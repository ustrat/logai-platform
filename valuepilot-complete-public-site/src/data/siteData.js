
export const imageMap = {
  heroShowcase: "/assets/product-images/renewal-refund-now-available.png",
  renewalguard: "/assets/product-images/renewalguard-phone.png",
  refundpilot: "/assets/product-images/refundpilot-phone.png",
  boarderpilot: "/assets/product-images/boarderpilot-phone.png",
  followup: "/assets/product-images/followup-phone.png",
  drivepilot: "/assets/product-images/drivepilot-phone.png",
  leakageindex: "/assets/product-images/leakageindex-dashboard.png",
  enterprisepilot: "/assets/product-images/enterprisepilot-dashboard.png",
  executepilot: "/assets/product-images/executepilot-command-center.png",
  spendanalyzer: "/assets/product-images/spendanalyzer-dashboard.png",
  contractwatch: "/assets/product-images/contractwatch-dashboard.png",
  smartreminder: "/assets/product-images/smartreminder-dashboard.png",
  autodraft:     "/assets/product-images/autodraft-dashboard.png",
  currencyguard: "/assets/product-images/currencyguard-dashboard.png",
  taxnormalizer: "/assets/product-images/taxnormalizer-dashboard.png",
  pricing: "/assets/product-images/pricing-cards.png",
  ecosystem: "/assets/product-images/ecosystem-public-diagram.png",
  featureMatrix: "/assets/product-images/feature-matrix.png",
  logoAssets: "/assets/product-images/valuepilot-logo-assets.png"
};

