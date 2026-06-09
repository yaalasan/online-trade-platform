# SinoSource B2B Sourcing Platform Prototype

A Flask and SQLite prototype for a B2B sourcing marketplace. It is legally distinct from Alibaba, but follows common global sourcing marketplace patterns: search-first discovery, categories, product cards with photos, supplier directory, RFQs, buyer-supplier messaging, supplier verification, order creation, trust events, and audit logging.

## Setup

1. Create a virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the app:
   ```bash
   python main.py
   ```
4. Open the platform in your browser:
   ```bash
   http://localhost:5000
   ```

## What is included

- `main.py`: Flask backend with SQLite persistence, authentication, role checks, marketplace search, RFQs, orders, messages, verification records, trust events, audit logs, and database migrations
- `index.html`: marketplace-style frontend with top navigation, category rail, product discovery, suppliers, RFQ intake, and account workspace
- `static/app.js`: frontend JavaScript for authentication, product/supplier search, category filters, product detail modals, RFQs, quote status updates, order conversion, messaging, supplier verification, product listings, and dashboard rendering
- `static/styles.css`: responsive B2B marketplace styling

## Features implemented

- Buyer and supplier registration/login
- Product search by category, supplier, location, certification, and capability
- Category browsing and supplier directory APIs
- Product cards with real photo URLs
- Buyer RFQ requests with quantity, target price, destination, and notes
- Supplier and buyer RFQ dashboards with status updates
- Buyer-supplier RFQ message threads
- Supplier capability listing creation
- Supplier verification workflow records
- Order creation from RFQs
- Trust event logging for escrow/payment-provider abstraction
- Audit trail for important platform actions
- SQLite database persistence with sample data
- Contact request form

## Available sample accounts

- Buyer: `buyer@example.com` / `Password123`
- Supplier: `aurora@example.com` / `Password123`
- Supplier: `greenwrap@example.com` / `Password123`
- Admin: `admin@example.com` / `Password123`

## Run

1. Activate the virtual environment:
   ```bash
   source .venv/bin/activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the app:
   ```bash
   python main.py
   ```
4. Open:
   ```bash
   http://localhost:5000
   ```
