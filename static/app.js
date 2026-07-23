const marketplaceGrid = document.getElementById('marketplace-grid');
const supplierGrid = document.getElementById('supplier-grid');
const categoryList = document.getElementById('category-list');
const userPanel = document.getElementById('user-panel');
const headerSearch = document.getElementById('header-search');
const searchType = document.getElementById('search-type');
const searchQuery = document.getElementById('search-query');
const heroSearchForm = document.getElementById('search-form');
const heroSearchQuery = document.getElementById('hero-search-query');
const supplierSearch = document.getElementById('supplier-search');
const contactForm = document.getElementById('contact-form');
const contactFeedback = document.getElementById('contact-feedback');
const accountModal = document.getElementById('account-modal');
const modalBody = document.getElementById('modal-body');
const quoteModal = document.getElementById('quote-modal');
const quoteForm = document.getElementById('quote-form');
const quoteProductId = document.getElementById('quote-product-id');
const quoteQuantity = document.getElementById('quote-quantity');
const quoteTargetPrice = document.getElementById('quote-target-price');
const quoteDestination = document.getElementById('quote-destination');
const quoteNotes = document.getElementById('quote-notes');
const quoteFeedback = document.getElementById('quote-feedback');

let currentUser = null;
let activeQuoteId = null;
let activeCategory = '';
let lastMarketplaceQuery = '';
// B2B filter state (5.2) — mirrored to the URL so results are shareable.
let filterLocation = '';
let filterVerified = false;
let filterLeadMax = '';
let knownLocations = [];
let currentLang = 'en';


