// =============================================================================
// Post-contract workflow templates.
//
// CASE_STAGES: the fixed 12-step pipeline every case moves through.
// DEFAULT_CHECKLISTS: default document requirements per case type. When a
// Case is auto-created, we insert the matching checklist. Users can add /
// remove items after that.
// =============================================================================

const CASE_STAGES = [
  { code: 'SIGNED',            label: 'Client signed agreement',   order: 1  },
  { code: 'OFFICE_SIGNED',     label: 'Office signed agreement',   order: 2  },
  { code: 'INVOICED',          label: 'Invoice sent',              order: 3  },
  { code: 'PAYMENT_RECEIVED',  label: 'Payment received',          order: 4  },
  { code: 'INFO_FORM_SENT',    label: 'General Info Form sent',    order: 5  },
  { code: 'CV_RECEIVED',       label: 'CV received',               order: 6  },
  { code: 'MEETING_SCHEDULED', label: 'Tourani meeting scheduled', order: 7  },
  { code: 'MEETING_COMPLETED', label: 'Tourani meeting completed', order: 8  },
  { code: 'DOCS_REQUESTED',    label: 'Documents checklist sent',  order: 9  },
  { code: 'DOCS_COMPLETE',     label: 'All documents received',    order: 10 },
  { code: 'SUBMITTED',         label: 'Application submitted',     order: 11 },
  { code: 'DECISION_RECEIVED', label: 'Decision received',         order: 12 },
];

const STAGE_BY_CODE = Object.fromEntries(CASE_STAGES.map((s) => [s.code, s]));

function nextStageAfter(currentCode) {
  const current = STAGE_BY_CODE[currentCode];
  if (!current) return CASE_STAGES[0];
  return CASE_STAGES[current.order] || null; // order-1 is index, so next is at [order]
}

// -----------------------------------------------------------------------------
// Default document checklists (per case type)
// -----------------------------------------------------------------------------

const CORE_ID_DOCS = [
  { name: 'Passport (biographical page)',      category: 'IDENTITY' },
  { name: 'National ID',                       category: 'IDENTITY' },
  { name: '2 x passport-style photos',         category: 'IDENTITY' },
];

