/* eslint-disable no-console */
// =============================================================================
// Import the leads + clients from "Lead and client info.xlsx".
// Idempotent — running it twice does not create duplicates (skips records
// whose phone or email already exists).
//
//   npm run import:leads
// =============================================================================

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// CLIENTS (sheet "client") — already signed, status: CONVERTED.
// ---------------------------------------------------------------------------
const CLIENTS = [
  {
    fullName: 'Leila Irja',
    email: 'leila55araji@gmail.com',
    phoneRaw: '14379904163',
    caseType: 'Visitor Visa',
    agreementDate: '2026-06-29',
    agreement: 250,
    paid: null,
    balance: 0,
    extraNotes: 'Visitor inside Canada',
  },
  {
    fullName: 'Kiana Kazeminejad',
    email: 'kianakazemii2002@gmail.com',
    phoneRaw: '4374402002',
    caseType: 'Express Entry',
    agreementDate: '2026-06-29',
    agreement: 3500,
    paid: 1000,
    balance: 1000,
    extraNotes: 'Express Entry',
  },
  {
    fullName: 'Reza Nouripour',
    email: 'atemehtakloo@gmail.com',
    phoneRaw: '16476145280',
    caseType: 'Dependent / Family Visa',
    agreementDate: '2026-04-01',
    agreement: 1400,
    paid: 1000,
    balance: 1000,
    extraNotes: 'Dependent visa',
  },
];

// ---------------------------------------------------------------------------
// LEADS (sheet "Lead") — phone-only inbound interest, status: NEW.
// All marked source = "tia immigration" in the file; we treat them as
// WhatsApp-channel leads (Tia uses WhatsApp heavily on Canada+Iran lines).
// ---------------------------------------------------------------------------
const LEADS = [
  { phoneRaw: '1 (647) 217-7023', dateOfInterest: '2026-06-29' },
  { phoneRaw: '1 (647) 915-1222', dateOfInterest: '2026-06-29' },
  { phoneRaw: '98 912 306 7610',  dateOfInterest: '2026-06-29' },
  { phoneRaw: '39 324 868 9865',  dateOfInterest: '2026-06-29' },
  { phoneRaw: '98 912 264 8854',  dateOfInterest: '2026-06-29' },
  { phoneRaw: '98 903 321 5799',  dateOfInterest: '2026-06-29' },
  { phoneRaw: '98 911 193 4960',  dateOfInterest: '2026-06-29' },
  { phoneRaw: '98 910 160 3400',  dateOfInterest: '2026-06-29' },
  { phoneRaw: '98 905 109 8224',  dateOfInterest: '2026-06-29' },
  { phoneRaw: '98 912 074 1998',  dateOfInterest: '2026-06-29' },
  { phoneRaw: '98 919 302 8791',  dateOfInterest: '2026-06-29' },
  { phoneRaw: '98 920 318 4910',  dateOfInterest: '2026-06-29' },
  { phoneRaw: '98 919 646 0915',  dateOfInterest: '2026-06-29' },
  { phoneRaw: '98 936 104 0724',  dateOfInterest: '2026-06-29' },
  { phoneRaw: '98 930 752 7074',  dateOfInterest: '2026-06-30' },
  { phoneRaw: '98 936 657 6396',  dateOfInterest: '2026-06-30' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strip every non-digit and prefix '+'. 10-digit input is treated as
 * North American (+1 prefix).
 */
function normalizePhone(raw) {
  if (raw === null || raw === undefined) return null;
  const digits = String(raw).replace(/\D+/g, '');
  if (!digits) return null;
  if (digits.length === 10) return '+1' + digits;
  return '+' + digits;
}

async function main() {
  // Load case types for ID lookup.
  const caseTypes = await prisma.caseType.findMany();
  const ctByName = Object.fromEntries(caseTypes.map((c) => [c.name, c]));

  let createdClients = 0;
  let skippedClients = 0;
  let createdLeads = 0;
  let skippedLeads = 0;

  // -------------------------------------------------------------------------
  // Clients (CONVERTED status)
  // -------------------------------------------------------------------------
  console.log('[import] Clients (CONVERTED)...');
  for (const c of CLIENTS) {
    const phone = normalizePhone(c.phoneRaw);
    const email = c.email.trim().toLowerCase();

    const existing = await prisma.lead.findFirst({
      where: { OR: [{ email }, { phone }] },
    });
    if (existing) {
      console.log(`  - ${c.fullName}: already exists (lead #${existing.id}), skipped`);
      skippedClients++;
      continue;
    }

    const ct = ctByName[c.caseType];
    if (!ct) {
      console.warn(`  - ${c.fullName}: case type "${c.caseType}" not found — leaving unset`);
    }

    const lead = await prisma.lead.create({
      data: {
        fullName: c.fullName,
        email,
        phone,
        source: 'WHATSAPP',
        status: 'CONVERTED',
        caseTypeId: ct ? ct.id : null,
        externalContactId: `imported:${email || phone}`,
      },
    });

    // Attach the financial info as a Note + a client profile.
    const lines = [
      c.extraNotes,
      `Agreement: $${c.agreement}`,
      c.paid != null ? `Paid: $${c.paid}` : null,
      `Balance: $${c.balance}`,
      `Agreement date: ${c.agreementDate}`,
    ].filter(Boolean);

    await prisma.note.create({
      data: {
        leadId: lead.id,
        body: lines.join('\n'),
      },
    });

    await prisma.clientProfile.create({
      data: {
        leadId: lead.id,
        notes: lines.join('\n'),
      },
    });

    console.log(`  - ${c.fullName}: created (lead #${lead.id})`);
    createdClients++;
  }

  // -------------------------------------------------------------------------
  // Leads (NEW status — phone-only)
  // -------------------------------------------------------------------------
  console.log('\n[import] Leads (NEW)...');
  for (const l of LEADS) {
    const phone = normalizePhone(l.phoneRaw);
    if (!phone) { console.warn(`  - skipped row with unparseable phone: ${l.phoneRaw}`); continue; }

    const existing = await prisma.lead.findFirst({ where: { phone } });
    if (existing) {
      console.log(`  - ${phone}: already exists (lead #${existing.id}), skipped`);
      skippedLeads++;
      continue;
    }

    const lead = await prisma.lead.create({
      data: {
        fullName: `New lead (${phone})`,
        phone,
        source: 'WHATSAPP',
        status: 'NEW',
        externalContactId: `imported:${phone}`,
      },
    });

    await prisma.note.create({
      data: {
        leadId: lead.id,
        body: `Imported lead — date of interest: ${l.dateOfInterest}\nSource: Tia Immigration`,
      },
    });

    console.log(`  - ${phone}: created (lead #${lead.id})`);
    createdLeads++;
  }

  console.log('\n[import] Done.');
  console.log({
    clientsCreated: createdClients,
    clientsSkipped: skippedClients,
    leadsCreated: createdLeads,
    leadsSkipped: skippedLeads,
  });
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