const translations = {
  en: {
    utilitySlogan: 'Vetted Chinese suppliers · Multilingual product pages · Hands-on sourcing support',
    navAbout: 'About',
    navContact: 'Contact',
    navAboutUs: 'About Us',
    navMembership: 'Membership',
    navFaq: 'FAQ',
    authSignIn: 'Sign in',
    authJoinFree: 'Join Free',
    navPortal: 'Supplier Portal',
    heroListCompany: 'List your factory',
    heroEyebrow: 'Cross-border sourcing, handled',
    heroTitle: 'Source from verified Chinese factories — without the guesswork',
    heroSubtitle: 'Tell us what you need. Get matched with vetted suppliers in days, then let us handle quotes, compliance, and shipping.',
    heroBuyerBtn: 'Find suppliers',
    heroSupplierBtn: 'Become a supplier — contact us',
    heroConsultBtn: 'Online Consultation',
    heroHighlights: 'Vetted suppliers · Multilingual browsing · Hands-on sourcing support',
    heroShowcaseBadge: '🌐 Global Sourcing Platform',
    searchProducts: 'Products',
    searchSuppliers: 'Suppliers',
    searchPlaceholder: 'Search products, suppliers, certifications...',
    searchButton: 'Search',
    advantageEyebrow: 'Platform advantages',
    advantageTitle: 'Four things that make sourcing simpler',
    featureMatchTitle: 'Supplier matching',
    featureMatchCopy: 'Tell us what you need — we search our verified factory network and connect you with qualified suppliers across categories.',
    featureCommTitle: 'Multilingual browsing',
    featureCommCopy: 'Product pages translated into English, Chinese, and Russian via AI translation. Browse and communicate in your language.',
    featureRiskTitle: 'Trade compliance',
    featureRiskCopy: 'Supplier verification, pre-shipment inspections, and customs document support — so your goods arrive as ordered.',
    featureConsultTitle: 'End-to-end consulting',
    featureConsultCopy: 'Policy analysis, tariff consulting, factory audits, and quality inspection — your sourcing desk without the headcount.',
    statsProducts: 'Products available for sourcing',
    statsVerified: 'Verified suppliers',
    statsRfqs: 'Live RFQ requests',
    statsOrdersMetric: 'Orders tracked in dashboard',
    servicesEyebrow: 'Service scenarios',
    servicesTitle: 'Buyer & supplier services for global trade',
    buyersSectionTitle: 'Buyer services',
    buyersList1: 'Post purchasing requests and get matched with qualified suppliers',
    buyersList2: 'Compare quotes, review qualifications and transaction history',
    buyersList3: 'One-stop logistics, customs, and payment support',
    buyersList4: 'Dedicated trade consultant for negotiation and fulfillment support',
    buyersSub: 'Post purchasing requests, compare quotes from verified suppliers, and access logistics, customs, and payment support.',
    suppliersSectionTitle: 'Supplier services',
    suppliersList1: 'Register free and connect with global buyers',
    suppliersList2: 'Multilingual product pages and overseas visibility',
    suppliersList3: 'Targeted inquiry distribution to boost order volume',
    suppliersList4: 'Compliance guidance, document templates, and risk alerts',
    suppliersSub: 'Register free, get multilingual product pages, receive targeted inquiries, and gain compliance guidance.',
    serviceListEyebrow: 'Core services',
    serviceListTitle: 'Value-added service modules',
    serviceMatch: 'Trade mediation',
    serviceMatchSub: 'Supply-demand matching, order brokerage and negotiation support.',
    serviceCompliance: 'Compliance consulting',
    serviceComplianceSub: 'Import/export policy, tariff, rebate and certification support.',
    serviceDocument: 'Document service',
    serviceDocumentSub: 'Contracts, PI, packing lists, and customs documents — prepared and reviewed for you.',
    serviceInspection: 'Factory audit & QC',
    serviceInspectionSub: 'On-site audit, pre-shipment inspection and third-party quality control.',
    serviceLogistics: 'Logistics solution',
    serviceLogisticsSub: 'Integrated sea freight, air freight and dedicated line services.',
    marketplaceEyebrow: 'Products',
    marketplaceTitle: 'Featured sourcing opportunities',
    suppliersEyebrow: 'Suppliers',
    suppliersTitle: 'Supplier network',
    supplierSearchPlaceholder: 'Search suppliers, locations, certifications...',
    aboutEyebrow: 'About Us',
    aboutTitle: 'Trade expertise bridging global buyers and verified suppliers',
    aboutCopy1: 'We are a cross-border sourcing platform combining trade expertise and verification infrastructure to connect global buyers with Chinese manufacturers.',
    aboutCopy2: 'Adhering to Integrity, Professionalism, Efficiency and Compliance, we match reliable sources for buyers and help domestic factories expand globally with consulting and risk-control support.',
    membershipEyebrow: 'Membership & Fees',
    membershipTitle: 'Flexible registration, transparent membership',
    supplierRegistrationTitle: 'Supplier Registration',
    supplierRegistrationReq: 'Requirements: valid business license, production or supply qualification, and compliant export products.',
    supplierRegistrationPlans: 'Basic plan: free registration and standard inquiries. Premium plan: priority listing, homepage exposure, and traffic support.',
    supplierRegistrationPricing: 'Service fees apply only to successful order brokerage, with no hidden charges.',
    buyerServiceTitle: 'Buyer Service',
    buyerServiceCopy: 'Post requests and find suppliers for FREE forever; fees only apply to custom audits, dedicated consultants and expedited documents.',
    faqEyebrow: 'FAQ',
    faqTitle: 'Frequently asked questions',
    faqSafetyQ: 'How does the platform secure transactions?',
    faqSafetyA: 'We vet suppliers before listing them and our team stays involved in every deal — from quote to delivery.',
    faqFeesQ: 'Is there a fee to join the platform?',
    faqFeesA: 'Basic registration is free. Fees apply only for promotion, premium membership and value-added services.',
    faqPostQ: 'Can I post purchasing requests?',
    faqPostA: 'Yes, post purchasing requests for free after registration and we\'ll match you with suitable suppliers.',
    faqLangQ: 'What languages does the platform support?',
    faqLangA: 'The platform is available in English, Chinese, and Russian. Product listings are translated automatically.',
    faqMultiQ: 'Can products be displayed in multiple languages?',
    faqMultiA: 'Yes, product names, descriptions, and specifications are automatically translated into multiple languages.',
    faqAssignQ: 'How are inquiries assigned?',
    faqAssignA: 'Our team reviews each inquiry and forwards it to the manufacturer best suited to your requirements.',
    contactEyebrow: 'Contact Us',
    contactTitle: 'Ready to source from China? Let\'s talk.',
    contactLine1: 'Online support | Email | Phone | Address',
    contactLine2: 'Multilingual consultation available. Welcome global partners.',
    contactLabelName: 'Name',
    contactNamePlaceholder: 'Your name',
    contactLabelEmail: 'Company Email',
    contactEmailPlaceholder: 'name@company.com',
    contactLabelCompany: 'Company',
    contactCompanyPlaceholder: 'Your company',
    contactLabelMessage: 'Request',
    contactMessagePlaceholder: 'Product specs, quantity, delivery port, certifications',
    contactSubmit: 'Submit sourcing request',
    dashboardEyebrow: 'Account',
    dashboardTitle: 'My Fastflow',
    auditEyebrow: 'Operations',
    auditTitle: 'Recent audit trail',
    footerDescription: 'Trade mediation, sourcing consulting, and full-process cross-border support.',
    quoteHeader: 'Request quote',
    quoteLabelQuantity: 'Quantity',
    quoteQuantityPlaceholder: 'e.g. 5,000 units',
    quoteLabelPrice: 'Target price',
    quotePricePlaceholder: 'Optional target landed price',
    quoteLabelDestination: 'Destination',
    quoteDestinationPlaceholder: 'Port or delivery city',
    quoteLabelNotes: 'Notes',
    quoteNotesPlaceholder: 'Specs, packaging, inspection, deadline',
    quoteSubmit: 'Send RFQ',
    authFieldName: 'Name',
    authFieldCompany: 'Company',
    authFieldEmail: 'Email',
    authFieldPassword: 'Password',
    authFieldRole: 'Role',
    authRoleBuyer: 'Buyer',
    authRoleSupplier: 'Supplier',
    authCreateAccount: 'Create account',
    authNeedAccount: 'Need an account?',
    authAlreadyRegistered: 'Already registered?',
    authJoinFreeOption: 'Join free',
    authBuyerPrompt: 'Sign in as a buyer to send RFQs.',
    authBuyerRequiredTitle: 'Buyer account required',
    authBuyerRequiredDesc: 'Supplier and admin accounts can manage listings and RFQs, but only buyers can send new quote requests.',
    authClose: 'Close',
    noAuditEvents: 'No audit events yet.',
    trustItem1: 'Suppliers vetted by our team',
    trustItem2: 'Hands-on support on every order',
    trustItem3: 'Compliance and document guidance',
    trustItem4: 'Support in English, Chinese & Russian',
    howEyebrow: 'How It Works',
    howTitle: 'Three steps to global trade',
    howStep1Num: '01',
    howStep1Title: 'Register & Post',
    howStep1Copy: 'Create a free buyer or supplier account and post your products or sourcing requests in minutes.',
    howStep2Num: '02',
    howStep2Title: 'Get matched',
    howStep2Copy: 'We review your requirements and introduce you to verified buyers or qualified suppliers — typically within 24–48 hours.',
    howStep3Num: '03',
    howStep3Title: 'Connect & Trade',
    howStep3Copy: 'Communicate, exchange RFQs, negotiate terms, and complete trades with full compliance and logistics support.',
    dashboardTabRfqs: 'RFQs',
    dashboardTabOrders: 'Orders',
    dashboardTabVerification: 'Verification',
    dashboardTabProducts: 'Products',
    dashboardTabAdmin: 'Admin',
    dashboardLogout: 'Logout',
    dashboardRfqThread: 'RFQ Thread',
    dashboardRfqThreadEmpty: 'Select an RFQ to open the thread.',
    categoriesAll: 'All Categories',
    catAllPrefix: 'All',
    categoryProducts: 'products',
    systemActor: 'System',
    metricOrdersLabel: 'orders',
    pillVerified: 'Verified',
    specMoq: 'MOQ',
    specLeadTime: 'Lead time',
    specCapacity: 'Capacity',
    specAsk: 'Ask',
    cardRequestQuote: 'Request quote',
    cardViewDetails: 'View details',
    marketplaceEmpty: 'No matching products found.',
    emptyCtaSource: 'Tell us what you\'re sourcing',
    filterVerified: 'Verified only',
    filterLocation: 'Location',
    filterLeadTime: 'Lead time',
    filterAny: 'Any',
    filterLeadDays: '≤ {d} days',
    filterClear: 'Clear filters',
    emptyProductsLead: 'Nothing here yet — post what you need and we\'ll match you with verified factories.',
    emptySuppliersLead: 'No suppliers to show yet — tell us your category and we\'ll introduce qualified factories.',
    marketplaceError: 'Unable to load marketplace data.',
    categoriesError: 'Categories unavailable.',
    auditError: 'Unable to load audit trail.',
    detailSupplier: 'Supplier',
    detailLocation: 'Location',
    detailPrice: 'Price',
    detailCertifications: 'Certifications',
    detailPending: 'Pending',
    productUnavailable: 'Product unavailable',
    pdLoading: 'Loading…',
    galEmpty: 'No photos yet — ask the supplier for product images.',
    galStageLabel: 'Product media. Use arrow keys to browse, Enter to enlarge.',
    galThumbsLabel: 'Product media thumbnails',
    galLightboxLabel: 'Product image viewer',
    galPrev: 'Previous',
    galNext: 'Next',
    galZoomOpen: 'View full screen',
    galImageUnavailable: 'Image unavailable',
    galPhotoOf: '{name} — photo {n} of {m}',
    galVideoOf: 'Product video {n} of {m}',
    pdMinOrder: 'Min. order',
    pdTrustVetted: 'Manufacturer vetted by our team',
    pdTrustInspection: 'Pre-shipment inspection available',
    pdTrustSupport: 'Hands-on support from quote to delivery',
    pdVerifiedBadge: 'Verified supplier',
    pdSpecs: 'Specifications',
    pdInquiryTitle: 'Send inquiry',
    pdFieldName: 'Your name',
    pdFieldNamePh: 'Full name',
    pdFieldEmail: 'Company email',
    pdFieldEmailPh: 'you@company.com',
    pdFieldCompany: 'Company',
    pdFieldCompanyPh: 'Company name',
    pdFieldQty: 'Target quantity',
    pdFieldQtyPh: 'e.g. 200',
    pdFieldMessage: 'Message',
    pdFieldMessagePh: 'Requirements, target price, destination port… (20–4000 characters)',
    pdSend: 'Send inquiry',
    pdSending: 'Sending…',
    pdErrName: 'Please enter your name.',
    pdErrEmail: 'Enter a valid email address.',
    pdErrMessage: 'Message must be at least 20 characters.',
    pdErrSend: 'Could not send inquiry. Please try again.',
    pdErrNetwork: 'Network error. Please try again.',
    pdSent: 'Inquiry sent! Our team will be in touch shortly.',
    pdDescription: 'Description',
    pdSupplierTitle: 'About this supplier',
    pdVerificationPending: 'Verification pending',
    pdResponseRate: 'Response rate',
    pdNotRated: 'Not yet rated',
    pdYearsActive: 'On Fastflow since',
    pdMemberSince: 'On Fastflow since {y}',
    pdCtaHint: 'No account needed — the supplier replies by email',
    pdErrNameFix: 'Add your name so the supplier knows who is asking.',
    pdErrEmailFix: 'Enter a valid email — the supplier replies to this address.',
    pdErrMessageFix: 'Describe what you need in at least 20 characters — specs, quantity, destination.',
    pdSentTitle: 'Inquiry sent to {supplier}',
    pdSentNext: 'They usually reply within 1–2 business days. Their response goes to {email}.',
    supplierProducts: 'Products',
    supplierCategories: 'Categories',
    supplierCertifications: 'Certifications',
    supplierLocationPending: 'Location pending',
    supplierPending: 'Pending',
    suppliersEmpty: 'No suppliers found.',
    suppliersError: 'Unable to load suppliers.',
    rfqMine: 'My RFQs',
    rfqQueue: 'RFQ queue',
    rfqActiveRecords: 'active records',
    recordQuantity: 'Quantity',
    recordStatus: 'Status',
    recordTarget: 'Target',
    recordDestination: 'Destination',
    recordNotSet: 'Not set',
    openThread: 'Open thread',
    createOrderBtn: 'Create order',
    rfqEmpty: 'No RFQs yet. Buyers can request quotes from product cards.',
    statusRequested: 'Requested',
    statusReviewing: 'Reviewing',
    statusQuoted: 'Quoted',
    statusSampleRequested: 'Sample requested',
    statusAccepted: 'Accepted',
    statusClosed: 'Closed',
    ordersTitle: 'Orders',
    ordersTradeRecords: 'trade records',
    orderLabel: 'Order',
    orderIncoterm: 'Incoterm',
    orderPayment: 'Payment',
    orderInspection: 'Inspection',
    ordersEmpty: 'No orders created yet.',
    threadPlaceholder: 'Write to this RFQ thread',
    threadSend: 'Send',
    verificationTitle: 'Supplier verification',
    verificationRecords: 'records',
    verifStatus: 'Status',
    verifApprove: 'Approve — mark verified',
    verifRevoke: 'Revoke verification',
    verifActionError: 'Could not update verification.',
    verifFactory: 'Factory',
    verifEvidence: 'Evidence',
    verifNextReview: 'Next review',
    verifMissing: 'Missing',
    verifUnset: 'Unset',
    verifBusinessLicense: 'Business license',
    verifBusinessLicensePh: 'License number or document reference',
    verifFactoryAddress: 'Factory address',
    verifFactoryAddressPh: 'Registered factory address',
    verifEvidenceLabel: 'Evidence',
    verifEvidencePh: 'Certificates, ownership, audit notes',
    verifSubmit: 'Submit evidence',
    verifCompany: 'Supplier company',
    verifCompanyPick: 'Choose a company…',
    verifCompanyNone: 'No suppliers left to add — all listed companies already have a record.',
    verifOptional: '(optional)',
    verifAdminHint: 'Pick a company to create a verification record, then Approve it. License and evidence are optional.',
    productFormTitle: 'Add product listing',
    productFormSub: 'Supplier listings enter verification review',
    pfCategory: 'Category',
    pfCategoryPh: 'e.g. Agricultural Machinery — pick from the list',
    pfName: 'Name',
    pfNamePh: 'Product title',
    pfLocation: 'Location',
    pfLocationPh: 'City, country',
    pfPrice: 'Price',
    pfPricePh: '$ / unit',
    pfMoq: 'MOQ',
    pfMoqPh: 'Minimum order quantity',
    pfLeadTime: 'Lead time',
    pfLeadTimePh: 'e.g. 21 days',
    pfCapacity: 'Capacity',
    pfCapacityPh: 'Monthly production capacity',
    pfCertifications: 'Certifications',
    pfCertificationsPh: 'ISO, CE, RoHS...',
    pfPhoto: 'Photo URL',
    pfPhotoPh: 'https://...',
    pfDescription: 'Description',
    pfDescriptionPh: 'Materials, specs, packaging, use cases',
    pfSubmit: 'Add listing',
    pfMediaLabel: 'Photos & video',
    pfEditTitle: 'Edit product',
    pfEditSubmit: 'Save changes',
    pfCancelEdit: 'Cancel',
    pfMyListings: 'My listings',
    pfEditBtn: 'Edit',
    adminAddSupplierTitle: 'Add manufacturer account',
    adminAddSupplierSub: 'Register a manufacturer — managed by your team, no supplier login',
    adminSupplierName: 'Contact name',
    adminSupplierCompany: 'Company name',
    adminSupplierEmail: 'Contact email (shown on product pages)',
    adminSupplierPhone: 'Contact phone',
    adminSupplierSubmit: 'Register manufacturer',
    adminSupplierCreated: 'Manufacturer registered.',
    adminAddProductTitle: 'Add product on behalf of supplier',
    adminProductSupplier: 'Manufacturer',
    adminProductSupplierPick: 'Select a registered manufacturer…',
    rfqSubmitted: 'RFQ submitted. Check My Fastflow.',
    aiTranslatedBadge: 'AI Translated',
    rfqTranslating: 'Translating your message to Chinese...',
    rfqTranslateError: 'Translation unavailable, sending original.',
    translationPending: 'Auto-translating...'
  },
  zh: {
    utilitySlogan: '严选中国供应商 · 多语种产品页面 · 全程采购支持',
    navAbout: '关于',
    navContact: '联系我们',
    navAboutUs: '关于我们',
    navMembership: '入驻规则',
    navFaq: '常见问答',
    authSignIn: '登录',
    authJoinFree: '免费入驻',
    navPortal: '供应商门户',
    heroListCompany: '登记您的公司',
    heroEyebrow: '跨境采购，交给我们',
    heroTitle: '严选中国工厂直采——告别盲选',
    heroSubtitle: '告诉我们您的需求，几天内为您匹配严选供应商，报价、合规与物流全程由我们处理。',
    heroBuyerBtn: '海外买家：立即找货源',
    heroSupplierBtn: '供应商入驻：联系我们',
    heroConsultBtn: '在线咨询',
    heroHighlights: '严选供应商 · 多语种浏览 · 全程采购支持',
    heroShowcaseBadge: '🌐 全球采购平台',
    searchProducts: '产品',
    searchSuppliers: '供应商',
    searchPlaceholder: '搜索产品、供应商、认证...',
    searchButton: '搜索',
    advantageEyebrow: '平台优势',
    advantageTitle: '让采购更简单的四大优势',
    featureMatchTitle: '供应商匹配',
    featureMatchCopy: '告诉我们您的需求——我们在严选工厂网络中为您对接各品类的合格供应商。',
    featureCommTitle: '多语种浏览',
    featureCommCopy: '产品页面自动翻译为英语、中文和俄语，用您的语言浏览与沟通。',
    featureRiskTitle: '贸易合规保障',
    featureRiskCopy: '供应商审核、出货前验货与报关单证支持——确保货物如约到达。',
    featureConsultTitle: '全链条外贸咨询',
    featureConsultCopy: '政策解读、市场调研、关税咨询、验厂质检、单证制作，一站式解决外贸问题。',
    statsProducts: '可采购产品',
    statsVerified: '认证供应商',
    statsRfqs: '实时询盘',
    statsOrdersMetric: '订单跟踪',
    servicesEyebrow: '服务场景',
    servicesTitle: '采购商与供应商一站式服务',
    buyersSectionTitle: '采购商服务',
    buyersList1: '发布采购需求，为您匹配合格供应商',
    buyersList2: '在线比价、资质查看、成交记录查询',
    buyersList3: '一站式物流、报关、结算配套服务',
    buyersList4: '专属顾问协助谈判与履约',
    buyersSub: '发布采购需求，比较严选供应商报价，享受物流、报关与结算支持。',
    suppliersSectionTitle: '供应商服务',
    suppliersList1: '免费入驻，直面全球采购商',
    suppliersList2: '多语种产品页面，海外曝光引流',
    suppliersList3: '精准分发询盘，提升接单效率',
    suppliersList4: '合规指导、单证模板、风险预警',
    suppliersSub: '免费注册，产品信息多语种展示，接收精准询盘并获得合规支持。',
    serviceListEyebrow: '核心服务',
    serviceListTitle: '增值服务模块',
    serviceMatch: '外贸撮合',
    serviceMatchSub: '供需对接、订单居间、商务谈判协助。',
    serviceCompliance: '合规咨询',
    serviceComplianceSub: '进出口政策、关税、退税、认证服务。',
    serviceDocument: '单证服务',
    serviceDocumentSub: '合同、PI、装箱单、报关资料——由我们为您准备与审核。',
    serviceInspection: '验厂与质检',
    serviceInspectionSub: '实地验厂、出货质检、第三方品控。',
    serviceLogistics: '物流方案',
    serviceLogisticsSub: '海运、空运与专线物流整合方案。',
    marketplaceEyebrow: '产品',
    marketplaceTitle: '精选采购机会',
    suppliersEyebrow: '供应商',
    suppliersTitle: '供应商网络',
    supplierSearchPlaceholder: '搜索供应商、地点、认证...',
    aboutEyebrow: '关于我们',
    aboutTitle: '以贸易经验连接全球买家与严选供应商',
    aboutCopy1: '我们是跨境采购服务平台，凭借贸易经验与供应商审核体系，连接全球买家与中国制造商。',
    aboutCopy2: '秉持诚信、专业、高效、合规，为海外采购商匹配靠谱货源，为国内工厂开拓全球市场。',
    membershipEyebrow: '入驻规则',
    membershipTitle: '灵活入驻，透明收费',
    supplierRegistrationTitle: '供应商入驻',
    supplierRegistrationReq: '要求：合法营业执照、生产/供货资质，产品符合进出口标准。',
    supplierRegistrationPlans: '基础版免费入驻，进阶版享受优先展示、首页曝光与流量扶持。',
    supplierRegistrationPricing: '撮合服务费仅针对成交订单，拒绝隐形消费。',
    buyerServiceTitle: '采购商服务',
    buyerServiceCopy: '发布需求、查找供应商永久免费，仅对定制验厂、专属顾问、加急单证等增值服务收费。',
    faqEyebrow: '常见问答',
    faqTitle: '常见问题',
    faqSafetyQ: '平台如何保障交易安全？',
    faqSafetyA: '供应商上架前经我们团队审核，交易全程有团队跟进——从报价到交付。',
    faqFeesQ: '入驻平台需要收费吗？',
    faqFeesA: '基础入驻免费，付费仅针对推广、高级会员和增值服务。',
    faqPostQ: '可以发布采购需求吗？',
    faqPostA: '可以，注册后免费发布，我们会为您匹配合适的供应商。',
    faqLangQ: '支持哪些语种沟通？',
    faqLangA: '平台支持英语、中文和俄语，产品信息自动翻译。',
    faqMultiQ: '产品可以做多语种展示吗？',
    faqMultiA: '可以，产品名称、详情和参数会自动翻译。',
    faqAssignQ: '询盘如何分配？',
    faqAssignA: '我们的团队会审核每条询盘，并转发给最合适的制造商。',
    contactEyebrow: '联系我们',
    contactTitle: '准备从中国采购？联系我们。',
    contactLine1: '在线客服 | 企业邮箱 | 联系电话 | 办公地址',
    contactLine2: '支持多语种咨询，欢迎海内外客户合作。',
    contactLabelName: '姓名',
    contactNamePlaceholder: '您的姓名',
    contactLabelEmail: '公司邮箱',
    contactEmailPlaceholder: 'name@company.com',
    contactLabelCompany: '公司',
    contactCompanyPlaceholder: '您的公司',
    contactLabelMessage: '咨询内容',
    contactMessagePlaceholder: '产品规格、数量、目的港、认证要求',
    contactSubmit: '提交询盘',
    dashboardEyebrow: '账户',
    dashboardTitle: '我的 Fastflow',
    auditEyebrow: '运营',
    auditTitle: '最新审核记录',
    footerDescription: '外贸撮合、采购咨询与跨境订单全流程服务。',
    quoteHeader: '请求报价',
    quoteLabelQuantity: '数量',
    quoteQuantityPlaceholder: '例如 5,000 件',
    quoteLabelPrice: '目标价格',
    quotePricePlaceholder: '可选目标到岸价',
    quoteLabelDestination: '目的地',
    quoteDestinationPlaceholder: '港口或交付城市',
    quoteLabelNotes: '备注',
    quoteNotesPlaceholder: '规格、包装、检验、交期',
    quoteSubmit: '发送询盘',
    authFieldName: '姓名',
    authFieldCompany: '公司',
    authFieldEmail: '邮箱',
    authFieldPassword: '密码',
    authFieldRole: '身份',
    authRoleBuyer: '买家',
    authRoleSupplier: '供应商',
    authCreateAccount: '创建账号',
    authNeedAccount: '需要账号吗？',
    authAlreadyRegistered: '已注册？',
    authJoinFreeOption: '免费入驻',
    authBuyerPrompt: '请买家登录后发送询盘。',
    authBuyerRequiredTitle: '需要买家账号',
    authBuyerRequiredDesc: '供应商和管理账号可以管理商品和询盘，但只有买家可以发送新询盘。',
    authClose: '关闭',
    noAuditEvents: '暂无审计记录。',
    trustItem1: '供应商经我们团队严选',
    trustItem2: '每笔订单全程跟进',
    trustItem3: '合规与单证指导',
    trustItem4: '英语、中文、俄语支持',
    howEyebrow: '服务流程',
    howTitle: '三步开启全球贸易',
    howStep1Num: '01',
    howStep1Title: '注册发布',
    howStep1Copy: '免费创建买家或供应商账号，几分钟内发布产品或采购需求。',
    howStep2Num: '02',
    howStep2Title: '获取匹配',
    howStep2Copy: '我们审核您的需求，通常在24–48小时内为您对接合格供应商或买家。',
    howStep3Num: '03',
    howStep3Title: '对接成交',
    howStep3Copy: '直接沟通、交换询盘、谈判条款，并在全程合规与物流支持下完成交易。',
    dashboardTabRfqs: '询盘',
    dashboardTabOrders: '订单',
    dashboardTabVerification: '资质认证',
    dashboardTabProducts: '产品管理',
    dashboardTabAdmin: '管理员',
    dashboardLogout: '退出登录',
    dashboardRfqThread: '询盘会话',
    dashboardRfqThreadEmpty: '选择询盘查看对话。',
    categoriesAll: '全部品类',
    catAllPrefix: '全部',
    categoryProducts: '件产品',
    systemActor: '系统',
    metricOrdersLabel: '个订单',
    pillVerified: '已认证',
    specMoq: '起订量',
    specLeadTime: '交期',
    specCapacity: '产能',
    specAsk: '面议',
    cardRequestQuote: '索取报价',
    cardViewDetails: '查看详情',
    marketplaceEmpty: '未找到匹配的产品。',
    emptyCtaSource: '告诉我们您的采购需求',
    filterVerified: '仅认证',
    filterLocation: '产地',
    filterLeadTime: '交期',
    filterAny: '全部',
    filterLeadDays: '≤ {d} 天',
    filterClear: '清除筛选',
    emptyProductsLead: '这里还没有内容 — 发布您的采购需求，我们将为您匹配认证工厂。',
    emptySuppliersLead: '暂无可显示的供应商 — 告诉我们您的品类，我们将为您推荐合格工厂。',
    marketplaceError: '无法加载产品数据。',
    categoriesError: '品类暂不可用。',
    auditError: '无法加载审计记录。',
    detailSupplier: '供应商',
    detailLocation: '所在地',
    detailPrice: '价格',
    detailCertifications: '认证',
    detailPending: '待定',
    productUnavailable: '产品不可用',
    pdLoading: '加载中…',
    galEmpty: '暂无照片 — 请向供应商索取产品图片。',
    galStageLabel: '产品图片。使用方向键浏览，回车键放大。',
    galThumbsLabel: '产品图片缩略图',
    galLightboxLabel: '产品图片查看器',
    galPrev: '上一张',
    galNext: '下一张',
    galZoomOpen: '全屏查看',
    galImageUnavailable: '图片无法显示',
    galPhotoOf: '{name} — 第 {n}/{m} 张照片',
    galVideoOf: '产品视频 {n}/{m}',
    pdMinOrder: '起订量',
    pdTrustVetted: '制造商经我们团队审核',
    pdTrustInspection: '可提供出货前验货',
    pdTrustSupport: '从报价到交付全程支持',
    pdVerifiedBadge: '认证供应商',
    pdSpecs: '产品规格',
    pdInquiryTitle: '发送询盘',
    pdFieldName: '您的姓名',
    pdFieldNamePh: '姓名',
    pdFieldEmail: '公司邮箱',
    pdFieldEmailPh: 'you@company.com',
    pdFieldCompany: '公司',
    pdFieldCompanyPh: '公司名称',
    pdFieldQty: '目标数量',
    pdFieldQtyPh: '例如 200',
    pdFieldMessage: '留言内容',
    pdFieldMessagePh: '需求、目标价、目的港…（20–4000字符）',
    pdSend: '发送询盘',
    pdSending: '发送中…',
    pdErrName: '请输入您的姓名。',
    pdErrEmail: '请输入有效的邮箱地址。',
    pdErrMessage: '留言至少需要20个字符。',
    pdErrSend: '发送失败，请重试。',
    pdErrNetwork: '网络错误，请重试。',
    pdSent: '询盘已发送！我们的团队会尽快与您联系。',
    pdDescription: '产品描述',
    pdSupplierTitle: '关于该供应商',
    pdVerificationPending: '认证审核中',
    pdResponseRate: '回复率',
    pdNotRated: '暂无评分',
    pdYearsActive: '入驻 Fastflow',
    pdMemberSince: '{y} 年入驻 Fastflow',
    pdCtaHint: '无需注册 — 供应商将通过邮箱回复',
    pdErrNameFix: '请填写您的姓名，供应商需要知道询价方。',
    pdErrEmailFix: '请输入有效邮箱 — 供应商将回复到此邮箱。',
    pdErrMessageFix: '请至少填写 20 个字符，说明您的需求：规格、数量、目的地。',
    pdSentTitle: '询盘已发送至 {supplier}',
    pdSentNext: '供应商通常在 1–2 个工作日内回复。回复将发送至 {email}。',
    supplierProducts: '产品数',
    supplierCategories: '品类',
    supplierCertifications: '认证',
    supplierLocationPending: '地点待定',
    supplierPending: '待定',
    suppliersEmpty: '未找到供应商。',
    suppliersError: '无法加载供应商。',
    rfqMine: '我的询盘',
    rfqQueue: '询盘队列',
    rfqActiveRecords: '条有效记录',
    recordQuantity: '数量',
    recordStatus: '状态',
    recordTarget: '目标价',
    recordDestination: '目的地',
    recordNotSet: '未设置',
    openThread: '打开会话',
    createOrderBtn: '创建订单',
    rfqEmpty: '暂无询盘。买家可在产品卡片上索取报价。',
    statusRequested: '已提交',
    statusReviewing: '审核中',
    statusQuoted: '已报价',
    statusSampleRequested: '已索样',
    statusAccepted: '已接受',
    statusClosed: '已关闭',
    ordersTitle: '订单',
    ordersTradeRecords: '条交易记录',
    orderLabel: '订单',
    orderIncoterm: '贸易术语',
    orderPayment: '付款',
    orderInspection: '验货',
    ordersEmpty: '暂无订单。',
    threadPlaceholder: '在此询盘会话中留言',
    threadSend: '发送',
    verificationTitle: '供应商认证',
    verificationRecords: '条记录',
    verifStatus: '状态',
    verifApprove: '批准 — 标记为已认证',
    verifRevoke: '撤销认证',
    verifActionError: '无法更新认证状态。',
    verifFactory: '工厂',
    verifEvidence: '证明材料',
    verifNextReview: '下次审核',
    verifMissing: '缺失',
    verifUnset: '未设置',
    verifBusinessLicense: '营业执照',
    verifBusinessLicensePh: '执照编号或文件编号',
    verifFactoryAddress: '工厂地址',
    verifFactoryAddressPh: '注册工厂地址',
    verifEvidenceLabel: '证明材料',
    verifEvidencePh: '证书、产权、审核记录',
    verifSubmit: '提交材料',
    verifCompany: '供应商公司',
    verifCompanyPick: '选择公司…',
    verifCompanyNone: '没有可添加的供应商 — 所有已列出的公司都已有记录。',
    verifOptional: '（选填）',
    verifAdminHint: '选择公司以创建认证记录，然后批准。营业执照和证明材料为选填项。',
    productFormTitle: '添加产品',
    productFormSub: '供应商发布的产品将进入认证审核',
    pfCategory: '品类',
    pfCategoryPh: '例如 Agricultural Machinery——请从列表选择',
    pfName: '名称',
    pfNamePh: '产品标题',
    pfLocation: '所在地',
    pfLocationPh: '城市、国家',
    pfPrice: '价格',
    pfPricePh: '$ / 单位',
    pfMoq: '起订量',
    pfMoqPh: '最小起订量',
    pfLeadTime: '交期',
    pfLeadTimePh: '例如 21 天',
    pfCapacity: '产能',
    pfCapacityPh: '月生产能力',
    pfCertifications: '认证',
    pfCertificationsPh: 'ISO、CE、RoHS...',
    pfPhoto: '图片链接',
    pfPhotoPh: 'https://...',
    pfDescription: '描述',
    pfDescriptionPh: '材料、规格、包装、用途',
    pfSubmit: '添加产品',
    pfMediaLabel: '图片与视频',
    pfEditTitle: '编辑产品',
    pfEditSubmit: '保存更改',
    pfCancelEdit: '取消',
    pfMyListings: '我的产品',
    pfEditBtn: '编辑',
    adminAddSupplierTitle: '添加制造商账户',
    adminAddSupplierSub: '登记制造商——由您的团队管理，供应商无需登录',
    adminSupplierName: '联系人姓名',
    adminSupplierCompany: '公司名称',
    adminSupplierEmail: '联系邮箱（显示在产品页面）',
    adminSupplierPhone: '联系电话',
    adminSupplierSubmit: '登记制造商',
    adminSupplierCreated: '制造商已登记。',
    adminAddProductTitle: '代供应商添加产品',
    adminProductSupplier: '制造商',
    adminProductSupplierPick: '选择已登记的制造商…',
    rfqSubmitted: '询盘已提交，请查看”我的 Fastflow”。',
    aiTranslatedBadge: 'AI已翻译',
    rfqTranslating: '正在翻译您的消息...',
    rfqTranslateError: '翻译暂不可用，发送原文。',
    translationPending: '自动翻译中...'
  },
  ru: {
    utilitySlogan: 'Проверенные китайские поставщики · Мультиязычные страницы товаров · Полное сопровождение закупок',
    navAbout: 'О нас',
    navContact: 'Контакты',
    navAboutUs: 'О нас',
    navMembership: 'Условия',
    navFaq: 'Вопросы',
    authSignIn: 'Войти',
    authJoinFree: 'Бесплатная регистрация',
    navPortal: 'Портал поставщика',
    heroListCompany: 'Разместить компанию',
    heroEyebrow: 'Трансграничные закупки — под ключ',
    heroTitle: 'Закупайтесь у проверенных китайских фабрик — без догадок',
    heroSubtitle: 'Расскажите, что вам нужно. За несколько дней подберём проверенных поставщиков и возьмём на себя расчёт цен, комплаенс и доставку.',
    heroBuyerBtn: 'Найти поставщиков',
    heroSupplierBtn: 'Стать поставщиком — свяжитесь с нами',
    heroConsultBtn: 'Онлайн-консультация',
    heroHighlights: 'Проверенные поставщики · Мультиязычный каталог · Полное сопровождение закупок',
    heroShowcaseBadge: '🌐 Глобальная платформа закупок',
    searchProducts: 'Товары',
    searchSuppliers: 'Поставщики',
    searchPlaceholder: 'Искать товары, поставщиков, сертификаты...',
    searchButton: 'Поиск',
    advantageEyebrow: 'Преимущества платформы',
    advantageTitle: 'Четыре вещи, которые упрощают закупки',
    featureMatchTitle: 'Подбор поставщиков',
    featureMatchCopy: 'Расскажите, что вам нужно — мы найдём подходящих производителей в нашей сети проверенных фабрик.',
    featureCommTitle: 'Мультиязычный каталог',
    featureCommCopy: 'Страницы товаров автоматически переводятся на английский, китайский и русский. Просматривайте и общайтесь на своём языке.',
    featureRiskTitle: 'Торговый комплаенс',
    featureRiskCopy: 'Проверка поставщиков, предотгрузочные инспекции и помощь с таможенными документами — чтобы товар прибыл таким, как заказан.',
    featureConsultTitle: 'Консультации по цепочке поставок',
    featureConsultCopy: 'Анализ политики, исследование рынка, тарифы, аудит, инспекции и подготовка документов.',
    statsProducts: 'Доступные товары',
    statsVerified: 'Проверенные поставщики',
    statsRfqs: 'Активные запросы',
    statsOrdersMetric: 'Заказы под контролем',
    servicesEyebrow: 'Сценарии услуг',
    servicesTitle: 'Услуги для покупателей и поставщиков',
    buyersSectionTitle: 'Услуги для покупателей',
    buyersList1: 'Размещайте запросы — мы подберём подходящих поставщиков',
    buyersList2: 'Сравнивайте цены, проверяйте квалификацию и историю сделок',
    buyersList3: 'Логистика, таможня и оплата в одном окне',
    buyersList4: 'Персональный консультант для переговоров и исполнения заказа',
    buyersSub: 'Размещайте запросы, сравнивайте предложения проверенных поставщиков и получайте поддержку по логистике, таможне и оплате.',
    suppliersSectionTitle: 'Услуги для поставщиков',
    suppliersList1: 'Бесплатная регистрация и доступ к глобальным покупателям',
    suppliersList2: 'Мультиязычные страницы товаров и международная видимость',
    suppliersList3: 'Точные запросы для роста заказов',
    suppliersList4: 'Комплаенс, шаблоны документов и предупреждения о рисках',
    suppliersSub: 'Бесплатная регистрация, мультиязычные страницы товаров, целевые запросы и поддержка комплаенса.',
    serviceListEyebrow: 'Основные услуги',
    serviceListTitle: 'Дополнительные сервисы',
    serviceMatch: 'Посредничество в торговле',
    serviceMatchSub: 'Сопоставление спроса и предложения, сопровождение переговоров.',
    serviceCompliance: 'Консультации по комплаенсу',
    serviceComplianceSub: 'Политика импорта/экспорта, тарифы, возвраты и сертификаты.',
    serviceDocument: 'Документы',
    serviceDocumentSub: 'Контракты, PI, упаковочные листы и таможенные документы — подготовим и проверим за вас.',
    serviceInspection: 'Аудит и QC',
    serviceInspectionSub: 'Аудит на месте, предпроверка и контроль качества.',
    serviceLogistics: 'Логистика',
    serviceLogisticsSub: 'Комбинированные решения для морских, воздушных и специализированных линий.',
    marketplaceEyebrow: 'Товары',
    marketplaceTitle: 'Лучшие закупочные предложения',
    suppliersEyebrow: 'Поставщики',
    suppliersTitle: 'Сеть поставщиков',
    supplierSearchPlaceholder: 'Поиск поставщиков, мест, сертификатов...',
    aboutEyebrow: 'О нас',
    aboutTitle: 'Торговый опыт, соединяющий глобальных покупателей и проверенных поставщиков',
    aboutCopy1: 'Мы — платформа трансграничных закупок, соединяющая покупателей с китайскими производителями благодаря торговому опыту и системе проверки поставщиков.',
    aboutCopy2: 'Мы соблюдаем честность, профессионализм, эффективность и комплаенс, помогая найти надежных поставщиков.',
    membershipEyebrow: 'Условия',
    membershipTitle: 'Гибкий вступительный процесс и прозрачные тарифы',
    supplierRegistrationTitle: 'Регистрация поставщика',
    supplierRegistrationReq: 'Требования: лицензия, квалификация, соответствие экспортным стандартам.',
    supplierRegistrationPlans: 'Базовый план — бесплатно; премиум даёт приоритетное размещение, экспозицию на главной и поддержку трафика.',
    supplierRegistrationPricing: 'Комиссия берется только за успешное посредничество, без скрытых платежей.',
    buyerServiceTitle: 'Сервис для покупателей',
    buyerServiceCopy: 'Размещение запросов и поиск поставщиков бесплатно; оплата только за кастомные аудиты, консультантов и ускоренные документы.',
    faqEyebrow: 'Вопросы',
    faqTitle: 'Часто задаваемые вопросы',
    faqSafetyQ: 'Как платформа обеспечивает безопасность сделок?',
    faqSafetyA: 'Мы проверяем поставщиков перед размещением, а наша команда сопровождает каждую сделку — от запроса цены до поставки.',
    faqFeesQ: 'Есть ли плата за регистрацию?',
    faqFeesA: 'Базовая регистрация бесплатна. Плата взимается только за продвижение, премиум и дополнительные сервисы.',
    faqPostQ: 'Можно ли разместить запрос на закупку?',
    faqPostA: 'Да, после регистрации запросы размещаются бесплатно, и мы подберём подходящих поставщиков.',
    faqLangQ: 'Какие языки поддерживаются?',
    faqLangA: 'Платформа доступна на английском, китайском и русском. Информация о товарах переводится автоматически.',
    faqMultiQ: 'Можно ли отображать товары на нескольких языках?',
    faqMultiA: 'Да, названия, описания и спецификации товаров переводятся автоматически.',
    faqAssignQ: 'Как распределяются запросы?',
    faqAssignA: 'Наша команда рассматривает каждый запрос и передаёт его наиболее подходящему производителю.',
    contactEyebrow: 'Контакты',
    contactTitle: 'Готовы закупать из Китая? Свяжитесь с нами.',
    contactLine1: 'Онлайн-поддержка | Email | Телефон | Адрес',
    contactLine2: 'Доступна мультиязычная поддержка. Добро пожаловать партнёры.',
    contactLabelName: 'Имя',
    contactNamePlaceholder: 'Ваше имя',
    contactLabelEmail: 'Email компании',
    contactEmailPlaceholder: 'name@company.com',
    contactLabelCompany: 'Компания',
    contactCompanyPlaceholder: 'Ваша компания',
    contactLabelMessage: 'Запрос',
    contactMessagePlaceholder: 'Требования, количество, порт доставки, сертификаты',
    contactSubmit: 'Отправить запрос',
    dashboardEyebrow: 'Аккаунт',
    dashboardTitle: 'Мой Fastflow',
    auditEyebrow: 'Операции',
    auditTitle: 'Последние аудиты',
    footerDescription: 'Торговое посредничество, консультации по закупкам и полное сопровождение трансграничных заказов.',
    quoteHeader: 'Запросить цену',
    quoteLabelQuantity: 'Количество',
    quoteQuantityPlaceholder: 'например 5 000 шт.',
    quoteLabelPrice: 'Целевая цена',
    quotePricePlaceholder: 'Необязательная целевая цена',
    quoteLabelDestination: 'Пункт назначения',
    quoteDestinationPlaceholder: 'Порт или город доставки',
    quoteLabelNotes: 'Примечания',
    quoteNotesPlaceholder: 'Технические требования, упаковка, инспекция, сроки',
    quoteSubmit: 'Отправить запрос',
    authFieldName: 'Имя',
    authFieldCompany: 'Компания',
    authFieldEmail: 'Email',
    authFieldPassword: 'Пароль',
    authFieldRole: 'Роль',
    authRoleBuyer: 'Покупатель',
    authRoleSupplier: 'Поставщик',
    authCreateAccount: 'Создать аккаунт',
    authNeedAccount: 'Нужна учетная запись?',
    authAlreadyRegistered: 'Уже зарегистрированы?',
    authJoinFreeOption: 'Зарегистрироваться бесплатно',
    authBuyerPrompt: 'Войдите как покупатель, чтобы отправить запрос.',
    authBuyerRequiredTitle: 'Требуется аккаунт покупателя',
    authBuyerRequiredDesc: 'Поставщики и администраторы могут управлять товарами, но только покупатели могут отправлять новые запросы.',
    authClose: 'Закрыть',
    noAuditEvents: 'Пока нет аудиторских событий.',
    trustItem1: 'Поставщики проверены нашей командой',
    trustItem2: 'Сопровождение каждого заказа',
    trustItem3: 'Помощь с комплаенсом и документами',
    trustItem4: 'Поддержка на английском, китайском и русском',
    howEyebrow: 'Как это работает',
    howTitle: 'Три шага к глобальной торговле',
    howStep1Num: '01',
    howStep1Title: 'Регистрация',
    howStep1Copy: 'Создайте бесплатный аккаунт покупателя или поставщика и разместите товары или запросы за несколько минут.',
    howStep2Num: '02',
    howStep2Title: 'Подбор партнёров',
    howStep2Copy: 'Мы изучаем ваши требования и обычно в течение 24–48 часов знакомим вас с подходящими поставщиками или покупателями.',
    howStep3Num: '03',
    howStep3Title: 'Сотрудничество',
    howStep3Copy: 'Общайтесь, обменивайтесь запросами, согласовывайте условия и завершайте сделки с полной поддержкой.',
    dashboardTabRfqs: 'Запросы',
    dashboardTabOrders: 'Заказы',
    dashboardTabVerification: 'Верификация',
    dashboardTabProducts: 'Товары',
    dashboardTabAdmin: 'Админ',
    dashboardLogout: 'Выйти',
    dashboardRfqThread: 'Тред запроса',
    dashboardRfqThreadEmpty: 'Выберите запрос для просмотра треда.',
    categoriesAll: 'Все категории',
    catAllPrefix: 'Всё',
    categoryProducts: 'товаров',
    systemActor: 'Система',
    metricOrdersLabel: 'заказов',
    pillVerified: 'Проверен',
    specMoq: 'MOQ',
    specLeadTime: 'Срок',
    specCapacity: 'Мощность',
    specAsk: 'Уточнить',
    cardRequestQuote: 'Запросить цену',
    cardViewDetails: 'Подробнее',
    marketplaceEmpty: 'Подходящие товары не найдены.',
    emptyCtaSource: 'Расскажите, что вы ищете',
    filterVerified: 'Только проверенные',
    filterLocation: 'Локация',
    filterLeadTime: 'Срок',
    filterAny: 'Любой',
    filterLeadDays: '≤ {d} дн.',
    filterClear: 'Сбросить фильтры',
    emptyProductsLead: 'Пока пусто — опишите, что вам нужно, и мы подберём проверенные фабрики.',
    emptySuppliersLead: 'Поставщиков пока нет — укажите категорию, и мы представим подходящие фабрики.',
    marketplaceError: 'Не удалось загрузить товары.',
    categoriesError: 'Категории недоступны.',
    auditError: 'Не удалось загрузить журнал аудита.',
    detailSupplier: 'Поставщик',
    detailLocation: 'Местоположение',
    detailPrice: 'Цена',
    detailCertifications: 'Сертификаты',
    detailPending: 'В ожидании',
    productUnavailable: 'Товар недоступен',
    pdLoading: 'Загрузка…',
    galEmpty: 'Фото пока нет — запросите изображения у поставщика.',
    galStageLabel: 'Медиа товара. Стрелки — листать, Enter — увеличить.',
    galThumbsLabel: 'Миниатюры медиа товара',
    galLightboxLabel: 'Просмотр изображений товара',
    galPrev: 'Назад',
    galNext: 'Вперёд',
    galZoomOpen: 'Полный экран',
    galImageUnavailable: 'Изображение недоступно',
    galPhotoOf: '{name} — фото {n} из {m}',
    galVideoOf: 'Видео товара {n} из {m}',
    pdMinOrder: 'Мин. заказ',
    pdTrustVetted: 'Производитель проверен нашей командой',
    pdTrustInspection: 'Доступна предотгрузочная инспекция',
    pdTrustSupport: 'Сопровождение от запроса цены до поставки',
    pdVerifiedBadge: 'Проверенный поставщик',
    pdSpecs: 'Характеристики',
    pdInquiryTitle: 'Отправить запрос',
    pdFieldName: 'Ваше имя',
    pdFieldNamePh: 'Полное имя',
    pdFieldEmail: 'Email компании',
    pdFieldEmailPh: 'you@company.com',
    pdFieldCompany: 'Компания',
    pdFieldCompanyPh: 'Название компании',
    pdFieldQty: 'Требуемое количество',
    pdFieldQtyPh: 'например 200',
    pdFieldMessage: 'Сообщение',
    pdFieldMessagePh: 'Требования, целевая цена, порт назначения… (20–4000 символов)',
    pdSend: 'Отправить запрос',
    pdSending: 'Отправка…',
    pdErrName: 'Пожалуйста, укажите имя.',
    pdErrEmail: 'Введите корректный email.',
    pdErrMessage: 'Сообщение должно содержать не менее 20 символов.',
    pdErrSend: 'Не удалось отправить запрос. Попробуйте ещё раз.',
    pdErrNetwork: 'Ошибка сети. Попробуйте ещё раз.',
    pdSent: 'Запрос отправлен! Наша команда скоро свяжется с вами.',
    pdDescription: 'Описание',
    pdSupplierTitle: 'О поставщике',
    pdVerificationPending: 'Проверка ожидается',
    pdResponseRate: 'Скорость ответа',
    pdNotRated: 'Пока нет данных',
    pdYearsActive: 'На Fastflow с',
    pdMemberSince: 'На Fastflow с {y}',
    pdCtaHint: 'Без регистрации — поставщик ответит на email',
    pdErrNameFix: 'Укажите имя, чтобы поставщик знал, кто спрашивает.',
    pdErrEmailFix: 'Укажите корректный email — поставщик ответит на него.',
    pdErrMessageFix: 'Опишите запрос минимум в 20 символах: характеристики, количество, пункт назначения.',
    pdSentTitle: 'Запрос отправлен: {supplier}',
    pdSentNext: 'Обычно отвечают в течение 1–2 рабочих дней. Ответ придёт на {email}.',
    supplierProducts: 'Товары',
    supplierCategories: 'Категории',
    supplierCertifications: 'Сертификаты',
    supplierLocationPending: 'Местоположение уточняется',
    supplierPending: 'В ожидании',
    suppliersEmpty: 'Поставщики не найдены.',
    suppliersError: 'Не удалось загрузить поставщиков.',
    rfqMine: 'Мои запросы',
    rfqQueue: 'Очередь запросов',
    rfqActiveRecords: 'активных записей',
    recordQuantity: 'Количество',
    recordStatus: 'Статус',
    recordTarget: 'Цель',
    recordDestination: 'Назначение',
    recordNotSet: 'Не задано',
    openThread: 'Открыть тред',
    createOrderBtn: 'Создать заказ',
    rfqEmpty: 'Запросов пока нет. Покупатели могут запросить цену на карточках товаров.',
    statusRequested: 'Запрошено',
    statusReviewing: 'На рассмотрении',
    statusQuoted: 'Цена выставлена',
    statusSampleRequested: 'Запрошен образец',
    statusAccepted: 'Принято',
    statusClosed: 'Закрыто',
    ordersTitle: 'Заказы',
    ordersTradeRecords: 'торговых записей',
    orderLabel: 'Заказ',
    orderIncoterm: 'Инкотермс',
    orderPayment: 'Оплата',
    orderInspection: 'Инспекция',
    ordersEmpty: 'Заказы пока не созданы.',
    threadPlaceholder: 'Написать в этот тред запроса',
    threadSend: 'Отправить',
    verificationTitle: 'Верификация поставщика',
    verificationRecords: 'записей',
    verifStatus: 'Статус',
    verifApprove: 'Одобрить — отметить проверенным',
    verifRevoke: 'Отозвать проверку',
    verifActionError: 'Не удалось обновить статус проверки.',
    verifFactory: 'Фабрика',
    verifEvidence: 'Документы',
    verifNextReview: 'Следующая проверка',
    verifMissing: 'Отсутствует',
    verifUnset: 'Не задано',
    verifBusinessLicense: 'Бизнес-лицензия',
    verifBusinessLicensePh: 'Номер лицензии или ссылка на документ',
    verifFactoryAddress: 'Адрес фабрики',
    verifFactoryAddressPh: 'Зарегистрированный адрес фабрики',
    verifEvidenceLabel: 'Документы',
    verifEvidencePh: 'Сертификаты, право собственности, заметки аудита',
    verifSubmit: 'Отправить документы',
    verifCompany: 'Компания-поставщик',
    verifCompanyPick: 'Выберите компанию…',
    verifCompanyNone: 'Нет поставщиков для добавления — у всех компаний уже есть запись.',
    verifOptional: '(необязательно)',
    verifAdminHint: 'Выберите компанию, чтобы создать запись проверки, затем одобрите её. Лицензия и документы необязательны.',
    productFormTitle: 'Добавить товар',
    productFormSub: 'Товары поставщиков проходят проверку',
    pfCategory: 'Категория',
    pfCategoryPh: 'напр. Agricultural Machinery — выберите из списка',
    pfName: 'Название',
    pfNamePh: 'Название товара',
    pfLocation: 'Местоположение',
    pfLocationPh: 'Город, страна',
    pfPrice: 'Цена',
    pfPricePh: '$ / ед.',
    pfMoq: 'MOQ',
    pfMoqPh: 'Минимальный объём заказа',
    pfLeadTime: 'Срок',
    pfLeadTimePh: 'например, 21 день',
    pfCapacity: 'Мощность',
    pfCapacityPh: 'Месячная производственная мощность',
    pfCertifications: 'Сертификаты',
    pfCertificationsPh: 'ISO, CE, RoHS...',
    pfPhoto: 'URL фото',
    pfPhotoPh: 'https://...',
    pfDescription: 'Описание',
    pfDescriptionPh: 'Материалы, характеристики, упаковка, применение',
    pfSubmit: 'Добавить',
    pfMediaLabel: 'Фото и видео',
    pfEditTitle: 'Редактировать товар',
    pfEditSubmit: 'Сохранить',
    pfCancelEdit: 'Отмена',
    pfMyListings: 'Мои товары',
    pfEditBtn: 'Изменить',
    adminAddSupplierTitle: 'Добавить производителя',
    adminAddSupplierSub: 'Зарегистрировать производителя — управляется вашей командой, без логина поставщика',
    adminSupplierName: 'Имя контакта',
    adminSupplierCompany: 'Название компании',
    adminSupplierEmail: 'Контактный email (виден на странице продукта)',
    adminSupplierPhone: 'Контактный телефон',
    adminSupplierSubmit: 'Зарегистрировать производителя',
    adminSupplierCreated: 'Производитель зарегистрирован.',
    adminAddProductTitle: 'Добавить продукт от поставщика',
    adminProductSupplier: 'Производитель',
    adminProductSupplierPick: 'Выберите зарегистрированного производителя…',
    rfqSubmitted: 'Запрос отправлен. Проверьте «Мой Fastflow».',
    aiTranslatedBadge: 'AI перевёл',
    rfqTranslating: 'Переводим ваше сообщение на китайский...',
    rfqTranslateError: 'Перевод недоступен, отправляем оригинал.',
    translationPending: 'Автоперевод...'
  }
};

