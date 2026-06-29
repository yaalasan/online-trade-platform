import hashlib
import hmac
import os
import secrets
import sqlite3
import threading
from datetime import UTC, datetime, timedelta
from html import escape as html_escape
from pathlib import Path

from flask import Flask, Response, g, jsonify, request, send_file, session
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import check_password_hash, generate_password_hash

IS_PRODUCTION = os.environ.get("PRODUCTION", "").lower() in ("1", "true", "yes")
CLAUDE_API_KEY = os.environ.get("CLAUDE_API_KEY", "")

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
    return jsonify({"error": "Too many requests. Please try again later."}), 429


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "data.db"


# --- Supplier portal integration ---------------------------------------------
# The buyer-facing Flask site reads the Next.js portal's published catalog over a
# small read-only JSON bridge, so a manufacturer who registers in the portal and
# publishes ACTIVE products shows up here automatically. Buyer sourcing requests
# flow the other way (into the portal's broker queue). All calls are best-effort:
# if the portal is unreachable, the site falls back to local SQLite data.
import json  # noqa: E402
import urllib.error  # noqa: E402
import urllib.parse  # noqa: E402
import urllib.request  # noqa: E402

PORTAL_API_URL = os.environ.get("PORTAL_API_URL", "http://localhost:3000").rstrip("/")
PORTAL_URL = os.environ.get("PORTAL_URL", PORTAL_API_URL)
PORTAL_TIMEOUT = float(os.environ.get("PORTAL_TIMEOUT", "2.5"))


def _portal_get(path):
    try:
        req = urllib.request.Request(f"{PORTAL_API_URL}{path}", headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=PORTAL_TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, OSError, ValueError, TimeoutError):
        return None


def _portal_post(path, payload):
    try:
        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{PORTAL_API_URL}{path}",
            data=body,
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=PORTAL_TIMEOUT) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        try:
            return exc.code, json.loads(exc.read().decode("utf-8"))
        except Exception:
            return exc.code, {}
    except (urllib.error.URLError, OSError, ValueError, TimeoutError):
        return None, None


def _portal_price(pmin, pmax, currency):
    cur = f" {currency}" if currency else ""
    if pmin and pmax and pmin != pmax:
        return f"{pmin} - {pmax}{cur}"
    if pmin or pmax:
        return f"{pmin or pmax}{cur}"
    return "On request"


def portal_product_row(p):
    """Map a portal product (card or detail JSON) to the Flask product dict shape."""
    moq = p.get("moq")
    unit = p.get("unit") or ""
    lead = p.get("leadTimeDays")
    certs = p.get("certifications")
    return {
        "id": f"portal-{p['id']}",
        "category": p.get("category") or "Marketplace",
        "name": p.get("name") or "",
        "supplier": p.get("supplier") or "",
        "location": p.get("country") or "",
        "description": p.get("description") or "",
        "price": _portal_price(p.get("priceMin"), p.get("priceMax"), p.get("currency")),
        "moq": (f"{moq} {unit}".strip() if moq is not None else ""),
        "lead_time": (f"{lead} days" if lead else ""),
        "capacity": "",
        "certifications": (
            ", ".join(c["name"] for c in certs if c.get("name")) if isinstance(certs, list) else ""
        ),
        "image_url": p.get("image") or "",
        "verified": 1 if p.get("verified") else 0,
        "source": "portal",
    }


def fetch_portal_products(query=""):
    """All ACTIVE portal products (following the paginated bridge), as Flask rows."""
    rows = []
    page = 1
    while page <= 20:  # safety cap
        params = [f"page={page}"]
        if query:
            params.append("q=" + urllib.parse.quote(query))
        data = _portal_get("/api/public/products?" + "&".join(params))
        if not data or not data.get("products"):
            break
        rows.extend(portal_product_row(p) for p in data["products"])
        if page >= (data.get("totalPages") or 1):
            break
        page += 1
    return rows


