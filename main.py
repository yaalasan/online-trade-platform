import sqlite3
from datetime import UTC, datetime
from pathlib import Path

from flask import Flask, g, jsonify, request, send_file, session
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__, static_folder="static", static_url_path="/static")
app.secret_key = "replace-with-a-secure-secret"
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "data.db"

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
    location TEXT NOT NULL,
    description TEXT NOT NULL,
    price TEXT NOT NULL,
    moq TEXT DEFAULT '',
    lead_time TEXT DEFAULT '',
    capacity TEXT DEFAULT '',
    certifications TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    verified INTEGER DEFAULT 0,
    created_at TEXT NOT NULL
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
    status TEXT NOT NULL DEFAULT 'not_started',
    business_license TEXT DEFAULT '',
    factory_address TEXT DEFAULT '',
    evidence TEXT DEFAULT '',
    next_review_at TEXT DEFAULT '',
    updated_at TEXT NOT NULL
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
"""

SAMPLE_USERS = [
    {"name": "Global Buyer", "email": "buyer@example.com", "password": "Password123", "company": "ProcureCo", "role": "buyer"},
    {"name": "Aurora Partner", "email": "aurora@example.com", "password": "Password123", "company": "Aurora Alloys", "role": "supplier"},
    {"name": "GreenWrap Partner", "email": "greenwrap@example.com", "password": "Password123", "company": "GreenWrap", "role": "supplier"},
    {"name": "Trade Desk Admin", "email": "admin@example.com", "password": "Password123", "company": "SinoSource", "role": "admin"},
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
        "image_url": "https://images.unsplash.com/photo-1518709268805-4e9042af2176?auto=format&fit=crop&w=900&q=80",
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
        "image_url": "https://images.unsplash.com/photo-1565254973040-607b474cb50d?auto=format&fit=crop&w=900&q=80",
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
        return "p.supplier = ?", (user["company"],)
    return "1 = 1", ()


@app.after_request
def apply_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


@app.route("/")
def home():
    return send_file(BASE_DIR / "index.html")


@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    company = data.get("company", "").strip()
    role = data.get("role", "buyer")

    if not name or not email or not password or not company:
        return jsonify({"error": "All registration fields are required."}), 400
    if role not in ("buyer", "supplier"):
        role = "buyer"
    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters."}), 400

    db = get_db()
    if db.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone():
        return jsonify({"error": "Email is already registered."}), 400

    cursor = db.execute(
        "INSERT INTO users (name, email, password_hash, company, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (name, email, generate_password_hash(password), company, role, utc_now()),
    )
    log_audit("registered", "user", cursor.lastrowid, f"{role} account created", cursor.lastrowid)
    db.commit()
    session["user_id"] = cursor.lastrowid
    user = db.execute("SELECT id, name, email, company, role FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return jsonify({"user": row_to_dict(user)})


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email and password are required."}), 400

    db = get_db()
    row = db.execute("SELECT id, password_hash FROM users WHERE email = ?", (email,)).fetchone()
    if not row or not check_password_hash(row["password_hash"], password):
        return jsonify({"error": "Invalid email or password."}), 401

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
def current_user():
    return jsonify({"user": get_current_user()})


@app.route("/api/overview")
def overview():
    db = get_db()
    stats = {
        "products": db.execute("SELECT COUNT(*) FROM products").fetchone()[0],
        "verified_suppliers": db.execute("SELECT COUNT(*) FROM supplier_verifications WHERE status = 'verified'").fetchone()[0],
        "open_rfqs": db.execute("SELECT COUNT(*) FROM quotes WHERE status != 'closed'").fetchone()[0],
        "orders": db.execute("SELECT COUNT(*) FROM orders").fetchone()[0],
    }
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
    return jsonify({"categories": [row_to_dict(row) for row in rows]})


@app.route("/api/products/<int:product_id>")
def product_detail(product_id):
    row = get_db().execute("SELECT * FROM products WHERE id = ?", (product_id,)).fetchone()
    if not row:
        return jsonify({"error": "Product not found."}), 404
    return jsonify({"product": row_to_dict(row)})


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
    return jsonify({"suppliers": [row_to_dict(row) for row in rows]})


@app.route("/api/products", methods=["POST"])
def create_product():
    user, error = require_user()
    if error:
        return error
    if user["role"] not in ("supplier", "admin"):
        return jsonify({"error": "Only suppliers can add product capabilities."}), 403

    data = request.get_json(silent=True) or {}
    required = ["category", "name", "location", "description", "price", "moq", "lead_time"]
    missing = [field for field in required if not data.get(field, "").strip()]
    if missing:
        return jsonify({"error": "Missing product fields.", "missing": missing}), 400

    supplier = data.get("supplier", user["company"]).strip() if user["role"] == "admin" else user["company"]
    db = get_db()
    cursor = db.execute(
        """
        INSERT INTO products
        (category, name, supplier, location, description, price, moq, lead_time, capacity, certifications, image_url, verified, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            data["category"].strip(),
            data["name"].strip(),
            supplier,
            data["location"].strip(),
            data["description"].strip(),
            data["price"].strip(),
            data["moq"].strip(),
            data["lead_time"].strip(),
            data.get("capacity", "").strip(),
            data.get("certifications", "").strip(),
            data.get("image_url", "").strip(),
            0,
            utc_now(),
        ),
    )
    log_audit("created", "product", cursor.lastrowid, f"{supplier} listed {data['name'].strip()}")
    db.commit()
    return jsonify({"product_id": cursor.lastrowid})


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
        quantity = data.get("quantity", "").strip()
        notes = data.get("notes", "").strip()
        target_price = data.get("target_price", "").strip()
        destination = data.get("destination", "").strip()

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
    status = data.get("status", "").strip()
    allowed = {"requested", "reviewing", "quoted", "sample_requested", "accepted", "closed"}
    if status not in allowed:
        return jsonify({"error": "Invalid quote status."}), 400

    db = get_db()
    quote = db.execute(
        """
        SELECT q.*, p.supplier FROM quotes q
        JOIN products p ON q.product_id = p.id
        WHERE q.id = ?
        """,
        (quote_id,),
    ).fetchone()
    if not quote:
        return jsonify({"error": "Quote not found."}), 404
    if user["role"] != "admin" and user["id"] != quote["buyer_id"] and user["company"] != quote["supplier"]:
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
            SELECT q.*, p.supplier FROM quotes q
            JOIN products p ON q.product_id = p.id
            WHERE q.id = ?
            """,
            (quote_id,),
        ).fetchone()
        if not quote:
            return jsonify({"error": "Quote not found."}), 404
        if user["role"] != "admin" and user["id"] != quote["buyer_id"] and user["company"] != quote["supplier"]:
            return jsonify({"error": "You cannot create an order for this RFQ."}), 403
        cursor = db.execute(
            "INSERT INTO orders (quote_id, incoterm, payment_status, inspection_status, created_at) VALUES (?, ?, ?, ?, ?)",
            (
                quote_id,
                data.get("incoterm", "FOB").strip() or "FOB",
                "escrow_pending",
                "not_scheduled",
                utc_now(),
            ),
        )
        db.execute(
            "INSERT INTO trust_events (quote_id, provider, event_type, status, amount, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (quote_id, "provider_abstraction", "escrow_intent", "created", data.get("amount", ""), utc_now()),
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
        SELECT q.*, p.supplier FROM quotes q
        JOIN products p ON q.product_id = p.id
        WHERE q.id = ?
        """,
        (quote_id,),
    ).fetchone()
    if not quote:
        return jsonify({"error": "Quote not found."}), 404
    if user["role"] != "admin" and user["id"] != quote["buyer_id"] and user["company"] != quote["supplier"]:
        return jsonify({"error": "You cannot access this thread."}), 403

    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        body = data.get("body", "").strip()
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
        supplier_company = data.get("supplier_company", user["company"]).strip() if user["role"] == "admin" else user["company"]
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
            (
                supplier_company,
                data.get("business_license", "").strip(),
                data.get("factory_address", "").strip(),
                data.get("evidence", "").strip(),
                data.get("next_review_at", "2026-12-31").strip(),
                utc_now(),
            ),
        )
        log_audit("submitted", "supplier_verification", None, supplier_company)
        db.commit()

    if user["role"] == "supplier":
        rows = db.execute("SELECT * FROM supplier_verifications WHERE supplier_company = ?", (user["company"],)).fetchall()
    else:
        rows = db.execute("SELECT * FROM supplier_verifications ORDER BY updated_at DESC").fetchall()
    return jsonify({"verifications": [row_to_dict(row) for row in rows]})


@app.route("/api/contact", methods=["POST"])
def contact():
    data = request.get_json(silent=True) or {}
    required_fields = ["name", "email", "company", "message"]
    missing = [field for field in required_fields if not data.get(field)]
    if missing:
        return jsonify({"error": "Missing fields", "missing": missing}), 400

    log_audit("created", "contact_request", None, f"{data.get('company')} - {data.get('email')}")
    get_db().commit()
    return jsonify({"status": "success", "message": "Request received and logged for sourcing review."})


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