export const products = [
  {
    name: "RenewalGuard™",
    slug: "renewalguard",
    color: "green",
    type: "Core Application",
    availability: "Consumer • Business • Enterprise",
    headline: "Cancel before you’re charged.",
    summary: "Predict, prevent, and manage unwanted renewals before they become financial leakage.",
    icon: "shieldCycle",
    imageKey: "renewalguard",
    publicCapabilities: {
      detect: ["Upcoming renewal dates", "Cancellation windows", "Price increases", "Silent renewal risk", "Subscription portfolio drift"],
      act: ["Cancellation prompts", "Downgrade paths", "Merchant-specific action routing", "Renewal reminders", "Negotiation prompts"],
      control: ["Consent-based action", "Action history", "Business approval routing when deployed", "Exception capture", "Renewal decision records"],
      measure: ["Avoided charges", "Renewal savings ledger", "Cancellation success rates", "Subscription exposure trends", "Merchant price-change visibility"]
    },
    buyerValue: ["Prevents forgotten recurring charges", "Improves household and business cash discipline", "Creates proof of avoided spend"]
  },
  {
    name: "RefundPilot™ / RefundIQ™",
    slug: "refundpilot",
    color: "blue",
    type: "Core Application",
    availability: "Consumer • Business • Enterprise",
    headline: "Get back money you didn’t know you were owed.",
    summary: "Detect refund opportunities, price drops, billing errors, and recovery windows.",
    icon: "refundArrow",
    imageKey: "refundpilot",
    publicCapabilities: {
      detect: ["Price drops", "Overcharges", "Refund windows", "Duplicate billing", "Claim eligibility"],
      act: ["Claim drafting", "Evidence packet organization", "Refund request workflows", "Status tracking", "Follow-up reminders"],
      control: ["Permission-based claim action", "Evidence history", "Business approval flows where deployed", "Exception documentation", "Outcome records"],
      measure: ["Recovered value", "Refund success rate", "Merchant response time", "Claim type trends", "Recovery analytics"]
    },
    buyerValue: ["Turns missed savings into visible recovery", "Reduces manual claim friction", "Builds trust through clear outcomes"]
  },
  {
    name: "FollowUp™ / CommitmentIQ™",
    slug: "followup",
    color: "purple",
    type: "Core Application",
    availability: "Consumer • Business • Enterprise",
    headline: "Promises should not disappear.",
    summary: "Track commitments, obligations, deadlines, and accountability across everyday and organizational communication.",
    icon: "timelineCheck",
    imageKey: "followup",
    publicCapabilities: {
      detect: ["Email commitments", "Message-based obligations", "Meeting outcomes", "Deadlines", "Conditional promises"],
      act: ["Follow-up drafts", "Reminder scheduling", "Commitment nudges", "Escalation prompts", "Multi-party accountability routing"],
      control: ["Consent-based dispatch", "Deferment capture", "Business role controls", "Communication records", "Escalation visibility"],
      measure: ["Fulfillment rate", "Reliability signals", "Response latency", "Deadline compliance", "Accountability trends"]
    },
    buyerValue: ["Reduces missed obligations", "Improves accountability", "Turns conversation into measurable follow-through"]
  },
  {
    name: "BoarderPilot™",
    slug: "boarderpilot",
    color: "cyan",
    type: "Core Application",
    availability: "Consumer • Business • Enterprise",
    headline: "Cross borders with awareness.",
    summary: "Travel, jurisdiction, currency, regional risk, and cross-border compliance intelligence for everyone.",
    icon: "globePin",
    imageKey: "boarderpilot",
    publicCapabilities: {
      detect: ["Country entry and exit", "Regional rule changes", "Cross-border financial exposure", "Restricted-zone alerts", "Currency-impact signals"],
      act: ["Travel advisories", "Cross-border prompts", "Device protection mode", "Regional policy guidance", "Business and enterprise routing where deployed"],
      control: ["Jurisdiction-aware safeguards", "Travel exception documentation", "Region-based authorization controls", "Business travel policy support", "Enterprise oversight where deployed"],
      measure: ["Traveler risk score", "Regional exposure trends", "Currency impact visibility", "Cross-border activity history", "Compliance drift indicators"]
    },
    buyerValue: ["Protects travelers and businesses in changing jurisdictions", "Helps reduce costly cross-border surprises", "Scales from consumer travel to global enterprise oversight"]
  },
  {
    name: "DrivePilot™",
    slug: "drivepilot",
    color: "orange",
    type: "Core Application",
    availability: "Consumer • Business • Enterprise",
    headline: "Drive safer. Save more. Every mile counts.",
    summary: "Driving behavior, trip risk, fleet visibility, and safety intelligence.",
    icon: "routeWheel",
    imageKey: "drivepilot",
    publicCapabilities: {
      detect: ["Trip events", "Driving behavior patterns", "Route risk", "Speed and safety triggers", "Fleet-level signals"],
      act: ["Real-time alerts", "Behavior coaching", "Safety prompts", "Fleet supervisor routing", "Incident workflow activation"],
      control: ["Trip records", "Fleet policy thresholds", "Exception capture", "Role-based fleet access", "Business safety controls"],
      measure: ["Safety score", "Risk trends", "Incident analytics", "Fleet heatmaps", "Insurance optimization indicators"]
    },
    buyerValue: ["Improves driver safety", "Supports fleet accountability", "Creates measurable mobility intelligence"]
  },
  {
    name: "LeakageIndex™",
    slug: "leakageindex",
    color: "lime",
    type: "Core Analytics Application",
    availability: "Business • Enterprise",
    headline: "See value leaking through the cracks.",
    summary: "Financial leakage scoring, redundancy detection, underutilization analytics, and cost-risk visibility.",
    icon: "gaugeNeedle",
    imageKey: "leakageindex",
    publicCapabilities: {
      detect: ["Financial leakage patterns", "Duplicate spend", "Dormant subscriptions", "Budget drift", "Vendor redundancy"],
      act: ["Leakage alerts", "Remediation workflow prompts", "Vendor review triggers", "Recovery path activation", "Spend correction routing"],
      control: ["Spend thresholds", "Approval rules", "Exception history", "Business policy alignment", "Audit-ready records"],
      measure: ["Leakage score", "Exposure heatmaps", "Vendor risk", "Recovered or avoided cost", "Governance effectiveness"]
    },
    buyerValue: ["Makes hidden financial waste visible", "Creates accountable remediation", "Supports executive cost control"]
  },
  {
    name: "EnterprisePilot™",
    slug: "enterprisepilot",
    color: "royal",
    type: "Enterprise Application",
    availability: "Business • Enterprise",
    headline: "Control tower for enterprise operations.",
    summary: "Portfolio oversight, cross-product governance, policy visibility, and enterprise operating intelligence.",
    icon: "controlTower",
    imageKey: "enterprisepilot",
    publicCapabilities: {
      detect: ["Cross-product risk signals", "Policy deviations", "Unauthorized action attempts", "Departmental risk patterns", "Exception clusters"],
      act: ["Policy deployment", "Approval routing", "Enterprise reporting", "Incident workflow activation", "Governance coordination"],
      control: ["Centralized policy management", "Role-based governance", "Override logging", "Multi-team visibility", "Audit-ready exports"],
      measure: ["Governance KPIs", "Policy effectiveness", "Risk exposure", "Escalation patterns", "Enterprise readiness"]
    },
    buyerValue: ["Creates enterprise visibility", "Keeps governance consistent", "Supports operating discipline at scale"]
  },
  {
    name: "ExecutePilot™",
    slug: "executepilot",
    color: "black",
    type: "Business / Enterprise Execution Layer",
    availability: "Business • Enterprise Only",
    headline: "The command center for controlled action.",
    summary: "A business and enterprise execution control layer for approval, policy enforcement, audit visibility, recovery, and controlled action.",
    icon: "commandGrid",
    imageKey: "executepilot",
    publicCapabilities: {
      detect: ["Action readiness", "Authorization requirements", "Exception conditions", "Risk-weighted execution signals", "Business workflow triggers"],
      act: ["Policy-validated execution", "Approval-based release", "Multi-step sequencing", "Human-in-the-loop activation", "Cross-application action coordination"],
      control: ["Authorization gates", "Role-based execution", "Freeze and override controls", "Recovery workflows", "Execution audit visibility"],
      measure: ["Execution success", "Approval latency", "Policy effectiveness", "Exception patterns", "Business command-center KPIs"]
    },
    buyerValue: ["Available only to business and enterprise users", "Controls execution before action happens", "Provides operational proof without exposing internal mechanics"]
  }
];