const DEFAULT_CHECKLISTS = {
  'Express Entry': [
    ...CORE_ID_DOCS,
    { name: 'IELTS or CELPIP score report',         category: 'EDUCATION' },
    { name: 'ECA (Educational Credential Assessment)', category: 'EDUCATION' },
    { name: 'All education diplomas + transcripts', category: 'EDUCATION' },
    { name: 'Work reference letters (per employer)', category: 'OTHER'    },
    { name: 'Proof of funds (bank statements 6 months)', category: 'FINANCIAL' },
    { name: 'Police certificates (per country lived in >6 months)', category: 'LEGAL' },
    { name: 'Marriage certificate (if married)',    category: 'LEGAL'    },
    { name: 'Birth certificates of children (if any)', category: 'LEGAL' },
    { name: 'Medical exam',                         category: 'OTHER'    },
  ],
  'Study Permit': [
    ...CORE_ID_DOCS,
    { name: 'Letter of Acceptance from DLI',        category: 'EDUCATION' },
    { name: 'Statement of purpose',                 category: 'EDUCATION' },
    { name: 'Previous transcripts',                 category: 'EDUCATION' },
    { name: 'IELTS or CELPIP score report',         category: 'EDUCATION' },
    { name: 'Proof of funds (GIC or bank statements)', category: 'FINANCIAL' },
    { name: 'Tuition payment receipt',              category: 'FINANCIAL' },
    { name: 'Medical exam',                         category: 'OTHER' },
  ],
  'Visitor Visa': [
    ...CORE_ID_DOCS,
    { name: 'Invitation letter from Canada',        category: 'LEGAL' },
    { name: 'Proof of ties to home country',        category: 'LEGAL' },
    { name: 'Bank statements (6 months)',           category: 'FINANCIAL' },
    { name: 'Employment / income letter',           category: 'FINANCIAL' },
    { name: 'Travel itinerary',                     category: 'OTHER' },
    { name: 'Previous travel history / visas',      category: 'OTHER' },
  ],
  'Work Permit': [
    ...CORE_ID_DOCS,
    { name: 'LMIA or LMIA-exempt job offer letter', category: 'LEGAL' },
    { name: 'Employment contract',                  category: 'LEGAL' },
    { name: 'Employer NOC / job duties description', category: 'OTHER' },
    { name: 'Previous work experience letters',     category: 'OTHER' },
    { name: 'Educational credentials',              category: 'EDUCATION' },
    { name: 'Medical exam',                         category: 'OTHER' },
  ],
  'Start-Up Visa': [
    ...CORE_ID_DOCS,
    { name: 'Letter of Support from designated org', category: 'LEGAL' },
    { name: 'Business plan',                        category: 'OTHER' },
    { name: 'Proof of ownership / cap table',       category: 'FINANCIAL' },
    { name: 'IELTS or CELPIP score (CLB 5 min)',    category: 'EDUCATION' },
    { name: 'Proof of settlement funds',            category: 'FINANCIAL' },
    { name: 'Medical exam',                         category: 'OTHER' },
  ],
  'Entrepreneur / Business Immigration': [
    ...CORE_ID_DOCS,
    { name: 'Business ownership / registration docs', category: 'FINANCIAL' },
    { name: 'Personal net worth statement',         category: 'FINANCIAL' },
    { name: 'Source of funds documentation',        category: 'FINANCIAL' },
    { name: 'Business plan',                        category: 'OTHER' },
    { name: 'Management experience letters',        category: 'OTHER' },
    { name: 'Medical exam',                         category: 'OTHER' },
  ],
  'Dependent / Family Visa': [
    ...CORE_ID_DOCS,
    { name: "Sponsor's Canadian PR / citizenship proof", category: 'LEGAL' },
    { name: 'Sponsor income documents (NOA, T4)',   category: 'FINANCIAL' },
    { name: 'Marriage / birth certificate',         category: 'LEGAL' },
    { name: 'Relationship proof (photos, chat logs, joint accounts)', category: 'LEGAL' },
    { name: 'Police certificates',                  category: 'LEGAL' },
    { name: 'Medical exam',                         category: 'OTHER' },
  ],
  'Ontario Provincial Program (OINP)': [
    ...CORE_ID_DOCS,
    { name: 'Ontario job offer letter',             category: 'LEGAL' },
    { name: 'Educational credentials + ECA',        category: 'EDUCATION' },
    { name: 'Language test (IELTS / CELPIP / TEF)', category: 'EDUCATION' },
    { name: 'Work reference letters',               category: 'OTHER' },
    { name: 'Proof of settlement funds',            category: 'FINANCIAL' },
  ],
  'Open Work Permit for Iranians': [
    ...CORE_ID_DOCS,
    { name: 'Proof of Iranian citizenship',         category: 'IDENTITY' },
    { name: 'Educational credentials',              category: 'EDUCATION' },
    { name: 'Language test (if required)',          category: 'EDUCATION' },
    { name: 'Proof of settlement funds',            category: 'FINANCIAL' },
    { name: 'Medical exam',                         category: 'OTHER' },
  ],
  'Passport Extension': [
    { name: 'Current passport (all pages)',         category: 'IDENTITY' },
    { name: 'Recent passport-style photos',         category: 'IDENTITY' },
    { name: 'Application form',                     category: 'LEGAL' },
    { name: 'Payment receipt',                      category: 'FINANCIAL' },
  ],
  'Job Offer': [
    ...CORE_ID_DOCS,
    { name: 'Resume / CV',                          category: 'OTHER' },
    { name: 'Educational credentials',              category: 'EDUCATION' },
    { name: 'Work reference letters',               category: 'OTHER' },
    { name: 'Language test score',                  category: 'EDUCATION' },
  ],
  'Canada Immigration (Dubai)': [
    ...CORE_ID_DOCS,
    { name: 'Educational credentials',              category: 'EDUCATION' },
    { name: 'Language test score',                  category: 'EDUCATION' },
    { name: 'Work experience letters',              category: 'OTHER' },
    { name: 'Proof of funds',                       category: 'FINANCIAL' },
  ],
  'Spain Residency': [
    ...CORE_ID_DOCS,
    { name: 'Proof of investment / income',         category: 'FINANCIAL' },
    { name: 'Criminal record certificate',          category: 'LEGAL' },
    { name: 'Private health insurance (Spain)',     category: 'OTHER' },
    { name: 'Proof of accommodation in Spain',      category: 'OTHER' },
  ],
  'Second Passport Programs': [
    ...CORE_ID_DOCS,
    { name: 'Source of funds documentation',        category: 'FINANCIAL' },
    { name: 'Criminal record certificate',          category: 'LEGAL' },
    { name: 'Business / employment history',        category: 'OTHER' },
    { name: 'Medical certificate',                  category: 'OTHER' },
  ],
};

// Fallback for case types we don't have a template for yet.
const FALLBACK_CHECKLIST = [
  ...CORE_ID_DOCS,
  { name: 'Educational credentials',              category: 'EDUCATION' },
  { name: 'Work experience letters',              category: 'OTHER' },
  { name: 'Proof of funds',                       category: 'FINANCIAL' },
  { name: 'Medical exam (if required)',           category: 'OTHER' },
];

function checklistForCaseType(caseTypeName) {
  if (!caseTypeName) return FALLBACK_CHECKLIST;
  return DEFAULT_CHECKLISTS[caseTypeName] || FALLBACK_CHECKLIST;
}

module.exports = {
  CASE_STAGES,
  STAGE_BY_CODE,
  nextStageAfter,
  DEFAULT_CHECKLISTS,
  FALLBACK_CHECKLIST,
  checklistForCaseType,
};