function t(key) {
  return (translations[currentLang] && translations[currentLang][key]) || translations.en[key] || key;
}

// Category taxonomy: parent -> subcategories. Products store the subcategory
// name; the rail shows the parent as a dropdown. Mirrored in main.py
// (CATEGORY_GROUPS) so filtering by the parent matches all its subs.
const CATEGORY_TREE = {
  'Machinery': [
    'Agricultural Machinery',
    'Metalworking Machinery',
    'Construction Machinery',
    'Industrial Machinery',
  ],
  'Pesticides': [
    'Herbicides',
    'Insecticides',
    'Fungicides',
    'Rodenticides',
    'Plant Growth Regulators',
  ],
};

// Canonical names suggested in the product-form category field.
const CATEGORY_PRESETS = [
  ...CATEGORY_TREE['Machinery'],
  ...CATEGORY_TREE['Pesticides'],
  'Raw Materials',
  'Packaging',
  'Components',
  'Home & Kitchen',
  'Electronics',
  'Textiles & Apparel',
  'Consumer Goods',
];

// Category names live in the database (free text, English), so they can't go
// through data-i18n. Known names are mapped per locale; unknown ones fall back
// to the stored string.
const CATEGORY_NAMES = {
  zh: {
    'Raw Materials': '原材料',
    'Packaging': '包装',
    'Components': '零部件',
    'Machinery': '机械设备',
    'Agricultural Machinery': '农业机械',
    'Metalworking Machinery': '金属加工机械',
    'Construction Machinery': '工程机械',
    'Industrial Machinery': '工业机械',
    'Home & Kitchen': '家居厨房',
    'Electronics': '电子产品',
    'Textiles & Apparel': '纺织服装',
    'Consumer Goods': '消费品',
    'Pesticides': '农药',
    'Herbicides': '除草剂',
    'Insecticides': '杀虫剂',
    'Fungicides': '杀菌剂',
    'Rodenticides': '灭鼠剂',
    'Plant Growth Regulators': '植物生长调节剂'
  },
  ru: {
    'Raw Materials': 'Сырьё',
    'Packaging': 'Упаковка',
    'Components': 'Комплектующие',
    'Machinery': 'Оборудование',
    'Agricultural Machinery': 'Сельскохозяйственная техника',
    'Metalworking Machinery': 'Металлообрабатывающие станки',
    'Construction Machinery': 'Строительная техника',
    'Industrial Machinery': 'Промышленное оборудование',
    'Home & Kitchen': 'Дом и кухня',
    'Electronics': 'Электроника',
    'Textiles & Apparel': 'Текстиль и одежда',
    'Consumer Goods': 'Потребительские товары',
    'Pesticides': 'Пестициды',
    'Herbicides': 'Гербициды',
    'Insecticides': 'Инсектициды',
    'Fungicides': 'Фунгициды',
    'Rodenticides': 'Родентициды',
    'Plant Growth Regulators': 'Регуляторы роста растений'
  }
};