export const addOns = [
  {
    name: "SmartReminder™",
    host: "FollowUp™ / CommitmentIQ™",
    color: "purple",
    icon: "bellClock",
    imageKey: "smartreminder",
    summary: "AI-calibrated reminder timing and behavioral follow-up intervals.",
    capabilities: ["Reminder timing", "Deadline prompts", "Behavior-adaptive intervals", "Escalation sensitivity"]
  },
  {
    name: "AutoDraft™",
    host: "RefundPilot™ / FollowUp™",
    color: "blue",
    icon: "draftDoc",
    imageKey: "autodraft",
    summary: "Context-aware drafting for refund requests, cancellation letters, responses, and approval packets.",
    capabilities: ["Refund drafts", "Cancellation letters", "Follow-up language", "Approval-ready packets"]
  },
  {
    name: "SpendAnalyzer™",
    host: "LeakageIndex™ / EnterprisePilot™",
    color: "cyan",
    icon: "barLens",
    imageKey: "spendanalyzer",
    summary: "Spend clustering, vendor concentration, redundancy exposure, and cost-drift intelligence.",
    capabilities: ["Vendor overlap", "Duplicate spend", "Cost drift", "Value-density insights"]
  },
  {
    name: "ContractWatch™",
    host: "RenewalGuard™ / EnterprisePilot™",
    color: "orange",
    icon: "contractDoc",
    imageKey: "contractwatch",
    summary: "Contract lifecycle monitoring, renewal clauses, pricing escalators, and obligations.",
    capabilities: ["Clause alerts", "Renewal windows", "Obligation mapping", "Risk prompts"]
  },
  {
    name: "CurrencyGuard™",
    host: "BoarderPilot™",
    color: "cyan",
    icon: "currencyGlobe",
    imageKey: "currencyguard",
    summary: "FX inefficiency detection, cross-border cost variance, and conversion impact visibility.",
    capabilities: ["FX spread alerts", "Foreign fees", "Currency exposure", "Cross-border trends"]
  },
  {
    name: "TaxNormalizer™",
    host: "BoarderPilot™ / EnterprisePilot™",
    color: "lime",
    icon: "taxCalc",
    imageKey: "taxnormalizer",
    summary: "Jurisdiction-aware tax intelligence for VAT, duty, regional charges, and reporting packs.",
    capabilities: ["VAT awareness", "Duty prompts", "Regional alignment", "Tax reporting support"]
  },
  {
    name: "EscalateAI™",
    host: "Business / Enterprise Workflows",
    color: "black",
    icon: "escalateArrow",
    summary: "Structured escalation routing when thresholds, risks, or exceptions require higher authority.",
    capabilities: ["Priority routing", "Exception workflows", "Approval ladder support", "Escalation history"]
  }
];

