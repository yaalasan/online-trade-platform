"""Supplier portal integration.

The buyer-facing Flask site reads the Next.js portal's published catalog over a
small read-only JSON bridge, so a manufacturer who registers in the portal and
publishes ACTIVE products shows up here automatically. Buyer sourcing requests
flow the other way (into the portal's broker queue). All calls are best-effort:
if the portal is unreachable, the site falls back to local Postgres data.

This module is deliberately self-contained (stdlib + its own env config, no
Flask/db imports) so it can be imported anywhere without circular-import risk.
"""

import json
import os
import urllib.error
import urllib.parse
import urllib.request

PORTAL_API_URL = os.environ.get("PORTAL_API_URL", "http://localhost:3000").rstrip("/")
PORTAL_TIMEOUT = float(os.environ.get("PORTAL_TIMEOUT", "2.5"))


def _portal_get(path):
    try:
        req = urllib.request.Request(f"{PORTAL_API_URL}{path}", headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=PORTAL_TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, OSError, ValueError, TimeoutError):
        return None


def _portal_post(path, payload, headers=None):
    try:
        body = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            f"{PORTAL_API_URL}{path}",
            data=body,
            headers={"Content-Type": "application/json", "Accept": "application/json", **(headers or {})},
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