// Translate a category name for display. Priority:
//   1. the static CATEGORY_NAMES map (curated, accurate for common presets)
//   2. backend-provided display_name (dynamic, covers user-typed categories)
//   3. the original English name
function tCategory(name, displayName) {
  const curated = CATEGORY_NAMES[currentLang] && CATEGORY_NAMES[currentLang][name];
  if (curated) return curated;
  if (displayName && displayName !== name) return displayName;
  return name;
}

const QUOTE_STATUSES = ['requested', 'reviewing', 'quoted', 'sample_requested', 'accepted', 'closed'];
const QUOTE_STATUS_KEYS = {
  requested: 'statusRequested',
  reviewing: 'statusReviewing',
  quoted: 'statusQuoted',
  sample_requested: 'statusSampleRequested',
  accepted: 'statusAccepted',
  closed: 'statusClosed'
};

function statusLabel(status) {
  return QUOTE_STATUS_KEYS[status] ? t(QUOTE_STATUS_KEYS[status]) : status;
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const hasFormChild = el.querySelector('input, select, textarea, button');
    if (hasFormChild) {
      let textNode = [...el.childNodes].find(n => n.nodeType === Node.TEXT_NODE);
      if (textNode) textNode.textContent = t(el.dataset.i18n);
      else el.insertBefore(document.createTextNode(t(el.dataset.i18n)), el.firstChild);
    } else {
      el.innerHTML = t(el.dataset.i18n);
    }
    });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('#search-type option').forEach(option => {
    if (option.dataset.i18n) {
      option.textContent = t(option.dataset.i18n);
    }
  });
}

function setLanguage(lang) {
  if (!translations[lang]) return;
  currentLang = lang;
  document.documentElement.lang = lang;
  document.querySelectorAll('.lang-button').forEach(button => {
    button.classList.toggle('active', button.dataset.lang === lang);
  });
  applyTranslations();
  renderCategories();
  if (currentUser) renderUserPanel();
  // Re-translate already-loaded catalog content into the new language, in
  // place (loadMarketplace keeps the active query/category; neither scrolls,
  // so the browser preserves the viewport — no jump to the homepage/top).
  loadMarketplace();
  loadSuppliers(supplierSearch?.value.trim() || '');
}

function translateButtonsInForm(form) {
  form.querySelectorAll('[data-i18n]').forEach(el => {
    el.innerHTML = t(el.dataset.i18n);
  });
}

function translatePage() {
  setLanguage(currentLang);
}

function escapeHtml(value = '') {
  // All strings stored via the server pass through html.escape() before DB write
  // (see clean_str in main.py). Returning them as-is here avoids double-encoding
  // while keeping every call site unchanged as a searchable audit trail.
  return String(value);
}

function getCookie(name) {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : '';
}

async function apiFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { ...(options.headers || {}) };
  // Attach the CSRF token (double-submit cookie) on state-changing requests.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    headers['X-CSRF-Token'] = getCookie('csrf_token');
  }
  const response = await fetch(url, { ...options, headers });

  let result = {};
  try {
    result = await response.json();
  } catch (error) {
    if (!response.ok) {
      throw new Error(`Request failed (${response.status}).`);
    }
    throw new Error('Unexpected response from server.');
  }

  if (!response.ok) {
    throw new Error(result.error || 'Request failed');
  }
  return result;
}

function scrollToId(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const headerH = document.querySelector('.site-header')?.getBoundingClientRect().height || 0;
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - headerH - 12, behavior: 'smooth' });
}

function openModal(contentHtml, { wide = false } = {}) {
  modalBody.innerHTML = contentHtml;
  const content = accountModal.querySelector('.modal-content');
  content?.classList.toggle('pd-wide', wide);
  accountModal.classList.remove('hidden');
}

function closeModal() {
  accountModal.classList.add('hidden');
}

function openQuoteModal(productId) {
  if (!currentUser) {
    openAuthModal('login', t('authBuyerPrompt'));
    return;
  }
  if (currentUser.role !== 'buyer') {
    openModal(`
      <h3>${escapeHtml(t('authBuyerRequiredTitle'))}</h3>
      <p class="muted">${escapeHtml(t('authBuyerRequiredDesc'))}</p>
      <button class="primary" data-modal-action="close">${escapeHtml(t('authClose'))}</button>
    `);
    return;
  }

  quoteProductId.value = productId;
  quoteQuantity.value = '';
  quoteTargetPrice.value = '';
  quoteDestination.value = '';
  quoteNotes.value = '';
  quoteFeedback.textContent = '';
  quoteModal.classList.remove('hidden');
}

function closeQuoteModal() {
  quoteModal.classList.add('hidden');
}

