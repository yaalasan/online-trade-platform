"""
Per-site configuration.

One dict per tenant, keyed by the `slug` column in the Postgres `sites` table.
main.py resolves the site from request.host, looks the slug up here, and passes
the result into every template as `site`.

Nothing site-specific should be hardcoded in a template. If you find yourself
typing "Fastflow" or an email address into an HTML file, it belongs here
instead -- that is what makes fastflow.asia and fastflow.tools nearly free.
"""

# Shared across every tenant unless a site overrides it.
_BASE = {
    "company_name": "Shanghai Fast Flow International Trade Co., Ltd.",
    "address": "Room 1805, No.2 Building, No.588 Longchang Road, "
               "Yangpu District, Shanghai, China",
    "tel": "021-5515 6028",
    "tel_link": "02155156028",
    "mobile": "158 0062 3930",
    "mobile_link": "15800623930",
    "whatsapp": "+86 158 0062 3930",
    "whatsapp_link": "8615800623930",   # international format, no + or spaces
    "email_sales": "sales@fastflow.global",
    "email_general": "manager@fastflow.global",
    "founded": "2022",
    "languages": [("en", "EN"), ("zh", "中文"), ("ru", "РУ")],
    "nav": [
        ("home",     "Home"),
        ("products", "Products"),
        ("about",    "About us"),
        ("contact",  "Contact us"),
        ("faq",      "FAQ"),
    ],
    "faq": [
        ("Minimum order quantity (MOQ)",
         "For machines, the minimum order is 1 unit. For spare parts, "
         "please contact us for details."),
        ("Payment terms and methods",
         "T/T &mdash; 30% in advance, 70% before shipment."),
        ("Shipping methods",
         "We arrange the method that suits your order and destination:"
         "<ul>"
         "<li>International express &mdash; DHL, FedEx, UPS</li>"
         "<li>Air freight</li>"
         "<li>Sea freight &mdash; FCL full container and LCL consolidation</li>"
         "<li>Railway transport</li>"
         "<li>Cross-border trucking</li>"
         "</ul>"),
        ("Lead time",
         "Approximately one month for machines. Lead times for other products "
         "are confirmed at quotation."),
        ("Sample policy",
         "Samples are free of charge. Freight is collect &mdash; paid by the buyer."),
        ("After-sales service",
         "Warranty period is 1 year."),
    ],
    # Product categories.
    # (name, blurb, moq, lead_time) -- moq/lead_time may be "" if not fixed.
    # The final "Custom sourcing" tile is a call to action, not a category:
    # it fills the 6th slot so the grid sits as a tidy 3x2. Remove it if you
    # would rather show five.
    "categories": [
        ("Construction Machinery", "Loaders, excavators, forklifts and mixer trucks",
         "1 unit", "~1 month"),
        ("Electric Bikes", "Electric bicycles and drive components",
         "On request", ""),
        ("Motorbikes", "Motorcycles and scooters",
         "On request", ""),
        ("Auto Spare Parts", "Replacement and wear parts for vehicles",
         "On request", ""),
        ("Moto Spare Parts", "Motorcycle replacement and wear parts",
         "On request", ""),
        ("Custom sourcing", "Send us a specification, drawing or sample",
         "", "Quote within 48h"),
    ],

    "services": [
        ("Product sourcing",
         "We identify and shortlist manufacturers matching your specification and budget."),
        ("Supplier audit",
         "Factories are verified before we recommend them &mdash; licence, capability, and capacity."),
        ("Quality inspection",
         "Goods are inspected before shipment so problems are caught in China, not at your door."),
        ("Export consulting",
         "Documentation, certification, and customs requirements for your destination market."),
        ("Logistics coordination",
         "Express, air, sea, rail, or cross-border trucking &mdash; arranged end to end."),
        ("Supply chain support",
         "Ongoing management for repeat orders and long-term supply relationships."),
    ],
}


def _build(**overrides):
    cfg = dict(_BASE)
    cfg.update(overrides)
    return cfg


SITES = {
    "fastflow": _build(
        brand_name="FASTFLOW",
        brand_split=("FAST", "FLOW"),        # for the two-tone logo
        domain="fastflow.global",
        tagline="Verified sourcing for global buyers.",
        hero_title="Machinery and vehicle parts from verified Chinese suppliers",
        hero_text="Shanghai-based sourcing and export. Construction machinery, "
                  "e-bikes, motorbikes and spare parts &mdash; we find the "
                  "supplier, audit the factory, inspect the goods, and ship it "
                  "to you.",
        meta_description="Shanghai Fast Flow International Trade Co., Ltd. "
                         "Construction machinery, auto and moto spare parts, "
                         "e-bikes and motorbikes sourced from verified Chinese "
                         "manufacturers. Supplier audit, quality inspection and "
                         "export logistics.",
        accent="#E8400C",
    ),

    "asia": _build(
        brand_name="FASTFLOW ASIA",
        brand_split=("FASTFLOW", " ASIA"),
        domain="fastflow.asia",
        tagline="Regional sourcing across Asia.",
        hero_title="Sourcing across Asian manufacturing",
        hero_text="Placeholder copy &mdash; replace when the Asia vertical is defined.",
        meta_description="Fastflow Asia &mdash; regional sourcing and export services.",
        accent="#E8400C",
    ),

    "tools": _build(
        brand_name="FASTFLOW TOOLS",
        brand_split=("FASTFLOW", " TOOLS"),
        domain="fastflow.tools",
        tagline="Heavy machinery and equipment.",
        hero_title="Heavy machinery, sourced and shipped",
        hero_text="Loaders, excavators, forklifts and mixer trucks from audited "
                  "Chinese manufacturers &mdash; inspected before dispatch.",
        meta_description="Fastflow Tools &mdash; heavy machinery, construction "
                         "equipment and spare parts sourced from verified "
                         "Chinese manufacturers.",
        accent="#E8400C",
    ),
}


def get_site(slug):
    """Return the config for a slug, falling back to the main site."""
    return SITES.get(slug, SITES["fastflow"])
