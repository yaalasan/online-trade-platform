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
    g,
    jsonify,
    redirect,
    render_template,
    request,
    send_file,
    session,
    url_for,
)
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix

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

IS_PRODUCTION = os.environ.get("PRODUCTION", "").lower() in ("1", "true", "yes")
CLAUDE_API_KEY = os.environ.get("CLAUDE_API_KEY", "")

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
CATEGORY_GROUPS = {
    "Machinery": [
        "Construction Machinery",
    ],

    "Vehicles": [
        "Electric Bikes",
        "Motorbikes",
        "Auto Spare Parts",
        "Moto Spare Parts"
    ],
}


def expand_category_filter(category):
    """Return the list of category names a filter value should match."""
    return [category, *CATEGORY_GROUPS.get(category, [])]


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


def _translate_via_claude(text, target_lang):
    """Optional paid fallback: Claude API. Only used when CLAUDE_API_KEY is set.
    Returns translated text, or original on error."""
    if not CLAUDE_API_KEY or not text:
        return text
    try:
        import anthropic  # lazy import – only needed when API key is set
        client = anthropic.Anthropic(api_key=CLAUDE_API_KEY)
        lang_names = {"en": "English", "zh": "Simplified Chinese", "ru": "Russian"}
        lang_name = lang_names.get(target_lang, target_lang)
        msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=512,
            messages=[{
                "role": "user",
                "content": (
                    f"Translate the following B2B product or company text to {lang_name}. "
                    f"Return ONLY the translated text, no commentary:\n\n{text}"
                ),
            }],
        )
        return msg.content[0].text.strip()
    except Exception:
        return text


def _machine_translate(text, target_lang):
    """Primary translation entry point: free engine, with the paid Claude path
    as an opt-in fallback when configured. Used behind the SQLite cache so each
    string is only ever translated once."""
    translated = _translate_free(text, target_lang)
    # If the free engine failed (returned the input unchanged) and a paid key is
    # available, try Claude as a backstop for higher-value fields.
    if translated == text and CLAUDE_API_KEY:
        return _translate_via_claude(text, target_lang)
    return translated


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


def _send_inquiry_email(inquiry_id, name, email, category, company="", message=""):
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

    msg = EmailMessage()
    msg["Subject"] = f"New enquiry #{inquiry_id}: {category or 'general'} — {name}"
    msg["From"] = CONTACT_EMAIL_FROM
    msg["To"] = CONTACT_EMAIL_TO
    msg["Reply-To"] = email
    msg.set_content(
        f"New contact-form enquiry (#{inquiry_id})\n\n"
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
                            company="", message=""):
    """Background staff notification for a public contact-form inquiry. Attempts
    delivery, then stamps notified_at so pending/failed sends are distinguishable
    and retryable. Runs in its own daemon thread with its own pooled connection;
    contact_inquiries is RLS-scoped, so it sets app.site_id before the UPDATE.

    The inquiry row is already committed by the request before this runs, so a
    delivery failure only leaves notified_at NULL — it can never lose the lead
    or surface as an error to the visitor."""
    try:
        _send_inquiry_email(inquiry_id, name, email, category, company, message)
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
    """{category_name: count} across the tenant's products. No site_id clause —
    RLS scopes it to the current site."""
    rows = get_db().execute(
        "SELECT category, COUNT(*) AS n FROM products GROUP BY category"
    ).fetchall()
    return {r["category"]: r["n"] for r in rows}


def _categories_with_counts(site):
    """Merge the config category list (what to show — source of truth for
    display) with live DB counts (how many are listed). The trailing
    'Custom sourcing' entry is a CTA to the contact form, not a listing page."""
    counts = _category_counts()
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
        "ORDER BY is_primary DESC, sort_order ASC, id ASC LIMIT 1",
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


@app.route("/")
def page_home():
    site = get_site(_site_slug())
    return render_template(
        "home.html", active_page="home",
        categories=_categories_with_counts(site),
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
    db = get_db()
    rows = db.execute(
        "SELECT id, name, supplier, location, price, moq, lead_time, verified "
        "FROM products WHERE category = %s ORDER BY verified DESC, name",
        (cat["name"],),
    ).fetchall()
    products = []
    for r in rows:
        p = dict(r)
        p["image"] = _primary_image(db, r["id"])
        products.append(p)
    return render_template(
        "category.html", active_page="products",
        category=cat, products=products,
    )


@app.route("/product/<int:id>")
def page_product(id):
    db = get_db()
    row = db.execute("SELECT * FROM products WHERE id = %s", (id,)).fetchone()
    if not row:
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
    return render_template("about.html", active_page="about")


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
                  form["company"], form["message"]),
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
            if user and user["role"] == "admin":
                return redirect(url_for("admin_inquiries"))
            return redirect(url_for("page_home"))

    return render_template("login.html", error=error, email=email,
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
    for prow in fetch_portal_products(query=query):
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

    return jsonify({
        "categories": [
            {
                "name": name,
                "display_name": _translated_category(name, target_lang, db),
                "items": items,
            }
            for name, items in categories.items()
        ],
        "all_locations": all_locations,
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
        GROUP BY category
        ORDER BY product_count DESC, category ASC
        """
    ).fetchall()
    cats = [row_to_dict(row) for row in rows]

    # Fold in portal product counts so portal-only categories show in the rail.
    by_name = {c["name"]: c for c in cats}
    for prow in fetch_portal_products():
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
    return jsonify({"product": portal_product_row(data["product"])})


@app.route("/api/suppliers")
def suppliers():
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
