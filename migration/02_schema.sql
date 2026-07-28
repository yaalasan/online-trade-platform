\c fastflow

CREATE TABLE users (
    id            integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          text NOT NULL,
    email         text UNIQUE,
    password_hash text NOT NULL,
    company       text NOT NULL,
    role          text NOT NULL CHECK (role IN ('buyer','supplier','admin')),
    contact_email text DEFAULT '',
    contact_phone text DEFAULT '',
    created_at    text NOT NULL
);

CREATE TABLE translations_cache (
    cache_key       text PRIMARY KEY,
    source_text     text NOT NULL,
    target_lang     text NOT NULL,
    translated_text text NOT NULL,
    created_at      text NOT NULL
);

CREATE TABLE products (
    id             integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    site_id        integer NOT NULL DEFAULT current_setting('app.site_id')::int REFERENCES sites(id),
    category       text NOT NULL,
    name           text NOT NULL,
    supplier       text NOT NULL,
    supplier_id    integer REFERENCES users(id),
    location       text NOT NULL,
    description    text NOT NULL,
    price          text NOT NULL,
    moq            text DEFAULT '',
    lead_time      text DEFAULT '',
    capacity       text DEFAULT '',
    certifications text DEFAULT '',
    image_url      text DEFAULT '',
    verified       integer DEFAULT 0,
    created_at     text NOT NULL
);

CREATE TABLE quotes (
    id           integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    site_id      integer NOT NULL DEFAULT current_setting('app.site_id')::int REFERENCES sites(id),
    buyer_id     integer NOT NULL REFERENCES users(id),
    product_id   integer NOT NULL REFERENCES products(id),
    quantity     text NOT NULL,
    status       text NOT NULL DEFAULT 'requested',
    target_price text DEFAULT '',
    destination  text DEFAULT '',
    notes        text,
    created_at   text NOT NULL
);

CREATE TABLE orders (
    id                integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    site_id           integer NOT NULL DEFAULT current_setting('app.site_id')::int REFERENCES sites(id),
    quote_id          integer NOT NULL REFERENCES quotes(id),
    status            text NOT NULL DEFAULT 'draft',
    incoterm          text NOT NULL DEFAULT 'FOB',
    payment_status    text NOT NULL DEFAULT 'escrow_pending',
    inspection_status text NOT NULL DEFAULT 'not_scheduled',
    created_at        text NOT NULL
);

CREATE TABLE messages (
    id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    site_id    integer NOT NULL DEFAULT current_setting('app.site_id')::int REFERENCES sites(id),
    quote_id   integer NOT NULL REFERENCES quotes(id),
    sender_id  integer NOT NULL REFERENCES users(id),
    body       text NOT NULL,
    read_at    text,
    created_at text NOT NULL
);

CREATE TABLE supplier_verifications (
    id               integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    site_id          integer NOT NULL DEFAULT current_setting('app.site_id')::int REFERENCES sites(id),
    supplier_company text NOT NULL,
    supplier_id      integer REFERENCES users(id),
    status           text NOT NULL DEFAULT 'not_started',
    business_license text DEFAULT '',
    factory_address  text DEFAULT '',
    evidence         text DEFAULT '',
    next_review_at   text DEFAULT '',
    updated_at       text NOT NULL,
    UNIQUE (site_id, supplier_company)
);

CREATE TABLE audit_logs (
    id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    site_id     integer NOT NULL DEFAULT current_setting('app.site_id')::int REFERENCES sites(id),
    actor_id    integer REFERENCES users(id),
    action      text NOT NULL,
    entity_type text NOT NULL,
    entity_id   integer,
    details     text DEFAULT '',
    created_at  text NOT NULL
);

CREATE TABLE trust_events (
    id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    site_id    integer NOT NULL DEFAULT current_setting('app.site_id')::int REFERENCES sites(id),
    quote_id   integer REFERENCES quotes(id),
    provider   text NOT NULL,
    event_type text NOT NULL,
    status     text NOT NULL,
    amount     text DEFAULT '',
    created_at text NOT NULL
);

CREATE TABLE product_specs (
    id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    site_id    integer NOT NULL DEFAULT current_setting('app.site_id')::int REFERENCES sites(id),
    product_id integer NOT NULL REFERENCES products(id),
    label      text NOT NULL,
    value      text NOT NULL,
    sort_order integer NOT NULL DEFAULT 0,
    created_at text NOT NULL
);

CREATE TABLE product_inquiries (
    id          integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    site_id     integer NOT NULL DEFAULT current_setting('app.site_id')::int REFERENCES sites(id),
    product_id  integer NOT NULL REFERENCES products(id),
    supplier_id integer REFERENCES users(id),
    name        text NOT NULL,
    email       text NOT NULL,
    company     text NOT NULL DEFAULT '',
    quantity    text NOT NULL DEFAULT '',
    message     text NOT NULL,
    created_at  text NOT NULL
);

CREATE TABLE product_media (
    id         integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    site_id    integer NOT NULL DEFAULT current_setting('app.site_id')::int REFERENCES sites(id),
    product_id integer NOT NULL REFERENCES products(id),
    type       text NOT NULL DEFAULT 'image' CHECK (type IN ('image','video')),
    url        text NOT NULL,
    thumb_url  text NOT NULL DEFAULT '',
    alt_text   text DEFAULT '',
    sort_order integer NOT NULL DEFAULT 0,
    is_primary integer NOT NULL DEFAULT 0,
    created_at text NOT NULL
);

CREATE INDEX idx_products_supplier_id      ON products(supplier_id);
CREATE INDEX idx_products_site_category    ON products(site_id, category);
CREATE INDEX idx_quotes_buyer_id           ON quotes(buyer_id);
CREATE INDEX idx_quotes_product_id         ON quotes(product_id);
CREATE INDEX idx_orders_quote_id           ON orders(quote_id);
CREATE INDEX idx_messages_quote_id         ON messages(quote_id);
CREATE INDEX idx_verifications_supplier_id ON supplier_verifications(supplier_id);
CREATE INDEX idx_audit_actor_id            ON audit_logs(actor_id);
CREATE INDEX idx_trust_quote_id            ON trust_events(quote_id);
CREATE INDEX idx_specs_product_id          ON product_specs(product_id);
CREATE INDEX idx_inquiries_product_id      ON product_inquiries(product_id);
CREATE INDEX idx_media_product_id          ON product_media(product_id);
