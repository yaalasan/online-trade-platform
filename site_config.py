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
        ("Minimum order quantity MOQ",
         "For finished units, the minimum order is 1-5 units. For spare parts, "
         "please contact us for details."),
        ("Payment terms and methods",
         "T/T &mdash; 30% in advance, 70% before shipment."
         " We accept Letter of Credit, terms are subject to order value."),
        ("Shipping methods",
         "We arrange the method that suits your order and destination:"
         "<ul>"
         "<li>International express &mdash; DHL, FedEx, UPS</li>"
         "<li>Air freight</li>"
         "<li>Sea freight &mdash; FCL full container and LCL consolidation</li>"
         "<li>Railway transport</li>"
         "<li>Cross-border trucking</li>"
         "</ul>"),
        ("Production lead time",
         "Standard orders: 7-20 working days. Custom/OEM orders will be quoted separately. "),
        ("Sample policy",
         "Samples are available. Sample cost and freight will be on buyer's side."),
        ("Quality & After-sales service",
         "Quality warranty for qualified products. Spare parts and remote technical support provided."),
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

    # Hero accountability chain -- the four things we own, in order, dramatised
    # on the homepage hero. Order matters (it is the sequence of an order).
    "chain": [
        "Find the supplier",
        "Audit the factory",
        "Inspect the goods",
        "Ship to your door",
    ],

    # Proof stats for the homepage "track record" band. Keep these HONEST -- this
    # is the live site. The four below are already true and verifiable. Replace
    # or extend them with stronger confirmed figures the moment you have them
    # (e.g. orders shipped, countries served, average reply time in hours).
    # A value of None is filled in live by the view (page_home) with a real,
    # verified count from the database -- never hardcode a product number here.
    "metrics": [
        ("2022", "Sourcing &amp; export from Shanghai since"),
        ("48h", "Typical quote turnaround"),
        (None, "Products sourced end to end"),
        ("6", "Services from enquiry to delivery"),
    ],

    # "How we work" -- each step names what the buyer actually receives, so the
    # process reads as accountability, not filler. (title, detail, deliverable)
    "process": [
        ("Tell us what you need",
         "Send your specification, drawing, or reference product. We identify "
         "suitable manufacturers and shortlist them for you.",
         "A shortlist of vetted, capable factories."),
        ("Quotation and samples",
         "We negotiate pricing, arrange samples, and collect compliance "
         "documents on your behalf.",
         "Quotes, samples, and paperwork in one place."),
        ("Inspection and shipping",
         "Goods are inspected before dispatch, then shipped by the method that "
         "suits your order and destination.",
         "A pre-shipment inspection report with photos."),
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
        tagline="Industrial equipment, sourced with confidence.",
        hero_title="Industrial equipment and components from verified Chinese suppliers",
        hero_text="Metal-processing machinery, industrial equipment, electronic "
                  "components and hardware tools &mdash; we find the supplier, "
                  "audit the factory, inspect the goods, and ship them to you.",
        meta_description="Fastflow Tools sources metal plate processing machinery, "
                         "industrial equipment, electronic components and hardware "
                         "tools from verified Chinese manufacturers.",
        categories=[
            ("Metal Plate Processing Machinery",
             "Fabrication, cutting, bending and forming equipment",
             "1 unit", "Quoted per model"),
            ("Industrial Equipment",
             "Production, handling and workshop equipment",
             "On request", "Quoted per model"),
            ("Electronic Components",
             "Components and assemblies for industrial applications",
             "On request", ""),
            ("Hardware Tools",
             "Professional tools and hardware for trade and industry",
             "On request", ""),
            ("Custom sourcing", "Send us a specification, drawing or sample",
             "", "Quote within 48h"),
        ],
        accent="#E8400C",
    ),
}


def get_site(slug):
    """Return the config for a slug, falling back to the main site."""
    return SITES.get(slug, SITES["fastflow"])
