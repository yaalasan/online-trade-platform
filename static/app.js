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
let currentLang = 'en';


const translations = {
  en: {
    utilitySlogan: 'AI-powered sourcing, compliance, and global supplier matching',
    navAbout: 'About',
    navContact: 'Contact',
    navAboutUs: 'About Us',
    navMembership: 'Membership',
    navAiFunctions: 'AI Functions',
    navFaq: 'FAQ',
    authSignIn: 'Sign in',
    authJoinFree: 'Join Free',
    navPortal: 'Supplier Portal',
    heroListCompany: 'List your company',
    heroEyebrow: 'AI-driven one-stop trade matching & consulting',
    heroTitle: 'Intelligent global sourcing · Multilingual communication · Full risk control',
    heroSubtitle: 'AI-Powered One-Stop Foreign Trade Matching & Consulting Service — intelligent global sourcing, real-time translation, and compliance support.',
    heroBuyerBtn: 'Find Suppliers',
    heroSupplierBtn: 'Join Free as Supplier',
    heroConsultBtn: 'Online Consultation',
    heroHighlights: 'AI-powered matching, multilingual support, risk control, and full-process consulting.',
    searchProducts: 'Products',
    searchSuppliers: 'Suppliers',
    searchPlaceholder: 'Search products, suppliers, certifications...',
    searchButton: 'Search',
    statsCountries: 'Serving 30+ Countries & Regions',
    statsCountriesSub: 'Serving 30+ countries and regions',
    statsFactories: '500+ Cooperated Factories',
    statsFactoriesSub: '500+ cooperated factories',
    statsOrders: '12,000+ Completed Orders',
    statsOrdersSub: '12,000+ completed orders',
    statsExperience: '15+ Years of Industry Experience',
    statsExperienceSub: '15+ years of industry experience',
    advantageEyebrow: 'Platform advantages',
    advantageTitle: 'Four AI-powered strengths for global trade',
    featureMatchTitle: 'AI intelligent matching',
    featureMatchCopy: 'Powered by AI algorithm, we automatically match ideal partners based on product category, production capacity, quotation, certification and lead time.',
    featureCommTitle: '24/7 multilingual communication',
    featureCommCopy: 'Supports English, Spanish, French, Arabic and other mainstream languages with real-time AI translation and intelligent response.',
    featureRiskTitle: 'Full-trade compliance and risk control',
    featureRiskCopy: 'AI qualification checks, transaction risk ratings and order monitoring across customs, logistics and contracts.',
    featureConsultTitle: 'End-to-end trade consulting',
    featureConsultCopy: 'Policy analysis, market research, tariff consulting, factory audit, quality inspection and document production.',
    statsProducts: 'Products available for sourcing',
    statsVerified: 'Verified suppliers',
    statsRfqs: 'Live RFQ requests',
    statsOrdersMetric: 'Orders tracked in dashboard',
    servicesEyebrow: 'Service scenarios',
    servicesTitle: 'Buyer & supplier services for global trade',
    buyersSectionTitle: 'Buyer services',
    buyersList1: 'Post purchasing requests and get AI-matched qualified suppliers',
    buyersList2: 'Compare quotes, review qualifications and transaction history',
    buyersList3: 'One-stop logistics, customs, and payment support',
    buyersList4: 'Dedicated trade consultant for negotiation and fulfillment support',
    buyersSub: 'Post purchasing requests & get AI-matched qualified suppliers, compare quotes, and access logistics, customs and payment support.',
    suppliersSectionTitle: 'Supplier services',
    suppliersList1: 'Register free and connect with global buyers',
    suppliersList2: 'AI multilingual product translation and overseas visibility',
    suppliersList3: 'Targeted inquiry distribution to boost order volume',
    suppliersList4: 'Compliance guidance, document templates, and risk alerts',
    suppliersSub: 'Register free, translate product information with AI, receive targeted inquiries and gain compliance guidance.',
    serviceListEyebrow: 'Core services',
    serviceListTitle: 'Value-added service modules',
    serviceMatch: 'Trade mediation',
    serviceMatchSub: 'Supply-demand matching, order brokerage and negotiation support.',
    serviceCompliance: 'Compliance consulting',
    serviceComplianceSub: 'Import/export policy, tariff, rebate and certification support.',
    serviceDocument: 'Document service',
    serviceDocumentSub: 'AI auto-generate contracts, PI, packing lists and customs documents.',
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
    aboutTitle: 'AI and trade expertise bridging global buyers and suppliers',
    aboutCopy1: 'We are a comprehensive cross-border trade platform combining AI technology and traditional trade experience to connect global buyers and domestic suppliers.',
    aboutCopy2: 'Adhering to Integrity, Professionalism, Efficiency and Compliance, we match reliable sources for buyers and help domestic factories expand globally with consulting and risk-control support.',
    membershipEyebrow: 'Membership & Fees',
    membershipTitle: 'Flexible registration, transparent membership',
    supplierRegistrationTitle: 'Supplier Registration',
    supplierRegistrationReq: 'Requirements: valid business license, production or supply qualification, and compliant export products.',
    supplierRegistrationPlans: 'Basic plan: free registration and standard inquiries. Premium plan: priority AI matching, homepage exposure and traffic support.',
    supplierRegistrationPricing: 'Service fees apply only to successful order brokerage, with no hidden charges.',
    buyerServiceTitle: 'Buyer Service',
    buyerServiceCopy: 'Post requests and find suppliers for FREE forever; fees only apply to custom audits, dedicated consultants and expedited documents.',
    aiFunctionsEyebrow: 'AI Functions',
    aiFunctionsTitle: 'AI tooling for intelligent matching and risk management',
    aiFunctionMatch: 'Intelligent matching',
    aiFunctionMatchSub: 'Match buyers and suppliers using big data algorithms.',
    aiFunctionChat: 'Multilingual AI Chatbot',
    aiFunctionChatSub: '24/7 auto-reply with multilingual support.',
    aiFunctionDocs: 'Smart document system',
    aiFunctionDocsSub: 'Generate standard trade documents with one click.',
    aiFunctionRisk: 'Risk control system',
    aiFunctionRiskSub: 'Verify qualification and assess transaction risks in real time.',
    teamEyebrow: 'Our Team',
    teamTitle: 'The people behind Fastflow',
    faqEyebrow: 'FAQ',
    faqTitle: 'Frequently asked questions',
    faqSafetyQ: 'How does the platform secure transactions?',
    faqSafetyA: 'Our AI risk control system verifies both parties and provides transaction guarantees and contract supervision.',
    faqFeesQ: 'Is there a fee to join the platform?',
    faqFeesA: 'Basic registration is free. Fees apply only for promotion, premium membership and value-added services.',
    faqPostQ: 'Can I post purchasing requests?',
    faqPostA: 'Yes, after registration you can post requests for free and AI will recommend suitable suppliers.',
    faqLangQ: 'What languages does the platform support?',
    faqLangA: 'We support English, Spanish, French, Arabic and more with real-time AI translation.',
    faqMultiQ: 'Can products be displayed in multiple languages?',
    faqMultiA: 'Yes, AI auto-translates product names, details and specifications into multiple languages.',
    faqAssignQ: 'How are inquiries assigned?',
    faqAssignA: 'Inquiries are distributed intelligently by AI based on category, capacity and pricing.',
    contactEyebrow: 'Contact Us',
    contactTitle: 'Start your AI-enabled trade matching journey',
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
    footerCopyright: '©2026 Fastflow',
    footerDescription: 'AI-powered trade mediation, consulting & full-process cross-border service.',
    footerPrivacy: 'Privacy Policy',
    footerAgreement: 'User Agreement',
    footerDisclaimer: 'Disclaimer',
    footerSitemap: 'Sitemap',
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
    trustItem1: 'Verified suppliers only',
    trustItem2: 'Secure escrow payments',
    trustItem3: 'Full-process risk control',
    trustItem4: 'Multilingual support 24/7',
    howEyebrow: 'How It Works',
    howTitle: 'Three steps to global trade',
    howStep1Num: '01',
    howStep1Title: 'Register & Post',
    howStep1Copy: 'Create a free buyer or supplier account and post your products or sourcing requests in minutes.',
    howStep2Num: '02',
    howStep2Title: 'AI Matching',
    howStep2Copy: 'Our AI engine analyzes your requirements and instantly connects you with verified buyers or qualified suppliers.',
    howStep3Num: '03',
    howStep3Title: 'Connect & Trade',
    howStep3Copy: 'Communicate, exchange RFQs, negotiate terms, and complete trades with full compliance and logistics support.',
    testimonialsEyebrow: 'Testimonials',
    testimonialsTitle: 'Trusted by global traders',
    testimonial1Quote: 'Fastflow connected us with 3 verified Chinese factories in 48 hours — the AI matching saved weeks of manual sourcing work.',
    testimonial1Name: 'James Kowalski',
    testimonial1Company: 'Procurement Manager, MechParts EU · Poland',
    testimonial2Quote: 'As an exporter in Shenzhen, we gained 12 new overseas buyers in our first quarter. The multilingual support and AI translation are excellent.',
    testimonial2Name: 'Zhang Wei',
    testimonial2Company: 'Export Manager, Delta Precision Works · Shenzhen',
    testimonial3Quote: 'The compliance and document support eliminated our main bottleneck. Our sourcing cycle shortened by 40% within two months.',
    testimonial3Name: 'Aisha Kolenova',
    testimonial3Company: 'Supply Chain Director, TradeCo CIS · Russia',
    dashboardTabRfqs: 'RFQs',
    dashboardTabOrders: 'Orders',
    dashboardTabVerification: 'Verification',
    dashboardTabProducts: 'Products',
    dashboardLogout: 'Logout',
    dashboardRfqThread: 'RFQ Thread',
    dashboardRfqThreadEmpty: 'Select an RFQ to open the thread.',
    categoriesAll: 'All Categories',
    categoryProducts: 'products',
    systemActor: 'System',
    metricOrdersLabel: 'orders',
    pillVerified: 'Verified',
    pillReview: 'Review',
    specMoq: 'MOQ',
    specLeadTime: 'Lead time',
    specCapacity: 'Capacity',
    specAsk: 'Ask',
    cardRequestQuote: 'Request quote',
    cardViewDetails: 'View details',
    marketplaceEmpty: 'No matching products found.',
    marketplaceError: 'Unable to load marketplace data.',
    categoriesError: 'Categories unavailable.',
    auditError: 'Unable to load audit trail.',
    detailSupplier: 'Supplier',
    detailLocation: 'Location',
    detailPrice: 'Price',
    detailCertifications: 'Certifications',
    detailPending: 'Pending',
    productUnavailable: 'Product unavailable',
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
    productFormTitle: 'Add product listing',
    productFormSub: 'Supplier listings enter verification review',
    pfCategory: 'Category',
    pfCategoryPh: 'Machinery, Packaging, Components',
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
    rfqSubmitted: 'RFQ submitted. Check My Fastflow.'
  },
  zh: {
    utilitySlogan: 'AI驱动采购、合规和全球供应商撮合',
    navAbout: '关于',
    navContact: '联系我们',
    navAboutUs: '关于我们',
    navMembership: '入驻规则',
    navAiFunctions: 'AI功能',
    navFaq: '常见问答',
    authSignIn: '登录',
    authJoinFree: '免费入驻',
    navPortal: '供应商门户',
    heroListCompany: '登记您的公司',
    heroEyebrow: 'AI驱动 · 一站式外贸撮合与咨询服务',
    heroTitle: '智能匹配全球供需 · 多语种实时沟通 · 全流程风控护航',
    heroSubtitle: 'AI驱动的一站式外贸撮合与咨询服务——智能全球采购、实时翻译与合规支持。',
    heroBuyerBtn: '海外买家：立即找货源',
    heroSupplierBtn: '国内供应商：免费入驻',
    heroConsultBtn: '在线咨询',
    heroHighlights: 'AI撮合、多语种支持、风控合规、全流程服务。',
    searchProducts: '产品',
    searchSuppliers: '供应商',
    searchPlaceholder: '搜索产品、供应商、认证...',
    searchButton: '搜索',
    statsCountries: '服务全球30+国家和地区',
    statsCountriesSub: '服务全球30+国家和地区',
    statsFactories: '合作工厂500+家',
    statsFactoriesSub: '合作工厂500+家',
    statsOrders: '累计撮合订单12,000+笔',
    statsOrdersSub: '累计撮合订单12,000+笔',
    statsExperience: '行业服务经验15+年',
    statsExperienceSub: '行业服务经验15+年',
    advantageEyebrow: '平台优势',
    advantageTitle: '四大AI优势，驱动全球外贸',
    featureMatchTitle: 'AI智能精准匹配',
    featureMatchCopy: '依托智能算法，根据品类、产能、报价、认证、交期等维度筛选最优合作方，快速达成合作。',
    featureCommTitle: '7×24小时多语种沟通',
    featureCommCopy: '支持英语、西班牙语、法语、阿拉伯语等主流语种，AI实时翻译，打破语言与时区壁垒。',
    featureRiskTitle: '全流程合规风控',
    featureRiskCopy: 'AI核验资质、交易评级、履约监控，覆盖报关、结汇、物流、合同各环节。',
    featureConsultTitle: '全链条外贸咨询',
    featureConsultCopy: '政策解读、市场调研、关税咨询、验厂质检、单证制作，一站式解决外贸问题。',
    statsProducts: '可采购产品',
    statsVerified: '认证供应商',
    statsRfqs: '实时询盘',
    statsOrdersMetric: '订单跟踪',
    servicesEyebrow: '服务场景',
    servicesTitle: '采购商与供应商一站式服务',
    buyersSectionTitle: '采购商服务',
    buyersList1: '发布采购需求，AI自动推送优质供应商',
    buyersList2: '在线比价、资质查看、成交记录查询',
    buyersList3: '一站式物流、报关、结算配套服务',
    buyersList4: '专属顾问协助谈判与履约',
    buyersSub: '发布采购需求，AI自动推荐供应商，支持物流、报关和结算服务。',
    suppliersSectionTitle: '供应商服务',
    suppliersList1: '免费入驻，直面全球采购商',
    suppliersList2: 'AI多语种翻译，海外曝光引流',
    suppliersList3: '精准分发询盘，提升接单效率',
    suppliersList4: '合规指导、单证模板、风险预警',
    suppliersSub: '免费注册，AI翻译产品信息，接收精准询盘并获得合规支持。',
    serviceListEyebrow: '核心服务',
    serviceListTitle: '增值服务模块',
    serviceMatch: '外贸撮合',
    serviceMatchSub: '供需对接、订单居间、商务谈判协助。',
    serviceCompliance: '合规咨询',
    serviceComplianceSub: '进出口政策、关税、退税、认证服务。',
    serviceDocument: '单证服务',
    serviceDocumentSub: 'AI自动生成合同、PI、装箱单、报关资料。',
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
    aboutTitle: 'AI与贸易经验，连接全球买家与供应商',
    aboutCopy1: '我们是一家综合跨境外贸服务平台，融合AI技术与传统经验，搭建海内外供需桥梁。',
    aboutCopy2: '秉持诚信、专业、高效、合规，为海外采购商匹配靠谱货源，为国内工厂开拓全球市场。',
    membershipEyebrow: '入驻规则',
    membershipTitle: '灵活入驻，透明收费',
    supplierRegistrationTitle: '供应商入驻',
    supplierRegistrationReq: '要求：合法营业执照、生产/供货资质，产品符合进出口标准。',
    supplierRegistrationPlans: '基础版免费入驻，进阶版享受AI优先匹配、首页曝光、流量扶持。',
    supplierRegistrationPricing: '撮合服务费仅针对成交订单，拒绝隐形消费。',
    buyerServiceTitle: '采购商服务',
    buyerServiceCopy: '发布需求、查找供应商永久免费，仅对定制验厂、专属顾问、加急单证等增值服务收费。',
    aiFunctionsEyebrow: 'AI功能',
    aiFunctionsTitle: '智能匹配与风控工具',
    aiFunctionMatch: '智能匹配',
    aiFunctionMatchSub: '大数据算法匹配买卖双方。',
    aiFunctionChat: '多语种客服',
    aiFunctionChatSub: '7×24小时自动应答，支持多语言。',
    aiFunctionDocs: '智能单证',
    aiFunctionDocsSub: '一键生成标准外贸单据。',
    aiFunctionRisk: '风控系统',
    aiFunctionRiskSub: 'AI核验资质，实时评估风险。',
    teamEyebrow: '我们的团队',
    teamTitle: 'Fastflow背后的人',
    faqEyebrow: '常见问答',
    faqTitle: '常见问题',
    faqSafetyQ: '平台如何保障交易安全？',
    faqSafetyA: '平台搭载AI风控系统，核验双方资质并提供交易担保与合同监管。',
    faqFeesQ: '入驻平台需要收费吗？',
    faqFeesA: '基础入驻免费，付费仅针对推广、高级会员和增值服务。',
    faqPostQ: '可以发布采购需求吗？',
    faqPostA: '可以，注册后免费发布，AI会自动推荐合适供应商。',
    faqLangQ: '支持哪些语种沟通？',
    faqLangA: '支持英语、西班牙语、法语、阿拉伯语等主流语种，AI实时翻译。',
    faqMultiQ: '产品可以做多语种展示吗？',
    faqMultiA: '可以，AI自动翻译产品名称、详情和参数。',
    faqAssignQ: '询盘如何分配？',
    faqAssignA: 'AI根据品类、产能、报价等条件智能分发询盘。',
    contactEyebrow: '联系我们',
    contactTitle: '开启AI外贸撮合之旅',
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
    auditTitle: '最新审计记录',
    footerCopyright: '©2026 Fastflow',
    footerDescription: 'AI赋能外贸撮合、咨询与跨境订单全流程服务。',
    footerPrivacy: '隐私政策',
    footerAgreement: '用户协议',
    footerDisclaimer: '免责声明',
    footerSitemap: '网站地图',
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
    trustItem1: '仅限认证供应商',
    trustItem2: '安全资金托管支付',
    trustItem3: '全流程风险管控',
    trustItem4: '7×24小时多语种服务',
    howEyebrow: '服务流程',
    howTitle: '三步开启全球贸易',
    howStep1Num: '01',
    howStep1Title: '注册发布',
    howStep1Copy: '免费创建买家或供应商账号，几分钟内发布产品或采购需求。',
    howStep2Num: '02',
    howStep2Title: 'AI智能匹配',
    howStep2Copy: 'AI引擎分析您的需求，即时匹配认证买家或合格供应商。',
    howStep3Num: '03',
    howStep3Title: '对接成交',
    howStep3Copy: '直接沟通、交换询盘、谈判条款，并在全程合规与物流支持下完成交易。',
    testimonialsEyebrow: '客户评价',
    testimonialsTitle: '全球贸易商的信任之选',
    testimonial1Quote: 'Fastflow在48小时内为我们匹配了3家经过认证的中国工厂——AI匹配节省了数周的人工寻源工作。',
    testimonial1Name: 'James Kowalski',
    testimonial1Company: '采购经理，MechParts EU · 波兰',
    testimonial2Quote: '作为深圳的出口商，我们在平台第一个季度就获得了12个新的海外买家。多语种支持和AI翻译非常出色。',
    testimonial2Name: '张伟',
    testimonial2Company: '出口经理，达尔特精密制造 · 深圳',
    testimonial3Quote: '合规与单证支持消除了我们的主要瓶颈，两个月内采购周期缩短了40%。',
    testimonial3Name: 'Aisha Kolenova',
    testimonial3Company: '供应链总监，TradeCo CIS · 俄罗斯',
    dashboardTabRfqs: '询盘',
    dashboardTabOrders: '订单',
    dashboardTabVerification: '资质认证',
    dashboardTabProducts: '产品管理',
    dashboardLogout: '退出登录',
    dashboardRfqThread: '询盘会话',
    dashboardRfqThreadEmpty: '选择询盘查看对话。',
    categoriesAll: '全部品类',
    categoryProducts: '件产品',
    systemActor: '系统',
    metricOrdersLabel: '个订单',
    pillVerified: '已认证',
    pillReview: '审核中',
    specMoq: '起订量',
    specLeadTime: '交期',
    specCapacity: '产能',
    specAsk: '面议',
    cardRequestQuote: '索取报价',
    cardViewDetails: '查看详情',
    marketplaceEmpty: '未找到匹配的产品。',
    marketplaceError: '无法加载产品数据。',
    categoriesError: '品类暂不可用。',
    auditError: '无法加载审计记录。',
    detailSupplier: '供应商',
    detailLocation: '所在地',
    detailPrice: '价格',
    detailCertifications: '认证',
    detailPending: '待定',
    productUnavailable: '产品不可用',
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
    productFormTitle: '添加产品',
    productFormSub: '供应商发布的产品将进入认证审核',
    pfCategory: '品类',
    pfCategoryPh: '机械、包装、零部件',
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
    rfqSubmitted: '询盘已提交，请查看“我的 Fastflow”。'
  },
  ru: {
    utilitySlogan: 'ИИ-поддержка закупок, комплаенса и глобального поиска поставщиков',
    navAbout: 'О нас',
    navContact: 'Контакты',
    navAboutUs: 'О нас',
    navMembership: 'Условия',
    navAiFunctions: 'Функции ИИ',
    navFaq: 'Вопросы',
    authSignIn: 'Войти',
    authJoinFree: 'Бесплатная регистрация',
    navPortal: 'Портал поставщика',
    heroListCompany: 'Разместить компанию',
    heroEyebrow: 'ИИ‑платформа для комплексного внешнеторгового посредничества',
    heroTitle: 'Интеллектуальный глобальный поиск · Мультиязычная связь · Полный контроль рисков',
    heroSubtitle: 'ИИ-управляемая платформа для внешнеторгового посредничества и консультаций — глобальный поиск, перевод в реальном времени и комплаенс.',
    heroBuyerBtn: 'Найти поставщиков',
    heroSupplierBtn: 'Зарегистрироваться поставщику',
    heroConsultBtn: 'Онлайн-консультация',
    heroHighlights: 'ИИ-сопоставление, мультиязычие, контроль рисков и полный цикл услуг.',
    searchProducts: 'Товары',
    searchSuppliers: 'Поставщики',
    searchPlaceholder: 'Искать товары, поставщиков, сертификаты...',
    searchButton: 'Поиск',
    statsCountries: 'Работаем в 30+ странах и регионах',
    statsCountriesSub: 'Работаем в 30+ странах и регионах',
    statsFactories: '500+ партнерских фабрик',
    statsFactoriesSub: '500+ партнерских фабрик',
    statsOrders: '12,000+ завершенных заказов',
    statsOrdersSub: '12,000+ завершенных заказов',
    statsExperience: 'Годы отраслевого опыта',
    statsExperienceSub: 'Годы отраслевого опыта',
    advantageEyebrow: 'Преимущества платформы',
    advantageTitle: 'Четыре AI-преимущества для глобальной торговли',
    featureMatchTitle: 'ИИ интеллектуальное сопоставление',
    featureMatchCopy: 'ИИ автоматически подбирает лучших партнеров по категории, мощности, цене, сертификатам и срокам.',
    featureCommTitle: '24/7 мультиязычная связь',
    featureCommCopy: 'Поддержка английского, испанского, французского, арабского и других языков с переводом в реальном времени.',
    featureRiskTitle: 'Полный комплаенс и контроль рисков',
    featureRiskCopy: 'ИИ проверяет квалификацию, оценивает риски и контролирует исполнение заказа на всех этапах.',
    featureConsultTitle: 'Консультации по цепочке поставок',
    featureConsultCopy: 'Анализ политики, исследование рынка, тарифы, аудит, инспекции и подготовка документов.',
    statsProducts: 'Доступные товары',
    statsVerified: 'Проверенные поставщики',
    statsRfqs: 'Активные запросы',
    statsOrdersMetric: 'Заказы под контролем',
    servicesEyebrow: 'Сценарии услуг',
    servicesTitle: 'Услуги для покупателей и поставщиков',
    buyersSectionTitle: 'Услуги для покупателей',
    buyersList1: 'Размещайте запросы и получайте AI-подбор поставщиков',
    buyersList2: 'Сравнивайте цены, проверяйте квалификацию и историю сделок',
    buyersList3: 'Логистика, таможня и оплата в одном окне',
    buyersList4: 'Персональный консультант для переговоров и исполнения заказа',
    buyersSub: 'Размещайте запросы, получайте AI-рекомендации поставщиков и доступ к логистике и оплате.',
    suppliersSectionTitle: 'Услуги для поставщиков',
    suppliersList1: 'Бесплатная регистрация и доступ к глобальным покупателям',
    suppliersList2: 'AI-перевод товаров и международная видимость',
    suppliersList3: 'Точные запросы для роста заказов',
    suppliersList4: 'Комплаенс, шаблоны документов и предупреждения о рисках',
    suppliersSub: 'Регистрация бесплатно, AI-перевод, точная дистрибуция запросов и поддержка комплаенса.',
    serviceListEyebrow: 'Основные услуги',
    serviceListTitle: 'Дополнительные сервисы',
    serviceMatch: 'Посредничество в торговле',
    serviceMatchSub: 'Сопоставление спроса и предложения, сопровождение переговоров.',
    serviceCompliance: 'Консультации по комплаенсу',
    serviceComplianceSub: 'Политика импорта/экспорта, тарифы, возвраты и сертификаты.',
    serviceDocument: 'Документы',
    serviceDocumentSub: 'ИИ генерирует контракты, PI, упаковочные листы и таможенные документы.',
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
    aboutTitle: 'ИИ и торговый опыт объединяют покупателей и поставщиков',
    aboutCopy1: 'Мы платформа для трансграничной торговли, объединяющая ИИ и опыт для связи покупателей и производителей.',
    aboutCopy2: 'Мы соблюдаем честность, профессионализм, эффективность и комплаенс, помогая найти надежных поставщиков.',
    membershipEyebrow: 'Условия',
    membershipTitle: 'Гибкий вступительный процесс и прозрачные тарифы',
    supplierRegistrationTitle: 'Регистрация поставщика',
    supplierRegistrationReq: 'Требования: лицензия, квалификация, соответствие экспортным стандартам.',
    supplierRegistrationPlans: 'Базовый план бесплатно, премиум дает приоритет AI, экспозицию и трафик.',
    supplierRegistrationPricing: 'Комиссия берется только за успешное посредничество, без скрытых платежей.',
    buyerServiceTitle: 'Сервис для покупателей',
    buyerServiceCopy: 'Размещение запросов и поиск поставщиков бесплатно; оплата только за кастомные аудиты, консультантов и ускоренные документы.',
    aiFunctionsEyebrow: 'Функции ИИ',
    aiFunctionsTitle: 'Инструменты ИИ для сопоставления и контроля рисков',
    aiFunctionMatch: 'Интеллектуальное сопоставление',
    aiFunctionMatchSub: 'Алгоритмы данных сопоставляют покупателей и поставщиков.',
    aiFunctionChat: 'Мультиязычный чат-бот',
    aiFunctionChatSub: 'Автоответ 24/7 с поддержкой нескольких языков.',
    aiFunctionDocs: 'Умные документы',
    aiFunctionDocsSub: 'Генерация стандартных торговых документов одним кликом.',
    aiFunctionRisk: 'Система контроля рисков',
    aiFunctionRiskSub: 'ИИ проверяет квалификацию и оценивает риски в реальном времени.',
    teamEyebrow: 'Наша команда',
    teamTitle: 'Люди за Fastflow',
    faqEyebrow: 'Вопросы',
    faqTitle: 'Часто задаваемые вопросы',
    faqSafetyQ: 'Как платформа обеспечивает безопасность сделок?',
    faqSafetyA: 'Наша система ИИ проверяет квалификацию сторон и обеспечивает гарантию сделки и контроль контрактов.',
    faqFeesQ: 'Есть ли плата за регистрацию?',
    faqFeesA: 'Базовая регистрация бесплатна. Плата взимается только за продвижение, премиум и дополнительные сервисы.',
    faqPostQ: 'Можно ли разместить запрос на закупку?',
    faqPostA: 'Да, после регистрации запросы размещаются бесплатно, а ИИ подбирает подходящих поставщиков.',
    faqLangQ: 'Какие языки поддерживаются?',
    faqLangA: 'Поддерживаются английский, испанский, французский, арабский и другие языки с мгновенным переводом.',
    faqMultiQ: 'Можно ли отображать товары на нескольких языках?',
    faqMultiA: 'Да, ИИ автоматически переводит названия, описания и спецификации товаров.',
    faqAssignQ: 'Как распределяются запросы?',
    faqAssignA: 'ИИ распределяет запросы по категориям, мощности и ценам.',
    contactEyebrow: 'Контакты',
    contactTitle: 'Начните работу с AI в торговле',
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
    footerCopyright: '©2026 Fastflow',
    footerDescription: 'ИИ-посредничество, консультации и полный цикл кросс-граничных заказов.',
    footerPrivacy: 'Политика конфиденциальности',
    footerAgreement: 'Пользовательское соглашение',
    footerDisclaimer: 'Отказ от ответственности',
    footerSitemap: 'Карта сайта',
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
    trustItem1: 'Только проверенные поставщики',
    trustItem2: 'Безопасные эскроу-платежи',
    trustItem3: 'Контроль рисков на всех этапах',
    trustItem4: 'Мультиязычная поддержка 24/7',
    howEyebrow: 'Как это работает',
    howTitle: 'Три шага к глобальной торговле',
    howStep1Num: '01',
    howStep1Title: 'Регистрация',
    howStep1Copy: 'Создайте бесплатный аккаунт покупателя или поставщика и разместите товары или запросы за несколько минут.',
    howStep2Num: '02',
    howStep2Title: 'Подбор ИИ',
    howStep2Copy: 'Наш ИИ анализирует ваши требования и мгновенно связывает вас с проверенными партнёрами.',
    howStep3Num: '03',
    howStep3Title: 'Сотрудничество',
    howStep3Copy: 'Общайтесь, обменивайтесь запросами, согласовывайте условия и завершайте сделки с полной поддержкой.',
    testimonialsEyebrow: 'Отзывы',
    testimonialsTitle: 'Доверие глобальных трейдеров',
    testimonial1Quote: 'Fastflow подобрал нам 3 проверенные китайские фабрики за 48 часов — ИИ сэкономил недели поиска.',
    testimonial1Name: 'James Kowalski',
    testimonial1Company: 'Менеджер по закупкам, MechParts EU · Польша',
    testimonial2Quote: 'Как экспортёр из Шэньчжэня, мы привлекли 12 новых зарубежных покупателей за первый квартал. Поддержка множества языков отличная.',
    testimonial2Name: 'Чжан Вэй',
    testimonial2Company: 'Менеджер экспорта, Delta Precision Works · Шэньчжэнь',
    testimonial3Quote: 'Поддержка комплаенса и документов устранила наше главное узкое место. Цикл поставок сократился на 40% за два месяца.',
    testimonial3Name: 'Айша Коленова',
    testimonial3Company: 'Директор цепочки поставок, TradeCo CIS · Россия',
    dashboardTabRfqs: 'Запросы',
    dashboardTabOrders: 'Заказы',
    dashboardTabVerification: 'Верификация',
    dashboardTabProducts: 'Товары',
    dashboardLogout: 'Выйти',
    dashboardRfqThread: 'Тред запроса',
    dashboardRfqThreadEmpty: 'Выберите запрос для просмотра треда.',
    categoriesAll: 'Все категории',
    categoryProducts: 'товаров',
    systemActor: 'Система',
    metricOrdersLabel: 'заказов',
    pillVerified: 'Проверен',
    pillReview: 'На проверке',
    specMoq: 'MOQ',
    specLeadTime: 'Срок',
    specCapacity: 'Мощность',
    specAsk: 'Уточнить',
    cardRequestQuote: 'Запросить цену',
    cardViewDetails: 'Подробнее',
    marketplaceEmpty: 'Подходящие товары не найдены.',
    marketplaceError: 'Не удалось загрузить товары.',
    categoriesError: 'Категории недоступны.',
    auditError: 'Не удалось загрузить журнал аудита.',
    detailSupplier: 'Поставщик',
    detailLocation: 'Местоположение',
    detailPrice: 'Цена',
    detailCertifications: 'Сертификаты',
    detailPending: 'В ожидании',
    productUnavailable: 'Товар недоступен',
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
    productFormTitle: 'Добавить товар',
    productFormSub: 'Товары поставщиков проходят проверку',
    pfCategory: 'Категория',
    pfCategoryPh: 'Машины, упаковка, компоненты',
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
    rfqSubmitted: 'Запрос отправлен. Проверьте «Мой Fastflow».'
  }
};

