import hashlib
import hmac
import os
import re
import secrets
import smtplib
import threading
from datetime import UTC, datetime, timedelta
from email.message import EmailMessage
from pathlib import Path

from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

from flask import (
    Flask,
    abort,
    flash,
    g,
    jsonify,
    redirect,
    render_template,
    request,
    send_file,
    send_from_directory,
    session,
    url_for,
)
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.utils import secure_filename

from site_config import get_site
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = Path(__file__).resolve().parent


def _load_dotenv(path):
    """Minimal .env loader (no dependency). Populates os.environ for values not
    already set, so local runs pick up DATABASE_URL/SECRET_KEY from .env while
    production keeps using systemd EnvironmentFile / real env vars."""
    try:
        for raw in Path(path).read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            os.environ.setdefault(key.strip(), val.strip())
    except FileNotFoundError:
        pass


_load_dotenv(BASE_DIR / ".env")

# APP_ENV=production is the canonical production switch (the systemd
# EnvironmentFile sets it). PRODUCTION=1 is still honoured for back-compat, so
# every prod behaviour — secure cookies, ProxyFix, and the unknown-host 404 in
# resolve_site_id — keys off the single IS_PRODUCTION flag below.
APP_ENV = os.environ.get("APP_ENV", "").strip().lower()
IS_PRODUCTION = (
    APP_ENV == "production"
    or os.environ.get("PRODUCTION", "").lower() in ("1", "true", "yes")
)
# Contact-form staff notifications. Default "console" just logs (no provider
# needed for dev); set CONTACT_EMAIL_MODE=smtp to deliver via SMTP. Tuned for
# Namecheap Private Email (mail.privateemail.com:587, STARTTLS, username = the
# full mailbox address). CONTACT_EMAIL_FROM/TO default to the authenticated
# mailbox — Private Email requires the From to be that mailbox — and each
# notification carries Reply-To: <buyer> so a staff reply reaches the buyer.
CONTACT_EMAIL_MODE = os.environ.get("CONTACT_EMAIL_MODE", "console").strip().lower()
SMTP_HOST = os.environ.get("SMTP_HOST", "").strip()
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587") or "587")
SMTP_USER = os.environ.get("SMTP_USER", "").strip()
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
CONTACT_EMAIL_FROM = os.environ.get("CONTACT_EMAIL_FROM", "").strip() or SMTP_USER
CONTACT_EMAIL_TO = os.environ.get("CONTACT_EMAIL_TO", "").strip() or SMTP_USER

# Supplier-portal bridge toggle. The site was originally a multi-supplier B2B
# marketplace that pulled live products from the Next.js portal. We are now a
# single-company, admin-curated catalogue, so the portal merge is OFF by
# default; set PORTAL_ENABLED=1 to re-enable the read-only bridge.
PORTAL_ENABLED = os.environ.get("PORTAL_ENABLED", "").strip().lower() in ("1", "true", "yes")

# Admin product-photo uploads. Files are stored OUTSIDE the code tree (so a
# redeploy/rsync never wipes them) and served same-origin at /media/<name>.
UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "").strip() or str(BASE_DIR / "uploads")
MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MB per image
ALLOWED_IMAGE_EXT = {"jpg", "jpeg", "png", "webp", "gif"}

ALLOWED_ORIGINS = {
    "https://fastflow.global",
    "https://www.fastflow.global",
    "https://portal.fastflow.global",
}

app = Flask(__name__, static_folder="static", static_url_path="/static")

# Behind nginx (TLS terminates there): trust one proxy hop's X-Forwarded-* so
# request.scheme is "https" and secure cookies/redirects work correctly.
if IS_PRODUCTION:
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

app.secret_key = os.environ.get("SECRET_KEY")
if not app.secret_key:
    if IS_PRODUCTION:
        raise RuntimeError("SECRET_KEY environment variable is required in production.")
    # Dev-only ephemeral key so sessions work locally without configuration.
    app.secret_key = secrets.token_hex(32)

app.config.update(
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    SESSION_COOKIE_SECURE=IS_PRODUCTION,
    PERMANENT_SESSION_LIFETIME=timedelta(days=7),
    # Cap total request body so a batch of product photos can't exhaust memory.
    MAX_CONTENT_LENGTH=40 * 1024 * 1024,
)

# 30 req/min default on all routes; auth + contact endpoints override to 10/min.
# Uses in-memory storage (per gunicorn worker). Switch storage_uri to a Redis URL
# for cross-process enforcement when running multiple workers.
limiter = Limiter(
    key_func=get_remote_address,
    app=app,
    default_limits=["30 per minute"],
    storage_uri="memory://",
)


@app.errorhandler(429)
def rate_limit_handler(e):
    # The public contact form is an HTML page, so give it a friendly banner on
    # the rendered page rather than raw JSON. API clients still get JSON.
    if request.path == "/contact":
        site = get_site(_site_slug())
        return render_template(
            "contact.html",
            active_page="contact",
            enquiry_categories=_enquiry_categories(site),
            csrf_token=session.get("csrf_token", ""),
            error="You've sent several messages in a short time. Please wait a "
                  "little while before sending another.",
        ), 429
    if request.path == "/login":
        return render_template(
            "login.html",
            error="Too many attempts. Please wait a minute and try again.",
            email=clean_str(request.form, "email"),
            csrf_token=session.get("csrf_token", ""),
        ), 429
    return jsonify({"error": "Too many requests. Please try again later."}), 429


# --- Database: shared Postgres pool + per-request tenant resolution ----------
DATABASE_URL = os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is required.")

# One pool for the process; dict_row so every fetched row is a dict (keyed
# access). Tenant isolation is enforced by Postgres RLS keyed on app.site_id,
# which open_db() sets per request from the request host.
pool = ConnectionPool(
    conninfo=DATABASE_URL,
    kwargs={"row_factory": dict_row},
    min_size=2,
    max_size=10,
    open=False,
)
pool.open()
# Close the pool cleanly at process exit so its worker threads aren't joined
# during interpreter finalization (which would raise a noisy shutdown warning).
import atexit  # noqa: E402
atexit.register(pool.close)

# host -> site_id, loaded once at startup from the global `sites` table.
_SITES = {}


def load_sites():
    _SITES.clear()
    with pool.connection() as conn:
        for row in conn.execute("SELECT host, id FROM sites WHERE is_active = 1"):
            _SITES[row["host"]] = row["id"]


def resolve_site_id(host):
    """Map a request host to a site_id. Unknown hosts are 404 in production; in
    dev they fall back to the primary site so localhost/127.0.0.1 work."""
    h = (host or "").split(":")[0].lower()
    if h.startswith("www."):
        h = h[4:]
    sid = _SITES.get(h)
    if sid is None and not IS_PRODUCTION:
        sid = _SITES.get("fastflow.global")
    return sid


# --- Supplier portal integration ---------------------------------------------
# The portal HTTP bridge (read-only JSON, best-effort, falls back to local data)
# lives in portal.py — self-contained, stdlib only, so it imports cleanly here.
import urllib.parse  # noqa: E402  (still used by product_detail_portal below)

from portal import (  # noqa: E402
    _portal_get,
    _portal_post,
    fetch_portal_products,
    fetch_portal_suppliers,
    portal_product_row,
)

# Category taxonomy: parent -> subcategories. Products store the subcategory
# name; filtering by the parent matches the parent itself plus all its subs.
# Mirrored in static/app.js (CATEGORY_TREE) for the category rail dropdown.
SITE_CATEGORY_GROUPS = {
    "fastflow": {
    "Construction Machinery": [
        "Excavator",
        "Forklift",
        "Mini Loader",
        "Mixer Truck",
        "Crawler Transporter",
    ],
    "Electric Bikes": [
        "Electric Bikes",
    ],
    "Motorbikes": [
        "Motorbikes",
    ],
    "Auto Spare Parts": [
        "Auto Spare Parts",
    ],
    "Moto Spare Parts": [
        "Moto Spare Parts",
    ],
    },
    # These categories are intentionally flat for launch. Subcategories can be
    # added later without changing the tenant or product schema.
    "tools": {
        "Metal Plate Processing Machinery": ["Metal Plate Processing Machinery"],
        "Industrial Equipment": ["Industrial Equipment"],
        "Electronic Components": ["Electronic Components"],
        "Hardware Tools": ["Hardware Tools"],
    },
}


def category_groups(site_slug=None):
    """Return the category tree for a site, defaulting to Fastflow's taxonomy."""
    return SITE_CATEGORY_GROUPS.get(site_slug or _site_slug(), SITE_CATEGORY_GROUPS["fastflow"])


def product_categories(site_slug=None):
    """The accepted product category values for the active site."""
    return [sub for subs in category_groups(site_slug).values() for sub in subs]

STATIC_CATEGORY_IMAGES = {
    "construction-machinery": "categories/construction_machinery.png",
    "electric-bikes": "categories/electric_bike.png",
    "motorbikes": "categories/motorbike.png",
    "auto-spare-parts": "categories/auto_parts.png",
    "moto-spare-parts": "categories/moto_spare_parts.png",
    "custom-sourcing": "categories/custom_sourcing.png",
}

SUBCATEGORY_BLURBS = {
    "Excavator": "Mini and compact excavators for construction and earthmoving.",
    "Forklift": "Electric and diesel forklifts for warehouse and industrial handling.",
    "Mini Loader": "Compact loaders for tight job sites and multi-attachment work.",
    "Mixer Truck": "Concrete mixer and self-loading mixer trucks for project delivery.",
    "Crawler Transporter": "Tracked transporters and crawler dumpers for rough terrain.",
}


def expand_category_filter(category):
    """Return the list of category names a filter value should match. A parent
    name (e.g. 'Vehicles') expands to its subcategories; a leaf name matches
    itself."""
    return [category, *category_groups().get(category, [])]


def _default_category_images():
    images = {}
    groups = category_groups()
    names = list(groups.keys())
    for subs in groups.values():
        names.extend(subs)
    names.append("Custom sourcing")

    for name in names:
        slug = _slugify(name)
        override = STATIC_CATEGORY_IMAGES.get(slug)
        if override and (BASE_DIR / "static" / override).exists():
            images[slug] = url_for("static", filename=override)
            continue
        candidates = []
        base = slug
        candidates.extend([base, base.replace("-", "_"), base.replace("-", " ")])
        # try title-case stems too because current folder uses spaces in names.
        spaced = " ".join(part.capitalize() for part in base.split("-"))
        candidates.append(spaced)
        for stem in candidates:
            for ext in ("png", "jpg", "jpeg", "webp", "gif"):
                rel = f"categories/{stem}.{ext}"
                if (BASE_DIR / "static" / rel).exists():
                    images[slug] = url_for("static", filename=rel)
                    break
            if slug in images:
                break
    return images


def _classify_construction_product(product):
    """Map legacy 'Construction Machinery' listings into the new public
    subcategories using product text, so old rows remain browsable until they
    are retagged in admin."""
    category = (product.get("category") or "").strip()
    construction_categories = category_groups().get("Construction Machinery", [])
    if category in construction_categories:
        return category
    if category != "Construction Machinery":
        return category
    text = " ".join([
        product.get("name") or "",
        product.get("description") or "",
        product.get("capacity") or "",
    ]).lower()
    if "excavator" in text or "digger" in text:
        return "Excavator"
    if "forklift" in text:
        return "Forklift"
    if ("mini loader" in text or "skid steer" in text
            or ("loader" in text and "wheel loader" not in text)):
        return "Mini Loader"
    if "mixer truck" in text or "concrete mixer" in text:
        return "Mixer Truck"
    if ("crawler transporter" in text or "crawler dumper" in text
            or "tracked transporter" in text):
        return "Crawler Transporter"
    return "Construction Machinery"


def _group_products_for_category(category_name, products):
    order = category_groups().get(category_name, [])
    if not order:
        return [{"name": category_name, "slug": _slugify(category_name), "products": products}]
    grouped = {name: [] for name in order}
    extras = []
    for product in products:
        if category_name == "Construction Machinery":
            bucket = _classify_construction_product(product)
        else:
            bucket = product.get("category") or category_name
        if bucket in grouped:
            grouped[bucket].append(product)
        else:
            extras.append(product)
    sections = [
        {"name": name, "slug": _slugify(name), "products": grouped[name]}
        for name in order
        if grouped[name]
    ]
    if extras:
        sections.append({
            "name": f"More {category_name}",
            "slug": _slugify(f"more-{category_name}"),
            "products": extras,
        })
    return sections


def _is_parent_category(name):
    subs = category_groups().get(name, [])
    # A parent category with one identical child behaves as a leaf.
    return len(subs) > 1


def _subcategory_counts(parent_name):
    subs = category_groups().get(parent_name, [])
    if not subs:
        return {}
    names = [*subs]
    if parent_name == "Construction Machinery":
        names.append(parent_name)
    placeholders = ", ".join(["%s"] * len(names))
    rows = get_db().execute(
        f"SELECT category, name, description, capacity FROM products "
        f"WHERE is_published = 1 AND category IN ({placeholders})",
        tuple(names),
    ).fetchall()
    counts = {sub: 0 for sub in subs}
    for row in rows:
        product = dict(row)
        bucket = (
            _classify_construction_product(product)
            if parent_name == "Construction Machinery"
            else product.get("category")
        )
        if bucket in counts:
            counts[bucket] += 1
    return counts


def _parent_subcategory_cards(parent_name):
    counts = _subcategory_counts(parent_name)
    images = _category_images()
    cards = []
    for sub in category_groups().get(parent_name, []):
        slug = _slugify(sub)
        cards.append({
            "name": sub,
            "slug": slug,
            "count": counts.get(sub, 0),
            "blurb": SUBCATEGORY_BLURBS.get(sub, ""),
            "image": images.get(slug, ""),
        })
    return cards


def clean_str(data, key, default=""):
    """Coerce a JSON field to a stripped string. Raw values are stored; the JS
    render layer calls escapeHtml() before inserting into the DOM."""
    value = data.get(key, default)
    if value is None:
        return default
    if not isinstance(value, str):
        value = str(value)
    return value.strip()