def fetch_portal_suppliers(query=""):
    data = _portal_get("/api/public/suppliers")
    if not data:
        return []
    out = []
    for s in data.get("suppliers", []):
        name = s.get("name") or ""
        if query and query.lower() not in name.lower():
            continue
        out.append({
            "company": name,
            "location": s.get("country") or s.get("city") or "",
            "product_count": s.get("productCount") or 0,
            "verified": 1 if s.get("verified") else 0,
            "categories": "",
            "certifications": "",
            "verification_status": "verified" if s.get("verified") else "listed",
            "source": "portal",
        })
    return out


def clean_str(data, key, default=""):
    """Coerce a JSON field to a stripped, HTML-safe string.

    html_escape() is applied before any DB write so stored values are safe for
    server-side rendering. The JS layer renders these values as text (not raw HTML),
    so no double-encoding occurs in practice.
    """
    value = data.get(key, default)
    if value is None:
        return default
    if not isinstance(value, str):
        value = str(value)
    return html_escape(value.strip())

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    company TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('buyer', 'supplier', 'admin')),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    supplier TEXT NOT NULL,
    supplier_id INTEGER,
    location TEXT NOT NULL,
    description TEXT NOT NULL,
    price TEXT NOT NULL,
    moq TEXT DEFAULT '',
    lead_time TEXT DEFAULT '',
    capacity TEXT DEFAULT '',
    certifications TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    verified INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY(supplier_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    buyer_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested',
    target_price TEXT DEFAULT '',
    destination TEXT DEFAULT '',
    notes TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(buyer_id) REFERENCES users(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    incoterm TEXT NOT NULL DEFAULT 'FOB',
    payment_status TEXT NOT NULL DEFAULT 'escrow_pending',
    inspection_status TEXT NOT NULL DEFAULT 'not_scheduled',
    created_at TEXT NOT NULL,
    FOREIGN KEY(quote_id) REFERENCES quotes(id)
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER NOT NULL,
    sender_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    read_at TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(quote_id) REFERENCES quotes(id),
    FOREIGN KEY(sender_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS supplier_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_company TEXT NOT NULL UNIQUE,
    supplier_id INTEGER,
    status TEXT NOT NULL DEFAULT 'not_started',
    business_license TEXT DEFAULT '',
    factory_address TEXT DEFAULT '',
    evidence TEXT DEFAULT '',
    next_review_at TEXT DEFAULT '',
    updated_at TEXT NOT NULL,
    FOREIGN KEY(supplier_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id INTEGER,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY(actor_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS trust_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quote_id INTEGER,
    provider TEXT NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT NOT NULL,
    amount TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY(quote_id) REFERENCES quotes(id)
);

CREATE TABLE IF NOT EXISTS translations_cache (
    cache_key TEXT PRIMARY KEY,
    source_text TEXT NOT NULL,
    target_lang TEXT NOT NULL,
    translated_text TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""

SAMPLE_USERS = [
    {"name": "Global Buyer", "email": "buyer@example.com", "password": "Password123", "company": "ProcureCo", "role": "buyer"},
    {"name": "Aurora Partner", "email": "aurora@example.com", "password": "Password123", "company": "Aurora Alloys", "role": "supplier"},
    {"name": "GreenWrap Partner", "email": "greenwrap@example.com", "password": "Password123", "company": "GreenWrap", "role": "supplier"},
    {"name": "Trade Desk Admin", "email": "admin@example.com", "password": "Password123", "company": "Fastflow", "role": "admin"},
]

SAMPLE_PRODUCTS = [
    {
        "category": "Raw Materials",
        "name": "Industrial Metals",
        "supplier": "Aurora Alloys",
        "location": "Istanbul, Turkey",
        "description": "High-grade steel and aluminum alloys for manufacturing.",
        "price": "$1.25/kg",
        "moq": "2,000 kg",
        "lead_time": "21 days",
        "capacity": "180 tons/month",
        "certifications": "ISO 9001, REACH",
        "image_url": "https://images.unsplash.com/photo-1535813547-99c456a41d4a?auto=format&fit=crop&w=900&q=80",
        "verified": 1,
    },
    {
        "category": "Packaging",
        "name": "Biodegradable Packaging Film",
        "supplier": "GreenWrap",
        "location": "Poznan, Poland",
        "description": "Compostable film for finished goods and export packing.",
        "price": "$18.50/roll",
        "moq": "300 rolls",
        "lead_time": "14 days",
        "capacity": "12,000 rolls/month",
        "certifications": "BPI, EN 13432",
        "image_url": "https://images.unsplash.com/photo-1605600659908-0ef719419d41?auto=format&fit=crop&w=900&q=80",
        "verified": 1,
    },
    {
        "category": "Components",
        "name": "Electronic Control Modules",
        "supplier": "Nordic Circuits",
        "location": "Tampere, Finland",
        "description": "Custom control modules for industrial automation.",
        "price": "$34.70/unit",
        "moq": "500 units",
        "lead_time": "35 days",
        "capacity": "40,000 units/month",
        "certifications": "ISO 14001, CE",
        "image_url": "https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=900&q=80",
        "verified": 0,
    },
    {
        "category": "Components",
        "name": "Precision Fasteners",
        "supplier": "BoltWorks",
        "location": "Stuttgart, Germany",
        "description": "High-strength fasteners for heavy equipment assembly.",
        "price": "$12.00/pack",
        "moq": "800 packs",
        "lead_time": "18 days",
        "capacity": "90,000 packs/month",
        "certifications": "IATF 16949",
        "image_url": "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=900&q=80",
        "verified": 0,
    },
    {
        "category": "Machinery",
        "name": "CNC Machined Aluminum Housings",
        "supplier": "Delta Precision Works",
        "location": "Shenzhen, China",
        "description": "Custom CNC housings with anodizing, QA reports, and export packing.",
        "price": "$4.80/unit",
        "moq": "1,000 units",
        "lead_time": "28 days",
        "capacity": "75,000 units/month",
        "certifications": "ISO 9001, RoHS",
        "image_url": "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=900&q=80",
        "verified": 1,
    },
    {
        "category": "Home & Kitchen",
        "name": "Stainless Steel Drinkware Set",
        "supplier": "Harbor Home Manufacturing",
        "location": "Ningbo, China",
        "description": "OEM drinkware with private label packaging and inspection support.",
        "price": "$2.95/set",
        "moq": "2,400 sets",
        "lead_time": "24 days",
        "capacity": "120,000 sets/month",
        "certifications": "BSCI, LFGB",
        "image_url": "https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=900&q=80",
        "verified": 1,
    },
]


def utc_now():
    return datetime.now(UTC).isoformat()


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(DB_PATH)
        g.db.row_factory = sqlite3.Row
    return g.db


def row_to_dict(row):
    if not row:
        return None
    return {key: row[key] for key in row.keys()}


# --- Translation helpers ------------------------------------------------------

def _open_translation_db():
    """Open a dedicated SQLite connection for use outside request context."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def _translate_via_claude(text, target_lang):
    """Call Claude API. Returns translated text, or original on error."""
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


def _cache_key(text, target_lang):
    return hashlib.sha256(f"{text}|{target_lang}".encode()).hexdigest()


def get_cached_translation(text, target_lang, db):
    """Return cached translation string or None if not cached."""
    if not text:
        return None
    row = db.execute(
        "SELECT translated_text FROM translations_cache WHERE cache_key = ?",
        (_cache_key(text, target_lang),),
    ).fetchone()
    return row["translated_text"] if row else None


def _store_translation(text, target_lang, translated, db):
    db.execute(
        """
        INSERT OR REPLACE INTO translations_cache
        (cache_key, source_text, target_lang, translated_text, created_at)
        VALUES (?, ?, ?, ?, ?)
        """,
        (_cache_key(text, target_lang), text, target_lang, translated, utc_now()),
    )


def translate_text_cached(text, target_lang):
    """Translate text using Claude, with SQLite cache. Uses its own DB connection (thread-safe)."""
    if not text:
        return text
    db = _open_translation_db()
    try:
        cached = get_cached_translation(text, target_lang, db)
        if cached is not None:
            return cached
        translated = _translate_via_claude(text, target_lang)
        _store_translation(text, target_lang, translated, db)
        db.commit()
        return translated
    finally:
        db.close()


def _bg_translate_product(name, description):
    """Pre-translate product fields to EN/ZH/RU. Runs in a daemon thread."""
    db = _open_translation_db()
    try:
        for lang in ("en", "zh", "ru"):
            for text in (name, description):
                if text and get_cached_translation(text, lang, db) is None:
                    translated = _translate_via_claude(text, lang)
                    _store_translation(text, lang, translated, db)
        db.commit()
    except Exception:
        pass
    finally:
        db.close()


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


def add_column_if_missing(db, table, column, definition):
    columns = [row[1] for row in db.execute(f"PRAGMA table_info({table})").fetchall()]
    if column not in columns:
        db.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def migrate_users_role_constraint(db):
    row = db.execute("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'").fetchone()
    if not row or "'admin'" in row[0]:
        return
    db.executescript(
        """
        ALTER TABLE users RENAME TO users_legacy;
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            company TEXT NOT NULL,
            role TEXT NOT NULL CHECK(role IN ('buyer', 'supplier', 'admin')),
            created_at TEXT NOT NULL
        );
        INSERT INTO users (id, name, email, password_hash, company, role, created_at)
        SELECT id, name, email, password_hash, company, role, created_at FROM users_legacy;
        DROP TABLE users_legacy;
        """
    )


def init_db():
    db = sqlite3.connect(DB_PATH)
    db.executescript(SCHEMA_SQL)
    migrate_users_role_constraint(db)
    add_column_if_missing(db, "products", "moq", "TEXT DEFAULT ''")
    add_column_if_missing(db, "products", "lead_time", "TEXT DEFAULT ''")
    add_column_if_missing(db, "products", "capacity", "TEXT DEFAULT ''")
    add_column_if_missing(db, "products", "certifications", "TEXT DEFAULT ''")
    add_column_if_missing(db, "products", "image_url", "TEXT DEFAULT ''")
    add_column_if_missing(db, "products", "verified", "INTEGER DEFAULT 0")
    add_column_if_missing(db, "products", "supplier_id", "INTEGER")
    add_column_if_missing(db, "supplier_verifications", "supplier_id", "INTEGER")
    add_column_if_missing(db, "quotes", "target_price", "TEXT DEFAULT ''")
    add_column_if_missing(db, "quotes", "destination", "TEXT DEFAULT ''")

    existing_emails = {row[0] for row in db.execute("SELECT email FROM users").fetchall()}
    for user in SAMPLE_USERS:
        if user["email"] not in existing_emails:
            db.execute(
                "INSERT INTO users (name, email, password_hash, company, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (user["name"], user["email"], generate_password_hash(user["password"]), user["company"], user["role"], utc_now()),
            )

    existing_product_names = {row[0] for row in db.execute("SELECT name FROM products").fetchall()}
    for product in SAMPLE_PRODUCTS:
        if product["name"] in existing_product_names:
            db.execute(
                """
                UPDATE products
                SET moq = COALESCE(NULLIF(moq, ''), ?),
                    lead_time = COALESCE(NULLIF(lead_time, ''), ?),
                    capacity = COALESCE(NULLIF(capacity, ''), ?),
                    certifications = COALESCE(NULLIF(certifications, ''), ?),
                    image_url = COALESCE(NULLIF(image_url, ''), ?)
                WHERE name = ?
                """,
                (
                    product["moq"],
                    product["lead_time"],
                    product["capacity"],
                    product["certifications"],
                    product["image_url"],
                    product["name"],
                ),
            )
            continue

        db.execute(
            """
            INSERT INTO products
            (category, name, supplier, location, description, price, moq, lead_time, capacity, certifications, image_url, verified, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                product["category"],
                product["name"],
                product["supplier"],
                product["location"],
                product["description"],
                product["price"],
                product["moq"],
                product["lead_time"],
                product["capacity"],
                product["certifications"],
                product["image_url"],
                product["verified"],
                utc_now(),
            ),
        )

    for product in SAMPLE_PRODUCTS:
        db.execute(
            """
            INSERT OR IGNORE INTO supplier_verifications
            (supplier_company, status, business_license, factory_address, evidence, next_review_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                product["supplier"],
                "verified" if product["verified"] else "document_review",
                "License file pending secure upload",
                product["location"],
                product["certifications"],
                "2026-12-31",
                utc_now(),
            ),
        )

    # Backfill the supplier identity link so authorization no longer depends on
    # the free-text company name. Each product/verification is tied to the
    # earliest supplier (or admin) account whose company matches.
    db.execute(
        """
        UPDATE products SET supplier_id = (
            SELECT u.id FROM users u
            WHERE u.company = products.supplier AND u.role IN ('supplier', 'admin')
            ORDER BY u.id LIMIT 1
        )
        WHERE supplier_id IS NULL
        """
    )
    db.execute(
        """
        UPDATE supplier_verifications SET supplier_id = (
            SELECT u.id FROM users u
            WHERE u.company = supplier_verifications.supplier_company AND u.role IN ('supplier', 'admin')
            ORDER BY u.id LIMIT 1
        )
        WHERE supplier_id IS NULL
        """
    )

    db.commit()
    db.close()


def ensure_db():
    init_db()


def log_audit(action, entity_type, entity_id=None, details="", actor_id=None):
    db = get_db()
    if actor_id is None:
        user = get_current_user()
        actor_id = user["id"] if user else None
    db.execute(
        "INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (actor_id, action, entity_type, entity_id, details, utc_now()),
    )


ensure_db()


@app.teardown_appcontext
def close_db(exception=None):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def get_current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    row = get_db().execute("SELECT id, name, email, company, role FROM users WHERE id = ?", (user_id,)).fetchone()
    return row_to_dict(row)


def require_user():
    user = get_current_user()
    if not user:
        return None, (jsonify({"error": "Authentication required."}), 401)
    return user, None


def quote_scope_clause(user):
    if user["role"] == "buyer":
        return "q.buyer_id = ?", (user["id"],)
    if user["role"] == "supplier":
        # Scope by the verified supplier identity link, never the company string.
        return "p.supplier_id = ?", (user["id"],)
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
        "img-src 'self' https: data:; "
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
    db = g.pop("db", None)
    if db is not None:
        db.rollback()
        db.close()
    app.logger.exception("Unhandled error: %s", error)
    return jsonify({"error": "An unexpected server error occurred."}), 500


@app.route("/")
def home():
    # Inject the portal URL so the "Supplier Portal" links point at the right host.
    html = (BASE_DIR / "index.html").read_text(encoding="utf-8")
    return Response(html.replace("{{PORTAL_URL}}", PORTAL_URL), mimetype="text/html")


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
    if db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone():
        return jsonify({"error": "Email is already registered."}), 400

    # Block claiming another supplier's company name — identity is what gates
    # access to that company's RFQs and verification record.
    if role == "supplier":
        taken = db.execute(
            "SELECT id FROM users WHERE LOWER(company) = LOWER(?) AND role IN ('supplier', 'admin')",
            (company,),
        ).fetchone()
        if taken:
            return jsonify({"error": "This company is already registered. Contact support to join an existing supplier account."}), 400

    cursor = db.execute(
        "INSERT INTO users (name, email, password_hash, company, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (name, email, generate_password_hash(password), company, role, utc_now()),
    )
    log_audit("registered", "user", cursor.lastrowid, f"{role} account created", cursor.lastrowid)
    db.commit()
    session.permanent = True
    session["user_id"] = cursor.lastrowid
    user = db.execute("SELECT id, name, email, company, role FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return jsonify({"user": row_to_dict(user)})


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

    db = get_db()
    row = db.execute("SELECT id, password_hash FROM users WHERE email = ?", (email,)).fetchone()
    if not row or not check_password_hash(row["password_hash"], password):
        return jsonify({"error": "Invalid email or password."}), 401

    session.permanent = True
    session["user_id"] = row["id"]
    log_audit("logged_in", "user", row["id"], "Session started", row["id"])
    db.commit()
    user = db.execute("SELECT id, name, email, company, role FROM users WHERE id = ?", (row["id"],)).fetchone()
    return jsonify({"user": row_to_dict(user)})


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.pop("user_id", None)
    return jsonify({"status": "logged_out"})


@app.route("/api/auth/me")
def current_user_compat():
    user = get_current_user()
    return jsonify({"authenticated": user is not None, "user": user})


@app.route("/api/me")
def api_me():
    user = get_current_user()
    return jsonify({"authenticated": user is not None, "user": user})


@app.route("/api/translate", methods=["POST"])
@limiter.limit("20 per minute")
def api_translate():
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

    if not CLAUDE_API_KEY:
        return jsonify({"translated": text, "cached": False})

    translated = _translate_via_claude(text, target_lang)
    _store_translation(text, target_lang, translated, db)
    db.commit()
    return jsonify({"translated": translated, "cached": False})


@app.route("/api/overview")
def overview():
    db = get_db()
    stats = {
        "products": db.execute("SELECT COUNT(*) FROM products").fetchone()[0],
        "verified_suppliers": db.execute("SELECT COUNT(*) FROM supplier_verifications WHERE status = 'verified'").fetchone()[0],
        "open_rfqs": db.execute("SELECT COUNT(*) FROM quotes WHERE status != 'closed'").fetchone()[0],
        "orders": db.execute("SELECT COUNT(*) FROM orders").fetchone()[0],
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
            (name LIKE ? OR supplier LIKE ? OR category LIKE ? OR description LIKE ?
            OR location LIKE ? OR certifications LIKE ?)
            """
        )
        params.extend([like, like, like, like, like, like])
    if category:
        filters.append("category = ?")
        params.append(category)
    where = f"WHERE {' AND '.join(filters)}" if filters else ""
    products = db.execute(f"SELECT * FROM products {where} ORDER BY verified DESC, category, name", params).fetchall()

    categories = {}
    for row in products:
        product = row_to_dict(row)
        categories.setdefault(product["category"], []).append(product)

    # Merge in live products published from the supplier portal (best-effort).
    for prow in fetch_portal_products(query=query):
        if category and prow["category"] != category:
            continue
        categories.setdefault(prow["category"], []).append(prow)

    # Apply cached translations if target_lang was requested.
    if target_lang:
        categories = {
            name: _apply_translations(items, target_lang, db)
            for name, items in categories.items()
        }

    return jsonify({"categories": [{"name": name, "items": items} for name, items in categories.items()]})


@app.route("/api/categories")
def categories():
    rows = get_db().execute(
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
    return jsonify({"categories": cats})


@app.route("/api/products/<int:product_id>")
def product_detail(product_id):
    row = get_db().execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not row:
        return jsonify({"error": "Product not found."}), 404
    return jsonify({"product": row_to_dict(row)})


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
        where = "WHERE p.supplier LIKE ? OR p.location LIKE ? OR p.certifications LIKE ?"
        params = [like, like, like]
    rows = get_db().execute(
        f"""
        SELECT p.supplier AS company,
               MIN(p.location) AS location,
               COUNT(p.id) AS product_count,
               MAX(p.verified) AS verified,
               GROUP_CONCAT(DISTINCT p.category) AS categories,
               GROUP_CONCAT(DISTINCT p.certifications) AS certifications,
               COALESCE(v.status, 'not_started') AS verification_status
        FROM products p
        LEFT JOIN supplier_verifications v ON v.supplier_company = p.supplier
        {where}
        GROUP BY p.supplier
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

    supplier = clean_str(data, "supplier", user["company"]) if user["role"] == "admin" else user["company"]
    db = get_db()
    cursor = db.execute(
        """
        INSERT INTO products
        (category, name, supplier, supplier_id, location, description, price, moq, lead_time, capacity, certifications, image_url, verified, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            fields["category"],
            fields["name"],
            supplier,
            user["id"],
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
    )
    log_audit("created", "product", cursor.lastrowid, f"{supplier} listed {fields['name']}")
    db.commit()
    product_id = cursor.lastrowid

    # Pre-translate name + description to all 3 languages in the background so
    # marketplace requests with ?target_lang= get instant cache hits.
    if CLAUDE_API_KEY:
        t_name = fields["name"]
        t_desc = fields["description"]
        threading.Thread(
            target=_bg_translate_product, args=(t_name, t_desc), daemon=True
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

        product = db.execute("SELECT id, supplier FROM products WHERE id = ?", (product_id,)).fetchone()
        if not product:
            return jsonify({"error": "Product not found."}), 404

        cursor = db.execute(
            """
            INSERT INTO quotes (buyer_id, product_id, quantity, notes, target_price, destination, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (user["id"], product_id, quantity, notes, target_price, destination, utc_now()),
        )
        quote_id = cursor.lastrowid
        db.execute(
            "INSERT INTO messages (quote_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)",
            (quote_id, user["id"], f"RFQ opened. Quantity: {quantity}. {notes}".strip(), utc_now()),
        )
        log_audit("created", "rfq", quote_id, f"RFQ sent to {product['supplier']}")
        db.commit()
        quote = db.execute("SELECT * FROM quotes WHERE id = ?", (quote_id,)).fetchone()
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
        WHERE q.id = ?
        """,
        (quote_id,),
    ).fetchone()
    if not quote:
        return jsonify({"error": "Quote not found."}), 404
    if not user_can_access_quote(user, quote):
        return jsonify({"error": "You cannot update this quote."}), 403

    db.execute("UPDATE quotes SET status = ? WHERE id = ?", (status, quote_id))
    db.execute(
        "INSERT INTO messages (quote_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)",
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
            WHERE q.id = ?
            """,
            (quote_id,),
        ).fetchone()
        if not quote:
            return jsonify({"error": "Quote not found."}), 404
        if not user_can_access_quote(user, quote):
            return jsonify({"error": "You cannot create an order for this RFQ."}), 403
        if quote["status"] != "accepted":
            return jsonify({"error": "The RFQ must be accepted before an order can be created."}), 400
        if db.execute("SELECT id FROM orders WHERE quote_id = ?", (quote_id,)).fetchone():
            return jsonify({"error": "An order already exists for this RFQ."}), 400
        cursor = db.execute(
            "INSERT INTO orders (quote_id, incoterm, payment_status, inspection_status, created_at) VALUES (?, ?, ?, ?, ?)",
            (
                quote_id,
                clean_str(data, "incoterm", "FOB") or "FOB",
                "escrow_pending",
                "not_scheduled",
                utc_now(),
            ),
        )
        db.execute(
            "INSERT INTO trust_events (quote_id, provider, event_type, status, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (quote_id, "provider_abstraction", "escrow_intent", "created", clean_str(data, "amount"), utc_now()),
        )
        log_audit("created", "order", cursor.lastrowid, "Order and escrow intent created")
        db.commit()
        return jsonify({"order_id": cursor.lastrowid})

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
        WHERE q.id = ?
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
        cursor = db.execute(
            "INSERT INTO messages (quote_id, sender_id, body, created_at) VALUES (?, ?, ?, ?)",
            (quote_id, user["id"], body, utc_now()),
        )
        log_audit("sent", "message", cursor.lastrowid, f"Quote {quote_id}")
        db.commit()

    rows = db.execute(
        """
        SELECT m.*, u.name AS sender_name, u.company AS sender_company
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.quote_id = ?
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
                "SELECT id FROM supplier_verifications WHERE supplier_id = ?", (user["id"],)
            ).fetchone()
            if not own:
                own = db.execute(
                    "SELECT id FROM supplier_verifications WHERE supplier_company = ? AND supplier_id IS NULL",
                    (supplier_company,),
                ).fetchone()
            if own:
                db.execute(
                    """
                    UPDATE supplier_verifications SET
                        supplier_id = ?, status = 'document_review',
                        business_license = ?, factory_address = ?, evidence = ?,
                        next_review_at = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (user["id"], business_license, factory_address, evidence, next_review_at, now, own["id"]),
                )
            else:
                db.execute(
                    """
                    INSERT INTO supplier_verifications
                    (supplier_company, supplier_id, status, business_license, factory_address, evidence, next_review_at, updated_at)
                    VALUES (?, ?, 'application', ?, ?, ?, ?, ?)
                    """,
                    (supplier_company, user["id"], business_license, factory_address, evidence, next_review_at, now),
                )
        else:  # admin may submit on behalf of any company
            supplier_company = clean_str(data, "supplier_company", user["company"])
            db.execute(
                """
                INSERT INTO supplier_verifications
                (supplier_company, status, business_license, factory_address, evidence, next_review_at, updated_at)
                VALUES (?, 'application', ?, ?, ?, ?, ?)
                ON CONFLICT(supplier_company) DO UPDATE SET
                    status = 'document_review',
                    business_license = excluded.business_license,
                    factory_address = excluded.factory_address,
                    evidence = excluded.evidence,
                    next_review_at = excluded.next_review_at,
                    updated_at = excluded.updated_at
                """,
                (supplier_company, business_license, factory_address, evidence, next_review_at, now),
            )
        log_audit("submitted", "supplier_verification", None, supplier_company)
        db.commit()

    if user["role"] == "supplier":
        rows = db.execute("SELECT * FROM supplier_verifications WHERE supplier_id = ?", (user["id"],)).fetchall()
    else:
        rows = db.execute("SELECT * FROM supplier_verifications ORDER BY updated_at DESC").fetchall()
    return jsonify({"verifications": [row_to_dict(row) for row in rows]})


@app.route("/api/admin/suppliers", methods=["POST"])
def admin_create_supplier():
    user, error = require_user()
    if error:
        return error
    if user["role"] != "admin":
        return jsonify({"error": "Admin only."}), 403

    data = request.get_json(silent=True) or {}
    name = clean_str(data, "name")
    email = clean_str(data, "email").lower()
    company = clean_str(data, "company")
    password = data.get("password", "")
    if not isinstance(password, str):
        password = ""

    if not name or not email or not company or not password:
        return jsonify({"error": "name, email, company and password are required."}), 400
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400

    db = get_db()
    if db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone():
        return jsonify({"error": "Email is already registered."}), 400
    if db.execute(
        "SELECT id FROM users WHERE LOWER(company) = LOWER(?) AND role IN ('supplier', 'admin')",
        (company,),
    ).fetchone():
        return jsonify({"error": "A supplier with that company name already exists."}), 400

    cursor = db.execute(
        "INSERT INTO users (name, email, password_hash, company, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (name, email, generate_password_hash(password), company, "supplier", utc_now()),
    )
    log_audit("created", "user", cursor.lastrowid, f"admin created supplier account for {company}", cursor.lastrowid)
    db.commit()
    return jsonify({"supplier_id": cursor.lastrowid, "company": company, "email": email})


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
    _portal_post("/api/public/inquiries", {
        "kind": "GENERAL",
        "contactName": fields["name"],
        "contactEmail": fields["email"],
        "contactCompany": fields["company"],
        "message": fields["message"],
    })

    return jsonify({"status": "success", "message": "Request received and logged for sourcing review."})


if __name__ == "__main__":
    debug = os.environ.get("FLASK_DEBUG", "").lower() in ("1", "true", "yes")
    # Bind to localhost by default; opt into all interfaces explicitly.
    host = "0.0.0.0" if os.environ.get("BIND_ALL", "").lower() in ("1", "true", "yes") else "127.0.0.1"
    app.run(host=host, port=5000, debug=debug)