function t(key) {
  return (translations[currentLang] && translations[currentLang][key]) || translations.en[key] || key;
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

function openModal(contentHtml) {
  modalBody.innerHTML = contentHtml;
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
  try {
    const result = await apiFetch('/api/me');
    currentUser = result.authenticated ? result.user : null;
  } catch (error) {
    currentUser = null;
  }
  renderUserPanel();
  await Promise.all([
    loadOverview(),
    loadCategories(),
    loadMarketplace(),
    loadSuppliers()
  ]);
  applyTranslations();
}

async function loadOverview() {
  try {
    const data = await apiFetch('/api/overview');
    document.getElementById('metric-products').textContent = data.stats.products;
    document.getElementById('metric-verified').textContent = data.stats.verified_suppliers;
    document.getElementById('metric-rfqs').textContent = data.stats.open_rfqs;
    document.getElementById('metric-orders-count').textContent = data.stats.orders;
    document.getElementById('metric-orders').textContent = `${data.stats.orders} ${t('metricOrdersLabel')}`;
    const hasData = data.stats.products > 0 || data.stats.verified_suppliers > 0;
    if (hasData) document.getElementById('stats-strip')?.classList.remove('hidden');
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
  categoryList.innerHTML = `
    <button class="${activeCategory ? '' : 'active'}" data-category="">${escapeHtml(t('categoriesAll'))}</button>
    ${cachedCategories.map(category => `
      <button class="${activeCategory === category.name ? 'active' : ''}" data-category="${escapeHtml(category.name)}">
        <span>${escapeHtml(category.name)}</span>
        <small>${category.product_count} ${t('categoryProducts')}</small>
      </button>
    `).join('')}
  `;
}

async function loadCategories() {
  try {
    const data = await apiFetch('/api/categories');
    cachedCategories = data.categories;
    renderCategories();
  } catch (error) {
    categoryList.innerHTML = `<p class="error">${escapeHtml(t('categoriesError'))}</p>`;
  }
}

function flattenCategories(categories) {
  return categories.flatMap(category => category.items.map(item => ({ ...item, category: category.name })));
}

async function loadMarketplace(query = lastMarketplaceQuery, category = activeCategory) {
  lastMarketplaceQuery = query || '';
  activeCategory = category || '';
  const params = new URLSearchParams();
  if (lastMarketplaceQuery) params.set('q', lastMarketplaceQuery);
  if (activeCategory) params.set('category', activeCategory);

  try {
    const data = await apiFetch(`/api/marketplace${params.toString() ? `?${params}` : ''}`);
    const products = flattenCategories(data.categories || []);
    if (!products.length) {
      marketplaceGrid.innerHTML = `<p class="empty-state">${escapeHtml(t('marketplaceEmpty'))}</p>`;
      return;
    }

    marketplaceGrid.innerHTML = products.map(product => `
      <article class="product-card">
        <button class="product-image" data-product-id="${product.id}" aria-label="${escapeHtml(t('cardViewDetails'))}">
          <img src="${escapeHtml(product.image_url || '')}" alt="${escapeHtml(product.name)}" loading="lazy" />
        </button>
        <div class="product-body">
          <div class="product-title-row">
            <button class="product-title" data-product-id="${product.id}">${escapeHtml(product.name)}</button>
            <span class="status-pill ${product.verified ? 'good' : 'warn'}">${escapeHtml(product.verified ? t('pillVerified') : t('pillReview'))}</span>
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
      </article>
    `).join('');

    // categories reloaded at page init only
  } catch (error) {
    marketplaceGrid.innerHTML = `<p class="error">${escapeHtml(t('marketplaceError'))}</p>`;
  }
}

async function openProductDetail(productId) {
  try {
    const { product } = await apiFetch(`/api/products/${productId}`);
    openModal(`
      <div class="product-detail">
        <img src="${escapeHtml(product.image_url || '')}" alt="${escapeHtml(product.name)}" />
        <div>
          <span class="eyebrow">${escapeHtml(product.category)}</span>
          <h3>${escapeHtml(product.name)}</h3>
          <p>${escapeHtml(product.description)}</p>
          <dl class="detail-grid">
            <div><dt>${escapeHtml(t('detailSupplier'))}</dt><dd>${escapeHtml(product.supplier)}</dd></div>
            <div><dt>${escapeHtml(t('detailLocation'))}</dt><dd>${escapeHtml(product.location)}</dd></div>
            <div><dt>${escapeHtml(t('detailPrice'))}</dt><dd>${escapeHtml(product.price)}</dd></div>
            <div><dt>${escapeHtml(t('specMoq'))}</dt><dd>${escapeHtml(product.moq)}</dd></div>
            <div><dt>${escapeHtml(t('specLeadTime'))}</dt><dd>${escapeHtml(product.lead_time)}</dd></div>
            <div><dt>${escapeHtml(t('specCapacity'))}</dt><dd>${escapeHtml(product.capacity)}</dd></div>
            <div><dt>${escapeHtml(t('detailCertifications'))}</dt><dd>${escapeHtml(product.certifications || t('detailPending'))}</dd></div>
          </dl>
          <button class="primary" data-quote-id="${product.id}">${escapeHtml(t('cardRequestQuote'))}</button>
        </div>
      </div>
    `);
  } catch (error) {
    openModal(`<h3>${escapeHtml(t('productUnavailable'))}</h3><p class="error">${escapeHtml(error.message)}</p>`);
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
            <span class="status-pill ${supplier.verified ? 'good' : 'warn'}">${escapeHtml(supplier.verification_status)}</span>
          </div>
          <p>${escapeHtml(supplier.location || t('supplierLocationPending'))}</p>
          <dl class="supplier-meta">
            <div><dt>${escapeHtml(t('supplierProducts'))}</dt><dd>${supplier.product_count}</dd></div>
            <div><dt>${escapeHtml(t('supplierCategories'))}</dt><dd>${escapeHtml(supplier.categories || t('supplierPending'))}</dd></div>
            <div><dt>${escapeHtml(t('supplierCertifications'))}</dt><dd>${escapeHtml(supplier.certifications || t('supplierPending'))}</dd></div>
          </dl>
        </div>
      </article>
    `).join('') : `<p class="empty-state">${escapeHtml(t('suppliersEmpty'))}</p>`;
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
      const body = new FormData(event.target).get('body');
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
  try {
    const data = await apiFetch('/api/verifications');
    container.innerHTML = `
      <div class="workspace-header"><h3>${escapeHtml(t('verificationTitle'))}</h3><span>${data.verifications.length} ${escapeHtml(t('verificationRecords'))}</span></div>
      <div class="verification-grid">
        ${data.verifications.map(item => `
          <article class="record-card">
            <strong>${escapeHtml(item.supplier_company)}</strong>
            <dl class="record-meta">
              <div><dt>${escapeHtml(t('verifStatus'))}</dt><dd>${escapeHtml(item.status)}</dd></div>
              <div><dt>${escapeHtml(t('verifFactory'))}</dt><dd>${escapeHtml(item.factory_address || t('verifMissing'))}</dd></div>
              <div><dt>${escapeHtml(t('verifEvidence'))}</dt><dd>${escapeHtml(item.evidence || t('verifMissing'))}</dd></div>
              <div><dt>${escapeHtml(t('verifNextReview'))}</dt><dd>${escapeHtml(item.next_review_at || t('verifUnset'))}</dd></div>
            </dl>
          </article>
        `).join('')}
      </div>
      ${currentUser.role === 'supplier' || currentUser.role === 'admin' ? `
        <form id="verification-form" class="data-form">
          <label>${escapeHtml(t('verifBusinessLicense'))}<input name="business_license" placeholder="${escapeHtml(t('verifBusinessLicensePh'))}" required /></label>
          <label>${escapeHtml(t('verifFactoryAddress'))}<input name="factory_address" placeholder="${escapeHtml(t('verifFactoryAddressPh'))}" required /></label>
          <label>${escapeHtml(t('verifEvidenceLabel'))}<textarea name="evidence" rows="3" placeholder="${escapeHtml(t('verifEvidencePh'))}" required></textarea></label>
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
  } catch (error) {
    container.innerHTML = `<p class="error">${escapeHtml(error.message)}</p>`;
  }
}

function renderProductForm() {
  const container = document.getElementById('workspace-content');
  container.innerHTML = `
    <div class="workspace-header"><h3>${escapeHtml(t('productFormTitle'))}</h3><span>${escapeHtml(t('productFormSub'))}</span></div>
    <form id="product-form" class="data-form two-column">
      <label>${escapeHtml(t('pfCategory'))}<input name="category" placeholder="${escapeHtml(t('pfCategoryPh'))}" required /></label>
      <label>${escapeHtml(t('pfName'))}<input name="name" placeholder="${escapeHtml(t('pfNamePh'))}" required /></label>
      <label>${escapeHtml(t('pfLocation'))}<input name="location" placeholder="${escapeHtml(t('pfLocationPh'))}" required /></label>
      <label>${escapeHtml(t('pfPrice'))}<input name="price" placeholder="${escapeHtml(t('pfPricePh'))}" required /></label>
      <label>${escapeHtml(t('pfMoq'))}<input name="moq" placeholder="${escapeHtml(t('pfMoqPh'))}" required /></label>
      <label>${escapeHtml(t('pfLeadTime'))}<input name="lead_time" placeholder="${escapeHtml(t('pfLeadTimePh'))}" required /></label>
      <label>${escapeHtml(t('pfCapacity'))}<input name="capacity" placeholder="${escapeHtml(t('pfCapacityPh'))}" /></label>
      <label>${escapeHtml(t('pfCertifications'))}<input name="certifications" placeholder="${escapeHtml(t('pfCertificationsPh'))}" /></label>
      <label class="wide">${escapeHtml(t('pfPhoto'))}<input name="image_url" placeholder="${escapeHtml(t('pfPhotoPh'))}" /></label>
      <label class="wide">${escapeHtml(t('pfDescription'))}<textarea name="description" rows="4" placeholder="${escapeHtml(t('pfDescriptionPh'))}" required></textarea></label>
      <button type="submit" class="primary">${escapeHtml(t('pfSubmit'))}</button>
    </form>
  `;
  document.getElementById('product-form').addEventListener('submit', async event => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.target).entries());
    await apiFetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    event.target.reset();
    await Promise.all([loadMarketplace(), loadCategories(), loadOverview(), loadSuppliers()]);
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

document.addEventListener('click', async event => {
  const scrollTarget = event.target.closest('[data-scroll-target]');
  if (scrollTarget) {
    scrollToId(scrollTarget.dataset.scrollTarget);
    return;
  }

  const categoryButton = event.target.closest('[data-category]');
  if (categoryButton) {
    activeCategory = categoryButton.dataset.category;
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