def utc_now():
    return datetime.now(UTC).isoformat()


def get_db():
    """The request-scoped pooled connection, opened by open_db() with the
    tenant's app.site_id already set."""
    return g.conn


def row_to_dict(row):
    # Rows are already dicts (dict_row); copy so callers can mutate freely.
    if not row:
        return None
    return dict(row)


# --- Translation helpers ------------------------------------------------------


# Internal language codes (en/zh/ru) → Google Translate codes. Google uses
# "zh-CN" for Simplified Chinese; the others match.
_GOOGLE_LANG = {"en": "en", "zh": "zh-CN", "ru": "ru"}


def _translate_free(text, target_lang):
    """Translate via deep-translator's free Google endpoint (no API key).
    Source language is auto-detected, so same-language text passes through.
    Returns the original text on any failure so callers never break."""
    if not text:
        return text
    google_target = _GOOGLE_LANG.get(target_lang)
    if not google_target:
        return text
    try:
        from deep_translator import GoogleTranslator  # lazy import
        result = GoogleTranslator(source="auto", target=google_target).translate(text)
        return result or text
    except Exception:
        return text


def _machine_translate(text, target_lang):
    """Primary translation entry point: free engine only. Used behind the SQLite
    cache so each string is only ever translated once."""
    return _translate_free(text, target_lang)


def _cache_key(text, target_lang):
    return hashlib.sha256(f"{text}|{target_lang}".encode()).hexdigest()


def get_cached_translation(text, target_lang, db):
    """Return cached translation string or None if not cached."""
    if not text:
        return None
    row = db.execute(
        "SELECT translated_text FROM translations_cache WHERE cache_key = %s",
        (_cache_key(text, target_lang),),
    ).fetchone()
    return row["translated_text"] if row else None


def _store_translation(text, target_lang, translated, db):
    db.execute(
        """
        INSERT INTO translations_cache
        (cache_key, source_text, target_lang, translated_text, created_at)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (cache_key) DO UPDATE SET
            source_text = EXCLUDED.source_text,
            target_lang = EXCLUDED.target_lang,
            translated_text = EXCLUDED.translated_text,
            created_at = EXCLUDED.created_at
        """,
        (_cache_key(text, target_lang), text, target_lang, translated, utc_now()),
    )


def translate_text_cached(text, target_lang):
    """Translate text with a Postgres-backed cache. Runs outside request context,
    so it borrows its own pooled connection. translations_cache is a global
    (non-RLS) table, so no app.site_id is needed."""
    if not text:
        return text
    with pool.connection() as db:
        cached = get_cached_translation(text, target_lang, db)
        if cached is not None:
            return cached
        translated = _machine_translate(text, target_lang)
        _store_translation(text, target_lang, translated, db)
        db.commit()
        return translated


def _bg_translate_texts(texts):
    """Pre-translate arbitrary user-facing strings to EN/ZH/RU and cache them.
    Runs in a daemon thread with its own pooled connection."""
    try:
        with pool.connection() as db:
            for lang in ("en", "zh", "ru"):
                for text in texts:
                    if text and get_cached_translation(text, lang, db) is None:
                        translated = _machine_translate(text, lang)
                        _store_translation(text, lang, translated, db)
            db.commit()
    except Exception:
        pass


def _bg_translate_product(name, description, category=""):
    """Pre-translate product name/description/category to EN/ZH/RU."""
    _bg_translate_texts([name, description, category])


def _notify_supplier_inquiry(product_id, supplier_id, inquiry_id):
    """Background supplier notification. Email delivery not yet configured
    (same console-mode pattern as SMS_PROVIDER=console in the portal).
    Replace this stub with an SMTP/SendGrid call when the provider is wired."""
    app.logger.info(
        "product_inquiry#%s on product#%s → notify supplier#%s",
        inquiry_id, product_id, supplier_id,
    )


def _send_inquiry_email(inquiry_id, name, email, category, company="", message="", site_slug="fastflow"):
    """Deliver the staff notification for a contact inquiry.

    In "console" mode (the default) this just logs — no provider needed for dev.
    In "smtp" mode it sends via CONTACT_EMAIL_* / SMTP_* using STARTTLS. The mail
    goes From the authenticated mailbox To the staff address, but Reply-To is the
    buyer, so replying from the inbox reaches the buyer, not the mailbox itself.

    Any exception propagates: callers (see _notify_contact_inquiry) treat a raise
    as "not delivered" and leave contact_inquiries.notified_at NULL, so a broken
    SMTP config can never lose the lead or surface an error to the visitor."""
    if CONTACT_EMAIL_MODE != "smtp":
        app.logger.info(
            "contact_inquiry#%s from %s <%s> (category=%s) → notify sales [console]",
            inquiry_id, name, email, category or "-",
        )
        return

    if not (SMTP_HOST and SMTP_USER and SMTP_PASSWORD and CONTACT_EMAIL_TO):
        raise RuntimeError(
            "CONTACT_EMAIL_MODE=smtp but SMTP_HOST/SMTP_USER/SMTP_PASSWORD/"
            "CONTACT_EMAIL_TO are not all set"
        )

    source_domain = get_site(site_slug)["domain"]
    msg = EmailMessage()
    msg["Subject"] = f"[{source_domain}] New enquiry #{inquiry_id}: {category or 'general'} — {name}"
    msg["From"] = CONTACT_EMAIL_FROM
    msg["To"] = CONTACT_EMAIL_TO
    msg["Reply-To"] = email
    msg.set_content(
        f"New contact-form enquiry (#{inquiry_id})\n"
        f"Source:   {source_domain}\n\n"
        f"Name:     {name}\n"
        f"Email:    {email}\n"
        f"Company:  {company or '-'}\n"
        f"Category: {category or '-'}\n\n"
        f"Message:\n{message or '-'}\n\n"
        f"Reply directly to this email to respond to the buyer."
    )
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as smtp:
        smtp.starttls()
        smtp.login(SMTP_USER, SMTP_PASSWORD)
        smtp.send_message(msg)
    app.logger.info(
        "contact_inquiry#%s emailed to %s (reply-to %s) [smtp]",
        inquiry_id, CONTACT_EMAIL_TO, email,
    )


def _notify_contact_inquiry(inquiry_id, site_id, name, email, category,
                            company="", message="", site_slug="fastflow"):
    """Background staff notification for a public contact-form inquiry. Attempts
    delivery, then stamps notified_at so pending/failed sends are distinguishable
    and retryable. Runs in its own daemon thread with its own pooled connection;
    contact_inquiries is RLS-scoped, so it sets app.site_id before the UPDATE.

    The inquiry row is already committed by the request before this runs, so a
    delivery failure only leaves notified_at NULL — it can never lose the lead
    or surface as an error to the visitor."""
    try:
        _send_inquiry_email(inquiry_id, name, email, category, company, message, site_slug)
    except Exception:
        app.logger.exception("contact inquiry notification failed for #%s", inquiry_id)
        return
    try:
        with pool.connection() as db:
            db.execute("SELECT set_config('app.site_id', %s, false)", (str(site_id),))
            db.execute("UPDATE contact_inquiries SET notified_at = %s WHERE id = %s",
                       (utc_now(), inquiry_id))
            db.commit()
    except Exception:
        app.logger.exception("marking contact_inquiry#%s notified failed", inquiry_id)


def _forward_lead_to_portal(payload):
    """Best-effort forward of a marketplace lead (contact form, product inquiry,
    RFQ) to the portal broker queue, so staff have a single inbox. Runs in a
    daemon thread and never blocks or fails the originating request — the local
    DB row remains the source of truth if the portal is unreachable.

    The visitor's IP is passed along so the portal rate-limits per client
    rather than lumping every forwarded lead under the server's own IP.
    Must be called from a request context (reads request.remote_addr)."""
    # Portal decommissioned for the admin-curated catalogue: leads live in the
    # local contact_inquiries table + email only. Re-enable with PORTAL_ENABLED.
    if not PORTAL_ENABLED:
        return
    client_ip = request.remote_addr or ""

    def _send():
        headers = {"X-Forwarded-For": client_ip} if client_ip else None
        status, _ = _portal_post("/api/public/inquiries", payload, headers=headers)
        if status != 201:
            app.logger.warning(
                "portal lead forward failed (kind=%s, status=%s)",
                payload.get("kind"), status,
            )
    threading.Thread(target=_send, daemon=True).start()


def _translated_category(name, target_lang, db):
    """Cached translation for a category name, falling back to the original."""
    if not target_lang or target_lang not in ("en", "zh", "ru"):
        return name
    return get_cached_translation(name, target_lang, db) or name


def _apply_translations(products, target_lang, db):
    """Overlay cached translations onto a list of product dicts. Mutates copies in-place."""
    if not target_lang or target_lang not in ("en", "zh", "ru"):
        return products
    result = []
    for p in products:
        t_name = get_cached_translation(p.get("name", ""), target_lang, db)
        t_desc = get_cached_translation(p.get("description", ""), target_lang, db)
        if t_name or t_desc:
            p = dict(p)
            if t_name:
                p["name"] = t_name
            if t_desc:
                p["description"] = t_desc
            p["translated"] = True
        else:
            p = dict(p)
            p["translated"] = False
        result.append(p)
    return result


def log_audit(action, entity_type, entity_id=None, details="", actor_id=None):
    db = get_db()
    if actor_id is None:
        user = get_current_user()
        actor_id = user["id"] if user else None
    db.execute(
        "INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, created_at) VALUES (%s, %s, %s, %s, %s, %s)",
        (actor_id, action, entity_type, entity_id, details, utc_now()),
    )


load_sites()


@app.before_request
def open_db():
    """Resolve the tenant from the request host and hand the request a pooled
    connection with app.site_id set, so RLS scopes every later query."""
    sid = resolve_site_id(request.host)
    if sid is None:
        abort(404)
    conn = pool.getconn()
    # SET cannot take a bind parameter; set_config can (site_id is a trusted int).
    conn.execute("SELECT set_config('app.site_id', %s, false)", (str(sid),))
    g.conn = conn
    g.site_id = sid


@app.teardown_request
def close_db(exc=None):
    conn = g.pop("conn", None)
    if conn is None:
        return
    try:
        if exc is not None or g.get("_db_rollback"):
            conn.rollback()
        else:
            conn.commit()
    finally:
        pool.putconn(conn)


def get_current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    row = get_db().execute("SELECT id, name, email, company, role FROM users WHERE id = %s", (user_id,)).fetchone()
    return row_to_dict(row)


def require_user():
    user = get_current_user()
    if not user:
        return None, (jsonify({"error": "Authentication required."}), 401)
    return user, None


# Fields that reveal supplier identity. We are a trading company: if a buyer
# learns which factory makes a product they can approach it directly and cut us
# out. So these are stripped from public API responses — not just for anonymous
# callers but for buyers too (buyers are the disintermediation threat). Only the
# vetted internal roles (supplier, admin) receive them. Columns are unchanged;
# this is a response-shaping guard, not a schema change.
_SUPPLIER_PRIVATE_FIELDS = (
    "supplier", "supplier_id", "location",
    "supplier_contact_email", "supplier_contact_phone", "supplier_since",
)


def _caller_sees_supplier():
    user = get_current_user()
    return bool(user and user["role"] in ("supplier", "admin"))


def _scrub_supplier_fields(item):
    """Drop supplier-identifying keys from a product/supplier dict, in place."""
    if item:
        for field in _SUPPLIER_PRIVATE_FIELDS:
            item.pop(field, None)
    return item


def _owns_product(user, product):
    """Return True when the user may mutate this product (IDOR guard).
    Ownership requires a numeric supplier_id match; the free-text company-name
    branch has been removed to prevent IDOR via shared company names."""
    if user["role"] == "admin":
        return True
    return product.get("supplier_id") == user["id"]


def quote_scope_clause(user):
    if user["role"] == "buyer":
        return "q.buyer_id = %s", (user["id"],)
    if user["role"] == "supplier":
        # Scope by the verified supplier identity link, never the company string.
        return "p.supplier_id = %s", (user["id"],)
    return "1 = 1", ()


def user_can_access_quote(user, quote):
    """A quote is accessible to the admin, the owning buyer, or the linked supplier."""
    if user["role"] == "admin":
        return True
    if user["id"] == quote["buyer_id"]:
        return True
    if user["role"] == "supplier" and quote["supplier_id"] == user["id"]:
        return True
    return False


SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


@app.before_request
def ensure_csrf_token():
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_hex(32)


@app.before_request
def verify_csrf_token():
    if request.method in SAFE_METHODS:
        return None
    if not request.path.startswith("/api/"):
        return None
    expected = session.get("csrf_token", "")
    provided = request.headers.get("X-CSRF-Token", "")
    if not expected or not provided or not hmac.compare_digest(expected, provided):
        return jsonify({"error": "CSRF token missing or invalid."}), 400
    return None


@app.after_request
def apply_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        # Google Fonts stylesheet + inline style attributes used across the SPA.
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' https: data:; "
        "media-src 'self' https:; "
        "connect-src 'self'; "
        # Product-video embeds (admin pastes a YouTube/Vimeo link).
        "frame-src https://www.youtube-nocookie.com https://player.vimeo.com; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    )
    if IS_PRODUCTION:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # Double-submit cookie: readable by JS so it can echo the token in a header.
    token = session.get("csrf_token")
    if token:
        response.set_cookie(
            "csrf_token",
            token,
            samesite="Lax",
            secure=IS_PRODUCTION,
            httponly=False,
        )
    return response


@app.errorhandler(Exception)
def handle_unexpected_error(error):
    from werkzeug.exceptions import HTTPException

    if isinstance(error, HTTPException):
        return error
    # Mark the request's connection for rollback; teardown_request returns it to
    # the pool. (The exception is handled here, so teardown won't see `exc`.)
    g._db_rollback = True
    app.logger.exception("Unhandled error: %s", error)
    return jsonify({"error": "An unexpected server error occurred."}), 500