async function init() {
  const yearEl = document.getElementById('footer-year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
  try {
    const result = await apiFetch('/api/me');
    currentUser = result.authenticated ? result.user : null;
  } catch (error) {
    currentUser = null;
  }
  renderUserPanel();
  readFiltersFromURL();   // restore shareable filter/search state from the URL
  await Promise.all([
    loadOverview(),
    loadCategories(),
    loadMarketplace(),
    loadSuppliers()
  ]);
  applyTranslations();
}

// Actionable empty state (4.2): a lead line + a CTA that opens the RFQ/contact
// path, so an empty screen invites action instead of dead-ending.
function emptyStateHtml(leadKey) {
  return `<div class="empty-state">
    <p>${escapeHtml(t(leadKey))}</p>
    <button type="button" class="secondary" data-scroll-target="contact">${escapeHtml(t('emptyCtaSource'))}</button>
  </div>`;
}

async function loadOverview() {
  try {
    const data = await apiFetch('/api/overview');
    document.getElementById('metric-products').textContent = data.stats.products;
    document.getElementById('metric-verified').textContent = data.stats.verified_suppliers;
    document.getElementById('metric-rfqs').textContent = data.stats.open_rfqs;
    document.getElementById('metric-orders-count').textContent = data.stats.orders;
    document.getElementById('metric-orders').textContent = `${data.stats.orders} ${t('metricOrdersLabel')}`;
    // Per-metric gate (4.1): show a stat card only when its value is real
    // (>= 1). Never display "0" / "0+". Hide the whole strip if none qualify.
    const cards = [
      ['card-products', data.stats.products],
      ['card-verified', data.stats.verified_suppliers],
      ['card-rfqs', data.stats.open_rfqs],
      ['card-orders', data.stats.orders],
    ];
    let anyVisible = false;
    cards.forEach(([id, val]) => {
      const card = document.getElementById(id);
      if (!card) return;
      const show = Number(val) >= 1;
      card.classList.toggle('hidden', !show);
      if (show) anyVisible = true;
    });
    document.getElementById('stats-strip')?.classList.toggle('hidden', !anyVisible);
    document.getElementById('audit-list').innerHTML = data.audit.length ? data.audit.map(item => `
      <article>
        <div>
          <strong>${escapeHtml(item.action)} ${escapeHtml(item.entity_type)}</strong>
          <span>${escapeHtml(item.actor_name || t('systemActor'))} · ${new Date(item.created_at).toLocaleString()}</span>
        </div>
        <p>${escapeHtml(item.details || '')}</p>
      </article>
    `).join('') : `<p class="empty-state">${escapeHtml(t('noAuditEvents'))}</p>`;
  } catch (error) {
    document.getElementById('audit-list').innerHTML = `<p class="error">${escapeHtml(t('auditError'))}</p>`;
  }
}

let cachedCategories = null;

function renderCategories() {
  if (!cachedCategories) return;
  const byName = Object.fromEntries(cachedCategories.map(c => [c.name, c]));
  const subNames = new Set(Object.values(CATEGORY_TREE).flat());
  const flat = cachedCategories.filter(c => !subNames.has(c.name) && !CATEGORY_TREE[c.name]);

  const groupsHtml = Object.entries(CATEGORY_TREE).map(([parent, subs]) => {
    const count = (byName[parent]?.product_count || 0)
      + subs.reduce((sum, name) => sum + (byName[name]?.product_count || 0), 0);
    const isActive = activeCategory === parent || subs.includes(activeCategory);
    return `
      <div class="cat-group">
        <button class="cat-group-btn ${isActive ? 'active' : ''}" aria-haspopup="true" aria-expanded="false">
          <span>${escapeHtml(tCategory(parent, byName[parent]?.display_name))}</span>
          <small>${count} ${t('categoryProducts')}</small>
          <span class="cat-caret" aria-hidden="true">▾</span>
        </button>
        <div class="cat-dropdown hidden">
          <button class="${activeCategory === parent ? 'active' : ''}" data-category="${escapeHtml(parent)}">
            <span>${escapeHtml(t('catAllPrefix'))} ${escapeHtml(tCategory(parent, byName[parent]?.display_name))}</span><small>${count}</small>
          </button>
          ${subs.map(sub => `
            <button class="${activeCategory === sub ? 'active' : ''}" data-category="${escapeHtml(sub)}">
              <span>${escapeHtml(tCategory(sub, byName[sub]?.display_name))}</span>
              ${byName[sub]?.product_count ? `<small>${byName[sub].product_count}</small>` : ''}
            </button>
          `).join('')}
        </div>
      </div>`;
  }).join('');

  categoryList.innerHTML = `
    <button class="${activeCategory ? '' : 'active'}" data-category="">${escapeHtml(t('categoriesAll'))}</button>
    ${groupsHtml}
    ${flat.map(category => `
      <button class="${activeCategory === category.name ? 'active' : ''}" data-category="${escapeHtml(category.name)}">
        <span>${escapeHtml(tCategory(category.name, category.display_name))}</span>
        <small>${category.product_count} ${t('categoryProducts')}</small>
      </button>
    `).join('')}
  `;
}

// Datalist of canonical category names for product forms. Values are stored in
// English; the label in parentheses shows the current-language name as a hint.
// Category is a closed set defined in code (CATEGORY_TREE + flat presets), so the
// product form uses a <select>, not free text — no more untranslated orphan
// categories. Grouped categories become optgroups; standalone ones follow.
// A legacy value not in the set is preserved as an option so editing never
// silently changes it.
function categorySelectHtml(selected = '') {
  const grouped = new Set(Object.values(CATEGORY_TREE).flat());
  const flat = CATEGORY_PRESETS.filter(name => !grouped.has(name));
  const known = new Set(CATEGORY_PRESETS);
  const opt = name =>
    `<option value="${escapeHtml(name)}"${name === selected ? ' selected' : ''}>${escapeHtml(tCategory(name))}</option>`;
  const groups = Object.entries(CATEGORY_TREE).map(([parent, subs]) =>
    `<optgroup label="${escapeHtml(tCategory(parent))}">${subs.map(opt).join('')}</optgroup>`).join('');
  const legacy = (selected && !known.has(selected))
    ? `<option value="${escapeHtml(selected)}" selected>${escapeHtml(tCategory(selected))} (legacy)</option>`
    : '';
  return `<select name="category" required>
    <option value="" disabled${selected ? '' : ' selected'}>${escapeHtml(t('pfCategoryPh'))}</option>
    ${groups}
    ${flat.map(opt).join('')}
    ${legacy}
  </select>`;
}

function closeCategoryMenus() {
  document.querySelectorAll('.cat-dropdown:not(.hidden)').forEach(menu => menu.classList.add('hidden'));
  document.querySelectorAll('.cat-group-btn[aria-expanded="true"]').forEach(btn => btn.setAttribute('aria-expanded', 'false'));
}

async function loadCategories() {
  try {
    const qs = currentLang ? `?target_lang=${encodeURIComponent(currentLang)}` : '';
    const data = await apiFetch(`/api/categories${qs}`);
    cachedCategories = data.categories;
    renderCategories();
  } catch (error) {
    categoryList.innerHTML = `<p class="error">${escapeHtml(t('categoriesError'))}</p>`;
  }
}

function flattenCategories(categories) {
  return categories.flatMap(category => category.items.map(item => ({ ...item, category: category.name })));
}

function productCardHtml(product) {
  return `
    <article class="product-card">
      <button class="product-image" data-product-id="${product.id}" aria-label="${escapeHtml(t('cardViewDetails'))}">
        ${product.image_url
          ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" />`
          : `<span class="img-placeholder" aria-hidden="true">${escapeHtml((product.supplier || product.name || '?').slice(0, 2).toUpperCase())}</span>`}
      </button>
      <div class="product-body">
        <div class="product-title-row">
          <button class="product-title" data-product-id="${product.id}">${escapeHtml(product.name)}</button>
          <div class="card-pills">
            ${product.verified ? `<span class="status-pill good">${escapeHtml(t('pillVerified'))}</span>` : ''}
            ${product.translated ? `<span class="status-pill translated-badge">${escapeHtml(t('aiTranslatedBadge'))}</span>` : ''}
          </div>
        </div>
        <p>${escapeHtml(product.description)}</p>
        <strong class="price">${escapeHtml(product.price)}</strong>
        <dl class="spec-grid">
          <div><dt>${escapeHtml(t('specMoq'))}</dt><dd>${escapeHtml(product.moq || t('specAsk'))}</dd></div>
          <div><dt>${escapeHtml(t('specLeadTime'))}</dt><dd>${escapeHtml(product.lead_time || t('specAsk'))}</dd></div>
          <div><dt>${escapeHtml(t('specCapacity'))}</dt><dd>${escapeHtml(product.capacity || t('specAsk'))}</dd></div>
        </dl>
        <div class="supplier-line">
          <span>${escapeHtml(product.supplier)}</span>
          <small>${escapeHtml(product.location)}</small>
        </div>
        <div class="card-actions">
          <button class="primary quote-button" data-id="${product.id}">${escapeHtml(t('cardRequestQuote'))}</button>
          <button class="detail-button" data-product-id="${product.id}">${escapeHtml(t('cardViewDetails'))}</button>
        </div>
      </div>
    </article>`;
}

function renderProductSkeleton() {
  return Array.from({ length: 4 }, () => `
    <article class="product-card shimmer-card" aria-hidden="true">
      <div class="shimmer-img"></div>
      <div class="product-body">
        <div class="shimmer-line shimmer-title"></div>
        <div class="shimmer-line"></div>
        <div class="shimmer-line shimmer-short"></div>
      </div>
    </article>
  `).join('');
}

// Mirror the active filters to the URL so a result view is shareable (5.2).
function syncMarketplaceURL() {
  const p = new URLSearchParams();
  if (lastMarketplaceQuery) p.set('q', lastMarketplaceQuery);
  if (activeCategory) p.set('category', activeCategory);
  if (filterLocation) p.set('location', filterLocation);
  if (filterVerified) p.set('verified', '1');
  if (filterLeadMax) p.set('lead_max', filterLeadMax);
  const qs = p.toString();
  try { history.replaceState(null, '', qs ? `?${qs}` : location.pathname); } catch (_) {}
}

// Restore filter state from the URL on load (shareable links).
function readFiltersFromURL() {
  const p = new URLSearchParams(location.search);
  lastMarketplaceQuery = p.get('q') || '';
  activeCategory = p.get('category') || '';
  filterLocation = p.get('location') || '';
  filterVerified = p.get('verified') === '1';
  filterLeadMax = /^\d+$/.test(p.get('lead_max') || '') ? p.get('lead_max') : '';
  if (lastMarketplaceQuery) {
    if (searchQuery) searchQuery.value = lastMarketplaceQuery;
    if (heroSearchQuery) heroSearchQuery.value = lastMarketplaceQuery;
  }
}

// B2B filter bar: verification, supplier location, lead time. (Category is the
// rail; MOQ range is intentionally absent — MOQ units are heterogeneous free
// text, see ledger 5.2.)
function renderFilterBar() {
  const bar = document.getElementById('marketplace-filters');
  if (!bar) return;
  const needBuild = bar.dataset.built !== '1' || bar.dataset.locs !== String(knownLocations.length);
  if (needBuild) {
    bar.innerHTML = `
      <label class="filter-check"><input type="checkbox" id="f-verified"> <span>${escapeHtml(t('filterVerified'))}</span></label>
      <label class="filter-field"><span>${escapeHtml(t('filterLocation'))}</span>
        <select id="f-location"><option value="">${escapeHtml(t('filterAny'))}</option>
          ${knownLocations.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('')}
        </select></label>
      <label class="filter-field"><span>${escapeHtml(t('filterLeadTime'))}</span>
        <select id="f-lead"><option value="">${escapeHtml(t('filterAny'))}</option>
          ${[7, 15, 30, 60].map(d => `<option value="${d}">${escapeHtml(t('filterLeadDays').replace('{d}', d))}</option>`).join('')}
        </select></label>
      <button type="button" id="f-clear" class="text-button filter-clear">${escapeHtml(t('filterClear'))}</button>`;
    bar.dataset.built = '1';
    bar.dataset.locs = String(knownLocations.length);
    bar.querySelector('#f-verified').addEventListener('change', e => { filterVerified = e.target.checked; loadMarketplace(); });
    bar.querySelector('#f-location').addEventListener('change', e => { filterLocation = e.target.value; loadMarketplace(); });
    bar.querySelector('#f-lead').addEventListener('change', e => { filterLeadMax = e.target.value; loadMarketplace(); });
    bar.querySelector('#f-clear').addEventListener('click', () => {
      filterLocation = ''; filterVerified = false; filterLeadMax = ''; lastMarketplaceQuery = ''; activeCategory = '';
      if (searchQuery) searchQuery.value = '';
      if (heroSearchQuery) heroSearchQuery.value = '';
      loadMarketplace();
      renderCategories();
    });
  }
  const v = bar.querySelector('#f-verified'); if (v) v.checked = filterVerified;
  const loc = bar.querySelector('#f-location'); if (loc) loc.value = filterLocation;
  const lead = bar.querySelector('#f-lead'); if (lead) lead.value = filterLeadMax;
  const clear = bar.querySelector('#f-clear');
  if (clear) clear.hidden = !(filterLocation || filterVerified || filterLeadMax || lastMarketplaceQuery || activeCategory);
}

async function loadMarketplace(query = lastMarketplaceQuery, category = activeCategory) {
  lastMarketplaceQuery = query || '';
  activeCategory = category || '';
  const params = new URLSearchParams();
  if (lastMarketplaceQuery) params.set('q', lastMarketplaceQuery);
  if (activeCategory) params.set('category', activeCategory);
  if (filterLocation) params.set('location', filterLocation);
  if (filterVerified) params.set('verified', '1');
  if (filterLeadMax) params.set('lead_max', filterLeadMax);
  // Request server-side translation from cache when UI is not in Chinese.
  // Ask the backend to overlay cached translations for the active language.
  // All three locales are valid targets — products may be entered in any language.
  if (currentLang) params.set('target_lang', currentLang);

  syncMarketplaceURL();
  const anyFilter = !!(activeCategory || lastMarketplaceQuery || filterLocation || filterVerified || filterLeadMax);
  marketplaceGrid.innerHTML = renderProductSkeleton();

  try {
    const data = await apiFetch(`/api/marketplace${params.toString() ? `?${params}` : ''}`);
    const categories = data.categories || [];
    if (Array.isArray(data.all_locations) && data.all_locations.length) knownLocations = data.all_locations;
    renderFilterBar();

    if (!categories.length || categories.every(c => !c.items.length)) {
      marketplaceGrid.innerHTML = emptyStateHtml('emptyProductsLead');
      marketplaceGrid.className = 'marketplace-sections';
      return;
    }

    if (anyFilter) {
      // Filtered view: flat grid
      const products = flattenCategories(categories);
      marketplaceGrid.className = 'product-grid';
      marketplaceGrid.innerHTML = products.map(productCardHtml).join('');
    } else {
      // Browse view: one section per category, capped at 4 cards + "View all" link
      marketplaceGrid.className = 'marketplace-sections';
      marketplaceGrid.innerHTML = categories.map(cat => {
        const preview = cat.items.slice(0, 4);
        const hasMore = cat.items.length > 4;
        return `
          <section class="cat-section" aria-label="${escapeHtml(tCategory(cat.name, cat.display_name))}">
            <div class="cat-section-header">
              <h3>${escapeHtml(tCategory(cat.name, cat.display_name))}</h3>
              ${hasMore ? `<button class="cat-view-all" data-category="${escapeHtml(cat.name)}">${cat.items.length} ${escapeHtml(t('categoryProducts'))} &rsaquo;</button>` : ''}
            </div>
            <div class="product-grid">${preview.map(productCardHtml).join('')}</div>
          </section>`;
      }).join('');
    }
  } catch (error) {
    marketplaceGrid.innerHTML = `<p class="error">${escapeHtml(t('marketplaceError'))}</p>`;
  }
}

/* ============================================================
   Product media gallery (Phase 2)
   ============================================================ */

// Only images.unsplash.com supports on-the-fly resizing/format via query
// params. For those we generate real responsive variants + WebP; any other
// host falls back to the raw URL (no server-side pipeline exists — see ledger).
function galIsResizable(url) {
  return /(^|\/\/|\.)images\.unsplash\.com\//.test(url || '');
}
function galVariant(url, w) {
  if (!galIsResizable(url)) return url;
  try {
    const u = new URL(url, window.location.origin);
    u.searchParams.set('auto', 'format');   // Unsplash negotiates WebP/AVIF
    u.searchParams.set('fit', 'crop');
    u.searchParams.set('q', '75');
    u.searchParams.set('w', String(w));
    return u.toString();
  } catch (_) { return url; }
}
function galThumbSrc(item) {
  const u = item.thumb_url && item.thumb_url !== item.url ? item.thumb_url : item.url;
  return galIsResizable(u) ? galVariant(u, 160) : u;
}
function galFullSrc(url) { return galIsResizable(url) ? galVariant(url, 2048) : url; }

// srcset/sizes attributes for a stage <img>. Primary is eager+high priority.
function galImgAttrs(url, eager) {
  const load = eager ? 'fetchpriority="high"' : 'loading="lazy"';
  if (!galIsResizable(url)) {
    return `src="${escapeHtml(url)}" ${load} decoding="async"`;
  }
  const widths = [480, 800, 1280, 1600, 2048];
  const srcset = widths.map(w => `${escapeHtml(galVariant(url, w))} ${w}w`).join(', ');
  return `src="${escapeHtml(galVariant(url, 1280))}" srcset="${srcset}" ` +
         `sizes="(max-width: 680px) 92vw, 520px" ${load} decoding="async"`;
}

// Localized alt: supplier-authored alt_text wins; else "<name> — photo N of M".
function galAlt(item, product, idx, total) {
  if (item.alt_text) return item.alt_text;
  const key = item.type === 'video' ? 'galVideoOf' : 'galPhotoOf';
  return t(key).replace('{name}', product.name || '')
               .replace('{n}', idx + 1).replace('{m}', total);
}

// Default order: primary first, otherwise the supplier's sort_order (already
// applied by the API). Stable — semantic role ordering (full-shot → detail →
// cert) needs per-media role metadata we don't yet capture (see ledger 2.6).
function galOrder(media, fallbackUrl) {
  let arr = (media && media.length) ? media.slice() : [];
  if (!arr.length && fallbackUrl) {
    arr = [{ type: 'image', url: fallbackUrl, thumb_url: fallbackUrl, is_primary: 1 }];
  }
  const p = arr.findIndex(m => m.is_primary);
  if (p > 0) { const [primary] = arr.splice(p, 1); arr.unshift(primary); }
  return arr;
}

function galStageInner(item, idx, total, product, eager) {
  const alt = escapeHtml(galAlt(item, product, idx, total));
  if (item.type === 'video') {
    // Inline, controls, never autoplays with sound.
    return `<video class="gal-media gal-video" src="${escapeHtml(item.url)}" controls ` +
           `playsinline preload="metadata" aria-label="${alt}"></video>`;
  }
  // No inline onerror — CSP (default-src 'self') blocks inline handlers.
  // Failures are caught by a JS listener wired in wireGallery/lightbox.
  return `<img class="gal-media gal-img" ${galImgAttrs(item.url, eager)} alt="${alt}" ` +
         `width="800" height="600" ` +   // reserve 4:3 intrinsic ratio → no layout shift
         `data-full="${escapeHtml(galFullSrc(item.url))}" />`;
}

// Replace a failed image with a graceful tile that preserves layout.
function galImgFail(img) {
  if (!img || !img.parentNode) return;
  const tile = document.createElement('div');
  tile.className = 'gal-fail';
  tile.innerHTML = `<span aria-hidden="true">⚠</span><p>${escapeHtml(t('galImageUnavailable'))}</p>`;
  img.replaceWith(tile);
}

// Attach a failure guard (and catch images that already errored before wiring).
function galGuardImg(img) {
  if (!img) return;
  if (img.complete && img.naturalWidth === 0) { galImgFail(img); return; }
  img.addEventListener('error', () => galImgFail(img), { once: true });
}

function galleryHtml(media, fallbackUrl, product) {
  const items = galOrder(media, fallbackUrl);
  const total = items.length;

  if (!total) {
    const mark = escapeHtml((product.supplier || product.name || '?').slice(0, 2).toUpperCase());
    return `<div class="gal gal--empty">
      <div class="gal-empty">
        <span class="gal-empty-mark" aria-hidden="true">${mark}</span>
        <p>${escapeHtml(t('galEmpty'))}</p>
      </div>
    </div>`;
  }

  const active = items[0];
  const multi = total > 1;

  const nav = multi ? `
    <button class="gal-nav gal-prev" id="gal-prev" type="button" aria-label="${escapeHtml(t('galPrev'))}" disabled>‹</button>
    <button class="gal-nav gal-next" id="gal-next" type="button" aria-label="${escapeHtml(t('galNext'))}">›</button>
    <div class="gal-counter" id="gal-counter" aria-hidden="true">1 / ${total}</div>` : '';

  const expand = active.type !== 'video'
    ? `<button class="gal-expand" id="gal-expand" type="button" aria-label="${escapeHtml(t('galZoomOpen'))}">⤢</button>`
    : '';

  const stage = `<div class="gal-stage" id="gal-stage" tabindex="0" role="group"
      aria-roledescription="carousel" aria-label="${escapeHtml(t('galStageLabel'))}">
      <div class="gal-stage-inner" id="gal-stage-inner">${galStageInner(active, 0, total, product, true)}</div>
      <div class="gal-lens" id="gal-lens" aria-hidden="true"></div>
      ${nav}${expand}
    </div>`;

  const rail = multi ? `<div class="gal-rail" id="gal-rail" role="tablist" aria-label="${escapeHtml(t('galThumbsLabel'))}">
      ${items.map((m, i) => `<button class="gal-thumb${i === 0 ? ' is-active' : ''}" type="button" role="tab"
          aria-selected="${i === 0 ? 'true' : 'false'}" data-idx="${i}"
          aria-label="${escapeHtml(galAlt(m, product, i, total))}">
          ${m.type === 'video'
            ? `<span class="gal-thumb-play" aria-hidden="true">▶</span>`
            : `<img src="${escapeHtml(galThumbSrc(m))}" alt="" loading="lazy" decoding="async" width="72" height="72" />`}
          <span class="gal-thumb-ring" aria-hidden="true"></span>
        </button>`).join('')}
    </div>` : '';

  return `<div class="gal" data-count="${total}">${stage}${rail}</div>`;
}

async function openProductDetail(productId) {
  openModal(`<div class="pd-loading" style="text-align:center;padding:60px 0;color:#6b7280">${escapeHtml(t('pdLoading'))}</div>`, { wide: true });
  let product;
  try {
    ({ product } = await apiFetch(`/api/products/${productId}`));
  } catch (error) {
    openModal(`<h3>${escapeHtml(t('productUnavailable'))}</h3><p class="error">${escapeHtml(error.message)}</p>`);
    return;
  }

  const specs = (product.specs || []);
  const specRows = specs.length
    ? specs.map(s => [s.label, s.value])
    : [
        [t('specMoq'), product.moq],
        [t('specLeadTime'), product.lead_time],
        [t('specCapacity'), product.capacity],
        [t('detailCertifications'), product.certifications || t('detailPending')],
      ].filter(([, v]) => v);
  const specTable = specRows.length
    ? `<table class="pd-spec"><tbody>${specRows.map(([k, v]) =>
        `<tr><th scope="row">${escapeHtml(String(k))}</th><td>${escapeHtml(String(v))}</td></tr>`).join('')}</tbody></table>`
    : `<p class="pd-muted">${escapeHtml(t('detailPending'))}</p>`;

  // Key facts for the buy card (3.1) — only render what exists.
  const keyFacts = [
    [t('specLeadTime'), product.lead_time],
    [t('specCapacity'), product.capacity],
  ].filter(([, v]) => v);

  const supplierInitials = escapeHtml((product.supplier || '??').slice(0, 2).toUpperCase());
  const isVerified = product.verified;
  const statusBadge = isVerified
    ? `<span class="badge badge-success">✓ ${escapeHtml(t('pdVerifiedBadge'))}</span>`
    : `<span class="badge badge-warning">${escapeHtml(t('pdVerificationPending'))}</span>`;

  openModal(`
    <div class="pd">
      <div class="pd-grid">
        <div class="pd-gallery-col">
          ${galleryHtml(product.media || [], product.image_url, product)}
        </div>

        <aside class="pd-side" id="pd-buy">
          <span class="pd-eyebrow">${escapeHtml(tCategory(product.category || ''))}</span>
          <h2 class="pd-title">${escapeHtml(product.name)}</h2>
          <div class="pd-buysup">
            <span class="pd-buysup-name">${escapeHtml(product.supplier || '')}</span>
            ${statusBadge}
          </div>
          <div class="pd-pricebox">
            <div class="pd-price">${escapeHtml(product.price || '—')}</div>
            ${product.moq ? `<div class="pd-moq"><b>${escapeHtml(product.moq)}</b> ${escapeHtml(t('pdMinOrder'))}</div>` : ''}
          </div>
          ${keyFacts.length ? `<dl class="pd-keyfacts">${keyFacts.map(([k, v]) =>
            `<div><dt>${escapeHtml(String(k))}</dt><dd>${escapeHtml(String(v))}</dd></div>`).join('')}</dl>` : ''}
          <button class="primary pd-cta" data-quote-id="${product.id}">${escapeHtml(t('cardRequestQuote'))}</button>
          <p class="pd-ctahint">${escapeHtml(t('pdCtaHint'))}</p>
          <div class="pd-trust">
            <div><span class="pd-tick">✓</span> ${escapeHtml(t('pdTrustVetted'))}</div>
            <div><span class="pd-tick">✓</span> ${escapeHtml(t('pdTrustInspection'))}</div>
            <div><span class="pd-tick">✓</span> ${escapeHtml(t('pdTrustSupport'))}</div>
          </div>
        </aside>

        <div class="pd-main">
          <section class="pd-supplier">
            <div class="pd-avatar">${supplierInitials}</div>
            <div class="pd-supplier-main">
              <div class="pd-sname">${escapeHtml(product.supplier || '')}</div>
              <div class="pd-smeta">${escapeHtml(product.location || '')}</div>
              ${product.supplier_contact_email || product.supplier_contact_phone ? `
              <div class="pd-smeta">
                ${product.supplier_contact_email ? `<a href="mailto:${escapeHtml(product.supplier_contact_email)}">${escapeHtml(product.supplier_contact_email)}</a>` : ''}
                ${product.supplier_contact_email && product.supplier_contact_phone ? ' · ' : ''}
                ${product.supplier_contact_phone ? escapeHtml(product.supplier_contact_phone) : ''}
              </div>` : ''}
            </div>
            <dl class="pd-trustgrid">
              <div><dt>${escapeHtml(t('pdVerifiedBadge'))}</dt><dd>${statusBadge}</dd></div>
              <div><dt>${escapeHtml(t('pdResponseRate'))}</dt><dd class="pd-muted">${escapeHtml(t('pdNotRated'))}</dd></div>
              ${product.supplier_since ? `<div><dt>${escapeHtml(t('pdYearsActive'))}</dt><dd>${escapeHtml(product.supplier_since)}</dd></div>` : ''}
            </dl>
          </section>

          ${product.description ? `<details class="pd-collapse" open>
            <summary class="pd-sh">${escapeHtml(t('pdDescription'))}</summary>
            <p class="pd-desc">${escapeHtml(product.description)}</p>
          </details>` : ''}

          <details class="pd-collapse" open>
            <summary class="pd-sh">${escapeHtml(t('pdSpecs'))}</summary>
            ${specTable}
          </details>

          <section class="pd-section" id="pd-inquiry-section">
            <h3 class="pd-sh pd-sh-static">${escapeHtml(t('pdInquiryTitle'))}</h3>
            <div class="pd-formgrid" id="pd-form">
              <input type="text" name="website" style="display:none" aria-hidden="true" tabindex="-1" autocomplete="off" />
              <div class="pd-field">
                <label for="pd-name">${escapeHtml(t('pdFieldName'))}</label>
                <input id="pd-name" placeholder="${escapeHtml(t('pdFieldNamePh'))}" aria-describedby="pd-name-err" />
                <span class="pd-fielderr" id="pd-name-err"></span>
              </div>
              <div class="pd-field">
                <label for="pd-email">${escapeHtml(t('pdFieldEmail'))}</label>
                <input id="pd-email" type="email" placeholder="${escapeHtml(t('pdFieldEmailPh'))}" aria-describedby="pd-email-err" />
                <span class="pd-fielderr" id="pd-email-err"></span>
              </div>
              <div class="pd-field">
                <label for="pd-company">${escapeHtml(t('pdFieldCompany'))}</label>
                <input id="pd-company" placeholder="${escapeHtml(t('pdFieldCompanyPh'))}" />
              </div>
              <div class="pd-field">
                <label for="pd-qty">${escapeHtml(t('pdFieldQty'))}</label>
                <input id="pd-qty" placeholder="${escapeHtml(t('pdFieldQtyPh'))}" />
              </div>
              <div class="pd-field pd-full">
                <label for="pd-message">${escapeHtml(t('pdFieldMessage'))}</label>
                <textarea id="pd-message" rows="4" placeholder="${escapeHtml(t('pdFieldMessagePh'))}" aria-describedby="pd-message-err"></textarea>
                <span class="pd-fielderr" id="pd-message-err"></span>
              </div>
              <div class="pd-field pd-full"><span class="pd-fielderr" id="pd-form-err" role="alert"></span></div>
              <div class="pd-field pd-full">
                <button type="button" class="primary pd-submit">${escapeHtml(t('pdSend'))}</button>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div class="pd-mobilecta" aria-hidden="false">
        <div class="pd-mobilecta-price">${escapeHtml(product.price || '—')}</div>
        <button class="primary pd-cta" data-quote-id="${product.id}">${escapeHtml(t('cardRequestQuote'))}</button>
      </div>
    </div>
  `, { wide: true });

  wireGallery(product);

  // Wire up the inquiry form
  const submitBtn = document.querySelector('.pd-submit');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => submitProductInquiry(product.id, product));
  }
}

// Gallery controller: thumbnail/stage sync, disable-at-ends nav, keyboard.
// (Lightbox + hover-magnify + video handling added in 2.3.)
function wireGallery(product) {
  const gal = document.querySelector('.gal');
  if (!gal || gal.classList.contains('gal--empty')) return;
  const media = galOrder(product.media || [], product.image_url);
  const total = media.length;
  const stage = document.getElementById('gal-stage');
  const inner = document.getElementById('gal-stage-inner');
  const rail = document.getElementById('gal-rail');
  const counter = document.getElementById('gal-counter');
  const prev = document.getElementById('gal-prev');
  const next = document.getElementById('gal-next');
  const expandBtn = document.getElementById('gal-expand');
  const lens = document.getElementById('gal-lens');
  const thumbs = rail ? Array.from(rail.querySelectorAll('.gal-thumb')) : [];
  let idx = 0;

  function sync() {
    thumbs.forEach((b, i) => {
      const on = i === idx;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (counter) counter.textContent = `${idx + 1} / ${total}`;
    if (prev) prev.disabled = idx === 0;
    if (next) next.disabled = idx === total - 1;
    if (thumbs[idx]) thumbs[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    // expand + zoom only apply to images
    const isImg = media[idx].type !== 'video';
    if (expandBtn) expandBtn.hidden = !isImg;
    if (stage) stage.style.cursor = isImg ? 'zoom-in' : 'default';
  }

  function go(i) {
    const n = Math.max(0, Math.min(total - 1, i));
    if (n === idx) return;
    idx = n;
    inner.innerHTML = galStageInner(media[idx], idx, total, product, false);
    sync();
    galGuardImg(inner.querySelector('.gal-img'));
    attachZoom();
  }

  prev?.addEventListener('click', () => go(idx - 1));
  next?.addEventListener('click', () => go(idx + 1));
  rail?.addEventListener('click', e => {
    const b = e.target.closest('.gal-thumb');
    if (b) go(Number(b.dataset.idx));
  });
  stage?.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(idx + 1); }
    else if ((e.key === 'Enter' || e.key === ' ') && media[idx].type !== 'video') {
      e.preventDefault(); openLightbox(idx);
    }
  });
  // Click stage (image) or the expand button opens the lightbox.
  stage?.addEventListener('click', e => {
    if (e.target.closest('.gal-nav')) return;
    if (media[idx].type !== 'video') openLightbox(idx);
  });

  /* ---- Desktop hover-magnify: zoomed region shown BESIDE the original ---- */
  function getPanel() {
    let p = document.querySelector('.gal-zoom-panel');
    if (!p) { p = document.createElement('div'); p.className = 'gal-zoom-panel'; p.setAttribute('aria-hidden', 'true'); document.body.appendChild(p); }
    return p;
  }
  function hideZoom() {
    const p = document.querySelector('.gal-zoom-panel');
    if (p) p.style.display = 'none';
    if (lens) lens.style.display = 'none';
  }
  function attachZoom() {
    hideZoom();
    const img = inner.querySelector('.gal-img');
    const fine = window.matchMedia('(pointer:fine)').matches && window.innerWidth >= 1024;
    if (!img || !fine) return;
    const ZOOM = 2.4;
    const full = img.dataset.full || img.currentSrc || img.src;
    img.addEventListener('mousemove', e => {
      const r = img.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      const room = window.innerWidth - r.right - 24;
      if (x < 0 || x > 1 || y < 0 || y > 1 || room < 240) { hideZoom(); return; }
      const p = getPanel();
      p.style.display = 'block';
      p.style.top = r.top + 'px';
      p.style.left = (r.right + 12) + 'px';
      p.style.width = Math.min(r.width, room) + 'px';
      p.style.height = r.height + 'px';
      p.style.backgroundImage = `url("${full}")`;
      p.style.backgroundSize = `${r.width * ZOOM}px ${r.height * ZOOM}px`;
      p.style.backgroundPosition = `${x * 100}% ${y * 100}%`;
      if (lens) {
        const lw = r.width / ZOOM, lh = r.height / ZOOM;
        lens.style.display = 'block';
        lens.style.width = lw + 'px'; lens.style.height = lh + 'px';
        lens.style.left = Math.max(0, Math.min(r.width - lw, (e.clientX - r.left) - lw / 2)) + 'px';
        lens.style.top = Math.max(0, Math.min(r.height - lh, (e.clientY - r.top) - lh / 2)) + 'px';
      }
    });
    img.addEventListener('mouseleave', hideZoom);
  }

  /* ---- Fullscreen lightbox: focus-trapped, keyboard, returns focus ---- */
  function openLightbox(start) {
    hideZoom();
    let li = start;
    const trigger = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'gal-lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', t('galLightboxLabel'));

    function paint() {
      const m = media[li];
      const alt = escapeHtml(galAlt(m, product, li, total));
      const body = m.type === 'video'
        ? `<video class="gal-lb-media" src="${escapeHtml(m.url)}" controls playsinline preload="metadata" aria-label="${alt}"></video>`
        : `<img class="gal-lb-media" src="${escapeHtml(galFullSrc(m.url))}" alt="${alt}" />`;
      overlay.innerHTML = `
        <button class="gal-lb-close" data-lb="close" type="button" aria-label="${escapeHtml(t('galZoomOpen'))}">×</button>
        ${total > 1 ? `
          <button class="gal-lb-nav gal-lb-prev" data-lb="prev" type="button" aria-label="${escapeHtml(t('galPrev'))}" ${li === 0 ? 'disabled' : ''}>‹</button>
          <button class="gal-lb-nav gal-lb-next" data-lb="next" type="button" aria-label="${escapeHtml(t('galNext'))}" ${li === total - 1 ? 'disabled' : ''}>›</button>
          <div class="gal-lb-counter">${li + 1} / ${total}</div>` : ''}
        <div class="gal-lb-stage">${body}</div>`;
      overlay.querySelector('[data-lb="close"]').focus();
      galGuardImg(overlay.querySelector('.gal-lb-media'));
    }
    function lbGo(i) { li = Math.max(0, Math.min(total - 1, i)); paint(); }
    function close() {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      document.body.style.overflow = '';
      go(li);  // sync main stage to where the buyer left off
      (trigger && trigger.focus ? trigger : stage)?.focus();
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowLeft') { lbGo(li - 1); }
      else if (e.key === 'ArrowRight') { lbGo(li + 1); }
      else if (e.key === 'Tab') {
        const f = Array.from(overlay.querySelectorAll('button:not([disabled])'));
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    overlay.addEventListener('click', e => {
      const act = e.target.closest('[data-lb]')?.dataset.lb;
      if (act === 'close' || e.target === overlay) return close();
      if (act === 'prev') lbGo(li - 1);
      if (act === 'next') lbGo(li + 1);
    });
    paint();
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);
    overlay.querySelector('[data-lb="close"]')?.focus();  // element is now in the DOM
  }

  expandBtn?.addEventListener('click', () => openLightbox(idx));
  sync();       // idempotent with the eager-rendered initial DOM
  galGuardImg(inner.querySelector('.gal-img')); // guard the eager primary image
  attachZoom(); // wire magnify onto the eager primary image
}

async function submitProductInquiry(productId, product) {
  const fields = {
    name: document.getElementById('pd-name'),
    email: document.getElementById('pd-email'),
    message: document.getElementById('pd-message'),
  };
  const formErr = document.getElementById('pd-form-err');
  const setErr = (key, msg) => {
    const err = document.getElementById(`pd-${key}-err`);
    if (err) err.textContent = msg || '';
    if (fields[key]) fields[key].setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  // Clear prior errors
  ['name', 'email', 'message'].forEach(k => setErr(k, ''));
  if (formErr) formErr.textContent = '';

  const name = fields.name?.value.trim() || '';
  const email = fields.email?.value.trim() || '';
  const company = document.getElementById('pd-company')?.value.trim() || '';
  const quantity = document.getElementById('pd-qty')?.value.trim() || '';
  const message = fields.message?.value.trim() || '';
  const website = document.querySelector('#pd-form input[name="website"]')?.value || '';

  // Inline, per-field validation: say what's wrong AND how to fix it.
  let firstBad = null;
  if (!name) { setErr('name', t('pdErrNameFix')); firstBad = firstBad || fields.name; }
  if (!/^\S+@\S+\.\S+$/.test(email)) { setErr('email', t('pdErrEmailFix')); firstBad = firstBad || fields.email; }
  if (message.length < 20) { setErr('message', t('pdErrMessageFix')); firstBad = firstBad || fields.message; }
  if (firstBad) { firstBad.focus(); return; }

  const btn = document.querySelector('.pd-submit');
  const stopLoading = () => { if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; btn.removeAttribute('aria-busy'); } };
  if (btn) { btn.classList.add('is-loading'); btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }

  try {
    const res = await fetch(`/api/products/${productId}/inquiry`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': getCookie('csrf_token'),  // required — POST /api/ enforces CSRF
      },
      credentials: 'include',
      body: JSON.stringify({ name, email, company, quantity, message, website }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      stopLoading();
      if (formErr) formErr.textContent = data.error || t('pdErrSend');
      return;
    }
    // Success state: confirm what happens next and when.
    const form = document.getElementById('pd-form');
    if (form) {
      form.innerHTML = `<div class="pd-success">
        <span class="pd-success-mark" aria-hidden="true">✓</span>
        <h4>${escapeHtml(t('pdSentTitle').replace('{supplier}', product?.supplier || ''))}</h4>
        <p>${escapeHtml(t('pdSentNext').replace('{email}', email))}</p>
      </div>`;
    }
  } catch {
    stopLoading();
    if (formErr) formErr.textContent = t('pdErrNetwork');
  }
}

async function loadSuppliers(query = '') {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  try {
    const data = await apiFetch(`/api/suppliers${params.toString() ? `?${params}` : ''}`);
    supplierGrid.innerHTML = data.suppliers.length ? data.suppliers.map(supplier => `
      <article class="supplier-card">
        <div class="supplier-logo">${escapeHtml(supplier.company.slice(0, 2).toUpperCase())}</div>
        <div>
          <div class="supplier-head">
            <strong>${escapeHtml(supplier.company)}</strong>
            ${supplier.verified ? `<span class="status-pill good">${escapeHtml(t('pillVerified'))}</span>` : ''}
          </div>
          <p>${escapeHtml(supplier.location || t('supplierLocationPending'))}</p>
          <dl class="supplier-meta">
            <div><dt>${escapeHtml(t('supplierProducts'))}</dt><dd>${supplier.product_count}</dd></div>
            <div><dt>${escapeHtml(t('supplierCategories'))}</dt><dd>${escapeHtml(supplier.categories || t('supplierPending'))}</dd></div>
            <div><dt>${escapeHtml(t('supplierCertifications'))}</dt><dd>${escapeHtml(supplier.certifications || t('supplierPending'))}</dd></div>
          </dl>
        </div>
      </article>
    `).join('') : emptyStateHtml('emptySuppliersLead');
  } catch (error) {
    supplierGrid.innerHTML = `<p class="error">${escapeHtml(t('suppliersError'))}</p>`;
  }
}

function renderUserPanel() {
  const dashboardSection = document.getElementById('dashboard');
  const auditSection = document.querySelector('.audit-section');

  if (!currentUser) {
    userPanel.innerHTML = '';
    dashboardSection?.classList.add('hidden');
    auditSection?.classList.add('hidden');
    return;
  }
  dashboardSection?.classList.remove('hidden');
  // Audit trail is sensitive — admin eyes only
  if (currentUser.role === 'admin') {
    auditSection?.classList.remove('hidden');
  } else {
    auditSection?.classList.add('hidden');
  }

  userPanel.innerHTML = `
    <aside class="account-card">
      <span class="eyebrow">${escapeHtml(currentUser.role)}</span>
      <h3>${escapeHtml(currentUser.company)}</h3>
      <p>${escapeHtml(currentUser.name)}</p>
      <button id="logout-button">${escapeHtml(t('dashboardLogout'))}</button>
    </aside>
    <section class="workspace-card">
      <div class="tabs">
        <button class="tab-button active" data-tab="rfqs">${escapeHtml(t('dashboardTabRfqs'))}</button>
        <button class="tab-button" data-tab="orders">${escapeHtml(t('dashboardTabOrders'))}</button>
        <button class="tab-button" data-tab="verification">${escapeHtml(t('dashboardTabVerification'))}</button>
        ${currentUser.role === 'supplier' || currentUser.role === 'admin' ? `<button class="tab-button" data-tab="products">${escapeHtml(t('dashboardTabProducts'))}</button>` : ''}
        ${currentUser.role === 'admin' ? `<button class="tab-button" data-tab="admin">${escapeHtml(t('dashboardTabAdmin'))}</button>` : ''}
      </div>
      <div id="workspace-content"></div>
    </section>
    <aside class="thread-card">
      <h3>${escapeHtml(t('dashboardRfqThread'))}</h3>
      <div id="thread-content" class="stack-list"><p class="empty-state">${escapeHtml(t('dashboardRfqThreadEmpty'))}</p></div>
    </aside>
  `;

  document.getElementById('logout-button').addEventListener('click', handleLogout);
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });
  switchTab('rfqs');
}

function setActiveTab(tab) {
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === tab);
  });
}

async function switchTab(tab) {
  setActiveTab(tab);
  if (tab === 'rfqs') await loadQuotes();
  if (tab === 'orders') await loadOrders();
  if (tab === 'verification') await loadVerifications();
  if (tab === 'products') renderProductForm();
  if (tab === 'admin') renderAdminPanel();
}

async function loadQuotes() {
  const container = document.getElementById('workspace-content');
  try {
    const data = await apiFetch('/api/quotes');
    const items = data.quotes || [];
    container.innerHTML = `
      <div class="workspace-header">
        <h3>${escapeHtml(currentUser.role === 'buyer' ? t('rfqMine') : t('rfqQueue'))}</h3>
        <span>${items.length} ${escapeHtml(t('rfqActiveRecords'))}</span>
      </div>
      ${items.length ? items.map(quote => `
        <article class="record-card">
          <div>
            <strong>${escapeHtml(quote.product_name)}</strong>
            <p>${escapeHtml(quote.buyer_company)} → ${escapeHtml(quote.product_supplier)}</p>
          </div>
          <dl class="record-meta">
            <div><dt>${escapeHtml(t('recordQuantity'))}</dt><dd>${escapeHtml(quote.quantity)}</dd></div>
            <div><dt>${escapeHtml(t('recordStatus'))}</dt><dd>${escapeHtml(statusLabel(quote.status))}</dd></div>
            <div><dt>${escapeHtml(t('recordTarget'))}</dt><dd>${escapeHtml(quote.target_price || t('recordNotSet'))}</dd></div>
            <div><dt>${escapeHtml(t('recordDestination'))}</dt><dd>${escapeHtml(quote.destination || t('recordNotSet'))}</dd></div>
          </dl>
          <div class="record-actions">
            <select class="status-select" data-id="${quote.id}">
              ${QUOTE_STATUSES.map(status => `
                <option value="${status}" ${status === quote.status ? 'selected' : ''}>${escapeHtml(statusLabel(status))}</option>
              `).join('')}
            </select>
            <button class="thread-button" data-id="${quote.id}">${escapeHtml(t('openThread'))}</button>
            <button class="order-button" data-id="${quote.id}">${escapeHtml(t('createOrderBtn'))}</button>
          </div>
        </article>
      `).join('') : `<p class="empty-state">${escapeHtml(t('rfqEmpty'))}</p>`}
    `;

    document.querySelectorAll('.status-select').forEach(select => {
      select.addEventListener('change', event => updateQuoteStatus(event.target.dataset.id, event.target.value));
    });
    document.querySelectorAll('.thread-button').forEach(button => {
      button.addEventListener('click', event => loadThread(event.target.dataset.id));
    });
    document.querySelectorAll('.order-button').forEach(button => {
      button.addEventListener('click', event => createOrder(event.target.dataset.id));
    });
  } catch (error) {
    container.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

async function updateQuoteStatus(quoteId, status) {
  await apiFetch(`/api/quotes/${quoteId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  await Promise.all([loadQuotes(), loadOverview()]);
  if (activeQuoteId === Number(quoteId)) await loadThread(quoteId);
}

async function createOrder(quoteId) {
  await apiFetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quote_id: quoteId, incoterm: 'FOB', amount: 'Pending provider quote' })
  });
  setActiveTab('orders');
  await Promise.all([loadOrders(), loadOverview()]);
}