export const plans = [
  {
    name: "Starter",
    audience: "Individual",
    accounts: "1 connected account",
    price: "$4.99/mo",
    tone: "green",
    include: ["RenewalGuard™", "RefundPilot™", "BoarderPilot™", "Basic alerts", "Basic activity history"],
    note: "No ExecutePilot™. No business approval workflows."
  },
  {
    name: "Plus",
    audience: "Individual / Household",
    accounts: "2 connected accounts",
    price: "$9.99/mo",
    tone: "blue",
    include: ["Everything in Starter", "SmartReminder™", "AutoDraft™ limited", "Expanded BoarderPilot™ travel mode", "More alert coverage"],
    note: "No ExecutePilot™. Designed for personal savings and travel awareness."
  },
  {
    name: "Pro",
    audience: "Power User",
    accounts: "3–4 connected accounts",
    price: "$14.99/mo",
    tone: "purple",
    include: ["RenewalGuard™", "RefundPilot™", "FollowUp™", "BoarderPilot™", "SpendAnalyzer™ light", "Advanced personal automation"],
    note: "No ExecutePilot™ command center."
  },
  {
    name: "Business Core",
    audience: "Small Business",
    accounts: "3–4 business accounts",
    price: "$29.99/mo",
    tone: "orange",
    include: ["Core product suite", "ExecutePilot™ Core", "Approval workflows", "Policy enforcement", "Standard audit records", "ContractWatch™", "SpendAnalyzer™"],
    note: "Built for small business control."
  },
  {
    name: "Business Growth",
    audience: "Active Business",
    accounts: "6–8 business accounts",
    price: "Custom / Growth",
    tone: "cyan",
    include: ["Everything in Business Core", "Expanded account coverage", "EscalateAI™", "LeakageIndex™", "Business dashboards", "Advanced routing"],
    note: "For operational teams managing multiple accounts."
  },
  {
    name: "Enterprise",
    audience: "Large Organization",
    accounts: "Custom accounts",
    price: "Custom",
    tone: "black",
    include: ["Full product ecosystem", "ExecutePilot™ Command Center", "EnterprisePilot™", "IntentLedger™ visibility", "Simulation sandbox", "Freeze / break-glass", "Rollback / compensation", "Event replay", "SSO / SAML", "Custom integrations"],
    note: "Full governance, control, and command-center oversight."
  }
];