# --- Server-rendered public site ---------------------------------------------
# Five pages at real URLs (Home / Products / About / Contact / FAQ) plus a
# per-category listing page and a product detail page. All site-specific text
# comes from site_config.py; nothing about the company is hardcoded here.

# request host -> site_config slug. RLS tenant resolution lives in open_db();
# this only picks which config dict to render with.
_HOST_SLUG = {
    "fastflow.global": "fastflow",
    "fastflow.asia": "asia",
    "fastflow.tools": "tools",
}


def _site_slug():
    host = (request.host or "").split(":")[0].lower()
    if host.startswith("www."):
        host = host[4:]
    return _HOST_SLUG.get(host, "fastflow")


@app.context_processor
def inject_site():
    """Make `site` config and `current_year` available in every template."""
    return {"site": get_site(_site_slug()), "current_year": datetime.now(UTC).year}


def _slugify(name):
    """'Construction machinery' -> 'construction-machinery'."""
    return re.sub(r"[^a-z0-9]+", "-", (name or "").lower()).strip("-")


def _category_counts():
    """{public_category_name: count} across the tenant's products. Counts are
    rolled up from subcategories into the parent tile (e.g. Excavator ->
    Construction Machinery). No site_id clause — RLS scopes it to the current
    site."""
    rows = get_db().execute(
        "SELECT category, COUNT(*) AS n FROM products "
        "WHERE is_published = 1 GROUP BY category"
    ).fetchall()
    groups = category_groups()
    counts = {}
    for row in rows:
        name = row["category"]
        count = row["n"]
        parent = next(
            (parent_name for parent_name, subs in groups.items() if name in subs),
            name,
        )
        counts[parent] = counts.get(parent, 0) + count
    return counts


def _category_images():
    """{slug: photo_url} for category tiles, from admin uploads (site_settings
    keys 'category_photo:<slug>'). One query, tolerant if the table is absent."""
    images = _default_category_images()
    try:
        rows = get_db().execute(
            "SELECT key, value FROM site_settings WHERE key LIKE 'category_photo:%'"
        ).fetchall()
    except Exception:
        return images
    for row in rows:
        if row["value"]:
            images[row["key"].split(":", 1)[1]] = row["value"]
    return images


def _categories_with_counts(site):
    """Merge the config category list (what to show — source of truth for
    display) with live DB counts (how many are listed). The trailing
    'Custom sourcing' entry is a CTA to the contact form, not a listing page."""
    counts = _category_counts()
    images = _category_images()
    out = []
    for name, blurb, moq, lead_time in site["categories"]:
        is_cta = name == "Custom sourcing"
        slug = _slugify(name)
        out.append({
            "name": name,
            "blurb": blurb,
            "moq": moq,
            "lead_time": lead_time,
            "slug": slug,
            "is_cta": is_cta,
            "count": 0 if is_cta else counts.get(name, 0),
            "image": images.get(slug, ""),
            "url": url_for("page_contact") if is_cta
                   else url_for("page_category", slug=slug),
        })
    return out


def _enquiry_categories(site):
    """Real category names + 'Other' for the contact-form dropdown, so it can
    never drift from the catalogue. Excludes the 'Custom sourcing' CTA tile."""
    names = [name for (name, *_rest) in site["categories"] if name != "Custom sourcing"]
    return names + ["Other"]


def _primary_image(db, product_id):
    """Best display image: primary product_media, else lowest sort_order, else
    the legacy products.image_url, else None."""
    row = db.execute(
        "SELECT url FROM product_media WHERE product_id = %s "
        "ORDER BY (type <> 'image'), is_primary DESC, sort_order ASC, id ASC LIMIT 1",
        (product_id,),
    ).fetchone()
    if row and row["url"]:
        return row["url"]
    legacy = db.execute(
        "SELECT image_url FROM products WHERE id = %s", (product_id,)
    ).fetchone()
    if legacy and legacy["image_url"]:
        return legacy["image_url"]
    return None


def _site_hero_image(site):
    """The tenant's uploaded hero photo, or its configured static fallback."""
    return get_setting(
        "hero_image",
        url_for("static", filename=site.get("hero_image", "hero.jpg")),
    )


@app.route("/")
def page_home():
    site = get_site(_site_slug())
    # Real team faces for the homepage "people behind your order" strip. Same
    # source as the About page; capped so the strip stays a single tidy row.
    db = get_db()
    team = db.execute(
        "SELECT name, role, bio, photo_url FROM team_members "
        "WHERE is_published = 1 AND photo_url <> '' "
        "ORDER BY sort_order, id LIMIT 6"
    ).fetchall()
    # Live count for the proof band. RLS scopes it to this site; no site_id clause.
    product_count = db.execute(
        "SELECT COUNT(*) AS n FROM products WHERE is_published = 1"
    ).fetchone()["n"]
    # Fill any None-valued metric (see site_config) with the real product count.
    metrics = [
        (str(product_count) if value is None else value, label)
        for value, label in site["metrics"]
    ]
    return render_template(
        "home.html", active_page="home",
        categories=_categories_with_counts(site),
        hero_image=_site_hero_image(site),
        about_image=get_setting("about_image"),
        team=[dict(t) for t in team],
        metrics=metrics,
    )


@app.route("/products")
def page_products():
    site = get_site(_site_slug())
    return render_template(
        "products.html", active_page="products",
        categories=_categories_with_counts(site),
    )


@app.route("/products/<slug>")
def page_category(slug):
    site = get_site(_site_slug())
    cat = next(
        (c for c in _categories_with_counts(site)
         if c["slug"] == slug and not c["is_cta"]),
        None,
    )
    if not cat:
        abort(404)
    if _is_parent_category(cat["name"]):
        subs = _parent_subcategory_cards(cat["name"])
        for sub in subs:
            sub["url"] = url_for("page_subcategory", slug=slug, subslug=sub["slug"])
        return render_template(
            "category.html", active_page="products",
            category=cat, products=[],
            subcategories=subs, is_subcategory_page=False,
        )
    db = get_db()
    names = expand_category_filter(cat["name"])
    placeholders = ", ".join(["%s"] * len(names))
    rows = db.execute(
        f"SELECT id, name, supplier, location, price, moq, lead_time, verified, "
        f"category, description, capacity FROM products "
        f"WHERE category IN ({placeholders}) AND is_published = 1 "
        f"ORDER BY verified DESC, name",
        tuple(names),
    ).fetchall()
    products = []
    for r in rows:
        p = dict(r)
        p["image"] = _primary_image(db, r["id"])
        products.append(p)
    sections = _group_products_for_category(cat["name"], products)
    return render_template(
        "category.html", active_page="products",
        category=cat, products=products, product_sections=sections,
        subcategories=[], is_subcategory_page=False,
    )


@app.route("/products/<slug>/<subslug>")
def page_subcategory(slug, subslug):
    site = get_site(_site_slug())
    cat = next(
        (c for c in _categories_with_counts(site)
         if c["slug"] == slug and not c["is_cta"]),
        None,
    )
    if not cat or not _is_parent_category(cat["name"]):
        abort(404)
    sub_name = next(
        (name for name in category_groups().get(cat["name"], [])
         if _slugify(name) == subslug),
        None,
    )
    if not sub_name:
        abort(404)

    db = get_db()
    if cat["name"] == "Construction Machinery":
        names = category_groups()["Construction Machinery"] + ["Construction Machinery"]
        placeholders = ", ".join(["%s"] * len(names))
        rows = db.execute(
            f"SELECT id, name, supplier, location, price, moq, lead_time, verified, "
            f"category, description, capacity FROM products "
            f"WHERE category IN ({placeholders}) AND is_published = 1 "
            f"ORDER BY verified DESC, name",
            tuple(names),
        ).fetchall()
        products = []
        for row in rows:
            p = dict(row)
            if _classify_construction_product(p) != sub_name:
                continue
            p["image"] = _primary_image(db, row["id"])
            products.append(p)
    else:
        rows = db.execute(
            "SELECT id, name, supplier, location, price, moq, lead_time, verified, "
            "category, description, capacity FROM products "
            "WHERE category = %s AND is_published = 1 "
            "ORDER BY verified DESC, name",
            (sub_name,),
        ).fetchall()
        products = []
        for row in rows:
            p = dict(row)
            p["image"] = _primary_image(db, row["id"])
            products.append(p)

    category_view = dict(cat)
    category_view["name"] = sub_name
    category_view["blurb"] = SUBCATEGORY_BLURBS.get(sub_name, cat.get("blurb", ""))
    category_view["slug"] = _slugify(sub_name)
    sections = _group_products_for_category(sub_name, products)
    return render_template(
        "category.html", active_page="products",
        category=category_view, products=products, product_sections=sections,
        subcategories=[], is_subcategory_page=True, parent_category=cat,
    )


@app.route("/product/<int:id>")
def page_product(id):
    db = get_db()
    row = db.execute("SELECT * FROM products WHERE id = %s", (id,)).fetchone()
    if not row:
        abort(404)
    # Unpublished products are invisible to the public; only an admin previewing
    # from the dashboard may open them.
    if not row["is_published"]:
        u = get_current_user()
        if not (u and u["role"] == "admin"):
            abort(404)
    product = dict(row)
    product["image"] = _primary_image(db, id)
    product["media"] = _get_media(db, id)
    spec_rows = db.execute(
        "SELECT label, value FROM product_specs WHERE product_id = %s ORDER BY sort_order ASC",
        (id,),
    ).fetchall()
    product["specs"] = [dict(s) for s in spec_rows]
    return render_template(
        "product.html", active_page="products",
        product=product, category_slug=_slugify(product["category"]),
    )


@app.route("/about")
def page_about():
    team = get_db().execute(
        "SELECT name, role, bio, photo_url FROM team_members "
        "WHERE is_published = 1 ORDER BY sort_order, id"
    ).fetchall()
    return render_template("about.html", active_page="about",
                           team=[dict(t) for t in team],
                           about_image=get_setting("about_image"))


@app.route("/faq")
def page_faq():
    return render_template("faq.html", active_page="faq")