async function loadOrders() {
  const container = document.getElementById('workspace-content');
  try {
    const data = await apiFetch('/api/orders');
    const items = data.orders || [];
    container.innerHTML = `
      <div class="workspace-header"><h3>${escapeHtml(t('ordersTitle'))}</h3><span>${items.length} ${escapeHtml(t('ordersTradeRecords'))}</span></div>
      ${items.length ? items.map(order => `
        <article class="record-card">
          <div>
            <strong>${escapeHtml(order.product_name)}</strong>
            <p>${escapeHtml(order.buyer_company)} · ${escapeHtml(order.supplier)}</p>
          </div>
          <dl class="record-meta">
            <div><dt>${escapeHtml(t('orderLabel'))}</dt><dd>#${order.id}</dd></div>
            <div><dt>${escapeHtml(t('orderIncoterm'))}</dt><dd>${escapeHtml(order.incoterm)}</dd></div>
            <div><dt>${escapeHtml(t('orderPayment'))}</dt><dd>${escapeHtml(order.payment_status)}</dd></div>
            <div><dt>${escapeHtml(t('orderInspection'))}</dt><dd>${escapeHtml(order.inspection_status)}</dd></div>
          </dl>
        </article>
      `).join('') : `<p class="empty-state">${escapeHtml(t('ordersEmpty'))}</p>`}
    `;
  } catch (error) {
    container.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

async function loadThread(quoteId) {
  activeQuoteId = Number(quoteId);
  const thread = document.getElementById('thread-content');
  try {
    const data = await apiFetch(`/api/messages/${quoteId}`);
    thread.innerHTML = `
      ${data.messages.map(message => `
        <article>
          <strong>${escapeHtml(message.sender_name)}</strong>
          <span>${escapeHtml(message.sender_company)} · ${new Date(message.created_at).toLocaleString()}</span>
          <p>${escapeHtml(message.body)}</p>
        </article>
      `).join('')}
      <form id="message-form" class="inline-form">
        <textarea name="body" rows="3" placeholder="${escapeHtml(t('threadPlaceholder'))}" required></textarea>
        <button type="submit" class="primary">${escapeHtml(t('threadSend'))}</button>
      </form>
    `;
    document.getElementById('message-form').addEventListener('submit', async event => {
      event.preventDefault();
      const form = event.target;
      let body = new FormData(form).get('body');
      const submitBtn = form.querySelector('button[type="submit"]');

      // Auto-translate buyer messages to Chinese so suppliers can read them.
      if (currentLang && currentLang !== 'zh' && body && body.trim()) {
        const originalLabel = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = t('rfqTranslating');
        try {
          const res = await apiFetch('/api/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: body.trim(), target_lang: 'zh' })
          });
          if (res.translated && res.translated !== body.trim()) {
            body = `${body.trim()}\n\n---\n${res.translated}`;
          }
        } catch (_) {
          // Translation failed — send original silently.
        }
        submitBtn.textContent = originalLabel;
        submitBtn.disabled = false;
      }

      await apiFetch(`/api/messages/${quoteId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body })
      });
      await Promise.all([loadThread(quoteId), loadOverview()]);
    });
  } catch (error) {
    thread.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

async function loadVerifications() {
  const container = document.getElementById('workspace-content');
  const isAdmin = currentUser.role === 'admin';
  try {
    const data = await apiFetch('/api/verifications');
    // Admin: build a picker of supplier companies that don't yet have a record,
    // so the admin can create (and then approve) a verification for any of them.
    let companyOptions = '';
    let hasCompanies = false;
    if (isAdmin) {
      try {
        const sup = await apiFetch('/api/suppliers');
        const existing = new Set(data.verifications.map(v => v.supplier_company));
        const companies = (sup.suppliers || [])
          .map(s => s.company)
          .filter(c => c && !existing.has(c))
          .sort((a, b) => a.localeCompare(b));
        hasCompanies = companies.length > 0;
        companyOptions = companies
          .map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
          .join('');
      } catch (_) { /* non-fatal: form still works via free-text fallback */ }
    }
    container.innerHTML = `
      <div class="workspace-header"><h3>${escapeHtml(t('verificationTitle'))}</h3><span>${data.verifications.length} ${escapeHtml(t('verificationRecords'))}</span></div>
      <div class="verification-grid">
        ${data.verifications.map(item => `
          <article class="record-card">
            <strong>${escapeHtml(item.supplier_company)}</strong>
            <dl class="record-meta">
              <div><dt>${escapeHtml(t('verifStatus'))}</dt><dd>${item.status === 'verified'
                ? `<span class="status-pill good">${escapeHtml(item.status)}</span>`
                : escapeHtml(item.status)}</dd></div>
              <div><dt>${escapeHtml(t('verifFactory'))}</dt><dd>${escapeHtml(item.factory_address || t('verifMissing'))}</dd></div>
              <div><dt>${escapeHtml(t('verifEvidence'))}</dt><dd>${escapeHtml(item.evidence || t('verifMissing'))}</dd></div>
              <div><dt>${escapeHtml(t('verifNextReview'))}</dt><dd>${escapeHtml(item.next_review_at || t('verifUnset'))}</dd></div>
            </dl>
            ${currentUser.role === 'admin' ? `<div class="record-actions">${item.status === 'verified'
              ? `<button class="secondary verif-action" data-id="${item.id}" data-action="revoke">${escapeHtml(t('verifRevoke'))}</button>`
              : `<button class="primary verif-action" data-id="${item.id}" data-action="approve">${escapeHtml(t('verifApprove'))}</button>`}
              <span class="verif-err" role="alert"></span></div>` : ''}
          </article>
        `).join('')}
      </div>
      ${currentUser.role === 'supplier' || isAdmin ? `
        <form id="verification-form" class="data-form">
          ${isAdmin ? `
            <p class="form-hint">${escapeHtml(t('verifAdminHint'))}</p>
            ${hasCompanies
              ? `<label>${escapeHtml(t('verifCompany'))}<select name="supplier_company" required>
                   <option value="">${escapeHtml(t('verifCompanyPick'))}</option>
                   ${companyOptions}
                 </select></label>`
              : `<label>${escapeHtml(t('verifCompany'))}<input name="supplier_company" placeholder="${escapeHtml(t('verifCompanyPick'))}" required /></label>`}
          ` : ''}
          <label>${escapeHtml(t('verifBusinessLicense'))}${isAdmin ? ` <span class="muted">${escapeHtml(t('verifOptional'))}</span>` : ''}<input name="business_license" placeholder="${escapeHtml(t('verifBusinessLicensePh'))}" ${isAdmin ? '' : 'required'} /></label>
          <label>${escapeHtml(t('verifFactoryAddress'))}${isAdmin ? ` <span class="muted">${escapeHtml(t('verifOptional'))}</span>` : ''}<input name="factory_address" placeholder="${escapeHtml(t('verifFactoryAddressPh'))}" ${isAdmin ? '' : 'required'} /></label>
          <label>${escapeHtml(t('verifEvidenceLabel'))}${isAdmin ? ` <span class="muted">${escapeHtml(t('verifOptional'))}</span>` : ''}<textarea name="evidence" rows="3" placeholder="${escapeHtml(t('verifEvidencePh'))}" ${isAdmin ? '' : 'required'}></textarea></label>
          <button type="submit" class="primary">${escapeHtml(t('verifSubmit'))}</button>
        </form>
      ` : ''}
    `;
    document.getElementById('verification-form')?.addEventListener('submit', async event => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(event.target).entries());
      await apiFetch('/api/verifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      await Promise.all([loadVerifications(), loadOverview(), loadSuppliers()]);
    });

    // Admin: approve / revoke a supplier verification (sets products.verified).
    container.querySelectorAll('.verif-action').forEach(btn => {
      btn.addEventListener('click', async () => {
        const errEl = btn.parentElement.querySelector('.verif-err');
        if (errEl) errEl.textContent = '';
        btn.disabled = true;
        try {
          await apiFetch(`/api/admin/verifications/${btn.dataset.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: btn.dataset.action })
          });
          await Promise.all([loadVerifications(), loadOverview(), loadSuppliers(), loadMarketplace()]);
        } catch (error) {
          btn.disabled = false;
          if (errEl) errEl.textContent = error.message || t('verifActionError');
        }
      });
    });
  } catch (error) {
    container.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

function mediaEditorHtml(mediaRows = []) {
  const rows = mediaRows.length
    ? mediaRows
    : [{ type: 'image', url: '', is_primary: true }];
  return `
    <div class="media-editor" id="media-editor">
      <div id="media-rows">
        ${rows.map((m, i) => mediaRowHtml(m, i)).join('')}
      </div>
      <button type="button" class="secondary media-add-btn" style="margin-top:.5rem;font-size:.8rem">+ Add photo / video URL</button>
    </div>`;
}

function mediaRowHtml(m, i) {
  return `
    <div class="media-row" data-index="${i}">
      <select class="media-type" style="width:90px;padding:6px 4px">
        <option value="image" ${m.type === 'image' ? 'selected' : ''}>Image</option>
        <option value="video" ${m.type === 'video' ? 'selected' : ''}>Video</option>
      </select>
      <input class="media-url" type="url" value="${escapeHtml(m.url || '')}" placeholder="https://…  (image or video URL)" style="flex:1" />
      <label style="display:flex;align-items:center;gap:4px;font-size:.8rem;white-space:nowrap">
        <input type="radio" name="media-primary" value="${i}" ${m.is_primary ? 'checked' : ''} /> Primary
      </label>
      <button type="button" class="media-remove-btn secondary" style="padding:4px 10px">✕</button>
    </div>`;
}

function collectMedia(container) {
  const rows = container.querySelectorAll('.media-row');
  const primaryIdx = parseInt(container.querySelector('input[name="media-primary"]:checked')?.value ?? '0');
  const media = [];
  rows.forEach((row, i) => {
    const url = row.querySelector('.media-url').value.trim();
    const type = row.querySelector('.media-type').value;
    if (url) media.push({ type, url, thumb_url: url, is_primary: i === primaryIdx ? 1 : 0 });
  });
  return media;
}

function bindMediaEditor(container) {
  container.querySelector('.media-add-btn').addEventListener('click', () => {
    const rowsEl = container.querySelector('#media-rows');
    const idx = rowsEl.querySelectorAll('.media-row').length;
    rowsEl.insertAdjacentHTML('beforeend', mediaRowHtml({ type: 'image', url: '', is_primary: false }, idx));
  });
  container.addEventListener('click', e => {
    if (e.target.closest('.media-remove-btn')) {
      const row = e.target.closest('.media-row');
      if (container.querySelectorAll('.media-row').length > 1) row.remove();
      else row.querySelector('.media-url').value = '';
    }
  });
}

function productFormHtml(product = null) {
  const v = f => escapeHtml(product ? (product[f] || '') : '');
  const isEdit = !!product;
  const media = product?.media?.length
    ? product.media
    : (product?.image_url ? [{ type: 'image', url: product.image_url, is_primary: true }] : []);
  return `
    <form id="product-form" class="data-form two-column" data-id="${isEdit ? product.id : ''}">
      <label>${escapeHtml(t('pfCategory'))}${categorySelectHtml(v('category'))}</label>
      <label>${escapeHtml(t('pfName'))}<input name="name" value="${v('name')}" placeholder="${escapeHtml(t('pfNamePh'))}" required /></label>
      <label>${escapeHtml(t('pfLocation'))}<input name="location" value="${v('location')}" placeholder="${escapeHtml(t('pfLocationPh'))}" required /></label>
      <label>${escapeHtml(t('pfPrice'))}<input name="price" value="${v('price')}" placeholder="${escapeHtml(t('pfPricePh'))}" required /></label>
      <label>${escapeHtml(t('pfMoq'))}<input name="moq" value="${v('moq')}" placeholder="${escapeHtml(t('pfMoqPh'))}" required /></label>
      <label>${escapeHtml(t('pfLeadTime'))}<input name="lead_time" value="${v('lead_time')}" placeholder="${escapeHtml(t('pfLeadTimePh'))}" required /></label>
      <label>${escapeHtml(t('pfCapacity'))}<input name="capacity" value="${v('capacity')}" placeholder="${escapeHtml(t('pfCapacityPh'))}" /></label>
      <label>${escapeHtml(t('pfCertifications'))}<input name="certifications" value="${v('certifications')}" placeholder="${escapeHtml(t('pfCertificationsPh'))}" /></label>
      <div class="wide">
        <div style="font-size:.85rem;color:#4A5A66;margin-bottom:.4rem">${escapeHtml(t('pfMediaLabel'))}</div>
        ${mediaEditorHtml(media)}
      </div>
      <label class="wide">${escapeHtml(t('pfDescription'))}<textarea name="description" rows="4" placeholder="${escapeHtml(t('pfDescriptionPh'))}" required>${v('description')}</textarea></label>
      <div style="display:flex;gap:.5rem">
        <button type="submit" class="primary">${escapeHtml(isEdit ? t('pfEditSubmit') : t('pfSubmit'))}</button>
        ${isEdit ? `<button type="button" id="cancel-edit" class="secondary">${escapeHtml(t('pfCancelEdit'))}</button>` : ''}
      </div>
    </form>
    <div id="product-form-feedback" class="feedback"></div>
  `;
}

function bindProductForm(onSuccess) {
  const form = document.getElementById('product-form');
  const mediaEditor = form.querySelector('#media-editor');
  if (mediaEditor) bindMediaEditor(mediaEditor);

  form.addEventListener('submit', async event => {
    event.preventDefault();
    const feedback = document.getElementById('product-form-feedback');
    const id = form.dataset.id;
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.media = collectMedia(form.querySelector('#media-editor'));
    try {
      if (id) {
        await apiFetch(`/api/products/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        await apiFetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        form.reset();
      }
      feedback.textContent = id ? t('pfEditSubmit') + ' ✓' : t('pfSubmit') + ' ✓';
      feedback.className = 'feedback success';
      await Promise.all([loadMarketplace(), loadCategories(), loadOverview(), loadSuppliers()]);
      if (onSuccess) onSuccess();
    } catch (error) {
      feedback.textContent = error.message;
      feedback.className = 'feedback error';
    }
  });
  document.getElementById('cancel-edit')?.addEventListener('click', () => renderProductForm());
}

async function renderProductForm() {
  const container = document.getElementById('workspace-content');
  let listings = [];
  try {
    const data = await apiFetch('/api/my-products');
    listings = data.products || [];
  } catch (_) {}

  container.innerHTML = `
    <div class="workspace-header"><h3>${escapeHtml(t('productFormTitle'))}</h3><span>${escapeHtml(t('productFormSub'))}</span></div>
    ${productFormHtml()}
    ${listings.length ? `
      <div class="workspace-header" style="margin-top:2rem"><h3>${escapeHtml(t('pfMyListings'))}</h3><span>${listings.length}</span></div>
      ${listings.map(p => `
        <article class="record-card">
          <div>
            <strong>${escapeHtml(p.name)}</strong>
            <p>${escapeHtml(tCategory(p.category))} · ${escapeHtml(p.supplier)}</p>
          </div>
          <dl class="record-meta">
            <div><dt>${escapeHtml(t('pfPrice'))}</dt><dd>${escapeHtml(p.price)}</dd></div>
            <div><dt>${escapeHtml(t('pfLocation'))}</dt><dd>${escapeHtml(p.location)}</dd></div>
          </dl>
          <div class="record-actions">
            <button class="edit-product-btn secondary" data-id="${p.id}">${escapeHtml(t('pfEditBtn'))}</button>
          </div>
        </article>
      `).join('')}
    ` : ''}
  `;
  bindProductForm(null);
  document.querySelectorAll('.edit-product-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const product = listings.find(p => String(p.id) === btn.dataset.id);
      if (product) renderEditProductForm(product);
    });
  });
}

function renderEditProductForm(product) {
  const container = document.getElementById('workspace-content');
  container.innerHTML = `
    <div class="workspace-header"><h3>${escapeHtml(t('pfEditTitle'))}: ${escapeHtml(product.name)}</h3></div>
    ${productFormHtml(product)}
  `;
  bindProductForm(() => renderProductForm());
}

async function renderAdminPanel() {
  const container = document.getElementById('workspace-content');
  let listings = [];
  try {
    const data = await apiFetch('/api/my-products');
    listings = data.products || [];
  } catch (_) {}

  let registry = [];
  try {
    const data = await apiFetch('/api/admin/suppliers');
    registry = data.suppliers || [];
  } catch (_) {}

  container.innerHTML = `
    <div class="workspace-header"><h3>${escapeHtml(t('adminAddSupplierTitle'))}</h3><span>${escapeHtml(t('adminAddSupplierSub'))}</span></div>
    <form id="admin-supplier-form" class="data-form two-column">
      <label>${escapeHtml(t('adminSupplierName'))}<input name="name" placeholder="Jane Smith" required /></label>
      <label>${escapeHtml(t('adminSupplierCompany'))}<input name="company" placeholder="Acme Manufacturing Co." required /></label>
      <label>${escapeHtml(t('adminSupplierEmail'))}<input name="contact_email" type="email" placeholder="sales@yourteam.com" /></label>
      <label>${escapeHtml(t('adminSupplierPhone'))}<input name="contact_phone" placeholder="+86 138 0000 0000" /></label>
      <button type="submit" class="primary">${escapeHtml(t('adminSupplierSubmit'))}</button>
    </form>
    <div id="admin-supplier-feedback" class="feedback"></div>

    <div class="workspace-header" style="margin-top:2rem"><h3>${escapeHtml(t('adminAddProductTitle'))}</h3></div>
    <form id="admin-product-form" class="data-form two-column" data-id="">
      <label class="wide">${escapeHtml(t('adminProductSupplier'))}
        <select name="supplier_id" required>
          <option value="">${escapeHtml(t('adminProductSupplierPick'))}</option>
          ${registry.map(s => `<option value="${s.id}">${escapeHtml(s.company)}</option>`).join('')}
        </select>
      </label>
      <label>${escapeHtml(t('pfCategory'))}${categorySelectHtml('')}</label>
      <label>${escapeHtml(t('pfName'))}<input name="name" placeholder="${escapeHtml(t('pfNamePh'))}" required /></label>
      <label>${escapeHtml(t('pfLocation'))}<input name="location" placeholder="${escapeHtml(t('pfLocationPh'))}" required /></label>
      <label>${escapeHtml(t('pfPrice'))}<input name="price" placeholder="${escapeHtml(t('pfPricePh'))}" required /></label>
      <label>${escapeHtml(t('pfMoq'))}<input name="moq" placeholder="${escapeHtml(t('pfMoqPh'))}" required /></label>
      <label>${escapeHtml(t('pfLeadTime'))}<input name="lead_time" placeholder="${escapeHtml(t('pfLeadTimePh'))}" required /></label>
      <label>${escapeHtml(t('pfCapacity'))}<input name="capacity" placeholder="${escapeHtml(t('pfCapacityPh'))}" /></label>
      <label>${escapeHtml(t('pfCertifications'))}<input name="certifications" placeholder="${escapeHtml(t('pfCertificationsPh'))}" /></label>
      <div class="wide">
        <div style="font-size:.85rem;color:#4A5A66;margin-bottom:.4rem">${escapeHtml(t('pfMediaLabel'))}</div>
        ${mediaEditorHtml([])}
      </div>
      <label class="wide">${escapeHtml(t('pfDescription'))}<textarea name="description" rows="4" placeholder="${escapeHtml(t('pfDescriptionPh'))}" required></textarea></label>
      <div style="display:flex;gap:.5rem">
        <button type="submit" id="admin-product-submit" class="primary">${escapeHtml(t('pfSubmit'))}</button>
        <button type="button" id="admin-cancel-edit" class="secondary" style="display:none">${escapeHtml(t('pfCancelEdit'))}</button>
      </div>
    </form>
    <div id="admin-product-feedback" class="feedback"></div>

    ${listings.length ? `
      <div class="workspace-header" style="margin-top:2rem"><h3>${escapeHtml(t('pfMyListings'))}</h3><span>${listings.length}</span></div>
      ${listings.map(p => `
        <article class="record-card">
          <div>
            <strong>${escapeHtml(p.name)}</strong>
            <p>${escapeHtml(p.supplier)} · ${escapeHtml(tCategory(p.category))}</p>
          </div>
          <dl class="record-meta">
            <div><dt>${escapeHtml(t('pfPrice'))}</dt><dd>${escapeHtml(p.price)}</dd></div>
            <div><dt>${escapeHtml(t('pfLocation'))}</dt><dd>${escapeHtml(p.location)}</dd></div>
          </dl>
          <div class="record-actions">
            <button class="admin-edit-product secondary" data-id="${p.id}">${escapeHtml(t('pfEditBtn'))}</button>
          </div>
        </article>
      `).join('')}
    ` : ''}
  `;

  document.getElementById('admin-supplier-form').addEventListener('submit', async event => {
    event.preventDefault();
    const feedback = document.getElementById('admin-supplier-feedback');
    const payload = Object.fromEntries(new FormData(event.target).entries());
    try {
      const result = await apiFetch('/api/admin/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      feedback.textContent = `${t('adminSupplierCreated')} ID: ${result.supplier_id} — ${result.company}${result.contact_email ? ` (${result.contact_email})` : ''}`;
      feedback.className = 'feedback success';
      event.target.reset();
      const supplierSelect = document.querySelector('#admin-product-form [name="supplier_id"]');
      if (supplierSelect) {
        const option = document.createElement('option');
        option.value = result.supplier_id;
        option.textContent = result.company;
        supplierSelect.appendChild(option);
      }
      await Promise.all([loadOverview(), loadSuppliers()]);
    } catch (error) {
      feedback.textContent = error.message;
      feedback.className = 'feedback error';
    }
  });

  const adminProductForm = document.getElementById('admin-product-form');
  const adminProductFeedback = document.getElementById('admin-product-feedback');
  const adminSubmitBtn = document.getElementById('admin-product-submit');
  const adminCancelBtn = document.getElementById('admin-cancel-edit');

  bindMediaEditor(adminProductForm.querySelector('.media-editor'));

  adminCancelBtn.addEventListener('click', () => {
    adminProductForm.reset();
    adminProductForm.dataset.id = '';
    adminSubmitBtn.textContent = t('pfSubmit');
    adminCancelBtn.style.display = 'none';
    adminProductForm.querySelector('[name="supplier_id"]').removeAttribute('disabled');
    const mediaEditor = adminProductForm.querySelector('.media-editor');
    if (mediaEditor) mediaEditor.querySelector('#media-rows').innerHTML = mediaRowHtml({ type: 'image', url: '', is_primary: true }, 0);
  });

  adminProductForm.addEventListener('submit', async event => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(adminProductForm).entries());
    if (payload.supplier_id) payload.supplier_id = parseInt(payload.supplier_id, 10);
    payload.media = collectMedia(adminProductForm.querySelector('.media-editor'));
    const id = adminProductForm.dataset.id;
    try {
      if (id) {
        await apiFetch(`/api/products/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        await apiFetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        adminProductForm.reset();
      }
      adminProductFeedback.textContent = (id ? t('pfEditSubmit') : t('pfSubmit')) + ' ✓';
      adminProductFeedback.className = 'feedback success';
      await Promise.all([loadMarketplace(), loadCategories(), loadOverview(), loadSuppliers()]);
      await renderAdminPanel();
    } catch (error) {
      adminProductFeedback.textContent = error.message;
      adminProductFeedback.className = 'feedback error';
    }
  });

  document.querySelectorAll('.admin-edit-product').forEach(btn => {
    btn.addEventListener('click', async () => {
      const product = listings.find(p => String(p.id) === btn.dataset.id);
      if (!product) return;
      const form = document.getElementById('admin-product-form');
      ['category', 'name', 'location', 'price', 'moq', 'lead_time', 'capacity', 'certifications', 'description'].forEach(f => {
        const el = form.querySelector(`[name="${f}"]`);
        if (el) el.value = product[f] || '';
      });
      // The pin is fixed once created — show it but keep the select disabled
      // (disabled fields are excluded from FormData, and PATCH ignores supplier anyway).
      const supplierEl = form.querySelector('[name="supplier_id"]');
      if (supplierEl) { supplierEl.value = String(product.supplier_id || ''); supplierEl.setAttribute('disabled', true); }
      form.dataset.id = product.id;
      adminSubmitBtn.textContent = t('pfEditSubmit');
      adminCancelBtn.style.display = '';

      // Populate media editor from the full product (which includes product_media rows)
      try {
        const res = await apiFetch(`/api/products/${product.id}`);
        const full = res.product || res;
        const mediaList = full.media?.length
          ? full.media
          : (full.image_url ? [{ type: 'image', url: full.image_url, is_primary: true }] : [{ type: 'image', url: '', is_primary: true }]);
        const mediaEditor = form.querySelector('.media-editor');
        if (mediaEditor) mediaEditor.querySelector('#media-rows').innerHTML = mediaList.map((m, i) => mediaRowHtml(m, i)).join('');
      } catch (_) {}

      form.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

async function handleLogout() {
  await apiFetch('/api/auth/logout', { method: 'POST' });
  currentUser = null;
  activeQuoteId = null;
  renderUserPanel();
  await Promise.all([loadMarketplace(), loadOverview()]);
}

function openAuthModal(type, message = '') {
  const isLogin = type === 'login';
  openModal(`
    <h3>${escapeHtml(isLogin ? t('authSignIn') : t('authJoinFree'))}</h3>
    ${message ? `<p class="notice">${escapeHtml(message)}</p>` : ''}
    <form id="auth-form" class="data-form">
      ${isLogin ? '' : `
        <label>${escapeHtml(t('authFieldName'))}<input type="text" name="name" required /></label>
        <label>${escapeHtml(t('authFieldCompany'))}<input type="text" name="company" required /></label>
      `}
      <label>${escapeHtml(t('authFieldEmail'))}<input type="email" name="email" value="${isLogin ? 'buyer@example.com' : ''}" required /></label>
      <label>${escapeHtml(t('authFieldPassword'))}<input type="password" name="password" value="${isLogin ? 'Password123' : ''}" minlength="8" required /></label>
      ${isLogin ? '' : `<label>${escapeHtml(t('authFieldRole'))}<select name="role"><option value="buyer">${escapeHtml(t('authRoleBuyer'))}</option><option value="supplier">${escapeHtml(t('authRoleSupplier'))}</option></select></label>`}
      <button type="submit" class="primary">${escapeHtml(isLogin ? t('authSignIn') : t('authCreateAccount'))}</button>
      <p>${escapeHtml(isLogin ? t('authNeedAccount') : t('authAlreadyRegistered'))} <button type="button" class="link-button" id="${isLogin ? 'switch-to-register' : 'switch-to-login'}">${escapeHtml(isLogin ? t('authJoinFreeOption') : t('authSignIn'))}</button></p>
      <div id="auth-feedback" class="feedback"></div>
    </form>
  `);

  const authForm = document.getElementById('auth-form');
  const authFeedback = document.getElementById('auth-feedback');
  authForm.addEventListener('submit', async event => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(authForm).entries());
    const url = isLogin ? '/api/auth/login' : '/api/auth/register';
    try {
      const result = await apiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      currentUser = result.user;
      closeModal();
      await Promise.all([loadOverview(), loadMarketplace(), loadSuppliers()]);
      renderUserPanel();
      scrollToId('dashboard');
    } catch (error) {
      authFeedback.textContent = error.message;
      authFeedback.className = 'feedback error';
    }
  });

  document.getElementById('switch-to-register')?.addEventListener('click', () => openAuthModal('register'));
  document.getElementById('switch-to-login')?.addEventListener('click', () => openAuthModal('login'));
}

async function demoLogin(email) {
  const result = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Password123' })
  });
  currentUser = result.user;
  renderUserPanel();
  await Promise.all([loadOverview(), loadMarketplace(), loadSuppliers()]);
  scrollToId('dashboard');
}

async function runProductSearch(query) {
  if (searchQuery) searchQuery.value = query;
  if (heroSearchQuery) heroSearchQuery.value = query;
  activeCategory = '';
  await loadMarketplace(query, '');
  scrollToId('marketplace');
}

headerSearch?.addEventListener('click', async () => {
  const query = searchQuery.value.trim();
  if (searchType.value === 'suppliers') {
    await loadSuppliers(query);
    scrollToId('suppliers');
  } else {
    await runProductSearch(query);
  }
});

heroSearchForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const q = (heroSearchQuery || searchQuery)?.value?.trim() || '';
  await runProductSearch(q);
});

// Debounced live search (5.3): typing filters results in place (skeleton =
// loading state, empty-state-with-CTA = zero results). Pressing Enter/Search
// still scrolls to the results. Live updates don't force-scroll on each key.
function debounce(fn, ms = 300) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}
const liveProductSearch = debounce((q) => { activeCategory = ''; loadMarketplace(q, ''); }, 300);
const liveSupplierSearch = debounce((q) => { loadSuppliers(q); }, 300);