export const featureRows = [
  ["Connected accounts", "1", "2", "3–4", "3–8+", "Custom"],
  ["RenewalGuard™", "Yes", "Yes", "Yes", "Yes", "Yes"],
  ["RefundPilot™ / RefundIQ™", "Yes", "Yes", "Yes", "Yes", "Yes"],
  ["BoarderPilot™", "Yes", "Yes", "Yes", "Yes", "Yes"],
  ["DrivePilot™", "Add-on", "Add-on", "Yes", "Yes", "Yes"],
  ["FollowUp™ / CommitmentIQ™", "No", "Add-on", "Yes", "Yes", "Yes"],
  ["SmartReminder™", "Limited", "Yes", "Yes", "Yes", "Yes"],
  ["AutoDraft™", "Limited", "Yes", "Yes", "Yes", "Yes"],
  ["SpendAnalyzer™", "No", "Add-on", "Light", "Yes", "Yes"],
  ["ContractWatch™", "No", "No/Add-on", "Add-on", "Yes", "Yes"],
  ["CurrencyGuard™", "Add-on", "Add-on", "Yes", "Yes", "Yes"],
  ["TaxNormalizer™", "No", "No", "Add-on", "Yes", "Yes"],
  ["LeakageIndex™", "No", "No", "Limited", "Yes", "Yes"],
  ["EnterprisePilot™", "No", "No", "No", "Limited", "Yes"],
  ["ExecutePilot™", "No", "No", "No", "Core", "Full"],
  ["Approval workflows", "No", "No", "No", "Yes", "Yes"],
  ["Policy enforcement", "No", "No", "No", "Yes", "Yes"],
  ["SLA timers", "No", "No", "Limited", "Yes", "Yes"],
  ["Audit trail", "Basic", "Basic", "Standard", "Business", "Full"],
  ["Business command center", "No", "No", "No", "Business view", "Enterprise"],
  ["Simulation sandbox", "No", "No", "No", "No", "Yes"],
  ["Freeze / break-glass", "No", "No", "No", "Limited", "Yes"],
  ["Rollback / compensation", "No", "No", "No", "Limited", "Yes"],
  ["Event replay", "No", "No", "No", "No", "Yes"],
  ["SSO / SAML", "No", "No", "No", "No", "Yes"],
  ["Custom integrations", "No", "No", "No", "Add-on", "Yes"]
];

export const safeArchitecture = [
  { label: "Detect", text: "Find risks, waste, deadlines, opportunities, and cross-border changes in real time." },
  { label: "Validate", text: "Confirm eligibility, timing, account scope, and user or business authorization." },
  { label: "Act", text: "Prompt, prepare, automate, or execute actions with the correct level of control." },
  { label: "Prove", text: "Record outcomes, decisions, approvals, and measurable value in a visible history." }
];

export const imageRequirements = [
  ["renewalguard-phone.png", "Phone ad/app mockup for RenewalGuard™"],
  ["refundpilot-phone.png", "Phone ad/app mockup for RefundPilot™"],
  ["boarderpilot-phone.png", "Phone ad/app mockup for BoarderPilot™"],
  ["followup-phone.png", "Phone ad/app mockup for FollowUp™"],
  ["drivepilot-phone.png", "Phone ad/app mockup for DrivePilot™"],
  ["leakageindex-dashboard.png", "Dashboard mockup for LeakageIndex™"],
  ["enterprisepilot-dashboard.png", "Dashboard mockup for EnterprisePilot™"],
  ["executepilot-command-center.png", "Dark command-center mockup for ExecutePilot™"],
  ["spendanalyzer-dashboard.png", "Dashboard mockup for SpendAnalyzer™"],
  ["contractwatch-dashboard.png", "Dashboard mockup for ContractWatch™"],
  ["pricing-cards.png", "Pricing card graphic"],
  ["ecosystem-public-diagram.png", "Public-safe Detect → Validate → Act → Prove diagram"],
  ["feature-matrix.png", "Optional feature matrix visual"],
  ["valuepilot-logo-assets.png", "Optional logo asset board"]
];