@app.route("/contact", methods=["GET", "POST"])
@limiter.limit("5 per hour", methods=["POST"])
def page_contact():
    site = get_site(_site_slug())
    enquiry_categories = _enquiry_categories(site)
    ctx = {
        "active_page": "contact",
        "enquiry_categories": enquiry_categories,
        "csrf_token": session.get("csrf_token", ""),
    }
    if request.method == "POST":
        # Honeypot: bots fill the hidden "website" field; a legitimate browser
        # leaves it empty. Show the same success flow (PRG) but persist nothing,
        # so a bot can't tell it was dropped.
        if clean_str(request.form, "website"):
            session["contact_sent"] = True
            return redirect(url_for("page_contact"))

        # Same-session CSRF check. verify_csrf_token only guards /api/*, so this
        # public form POST is otherwise uncovered. The token rides in a hidden
        # form field (this is a full form POST, not a fetch with a header).
        expected = session.get("csrf_token", "")
        provided = request.form.get("csrf_token", "")
        if not expected or not hmac.compare_digest(expected, provided):
            return render_template(
                "contact.html",
                form={k: clean_str(request.form, k)
                      for k in ("name", "company", "email", "category", "message")},
                error="Your session expired. Please reload the page and try again.",
                **ctx,
            )

        form = {k: clean_str(request.form, k)
                for k in ("name", "company", "email", "category", "message")}
        if not form["name"] or not form["email"] or not form["message"]:
            error = "Please provide your name, email, and a short description of what you need."
        elif not _EMAIL_RE.match(form["email"]):
            error = "Please enter a valid email address."
        else:
            error = None
        if error:
            return render_template("contact.html", form=form, error=error, **ctx)

        db = get_db()
        inquiry_id = db.execute(
            """INSERT INTO contact_inquiries
               (name, email, company, category, message, created_at)
               VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
            (form["name"], form["email"].lower(), form["company"],
             form["category"], form["message"], utc_now()),
        ).fetchone()["id"]
        log_audit("created", "contact_inquiry", inquiry_id,
                  f"inquiry from {form['email'].lower()}", actor_id=None)
        db.commit()

        # Everything below is best-effort and off the critical path — the
        # committed row above is the only thing the visitor's success depends on.
        threading.Thread(
            target=_notify_contact_inquiry,
            args=(inquiry_id, resolve_site_id(request.host),
                  form["name"], form["email"].lower(), form["category"],
                  form["company"], form["message"], _site_slug()),
            daemon=True,
        ).start()

        _forward_lead_to_portal({
            "kind": "CONTACT",
            "message": form["message"][:3000],
            "contactName": form["name"][:120],
            "contactEmail": form["email"].lower(),
            "contactCompany": form["company"][:160],
        })

        # Post/Redirect/Get: redirect so a browser refresh re-issues the GET
        # (showing the thank-you) instead of re-POSTing and duplicating the row.
        session["contact_sent"] = True
        return redirect(url_for("page_contact"))

    sent = session.pop("contact_sent", False)
    return render_template("contact.html", sent=sent, **ctx)


@app.route("/admin/inquiries")
def admin_inquiries():
    """Server-rendered admin inbox for public contact-form leads. Its own page
    (not merged into /api/admin/inquiries, which serves product inquiries) since
    the two have different shapes. No login page exists yet, so logged-out users
    are sent home; a proper admin login is deferred to the cutover."""
    user = get_current_user()
    if not user:
        return redirect(url_for("page_home"))
    if user["role"] != "admin":
        abort(403)
    # No WHERE site_id — RLS scopes the read to the current tenant.
    rows = get_db().execute(
        """SELECT id, name, company, email, category, message, created_at, notified_at
           FROM contact_inquiries
           ORDER BY created_at DESC, id DESC
           LIMIT 100"""
    ).fetchall()
    inquiries = [row_to_dict(r) for r in rows]
    return render_template("admin_inquiries.html", inquiries=inquiries,
                           csrf_token=session.get("csrf_token", ""))


# --- Admin dashboard: product management (admin-only, server-rendered) --------

def _require_admin_page():
    """Gate for server-rendered admin pages. Returns (user, None) for an admin,
    else (None, response): a redirect to /login when logged out, or aborts 403
    when logged in without the admin role."""
    user = get_current_user()
    if not user:
        return None, redirect(url_for("page_login", next=request.path))
    if user["role"] != "admin":
        abort(403)
    return user, None


def _check_form_csrf():
    """Manual CSRF check for server-rendered admin form POSTs (the global
    verify_csrf_token only guards /api/*). Same hmac pattern as /login."""
    expected = session.get("csrf_token", "")
    provided = request.form.get("csrf_token", "")
    return bool(expected and hmac.compare_digest(expected, provided))


@app.route("/media/<path:filename>")
def media(filename):
    """Serve an admin-uploaded product photo from UPLOAD_DIR (kept outside the
    code tree so redeploys never wipe it). send_from_directory blocks traversal."""
    return send_from_directory(UPLOAD_DIR, filename)


def _save_uploaded_photos(db, product_id, files, now, start_order=0):
    """Validate + store uploaded image files under UPLOAD_DIR, one product_media
    row each. Skips files with a disallowed extension or over MAX_UPLOAD_BYTES.
    site_id is filled by the column default (current app.site_id) so RLS passes."""
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    saved = 0
    order = start_order
    for f in files:
        if not f or not f.filename:
            continue
        ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else ""
        if ext not in ALLOWED_IMAGE_EXT:
            continue
        data = f.read(MAX_UPLOAD_BYTES + 1)
        if not data or len(data) > MAX_UPLOAD_BYTES:
            continue
        base = secure_filename(f.filename) or f"photo.{ext}"
        fname = f"{secrets.token_hex(8)}-{base}"
        with open(os.path.join(UPLOAD_DIR, fname), "wb") as out:
            out.write(data)
        url = f"/media/{fname}"
        db.execute(
            "INSERT INTO product_media (product_id, type, url, thumb_url, sort_order, is_primary, created_at) "
            "VALUES (%s, 'image', %s, %s, %s, 0, %s)",
            (product_id, url, url, order, now),
        )
        saved += 1
        order += 1
    return saved


def _parse_video_embed(raw):
    """Turn a pasted YouTube or Vimeo URL into a privacy-friendly embed URL and a
    poster thumbnail. Returns {'url': embed_url, 'thumb_url': poster} or None if
    the link isn't a recognised YouTube/Vimeo video."""
    raw = (raw or "").strip()
    if not raw:
        return None
    m = re.search(
        r"(?:youtube\.com/(?:watch\?v=|embed/|shorts/|v/)|youtu\.be/)([A-Za-z0-9_-]{6,})",
        raw,
    )
    if m:
        vid = m.group(1)
        return {"url": f"https://www.youtube-nocookie.com/embed/{vid}",
                "thumb_url": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"}
    m = re.search(r"vimeo\.com/(?:video/)?(\d+)", raw)
    if m:
        vid = m.group(1)
        return {"url": f"https://player.vimeo.com/video/{vid}", "thumb_url": ""}
    return None


def _save_video_embeds(db, product_id, raw_text, now, start_order=0):
    """Store pasted YouTube/Vimeo links as product_media rows (type='embed').
    One URL per line; unrecognised lines are skipped."""
    saved = 0
    order = start_order
    for line in (raw_text or "").splitlines():
        embed = _parse_video_embed(line)
        if not embed:
            continue
        db.execute(
            "INSERT INTO product_media (product_id, type, url, thumb_url, sort_order, is_primary, created_at) "
            "VALUES (%s, 'embed', %s, %s, %s, 0, %s)",
            (product_id, embed["url"], embed["thumb_url"], order, now),
        )
        saved += 1
        order += 1
    return saved


def _delete_media_row(db, media_id, product_id):
    """Delete one product_media row and best-effort remove its file from disk."""
    row = db.execute(
        "SELECT url FROM product_media WHERE id = %s AND product_id = %s",
        (media_id, product_id),
    ).fetchone()
    if not row:
        return
    db.execute("DELETE FROM product_media WHERE id = %s AND product_id = %s",
               (media_id, product_id))
    url = row["url"] or ""
    if url.startswith("/media/"):
        fp = os.path.abspath(os.path.join(UPLOAD_DIR, url[len("/media/"):]))
        try:
            if os.path.commonpath([fp, os.path.abspath(UPLOAD_DIR)]) == os.path.abspath(UPLOAD_DIR):
                os.remove(fp)
        except OSError:
            pass


def _set_primary(db, product_id, media_id):
    db.execute("UPDATE product_media SET is_primary = 0 WHERE product_id = %s", (product_id,))
    db.execute("UPDATE product_media SET is_primary = 1 WHERE id = %s AND product_id = %s",
               (media_id, product_id))


def _ensure_primary(db, product_id):
    """Guarantee exactly one primary image if any media exists."""
    if db.execute("SELECT 1 FROM product_media WHERE product_id = %s AND is_primary = 1",
                  (product_id,)).fetchone():
        return
    first = db.execute(
        "SELECT id FROM product_media WHERE product_id = %s "
        "ORDER BY (type <> 'image'), sort_order, id LIMIT 1",
        (product_id,),
    ).fetchone()
    if first:
        db.execute("UPDATE product_media SET is_primary = 1 WHERE id = %s", (first["id"],))


def _admin_product_payload(form):
    """Validate the product fields shared by add + edit. Returns (fields, error)."""
    category = clean_str(form, "category")
    name = clean_str(form, "name")
    price = clean_str(form, "price")
    if category not in product_categories():
        return None, "Choose a valid category."
    if not name:
        return None, "Product name is required."
    if not price:
        return None, "Price is required (a figure or 'On request')."
    return {
        "category": category,
        "name": name,
        "price": price,
        "description": clean_str(form, "description") or name,
        "location": clean_str(form, "location") or "China",
        "moq": clean_str(form, "moq"),
        "lead_time": clean_str(form, "lead_time"),
        "capacity": clean_str(form, "capacity"),
        "certifications": clean_str(form, "certifications"),
        "verified": 1 if form.get("verified") else 0,
        "is_published": 1 if form.get("is_published") else 0,
    }, None


@app.route("/admin")
def admin_home():
    user, resp = _require_admin_page()
    if resp:
        return resp
    return redirect(url_for("admin_products"))


@app.route("/admin/products")
def admin_products():
    user, resp = _require_admin_page()
    if resp:
        return resp
    db = get_db()
    rows = db.execute(
        "SELECT id, name, category, price, verified, is_published, created_at "
        "FROM products ORDER BY is_published DESC, category, name"
    ).fetchall()
    products = []
    for r in rows:
        p = dict(r)
        p["image"] = _primary_image(db, r["id"])
        products.append(p)
    return render_template(
        "admin_products.html", products=products,
        csrf_token=session.get("csrf_token", ""),
    )


@app.route("/admin/products/new", methods=["GET", "POST"])
def admin_product_new():
    user, resp = _require_admin_page()
    if resp:
        return resp
    if request.method == "POST":
        if not _check_form_csrf():
            abort(400)
        fields, error = _admin_product_payload(request.form)
        if error:
            return render_template(
                "admin_product_form.html", mode="new", error=error,
                form=request.form, categories=category_groups(), media=[],
                csrf_token=session.get("csrf_token", "")), 400
        db = get_db()
        now = utc_now()
        pid = db.execute(
            "INSERT INTO products (category, name, supplier, supplier_id, location, "
            "description, price, moq, lead_time, capacity, certifications, image_url, "
            "verified, is_published, created_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (fields["category"], fields["name"], (user["company"] or "Fast Flow"),
             user["id"], fields["location"], fields["description"], fields["price"],
             fields["moq"], fields["lead_time"], fields["capacity"],
             fields["certifications"], "", fields["verified"], fields["is_published"], now),
        ).fetchone()["id"]
        n = _save_uploaded_photos(db, pid, request.files.getlist("photos"), now)
        _save_video_embeds(db, pid, request.form.get("video_links", ""), now, start_order=n)
        _ensure_primary(db, pid)
        log_audit("created", "product", pid, f"admin added {fields['name']}")
        db.commit()
        flash(f"Product “{fields['name']}” created.")
        return redirect(url_for("admin_products"))
    return render_template(
        "admin_product_form.html", mode="new", error=None, form={},
        categories=category_groups(), media=[],
        csrf_token=session.get("csrf_token", ""))


@app.route("/admin/products/<int:id>/edit", methods=["GET", "POST"])
def admin_product_edit(id):
    user, resp = _require_admin_page()
    if resp:
        return resp
    db = get_db()
    row = db.execute("SELECT * FROM products WHERE id = %s", (id,)).fetchone()
    if not row:
        abort(404)
    if request.method == "POST":
        if not _check_form_csrf():
            abort(400)
        fields, error = _admin_product_payload(request.form)
        if error:
            return render_template(
                "admin_product_form.html", mode="edit", product=dict(row), error=error,
                form=request.form, categories=category_groups(),
                media=_get_media(db, id), csrf_token=session.get("csrf_token", "")), 400
        now = utc_now()
        db.execute(
            "UPDATE products SET category=%s, name=%s, location=%s, description=%s, "
            "price=%s, moq=%s, lead_time=%s, capacity=%s, certifications=%s, "
            "verified=%s, is_published=%s WHERE id=%s",
            (fields["category"], fields["name"], fields["location"], fields["description"],
             fields["price"], fields["moq"], fields["lead_time"], fields["capacity"],
             fields["certifications"], fields["verified"], fields["is_published"], id),
        )
        for mid in request.form.getlist("delete_media"):
            if mid.isdigit():
                _delete_media_row(db, int(mid), id)
        nxt = db.execute(
            "SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM product_media WHERE product_id=%s",
            (id,)).fetchone()["n"]
        added = _save_uploaded_photos(db, id, request.files.getlist("photos"), now, start_order=nxt)
        _save_video_embeds(db, id, request.form.get("video_links", ""), now, start_order=nxt + added)
        primary = request.form.get("primary_media", "")
        if primary.isdigit():
            _set_primary(db, id, int(primary))
        _ensure_primary(db, id)
        log_audit("updated", "product", id, f"admin edited {fields['name']}")
        db.commit()
        flash(f"Product “{fields['name']}” saved.")
        return redirect(url_for("admin_products"))
    return render_template(
        "admin_product_form.html", mode="edit", product=dict(row), error=None,
        form=dict(row), categories=category_groups(), media=_get_media(db, id),
        csrf_token=session.get("csrf_token", ""))


@app.route("/admin/products/<int:id>/toggle", methods=["POST"])
def admin_product_toggle(id):
    user, resp = _require_admin_page()
    if resp:
        return resp
    if not _check_form_csrf():
        abort(400)
    db = get_db()
    row = db.execute("SELECT is_published FROM products WHERE id = %s", (id,)).fetchone()
    if not row:
        abort(404)
    new = 0 if row["is_published"] else 1
    db.execute("UPDATE products SET is_published = %s WHERE id = %s", (new, id))
    log_audit("published" if new else "unpublished", "product", id, "")
    db.commit()
    return redirect(url_for("admin_products"))


@app.route("/admin/products/<int:id>/delete", methods=["POST"])
def admin_product_delete(id):
    user, resp = _require_admin_page()
    if resp:
        return resp
    if not _check_form_csrf():
        abort(400)
    db = get_db()
    row = db.execute("SELECT name FROM products WHERE id = %s", (id,)).fetchone()
    if not row:
        abort(404)
    try:
        for m in _get_media(db, id):
            _delete_media_row(db, m["id"], id)
        db.execute("DELETE FROM product_specs WHERE product_id = %s", (id,))
        db.execute("DELETE FROM product_inquiries WHERE product_id = %s", (id,))
        db.execute("DELETE FROM products WHERE id = %s", (id,))
        log_audit("deleted", "product", id, f"admin deleted {row['name']}")
        db.commit()
        flash("Product deleted.")
    except Exception:
        db.rollback()
        flash("Couldn't delete — this product has linked quotes/inquiries. Hide it instead.", "error")
    return redirect(url_for("admin_products"))


# --- Admin dashboard: team members (About page, admin-only) -------------------

def _int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _remove_media_file(url):
    """Best-effort delete of an uploaded file behind a /media/<name> URL."""
    if not url or not url.startswith("/media/"):
        return
    fp = os.path.abspath(os.path.join(UPLOAD_DIR, url[len("/media/"):]))
    try:
        if os.path.commonpath([fp, os.path.abspath(UPLOAD_DIR)]) == os.path.abspath(UPLOAD_DIR):
            os.remove(fp)
    except OSError:
        pass


def _save_one_photo(files):
    """Save the first valid uploaded image and return its /media URL, else None."""
    for f in files:
        if not f or not f.filename:
            continue
        ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else ""
        if ext not in ALLOWED_IMAGE_EXT:
            continue
        data = f.read(MAX_UPLOAD_BYTES + 1)
        if not data or len(data) > MAX_UPLOAD_BYTES:
            continue
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        base = secure_filename(f.filename) or f"photo.{ext}"
        fname = f"{secrets.token_hex(8)}-{base}"
        with open(os.path.join(UPLOAD_DIR, fname), "wb") as out:
            out.write(data)
        return f"/media/{fname}"
    return None


@app.route("/admin/team")
def admin_team():
    user, resp = _require_admin_page()
    if resp:
        return resp
    rows = get_db().execute(
        "SELECT * FROM team_members ORDER BY sort_order, id"
    ).fetchall()
    return render_template("admin_team.html", members=[dict(r) for r in rows],
                           about_image=get_setting("about_image"),
                           hero_image=_site_hero_image(get_site(_site_slug())),
                           hero_image_override=get_setting("hero_image"),
                           csrf_token=session.get("csrf_token", ""))


@app.route("/admin/team/new", methods=["GET", "POST"])
def admin_team_new():
    user, resp = _require_admin_page()
    if resp:
        return resp
    if request.method == "POST":
        if not _check_form_csrf():
            abort(400)
        name = clean_str(request.form, "name")
        role = clean_str(request.form, "role")
        if not name or not role:
            return render_template(
                "admin_team_form.html", mode="new", error="Name and role are required.",
                form=request.form, csrf_token=session.get("csrf_token", "")), 400
        db = get_db()
        photo = _save_one_photo(request.files.getlist("photo")) or ""
        db.execute(
            "INSERT INTO team_members (name, role, bio, photo_url, sort_order, is_published, created_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (name, role, clean_str(request.form, "bio"), photo,
             _int(request.form.get("sort_order"), 0),
             1 if request.form.get("is_published") else 0, utc_now()),
        )
        db.commit()
        flash(f"Team member “{name}” added.")
        return redirect(url_for("admin_team"))
    return render_template("admin_team_form.html", mode="new", error=None, form={},
                           csrf_token=session.get("csrf_token", ""))


@app.route("/admin/team/<int:id>/edit", methods=["GET", "POST"])
def admin_team_edit(id):
    user, resp = _require_admin_page()
    if resp:
        return resp
    db = get_db()
    row = db.execute("SELECT * FROM team_members WHERE id = %s", (id,)).fetchone()
    if not row:
        abort(404)
    if request.method == "POST":
        if not _check_form_csrf():
            abort(400)
        name = clean_str(request.form, "name")
        role = clean_str(request.form, "role")
        if not name or not role:
            return render_template(
                "admin_team_form.html", mode="edit", error="Name and role are required.",
                form=request.form, mid=id, csrf_token=session.get("csrf_token", "")), 400
        photo_url = row["photo_url"]
        if request.form.get("delete_photo") and photo_url:
            _remove_media_file(photo_url)
            photo_url = ""
        new_photo = _save_one_photo(request.files.getlist("photo"))
        if new_photo:
            if photo_url:
                _remove_media_file(photo_url)
            photo_url = new_photo
        db.execute(
            "UPDATE team_members SET name=%s, role=%s, bio=%s, photo_url=%s, "
            "sort_order=%s, is_published=%s WHERE id=%s",
            (name, role, clean_str(request.form, "bio"), photo_url,
             _int(request.form.get("sort_order"), 0),
             1 if request.form.get("is_published") else 0, id),
        )
        db.commit()
        flash(f"Team member “{name}” saved.")
        return redirect(url_for("admin_team"))
    return render_template("admin_team_form.html", mode="edit", error=None,
                           form=dict(row), mid=id, csrf_token=session.get("csrf_token", ""))


@app.route("/admin/team/<int:id>/toggle", methods=["POST"])
def admin_team_toggle(id):
    user, resp = _require_admin_page()
    if resp:
        return resp
    if not _check_form_csrf():
        abort(400)
    db = get_db()
    row = db.execute("SELECT is_published FROM team_members WHERE id = %s", (id,)).fetchone()
    if not row:
        abort(404)
    db.execute("UPDATE team_members SET is_published = %s WHERE id = %s",
               (0 if row["is_published"] else 1, id))
    db.commit()
    return redirect(url_for("admin_team"))


@app.route("/admin/team/<int:id>/delete", methods=["POST"])
def admin_team_delete(id):
    user, resp = _require_admin_page()
    if resp:
        return resp
    if not _check_form_csrf():
        abort(400)
    db = get_db()
    row = db.execute("SELECT photo_url FROM team_members WHERE id = %s", (id,)).fetchone()
    if not row:
        abort(404)
    db.execute("DELETE FROM team_members WHERE id = %s", (id,))
    _remove_media_file(row["photo_url"])
    db.commit()
    flash("Team member removed.")
    return redirect(url_for("admin_team"))


# --- Per-site settings (admin-managed single values, e.g. About intro photo) --

def get_setting(key, default=""):
    row = get_db().execute(
        "SELECT value FROM site_settings WHERE key = %s", (key,)
    ).fetchone()
    return row["value"] if row and row["value"] else default


def set_setting(db, key, value):
    db.execute(
        "INSERT INTO site_settings (key, value) VALUES (%s, %s) "
        "ON CONFLICT (site_id, key) DO UPDATE SET value = EXCLUDED.value",
        (key, value),
    )


@app.route("/admin/about-image", methods=["POST"])
def admin_about_image():
    user, resp = _require_admin_page()
    if resp:
        return resp
    if not _check_form_csrf():
        abort(400)
    db = get_db()
    current = get_setting("about_image")
    if request.form.get("delete_photo") and current:
        _remove_media_file(current)
        set_setting(db, "about_image", "")
        db.commit()
        flash("About-page photo removed.")
        return redirect(url_for("admin_team"))
    new_photo = _save_one_photo(request.files.getlist("photo"))
    if new_photo:
        if current:
            _remove_media_file(current)
        set_setting(db, "about_image", new_photo)
        db.commit()
        flash("About-page photo updated.")
    else:
        flash("No image was uploaded (check the file type/size).", "error")
    return redirect(url_for("admin_team"))


@app.route("/admin/hero-image", methods=["POST"])
def admin_hero_image():
    """Set the current tenant's homepage hero image."""
    user, resp = _require_admin_page()
    if resp:
        return resp
    if not _check_form_csrf():
        abort(400)
    db = get_db()
    current = get_setting("hero_image")
    if request.form.get("delete_photo") and current:
        _remove_media_file(current)
        set_setting(db, "hero_image", "")
        db.commit()
        flash("Homepage hero photo removed. The default will be used.")
        return redirect(url_for("admin_team"))
    new_photo = _save_one_photo(request.files.getlist("photo"))
    if new_photo:
        if current:
            _remove_media_file(current)
        set_setting(db, "hero_image", new_photo)
        db.commit()
        flash("Homepage hero photo updated.")
    else:
        flash("No image was uploaded (check the file type/size).", "error")
    return redirect(url_for("admin_team"))


@app.route("/admin/categories")
def admin_categories():
    user, resp = _require_admin_page()
    if resp:
        return resp
    site = get_site(_site_slug())
    imgs = _category_images()
    cats = []
    for entry in site["categories"]:
        name = entry[0]
        slug = _slugify(name)
        cats.append({"name": name, "slug": slug, "image": imgs.get(slug, ""),
                     "is_cta": name == "Custom sourcing"})
    return render_template("admin_categories.html", cats=cats,
                           csrf_token=session.get("csrf_token", ""))


@app.route("/admin/category-image", methods=["POST"])
def admin_category_image():
    user, resp = _require_admin_page()
    if resp:
        return resp
    if not _check_form_csrf():
        abort(400)
    site = get_site(_site_slug())
    valid = {_slugify(entry[0]) for entry in site["categories"]}
    slug = clean_str(request.form, "slug")
    if slug not in valid:
        abort(400)
    db = get_db()
    key = f"category_photo:{slug}"
    current = get_setting(key)
    if request.form.get("delete_photo") and current:
        _remove_media_file(current)
        set_setting(db, key, "")
        db.commit()
        flash("Category photo removed.")
        return redirect(url_for("admin_categories"))
    new_photo = _save_one_photo(request.files.getlist("photo"))
    if new_photo:
        if current:
            _remove_media_file(current)
        set_setting(db, key, new_photo)
        db.commit()
        flash("Category photo updated.")
    else:
        flash("No image was uploaded (check the file type/size).", "error")
    return redirect(url_for("admin_categories"))


@app.route("/login", methods=["GET", "POST"])
@limiter.limit("5 per minute", methods=["POST"])
def page_login():
    """Minimal server-rendered login. Not linked from the public nav/footer —
    reached by direct URL, primarily to get an admin to /admin/inquiries. Brute
    force is throttled harder here than anywhere else on the site."""
    error = None
    email = ""
    if request.method == "POST":
        # verify_csrf_token() only guards /api/*, so this form POST checks the
        # hidden token itself — same pattern as /contact.
        expected = session.get("csrf_token", "")
        provided = request.form.get("csrf_token", "")
        if not expected or not hmac.compare_digest(expected, provided):
            return render_template(
                "login.html", error="Your session expired. Please try again.",
                email=clean_str(request.form, "email"),
                next=request.form.get("next", ""),
                csrf_token=session.get("csrf_token", ""),
            ), 400

        email = clean_str(request.form, "email")
        password = request.form.get("password", "")
        uid = _check_credentials(email, password)
        if uid is None:
            # One generic message for both unknown email and wrong password, so
            # an attacker can't enumerate which accounts exist.
            error = "Incorrect email or password."
        else:
            _login_user(uid)
            user = get_current_user()
            nxt = request.form.get("next", "")
            if nxt.startswith("/") and not nxt.startswith("//"):
                return redirect(nxt)
            if user and user["role"] == "admin":
                return redirect(url_for("admin_products"))
            return redirect(url_for("page_home"))

    return render_template("login.html", error=error, email=email,
                           next=request.args.get("next", ""),
                           csrf_token=session.get("csrf_token", ""))


@app.route("/logout", methods=["POST"])
def page_logout():
    # CSRF-checked (same pattern) so a session can't be force-terminated.
    expected = session.get("csrf_token", "")
    provided = request.form.get("csrf_token", "")
    if expected and hmac.compare_digest(expected, provided):
        session.pop("user_id", None)
    return redirect(url_for("page_home"))


@app.route("/api/auth/register", methods=["POST"])
@limiter.limit("10 per minute")
def register():
    data = request.get_json(silent=True) or {}
    name = clean_str(data, "name")
    email = clean_str(data, "email").lower()
    password = data.get("password", "")
    if not isinstance(password, str):
        password = ""
    company = clean_str(data, "company")
    role = clean_str(data, "role", "buyer")

    if not name or not email or not password or not company:
        return jsonify({"error": "All registration fields are required."}), 400
    if role not in ("buyer", "supplier"):
        role = "buyer"
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400

    db = get_db()
    if db.execute("SELECT id FROM users WHERE email = %s", (email,)).fetchone():
        return jsonify({"error": "Email is already registered."}), 400

    # Block claiming another supplier's company name — identity is what gates
    # access to that company's RFQs and verification record.
    if role == "supplier":
        taken = db.execute(
            "SELECT id FROM users WHERE LOWER(company) = LOWER(%s) AND role IN ('supplier', 'admin')",
            (company,),
        ).fetchone()
        if taken:
            return jsonify({"error": "This company is already registered. Contact support to join an existing supplier account."}), 400

    new_id = db.execute(
        "INSERT INTO users (name, email, password_hash, company, role, created_at) VALUES (%s, %s, %s, %s, %s, %s) RETURNING id",
        (name, email, generate_password_hash(password), company, role, utc_now()),
    ).fetchone()["id"]
    log_audit("registered", "user", new_id, f"{role} account created", new_id)
    db.commit()
    session.permanent = True
    session["user_id"] = new_id
    user = db.execute("SELECT id, name, email, company, role FROM users WHERE id = %s", (new_id,)).fetchone()
    return jsonify({"user": row_to_dict(user)})


def _check_credentials(email, password):
    """Single source of truth for password verification, shared by the JSON
    /api/auth/login endpoint and the server-rendered /login page. Returns the
    user id for valid credentials, else None. Broker-managed accounts have an
    empty hash and can never authenticate."""
    email = (email or "").strip().lower()
    if not isinstance(password, str) or not email or not password:
        return None
    row = get_db().execute(
        "SELECT id, password_hash FROM users WHERE email = %s", (email,)
    ).fetchone()
    if not row or not row["password_hash"] or not check_password_hash(row["password_hash"], password):
        return None
    return row["id"]


def _login_user(user_id):
    """Establish an authenticated session for user_id and audit it."""
    session.permanent = True
    session["user_id"] = user_id
    log_audit("logged_in", "user", user_id, "Session started", user_id)
    get_db().commit()


@app.route("/api/auth/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():
    data = request.get_json(silent=True) or {}
    email = clean_str(data, "email").lower()
    password = data.get("password", "")
    if not isinstance(password, str):
        password = ""

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    uid = _check_credentials(email, password)
    if uid is None:
        return jsonify({"error": "Invalid email or password."}), 401

    _login_user(uid)
    user = get_db().execute(
        "SELECT id, name, email, company, role FROM users WHERE id = %s", (uid,)
    ).fetchone()
    return jsonify({"user": row_to_dict(user)})


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.pop("user_id", None)
    return jsonify({"status": "logged_out"})


@app.route("/api/auth/me")
def current_user_compat():
    # Deprecated: duplicate of /api/me, kept as a compatibility alias. No caller
    # in this repo; retained until any external consumer is confirmed gone.
    user = get_current_user()
    return jsonify({"authenticated": user is not None, "user": user})


@app.route("/api/me")
def api_me():
    user = get_current_user()
    return jsonify({"authenticated": user is not None, "user": user})


@app.route("/api/translate", methods=["POST"])
@limiter.limit("15 per minute")
def api_translate():
    # Same-origin guard: only serve requests from our own domains (or dev).
    if IS_PRODUCTION:
        origin = request.headers.get("Origin", "")
        referer = request.headers.get("Referer", "")
        source = origin or referer
        if not any(source == o or source.startswith(o + "/") for o in ALLOWED_ORIGINS):
            return jsonify({"error": "Forbidden."}), 403

    data = request.get_json(silent=True) or {}
    text = (data.get("text") or "").strip()
    target_lang = (data.get("target_lang") or "en").strip()
    if not text:
        return jsonify({"error": "text is required."}), 400
    if target_lang not in ("en", "zh", "ru"):
        return jsonify({"error": "target_lang must be en, zh, or ru."}), 400
    if len(text) > 2000:
        return jsonify({"error": "text too long (max 2000 characters)."}), 400

    db = get_db()
    cached = get_cached_translation(text, target_lang, db)
    if cached is not None:
        return jsonify({"translated": cached, "cached": True})

    translated = _machine_translate(text, target_lang)
    _store_translation(text, target_lang, translated, db)
    db.commit()
    return jsonify({"translated": translated, "cached": False})


@app.route("/api/overview")
def overview():
    db = get_db()
    stats = {
        "products": db.execute("SELECT COUNT(*) AS n FROM products").fetchone()["n"],
        "verified_suppliers": db.execute("SELECT COUNT(*) AS n FROM supplier_verifications WHERE status = 'verified'").fetchone()["n"],
        "open_rfqs": db.execute("SELECT COUNT(*) AS n FROM quotes WHERE status != 'closed'").fetchone()["n"],
        "orders": db.execute("SELECT COUNT(*) AS n FROM orders").fetchone()["n"],
    }
    # Audit log and trust events are admin-only — they contain actor names and
    # internal operation details that must not be exposed to unauthenticated users.
    user = get_current_user()
    recent_audit = []
    trust_events = []
    if user and user["role"] == "admin":
        recent_audit = db.execute(
            """
            SELECT a.*, u.name AS actor_name
            FROM audit_logs a
            LEFT JOIN users u ON a.actor_id = u.id
            ORDER BY a.created_at DESC
            LIMIT 6
            """
        ).fetchall()
        trust_events = db.execute("SELECT * FROM trust_events ORDER BY created_at DESC LIMIT 4").fetchall()
    return jsonify({
        "stats": stats,
        "audit": [row_to_dict(row) for row in recent_audit],
        "trust_events": [row_to_dict(row) for row in trust_events],
    })


@app.route("/api/marketplace")
def marketplace():
    query = request.args.get("q", "").strip()
    category = request.args.get("category", "").strip()
    location = request.args.get("location", "").strip()
    verified_only = request.args.get("verified", "") == "1"
    lead_max_raw = request.args.get("lead_max", "").strip()
    lead_max = int(lead_max_raw) if lead_max_raw.isdigit() else None
    target_lang = request.args.get("target_lang", "").strip()
    if target_lang not in ("en", "zh", "ru"):
        target_lang = ""
    db = get_db()
    params = []
    filters = []
    if query:
        like = f"%{query}%"
        filters.append(
            """
            (name LIKE %s OR supplier LIKE %s OR category LIKE %s OR description LIKE %s
            OR location LIKE %s OR certifications LIKE %s)
            """
        )
        params.extend([like, like, like, like, like, like])
    if category:
        names = expand_category_filter(category)
        filters.append(f"category IN ({','.join(['%s'] * len(names))})")
        params.extend(names)
    if location:
        filters.append("location LIKE %s")
        params.append(f"%{location}%")
    if verified_only:
        filters.append("verified = 1")
    # Public callers only ever see published products; admins see everything.
    _u = get_current_user()
    if not (_u and _u["role"] == "admin"):
        filters.append("is_published = 1")
    where = f"WHERE {' AND '.join(filters)}" if filters else ""
    products = db.execute(f"SELECT * FROM products {where} ORDER BY verified DESC, category, name", params).fetchall()

    # Pull primary media URL for each product in one query.
    product_ids = [row["id"] for row in products]
    primary_media = {}
    if product_ids:
        placeholders = ",".join(["%s"] * len(product_ids))
        media_rows = db.execute(
            f"SELECT product_id, url FROM product_media WHERE product_id IN ({placeholders}) "
            f"AND is_primary = 1 ORDER BY sort_order ASC",
            product_ids,
        ).fetchall()
        for mr in media_rows:
            if mr["product_id"] not in primary_media:
                primary_media[mr["product_id"]] = mr["url"]

    def _passes_lead(item):
        # lead_time is free text ("21 days"); parse the leading integer.
        if lead_max is None:
            return True
        m = re.match(r"\s*(\d+)", str(item.get("lead_time") or ""))
        return m is not None and int(m.group(1)) <= lead_max

    categories = {}
    for row in products:
        product = row_to_dict(row)
        # Prefer product_media primary URL; fall back to legacy image_url.
        product["image_url"] = primary_media.get(product["id"]) or product.get("image_url", "")
        if not _passes_lead(product):
            continue
        categories.setdefault(product["category"], []).append(product)

    # Merge in live products published from the supplier portal (best-effort).
    # Disabled by default now the catalogue is admin-curated (PORTAL_ENABLED).
    for prow in (fetch_portal_products(query=query) if PORTAL_ENABLED else []):
        if category and prow["category"] not in expand_category_filter(category):
            continue
        if location and location.lower() not in (prow.get("location") or "").lower():
            continue
        if verified_only and not prow.get("verified"):
            continue
        if not _passes_lead(prow):
            continue
        categories.setdefault(prow["category"], []).append(prow)

    # Apply cached translations if target_lang was requested.
    if target_lang:
        categories = {
            name: _apply_translations(items, target_lang, db)
            for name, items in categories.items()
        }

    # Distinct locations (unfiltered) so the location filter is stable.
    loc_rows = db.execute(
        "SELECT DISTINCT location FROM products WHERE TRIM(COALESCE(location,'')) != '' ORDER BY location"
    ).fetchall()
    all_locations = [r["location"] for r in loc_rows]

    # Hide supplier identity (name/location/contact) from the public — only
    # vetted internal roles see it. Also drop the location facet for them.
    show_supplier = _caller_sees_supplier()
    return jsonify({
        "categories": [
            {
                "name": name,
                "display_name": _translated_category(name, target_lang, db),
                "items": items if show_supplier
                         else [_scrub_supplier_fields(i) for i in items],
            }
            for name, items in categories.items()
        ],
        "all_locations": all_locations if show_supplier else [],
    })


@app.route("/api/categories")
def categories():
    target_lang = request.args.get("target_lang", "").strip()
    if target_lang not in ("en", "zh", "ru"):
        target_lang = ""
    db = get_db()
    rows = db.execute(
        """
        SELECT category AS name, COUNT(*) AS product_count,
               SUM(CASE WHEN verified = 1 THEN 1 ELSE 0 END) AS verified_count
        FROM products
        WHERE is_published = 1
        GROUP BY category
        ORDER BY product_count DESC, category ASC
        """
    ).fetchall()
    cats = [row_to_dict(row) for row in rows]

    # Fold in portal product counts so portal-only categories show in the rail.
    by_name = {c["name"]: c for c in cats}
    for prow in (fetch_portal_products() if PORTAL_ENABLED else []):
        bucket = by_name.get(prow["category"])
        if bucket is None:
            bucket = {"name": prow["category"], "product_count": 0, "verified_count": 0}
            by_name[prow["category"]] = bucket
            cats.append(bucket)
        bucket["product_count"] = (bucket.get("product_count") or 0) + 1
        bucket["verified_count"] = (bucket.get("verified_count") or 0) + (1 if prow["verified"] else 0)

    cats.sort(key=lambda c: (-(c.get("product_count") or 0), c["name"]))
    for c in cats:
        c["display_name"] = _translated_category(c["name"], target_lang, db)
    return jsonify({"categories": cats})


@app.route("/api/my-products")
def my_products():
    user, error = require_user()
    if error:
        return error
    if user["role"] not in ("supplier", "admin"):
        return jsonify({"error": "Suppliers only."}), 403
    db = get_db()
    if user["role"] == "admin":
        rows = db.execute("SELECT * FROM products ORDER BY created_at DESC").fetchall()
    else:
        rows = db.execute(
            "SELECT * FROM products WHERE supplier_id = %s ORDER BY created_at DESC",
            (user["id"],),
        ).fetchall()
    return jsonify({"products": [row_to_dict(r) for r in rows]})


@app.route("/api/products/<int:product_id>", methods=["PATCH"])
def update_product(product_id):
    user, error = require_user()
    if error:
        return error
    if user["role"] not in ("supplier", "admin"):
        return jsonify({"error": "Suppliers only."}), 403
    db = get_db()
    row = db.execute("SELECT * FROM products WHERE id = %s", (product_id,)).fetchone()
    if not row:
        return jsonify({"error": "Product not found."}), 404
    product = row_to_dict(row)
    if user["role"] != "admin" and not _owns_product(user, product):
        return jsonify({"error": "Not your product."}), 403

    data = request.get_json(silent=True) or {}
    editable = ["category", "name", "location", "description", "price", "moq", "lead_time", "capacity", "certifications"]
    updates = {f: clean_str(data, f) for f in editable if data.get(f) is not None}

    media_list = data.get("media") if isinstance(data.get("media"), list) else None
    if not updates and media_list is None:
        return jsonify({"error": "No fields to update."}), 400

    if updates:
        set_clause = ", ".join(f"{f} = %s" for f in updates)
        db.execute(f"UPDATE products SET {set_clause} WHERE id = %s", [*updates.values(), product_id])
    if media_list is not None and len(media_list) <= _MAX_MEDIA:
        _save_media(db, product_id, media_list, utc_now())
    log_audit("updated", "product", product_id, f"{user['company']} updated {product.get('name')}")
    db.commit()
    return jsonify({"ok": True})


# ---- Specs limits -------------------------------------------------------
_MAX_SPECS           = 100
_MAX_SPEC_LABEL_LEN  = 200
_MAX_SPEC_VALUE_LEN  = 500

@app.route("/api/products/<int:product_id>/specs", methods=["PUT"])
@limiter.limit("20 per minute")
def save_product_specs(product_id):
    user, error = require_user()
    if error:
        return error

    db = get_db()
    row = db.execute("SELECT * FROM products WHERE id = %s", (product_id,)).fetchone()
    if not row:
        return jsonify({"error": "Product not found."}), 404
    product = row_to_dict(row)
    if not _owns_product(user, product):
        return jsonify({"error": "Not your product."}), 403

    data = request.get_json(silent=True) or {}
    specs = data.get("specs")
    if not isinstance(specs, list):
        return jsonify({"error": "specs must be an array."}), 400
    if len(specs) > _MAX_SPECS:
        return jsonify({"error": f"Too many specs (max {_MAX_SPECS})."}), 400

    validated = []
    for i, item in enumerate(specs):
        if not isinstance(item, dict):
            return jsonify({"error": f"specs[{i}] must be an object."}), 400
        # Validate on raw values, then escape.
        raw_label = str(item.get("label", "")).strip()
        raw_value = str(item.get("value", "")).strip()
        if not raw_label:
            return jsonify({"error": f"specs[{i}].label is required."}), 400
        if len(raw_label) > _MAX_SPEC_LABEL_LEN:
            return jsonify({"error": f"specs[{i}].label too long (max {_MAX_SPEC_LABEL_LEN})."}), 400
        if len(raw_value) > _MAX_SPEC_VALUE_LEN:
            return jsonify({"error": f"specs[{i}].value too long (max {_MAX_SPEC_VALUE_LEN})."}), 400
        validated.append({
            "label": raw_label,
            "value": raw_value,
            "sort_order": i,  # derived from array position, client value ignored
        })

    now = utc_now()
    # Transactional replace: delete-then-reinsert under the same implicit transaction.
    db.execute("DELETE FROM product_specs WHERE product_id = %s", (product_id,))
    saved = []
    for spec in validated:
        new_id = db.execute(
            "INSERT INTO product_specs (product_id, label, value, sort_order, created_at) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (product_id, spec["label"], spec["value"], spec["sort_order"], now),
        ).fetchone()["id"]
        saved.append({**spec, "id": new_id, "product_id": product_id})
    log_audit("updated", "product_specs", product_id,
              f"{len(saved)} specs saved by {user['company']}")
    db.commit()
    return jsonify({"specs": saved})


_MAX_MEDIA       = 20
_MAX_MEDIA_URL   = 2000
_ALLOWED_MEDIA_TYPES = {"image", "video"}


def _get_media(db, product_id):
    # Default order (2.6): the primary (clearest full-product shot) leads, then
    # the supplier's explicit sort_order. Full semantic ordering — scale/dim ref
    # -> detail -> context -> certs — needs a per-media `role` field suppliers
    # would set in the portal; not captured yet (see ledger 2.6, BLOCKED).
    rows = db.execute(
        "SELECT id, type, url, thumb_url, alt_text, sort_order, is_primary FROM product_media "
        "WHERE product_id = %s ORDER BY is_primary DESC, sort_order ASC, id ASC",
        (product_id,),
    ).fetchall()
    return [dict(r) for r in rows]


def _save_media(db, product_id, media_list, now):
    """Replace all media for a product. Returns the saved rows."""
    db.execute("DELETE FROM product_media WHERE product_id = %s", (product_id,))
    saved = []
    has_primary = False
    for i, item in enumerate(media_list):
        kind = str(item.get("type", "image")).strip().lower()
        if kind not in _ALLOWED_MEDIA_TYPES:
            kind = "image"
        url = str(item.get("url", "")).strip()
        if not url:
            continue
        if len(url) > _MAX_MEDIA_URL:
            continue
        thumb = str(item.get("thumb_url", url)).strip() or url
        alt = str(item.get("alt_text", "")).strip()[:_MAX_MEDIA_URL]
        is_primary = 1 if (item.get("is_primary") and not has_primary) else 0
        if is_primary:
            has_primary = True
        new_id = db.execute(
            "INSERT INTO product_media (product_id, type, url, thumb_url, alt_text, sort_order, is_primary, created_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
            (product_id, kind, url, thumb, alt, i, is_primary, now),
        ).fetchone()["id"]
        saved.append({"id": new_id, "product_id": product_id, "type": kind,
                      "url": url, "thumb_url": thumb, "alt_text": alt, "sort_order": i, "is_primary": is_primary})
    # If caller sent rows but none were marked primary, promote first one.
    if saved and not has_primary:
        db.execute("UPDATE product_media SET is_primary=1 WHERE id=%s", (saved[0]["id"],))
        saved[0]["is_primary"] = 1
    return saved


@app.route("/api/products/<int:product_id>/media", methods=["PUT"])
@limiter.limit("20 per minute")
def save_product_media(product_id):
    user, error = require_user()
    if error:
        return error
    db = get_db()
    row = db.execute("SELECT * FROM products WHERE id = %s", (product_id,)).fetchone()
    if not row:
        return jsonify({"error": "Product not found."}), 404
    if not _owns_product(user, row_to_dict(row)):
        return jsonify({"error": "Not your product."}), 403

    data = request.get_json(silent=True) or {}
    media_list = data.get("media")
    if not isinstance(media_list, list):
        return jsonify({"error": "media must be an array."}), 400
    if len(media_list) > _MAX_MEDIA:
        return jsonify({"error": f"Too many media items (max {_MAX_MEDIA})."}), 400

    now = utc_now()
    saved = _save_media(db, product_id, media_list, now)
    log_audit("updated", "product_media", product_id,
              f"{len(saved)} media rows saved by {user['company']}")
    db.commit()
    return jsonify({"media": saved})


# ---- Inquiry validation constants ---------------------------------------
_EMAIL_RE        = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_QUANTITY_RE     = re.compile(r"^[\d,.\s]+$")
_MIN_MSG_LEN     = 20
_MAX_MSG_LEN     = 4000
_MAX_NAME_LEN    = 200
_MAX_COMPANY_LEN = 200
_MAX_QTY_LEN     = 100

@app.route("/api/products/<int:product_id>/inquiry", methods=["POST"])
@limiter.limit("5 per hour")
def product_inquiry(product_id):
    db = get_db()
    row = db.execute("SELECT id, name, supplier_id FROM products WHERE id = %s", (product_id,)).fetchone()
    if not row:
        return jsonify({"error": "Product not found."}), 404
    product = row_to_dict(row)

    data = request.get_json(silent=True) or {}

    # Honeypot: bots fill the hidden "website" field; legitimate forms leave it empty.
    if data.get("website", ""):
        return jsonify({"status": "success"}), 200

    # Extract and validate on raw strings before sanitizing.
    raw_name     = str(data.get("name",     "")).strip()
    raw_email    = str(data.get("email",    "")).strip().lower()
    raw_company  = str(data.get("company",  "")).strip()
    raw_quantity = str(data.get("quantity", "")).strip()
    raw_message  = str(data.get("message",  "")).strip()

    errors = {}
    if not raw_name or len(raw_name) > _MAX_NAME_LEN:
        errors["name"] = "Required (max 200 characters)."
    if not raw_email or not _EMAIL_RE.match(raw_email):
        errors["email"] = "Valid email address required."
    if len(raw_company) > _MAX_COMPANY_LEN:
        errors["company"] = f"Max {_MAX_COMPANY_LEN} characters."
    if raw_quantity and len(raw_quantity) > _MAX_QTY_LEN:
        errors["quantity"] = f"Max {_MAX_QTY_LEN} characters."
    if raw_quantity and not _QUANTITY_RE.match(raw_quantity):
        errors["quantity"] = "Quantity must be numeric."
    if len(raw_message) < _MIN_MSG_LEN:
        errors["message"] = f"Message must be at least {_MIN_MSG_LEN} characters."
    if len(raw_message) > _MAX_MSG_LEN:
        errors["message"] = f"Message must be {_MAX_MSG_LEN} characters or fewer."
    if errors:
        return jsonify({"error": "Validation failed.", "fields": errors}), 400

    name     = raw_name
    email    = raw_email
    company  = raw_company
    quantity = raw_quantity
    message  = raw_message

    inquiry_id = db.execute(
        """INSERT INTO product_inquiries
           (product_id, supplier_id, name, email, company, quantity, message, created_at)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id""",
        (product_id, product.get("supplier_id"), name, email, company, quantity, message, utc_now()),
    ).fetchone()["id"]
    log_audit("created", "product_inquiry", product_id,
              f"inquiry from {email}", actor_id=None)
    db.commit()

    if product.get("supplier_id"):
        threading.Thread(
            target=_notify_supplier_inquiry,
            args=(product_id, product["supplier_id"], inquiry_id),
            daemon=True,
        ).start()

    _forward_lead_to_portal({
        "kind": "PRODUCT",
        "productNeeded": (product.get("name") or "")[:200],
        "quantity": quantity[:120],
        "message": message[:3000],
        "contactName": name[:120],
        "contactEmail": email,
        "contactCompany": company[:160],
    })

    return jsonify({"status": "success"}), 200


@app.route("/api/products/<int:product_id>")
def product_detail(product_id):
    db = get_db()
    row = db.execute("SELECT * FROM products WHERE id = %s", (product_id,)).fetchone()
    if not row:
        return jsonify({"error": "Product not found."}), 404
    product = row_to_dict(row)
    spec_rows = db.execute(
        "SELECT label, value FROM product_specs WHERE product_id = %s ORDER BY sort_order ASC",
        (product_id,),
    ).fetchall()
    product["specs"] = [{"label": r["label"], "value": r["value"]} for r in spec_rows]
    product["media"] = _get_media(db, product_id)
    # Public contact info of the owning manufacturer (broker-managed registry).
    product["supplier_contact_email"] = ""
    product["supplier_contact_phone"] = ""
    # Trust signals (3.4). Only real data — supplier_since is the platform
    # membership year (NOT company age); response_rate is not tracked, so it is
    # deliberately omitted and the UI shows a "not yet rated" slot.
    product["supplier_since"] = ""
    if product.get("supplier_id"):
        owner = db.execute(
            "SELECT contact_email, contact_phone, created_at FROM users WHERE id = %s",
            (product["supplier_id"],),
        ).fetchone()
        if owner:
            product["supplier_contact_email"] = owner["contact_email"] or ""
            product["supplier_contact_phone"] = owner["contact_phone"] or ""
            created = owner["created_at"] or ""
            product["supplier_since"] = created[:4] if len(created) >= 4 and created[:4].isdigit() else ""
    if not _caller_sees_supplier():
        _scrub_supplier_fields(product)
    return jsonify({"product": product})


@app.route("/api/products/<product_id>")
def product_detail_portal(product_id):
    # Non-numeric ids (the <int:> route handles numeric SQLite ids) come from the
    # portal bridge, e.g. "portal-<cuid>".
    if not product_id.startswith("portal-"):
        return jsonify({"error": "Product not found."}), 404
    data = _portal_get(f"/api/public/products/{urllib.parse.quote(product_id[len('portal-'):])}")
    if not data or not data.get("product"):
        return jsonify({"error": "Product not found."}), 404
    product = portal_product_row(data["product"])
    if not _caller_sees_supplier():
        _scrub_supplier_fields(product)
    return jsonify({"product": product})


@app.route("/api/suppliers")
def suppliers():
    # This endpoint is a supplier directory (company names + locations) — it must
    # never be public for a trading company. Only vetted internal roles see it.
    if not _caller_sees_supplier():
        return jsonify({"suppliers": []})
    query = request.args.get("q", "").strip()
    params = []
    where = ""
    if query:
        like = f"%{query}%"
        where = "WHERE p.supplier LIKE %s OR p.location LIKE %s OR p.certifications LIKE %s"
        params = [like, like, like]
    rows = get_db().execute(
        f"""
        SELECT p.supplier AS company,
               MIN(p.location) AS location,
               COUNT(p.id) AS product_count,
               MAX(p.verified) AS verified,
               string_agg(DISTINCT p.category, ',') AS categories,
               string_agg(DISTINCT p.certifications, ',') AS certifications,
               COALESCE(v.status, 'not_started') AS verification_status
        FROM products p
        LEFT JOIN supplier_verifications v ON v.supplier_company = p.supplier
        {where}
        GROUP BY p.supplier, v.status
        ORDER BY verified DESC, product_count DESC, p.supplier ASC
        """,
        params,
    ).fetchall()
    suppliers = [row_to_dict(row) for row in rows]
    suppliers.extend(fetch_portal_suppliers(query=query))  # live portal suppliers
    return jsonify({"suppliers": suppliers})


@app.route("/api/products", methods=["POST"])
def create_product():
    user, error = require_user()
    if error:
        return error
    if user["role"] not in ("supplier", "admin"):
        return jsonify({"error": "Only suppliers can add product capabilities."}), 403

    data = request.get_json(silent=True) or {}
    required = ["category", "name", "location", "description", "price", "moq", "lead_time"]
    invalid = [field for field in required if data.get(field) is not None and not isinstance(data.get(field), str)]
    if invalid:
        return jsonify({"error": "Product fields must be text.", "invalid": invalid}), 400
    fields = {field: clean_str(data, field) for field in required}
    missing = [field for field in required if not fields[field]]
    if missing:
        return jsonify({"error": "Missing product fields.", "missing": missing}), 400

    db = get_db()
    if user["role"] == "admin":
        # Admins list products on behalf of registered manufacturers — the product
        # must be pinned to a registry entry, not to the admin's own account.
        supplier_id = data.get("supplier_id")
        if not isinstance(supplier_id, int):
            return jsonify({"error": "Pick the manufacturer this product belongs to."}), 400
        owner = db.execute(
            "SELECT id, company FROM users WHERE id = %s AND role = 'supplier'",
            (supplier_id,),
        ).fetchone()
        if not owner:
            return jsonify({"error": "Unknown manufacturer. Register the company first."}), 400
        supplier = owner["company"]
        owner_id = owner["id"]
    else:
        supplier = user["company"]
        owner_id = user["id"]
    product_id = db.execute(
        """
        INSERT INTO products
        (category, name, supplier, supplier_id, location, description, price, moq, lead_time, capacity, certifications, image_url, verified, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
        """,
        (
            fields["category"],
            fields["name"],
            supplier,
            owner_id,
            fields["location"],
            fields["description"],
            fields["price"],
            fields["moq"],
            fields["lead_time"],
            clean_str(data, "capacity"),
            clean_str(data, "certifications"),
            clean_str(data, "image_url"),
            0,
            utc_now(),
        ),
    ).fetchone()["id"]
    log_audit("created", "product", product_id, f"{supplier} listed {fields['name']}")

    # Persist media rows if provided; otherwise fall back to legacy image_url field.
    media_list = data.get("media") if isinstance(data.get("media"), list) else None
    if media_list is not None and len(media_list) <= _MAX_MEDIA:
        _save_media(db, product_id, media_list, utc_now())
    elif clean_str(data, "image_url"):
        db.execute(
            "INSERT INTO product_media (product_id, type, url, thumb_url, sort_order, is_primary, created_at) "
            "VALUES (%s, 'image', %s, %s, 0, 1, %s)",
            (product_id, clean_str(data, "image_url"), clean_str(data, "image_url"), utc_now()),
        )

    db.commit()

    # Pre-translate name + description + category to all 3 languages in the
    # background (free engine) so marketplace requests with ?target_lang= get
    # instant cache hits.
    threading.Thread(
        target=_bg_translate_product,
        args=(fields["name"], fields["description"], fields["category"]),
        daemon=True,
    ).start()

    return jsonify({"product_id": product_id})


@app.route("/api/quotes", methods=["GET", "POST"])
def quotes():
    user, error = require_user()
    if error:
        return error

    db = get_db()
    if request.method == "POST":
        if user["role"] != "buyer":
            return jsonify({"error": "Only buyers can request quotes."}), 403

        data = request.get_json(silent=True) or {}
        product_id = data.get("product_id")
        quantity = clean_str(data, "quantity")
        notes = clean_str(data, "notes")
        target_price = clean_str(data, "target_price")
        destination = clean_str(data, "destination")

        if not product_id or not quantity:
            return jsonify({"error": "Product and quantity are required."}), 400

        product = db.execute("SELECT id, name, supplier FROM products WHERE id = %s", (product_id,)).fetchone()
        if not product:
            return jsonify({"error": "Product not found."}), 404

        quote_id = db.execute(
            """
            INSERT INTO quotes (buyer_id, product_id, quantity, notes, target_price, destination, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id
            """,
            (user["id"], product_id, quantity, notes, target_price, destination, utc_now()),
        ).fetchone()["id"]
        db.execute(
            "INSERT INTO messages (quote_id, sender_id, body, created_at) VALUES (%s, %s, %s, %s)",
            (quote_id, user["id"], f"RFQ opened. Quantity: {quantity}. {notes}".strip(), utc_now()),
        )
        log_audit("created", "rfq", quote_id, f"RFQ sent to {product['supplier']}")
        db.commit()

        details = [f"Marketplace RFQ #{quote_id} for \"{product['name']}\" (supplier: {product['supplier']})."]
        if target_price:
            details.append(f"Target price: {target_price}.")
        if destination:
            details.append(f"Destination: {destination}.")
        if notes:
            details.append(notes)
        _forward_lead_to_portal({
            "kind": "RFQ",
            "productNeeded": (product["name"] or "")[:200],
            "quantity": quantity[:120],
            "message": " ".join(details)[:3000],
            "contactName": (user.get("name") or "")[:120],
            "contactEmail": user.get("email") or "",
            "contactCompany": (user.get("company") or "")[:160],
        })

        quote = db.execute("SELECT * FROM quotes WHERE id = %s", (quote_id,)).fetchone()
        return jsonify({"quote": row_to_dict(quote)})

    clause, params = quote_scope_clause(user)
    rows = db.execute(
        f"""
        SELECT q.*, p.name AS product_name, p.supplier AS product_supplier, p.location AS product_location,
               p.price AS product_price, u.name AS buyer_name, u.company AS buyer_company
        FROM quotes q
        JOIN products p ON q.product_id = p.id
        JOIN users u ON q.buyer_id = u.id
        WHERE {clause}
        ORDER BY q.created_at DESC
        """,
        params,
    ).fetchall()
    return jsonify({"quotes": [row_to_dict(row) for row in rows]})


@app.route("/api/quotes/<int:quote_id>/status", methods=["PATCH"])
def update_quote_status(quote_id):
    user, error = require_user()
    if error:
        return error
    data = request.get_json(silent=True) or {}
    status = clean_str(data, "status")
    allowed = {"requested", "reviewing", "quoted", "sample_requested", "accepted", "closed"}
    if status not in allowed:
        return jsonify({"error": "Invalid quote status."}), 400

    db = get_db()
    quote = db.execute(
        """
        SELECT q.*, p.supplier, p.supplier_id FROM quotes q
        JOIN products p ON q.product_id = p.id
        WHERE q.id = %s
        """,
        (quote_id,),
    ).fetchone()
    if not quote:
        return jsonify({"error": "Quote not found."}), 404
    if not user_can_access_quote(user, quote):
        return jsonify({"error": "You cannot update this quote."}), 403

    # Role-gated transitions. Suppliers drive the negotiation states (reviewing/
    # quoted); the buyer accepts a quote. Without this, a buyer could unilaterally
    # mark their own RFQ "accepted" and open an order + escrow with no supplier.
    if user["role"] != "admin":
        supplier_statuses = {"reviewing", "quoted", "sample_requested", "closed"}
        buyer_statuses = {"accepted", "sample_requested", "closed"}
        if user["role"] == "supplier" and status not in supplier_statuses:
            return jsonify({"error": "Suppliers cannot set that status."}), 403
        if user["role"] == "buyer":
            if status not in buyer_statuses:
                return jsonify({"error": "Buyers cannot set that status."}), 403
            # A buyer may only accept a quote the supplier has actually quoted.
            if status == "accepted" and quote["status"] != "quoted":
                return jsonify({"error": "This RFQ has not been quoted yet."}), 400

    db.execute("UPDATE quotes SET status = %s WHERE id = %s", (status, quote_id))
    db.execute(
        "INSERT INTO messages (quote_id, sender_id, body, created_at) VALUES (%s, %s, %s, %s)",
        (quote_id, user["id"], f"Status changed to {status}.", utc_now()),
    )
    log_audit("updated_status", "rfq", quote_id, status)
    db.commit()
    return jsonify({"status": status})


@app.route("/api/orders", methods=["GET", "POST"])
def orders():
    user, error = require_user()
    if error:
        return error
    db = get_db()
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        quote_id = data.get("quote_id")
        quote = db.execute(
            """
            SELECT q.*, p.supplier, p.supplier_id FROM quotes q
            JOIN products p ON q.product_id = p.id
            WHERE q.id = %s
            """,
            (quote_id,),
        ).fetchone()
        if not quote:
            return jsonify({"error": "Quote not found."}), 404
        if not user_can_access_quote(user, quote):
            return jsonify({"error": "You cannot create an order for this RFQ."}), 403
        if quote["status"] != "accepted":
            return jsonify({"error": "The RFQ must be accepted before an order can be created."}), 400
        if db.execute("SELECT id FROM orders WHERE quote_id = %s", (quote_id,)).fetchone():
            return jsonify({"error": "An order already exists for this RFQ."}), 400
        order_id = db.execute(
            "INSERT INTO orders (quote_id, incoterm, payment_status, inspection_status, created_at) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (
                quote_id,
                clean_str(data, "incoterm", "FOB") or "FOB",
                "escrow_pending",
                "not_scheduled",
                utc_now(),
            ),
        ).fetchone()["id"]
        db.execute(
            "INSERT INTO trust_events (quote_id, provider, event_type, status, amount, created_at) VALUES (%s, %s, %s, %s, %s, %s)",
            (quote_id, "provider_abstraction", "escrow_intent", "created", clean_str(data, "amount"), utc_now()),
        )
        log_audit("created", "order", order_id, "Order and escrow intent created")
        db.commit()
        return jsonify({"order_id": order_id})

    clause, params = quote_scope_clause(user)
    rows = db.execute(
        f"""
        SELECT o.*, q.quantity, q.status AS quote_status, p.name AS product_name, p.supplier,
               u.company AS buyer_company
        FROM orders o
        JOIN quotes q ON o.quote_id = q.id
        JOIN products p ON q.product_id = p.id
        JOIN users u ON q.buyer_id = u.id
        WHERE {clause}
        ORDER BY o.created_at DESC
        """,
        params,
    ).fetchall()
    return jsonify({"orders": [row_to_dict(row) for row in rows]})


@app.route("/api/messages/<int:quote_id>", methods=["GET", "POST"])
def messages(quote_id):
    user, error = require_user()
    if error:
        return error
    db = get_db()
    quote = db.execute(
        """
        SELECT q.*, p.supplier, p.supplier_id FROM quotes q
        JOIN products p ON q.product_id = p.id
        WHERE q.id = %s
        """,
        (quote_id,),
    ).fetchone()
    if not quote:
        return jsonify({"error": "Quote not found."}), 404
    if not user_can_access_quote(user, quote):
        return jsonify({"error": "You cannot access this thread."}), 403

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        body = clean_str(data, "body")
        if not body:
            return jsonify({"error": "Message is required."}), 400
        msg_id = db.execute(
            "INSERT INTO messages (quote_id, sender_id, body, created_at) VALUES (%s, %s, %s, %s) RETURNING id",
            (quote_id, user["id"], body, utc_now()),
        ).fetchone()["id"]
        log_audit("sent", "message", msg_id, f"Quote {quote_id}")
        db.commit()

    rows = db.execute(
        """
        SELECT m.*, u.name AS sender_name, u.company AS sender_company
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.quote_id = %s
        ORDER BY m.created_at ASC
        """,
        (quote_id,),
    ).fetchall()
    return jsonify({"messages": [row_to_dict(row) for row in rows]})


@app.route("/api/verifications", methods=["GET", "POST"])
def verifications():
    user, error = require_user()
    if error:
        return error
    db = get_db()
    if request.method == "POST":
        if user["role"] not in ("supplier", "admin"):
            return jsonify({"error": "Only suppliers can submit verification evidence."}), 403
        data = request.get_json(silent=True) or {}
        business_license = clean_str(data, "business_license")
        factory_address = clean_str(data, "factory_address")
        evidence = clean_str(data, "evidence")
        next_review_at = clean_str(data, "next_review_at", "2026-12-31")
        now = utc_now()

        if user["role"] == "supplier":
            supplier_company = user["company"]
            # A supplier may only touch their own record (matched by identity),
            # or claim the unowned seeded record for their company.
            own = db.execute(
                "SELECT id FROM supplier_verifications WHERE supplier_id = %s", (user["id"],)
            ).fetchone()
            if not own:
                own = db.execute(
                    "SELECT id FROM supplier_verifications WHERE supplier_company = %s AND supplier_id IS NULL",
                    (supplier_company,),
                ).fetchone()
            if own:
                db.execute(
                    """
                    UPDATE supplier_verifications SET
                        supplier_id = %s, status = 'document_review',
                        business_license = %s, factory_address = %s, evidence = %s,
                        next_review_at = %s, updated_at = %s
                    WHERE id = %s
                    """,
                    (user["id"], business_license, factory_address, evidence, next_review_at, now, own["id"]),
                )
            else:
                db.execute(
                    """
                    INSERT INTO supplier_verifications
                    (supplier_company, supplier_id, status, business_license, factory_address, evidence, next_review_at, updated_at)
                    VALUES (%s, %s, 'application', %s, %s, %s, %s, %s)
                    """,
                    (supplier_company, user["id"], business_license, factory_address, evidence, next_review_at, now),
                )
        else:  # admin may submit on behalf of any company
            supplier_company = clean_str(data, "supplier_company", user["company"])
            db.execute(
                """
                INSERT INTO supplier_verifications
                (supplier_company, status, business_license, factory_address, evidence, next_review_at, updated_at)
                VALUES (%s, 'application', %s, %s, %s, %s, %s)
                ON CONFLICT (site_id, supplier_company) DO UPDATE SET
                    status = 'document_review',
                    business_license = EXCLUDED.business_license,
                    factory_address = EXCLUDED.factory_address,
                    evidence = EXCLUDED.evidence,
                    next_review_at = EXCLUDED.next_review_at,
                    updated_at = EXCLUDED.updated_at
                """,
                (supplier_company, business_license, factory_address, evidence, next_review_at, now),
            )
        log_audit("submitted", "supplier_verification", None, supplier_company)
        db.commit()

    if user["role"] == "supplier":
        rows = db.execute("SELECT * FROM supplier_verifications WHERE supplier_id = %s", (user["id"],)).fetchall()
    else:
        rows = db.execute("SELECT * FROM supplier_verifications ORDER BY updated_at DESC").fetchall()
    return jsonify({"verifications": [row_to_dict(row) for row in rows]})


@app.route("/api/admin/verifications/<int:verif_id>", methods=["POST"])
def admin_set_verification(verif_id):
    """Admin-only: approve or revoke a supplier verification.
    Approving sets the record to 'verified' AND flips products.verified=1 for
    that company (which drives the Verified badge on cards/PDP and the homepage
    stat). Revoking undoes both."""
    user, error = require_user()
    if error:
        return error
    if user["role"] != "admin":
        return jsonify({"error": "Admin only."}), 403

    action = str((request.get_json(silent=True) or {}).get("action", "")).strip().lower()
    if action not in ("approve", "revoke"):
        return jsonify({"error": "Unknown action — use 'approve' or 'revoke'."}), 400

    db = get_db()
    row = db.execute("SELECT * FROM supplier_verifications WHERE id = %s", (verif_id,)).fetchone()
    if not row:
        return jsonify({"error": "Verification record not found."}), 404

    company = row["supplier_company"]
    now = utc_now()
    if action == "approve":
        db.execute("UPDATE supplier_verifications SET status = 'verified', updated_at = %s WHERE id = %s", (now, verif_id))
        db.execute("UPDATE products SET verified = 1 WHERE supplier = %s", (company,))
    else:
        db.execute("UPDATE supplier_verifications SET status = 'application', updated_at = %s WHERE id = %s", (now, verif_id))
        db.execute("UPDATE products SET verified = 0 WHERE supplier = %s", (company,))
    log_audit(action, "supplier_verification", verif_id, company, actor_id=user["id"])
    db.commit()

    updated = db.execute("SELECT * FROM supplier_verifications WHERE id = %s", (verif_id,)).fetchone()
    return jsonify({"verification": row_to_dict(updated)})


@app.route("/api/admin/translate-backfill", methods=["POST"])
def admin_translate_backfill():
    """One-time (idempotent) translation of all existing product names,
    descriptions, and categories into EN/ZH/RU. Cached strings are skipped, so
    it's safe to re-run. Work happens in a background thread; the cache fills in
    over the next minute or two."""
    user, error = require_user()
    if error:
        return error
    if user["role"] != "admin":
        return jsonify({"error": "Admin only."}), 403

    rows = get_db().execute("SELECT DISTINCT name, description, category FROM products").fetchall()
    texts = set()
    for r in rows:
        for value in (r["name"], r["description"], r["category"]):
            if value and value.strip():
                texts.add(value.strip())

    threading.Thread(target=_bg_translate_texts, args=(list(texts),), daemon=True).start()
    return jsonify({"status": "started", "strings": len(texts), "languages": ["en", "zh", "ru"]})


@app.route("/api/admin/inquiries")
def admin_list_inquiries():
    """Product-inquiry leads captured by the marketplace. New leads are also
    forwarded to the portal broker queue; this endpoint covers history and
    serves as the fallback inbox when the portal is unreachable."""
    user, error = require_user()
    if error:
        return error
    if user["role"] != "admin":
        return jsonify({"error": "Admin only."}), 403

    rows = get_db().execute(
        """
        SELECT i.*, p.name AS product_name, p.supplier AS product_supplier
        FROM product_inquiries i
        LEFT JOIN products p ON i.product_id = p.id
        ORDER BY i.created_at DESC
        """
    ).fetchall()
    return jsonify({"inquiries": [row_to_dict(row) for row in rows]})


@app.route("/api/admin/suppliers", methods=["GET", "POST"])
def admin_suppliers():
    """Broker-managed manufacturer registry. These accounts have no login
    (email NULL, empty hash) — the admin manages their catalog. contact_email /
    contact_phone are plain contact info and may repeat across companies."""
    user, error = require_user()
    if error:
        return error
    if user["role"] != "admin":
        return jsonify({"error": "Admin only."}), 403

    db = get_db()
    if request.method == "GET":
        rows = db.execute(
            """
            SELECT id, name, company, contact_email, contact_phone, created_at
            FROM users WHERE role = 'supplier' ORDER BY LOWER(company) ASC
            """
        ).fetchall()
        return jsonify({"suppliers": [row_to_dict(row) for row in rows]})

    data = request.get_json(silent=True) or {}
    name = clean_str(data, "name")
    company = clean_str(data, "company")
    contact_email = clean_str(data, "contact_email").lower()
    contact_phone = clean_str(data, "contact_phone")

    if not name or not company:
        return jsonify({"error": "Contact name and company are required."}), 400
    if contact_email and not _EMAIL_RE.match(contact_email):
        return jsonify({"error": "Contact email is not a valid email address."}), 400

    # Company name stays unique — it is the anchor products are pinned to.
    if db.execute(
        "SELECT id FROM users WHERE LOWER(company) = LOWER(%s) AND role IN ('supplier', 'admin')",
        (company,),
    ).fetchone():
        return jsonify({"error": "A supplier with that company name already exists."}), 400

    new_id = db.execute(
        """
        INSERT INTO users (name, email, password_hash, company, role, contact_email, contact_phone, created_at)
        VALUES (%s, NULL, '', %s, 'supplier', %s, %s, %s) RETURNING id
        """,
        (name, company, contact_email, contact_phone, utc_now()),
    ).fetchone()["id"]
    log_audit("created", "user", new_id, f"admin registered manufacturer {company}", new_id)
    db.commit()
    return jsonify({
        "supplier_id": new_id,
        "company": company,
        "contact_email": contact_email,
        "contact_phone": contact_phone,
    })


@app.route("/api/contact", methods=["POST"])
@limiter.limit("10 per minute")
def contact():
    data = request.get_json(silent=True) or {}
    required_fields = ["name", "email", "company", "message"]
    fields = {field: clean_str(data, field) for field in required_fields}
    missing = [field for field in required_fields if not fields[field]]
    if missing:
        return jsonify({"error": "Missing fields", "missing": missing}), 400

    log_audit("created", "contact_request", None, f"{fields['company']} - {fields['email']}")
    get_db().commit()

    # Forward the buyer's sourcing request to the portal broker queue (best-effort).
    _forward_lead_to_portal({
        "kind": "GENERAL",
        "contactName": fields["name"][:120],
        "contactEmail": fields["email"],
        "contactCompany": fields["company"][:160],
        "message": fields["message"][:3000],
    })

    return jsonify({"status": "success", "message": "Request received and logged for sourcing review."})


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "").lower() in ("1", "true", "yes")
    # Bind to localhost by default; opt into all interfaces explicitly.
    host = "0.0.0.0" if os.environ.get("BIND_ALL", "").lower() in ("1", "true", "yes") else "127.0.0.1"
    app.run(host=host, port=5000, debug=debug)