searchQuery?.addEventListener('input', () => {
  const q = searchQuery.value.trim();
  if (searchType?.value === 'suppliers') liveSupplierSearch(q);
  else liveProductSearch(q);
});
heroSearchQuery?.addEventListener('input', () => liveProductSearch(heroSearchQuery.value.trim()));

supplierSearch?.addEventListener('input', event => {
  loadSuppliers(event.target.value.trim());
});

contactForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const payload = Object.fromEntries(new FormData(contactForm).entries());
  try {
    const result = await apiFetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    contactFeedback.textContent = result.message;
    contactFeedback.className = 'feedback success';
    contactForm.reset();
    await loadOverview();
  } catch (error) {
    contactFeedback.textContent = error.message;
    contactFeedback.className = 'feedback error';
  }
});

quoteForm?.addEventListener('submit', async event => {
  event.preventDefault();
  const payload = {
    product_id: quoteProductId.value,
    quantity: quoteQuantity.value,
    target_price: quoteTargetPrice.value,
    destination: quoteDestination.value,
    notes: quoteNotes.value
  };

  try {
    await apiFetch('/api/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    quoteFeedback.textContent = t('rfqSubmitted');
    quoteFeedback.className = 'feedback success';
    await Promise.all([loadOverview(), loadMarketplace()]);
    if (currentUser) await loadQuotes();
    setTimeout(() => {
      closeQuoteModal();
      scrollToId('dashboard');
    }, 900);
  } catch (error) {
    quoteFeedback.textContent = error.message;
    quoteFeedback.className = 'feedback error';
  }
});

// The category dropdown is fixed-positioned, so close it when anything scrolls.
window.addEventListener('scroll', closeCategoryMenus, { passive: true });
document.getElementById('category-list')?.addEventListener('scroll', closeCategoryMenus, { passive: true });

// The category rail scrolls horizontally, but a desktop mouse wheel only scrolls
// vertically — translate vertical wheel intent into horizontal scroll so every
// category is reachable without a trackpad or visible scrollbar.
document.getElementById('category-list')?.addEventListener('wheel', event => {
  const rail = event.currentTarget;
  if (rail.scrollWidth <= rail.clientWidth) return; // nothing to scroll
  const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
  if (!delta) return;
  const atStart = rail.scrollLeft <= 0;
  const atEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 1;
  // Only hijack the wheel while there's room to scroll in that direction,
  // otherwise let the page scroll normally at the ends.
  if ((delta < 0 && !atStart) || (delta > 0 && !atEnd)) {
    rail.scrollLeft += delta;
    event.preventDefault();
  }
}, { passive: false });

document.addEventListener('click', async event => {
  const groupBtn = event.target.closest('.cat-group-btn');
  if (groupBtn) {
    const menu = groupBtn.parentElement.querySelector('.cat-dropdown');
    const wasOpen = menu && !menu.classList.contains('hidden');
    closeCategoryMenus();
    if (menu && !wasOpen) {
      // The rail clips overflow, so the menu is fixed-positioned under the pill.
      const rect = groupBtn.getBoundingClientRect();
      menu.style.top = `${rect.bottom + 6}px`;
      menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - 248))}px`;
      menu.classList.remove('hidden');
      groupBtn.setAttribute('aria-expanded', 'true');
    }
    return;
  }
  closeCategoryMenus();

  const scrollTarget = event.target.closest('[data-scroll-target]');
  if (scrollTarget) {
    scrollToId(scrollTarget.dataset.scrollTarget);
    return;
  }

  const categoryButton = event.target.closest('[data-category]');
  if (categoryButton) {
    activeCategory = categoryButton.dataset.category;
    renderCategories();
    await loadMarketplace(lastMarketplaceQuery, activeCategory);
    scrollToId('marketplace');
    return;
  }

  const searchButton = event.target.closest('[data-search]');
  if (searchButton) {
    await runProductSearch(searchButton.dataset.search);
    return;
  }

  const quoteButton = event.target.closest('[data-id], [data-quote-id]');
  if (quoteButton?.classList.contains('quote-button') || quoteButton?.dataset.quoteId) {
    openQuoteModal(quoteButton.dataset.id || quoteButton.dataset.quoteId);
    return;
  }

  const productButton = event.target.closest('[data-product-id]');
  if (productButton) {
    await openProductDetail(productButton.dataset.productId);
    return;
  }

  const demoButton = event.target.closest('[data-demo-login]');
  if (demoButton) {
    await demoLogin(demoButton.dataset.demoLogin);
    return;
  }

  const modalClose = event.target.closest('[data-modal-action="close"]');
  if (modalClose) {
    closeModal();
  }
});

document.getElementById('open-login')?.addEventListener('click', () => openAuthModal('login'));
document.getElementById('open-register')?.addEventListener('click', () => openAuthModal('register'));
document.getElementById('close-modal')?.addEventListener('click', closeModal);
document.getElementById('close-quote-modal')?.addEventListener('click', closeQuoteModal);
accountModal?.addEventListener('click', event => {
  if (event.target === accountModal) closeModal();
});

document.querySelectorAll('.lang-button').forEach(button => {
  button.addEventListener('click', () => setLanguage(button.dataset.lang));
});

init();
