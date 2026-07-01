/* eslint-disable no-console */
// =============================================================================
// Retroactively open a Case for every existing CONVERTED Lead that doesn't
// already have one. Also copies known financial info from a small hardcoded
// map (the 3 imported clients).
//
//   npm run backfill:cases
// =============================================================================

const { PrismaClient } = require('@prisma/client');
const caseService = require('../src/services/caseService');

const prisma = new PrismaClient();

// Known financial info for the imported clients (from Lead and client info.xlsx).
// Keyed by email so we can match records already in the DB.
const KNOWN_FINANCIALS = {
  'leila55araji@gmail.com':      { agreementAmount: 250,  amountPaid: 250,  agreementDate: '2026-06-29' },
  'kianakazemii2002@gmail.com':  { agreementAmount: 3500, amountPaid: 1000, agreementDate: '2026-06-29' },
  'atemehtakloo@gmail.com':      { agreementAmount: 1400, amountPaid: 1000, agreementDate: '2026-04-01' },
};

async function main() {
  const convertedLeads = await prisma.lead.findMany({
    where: { status: 'CONVERTED' },
    include: { case: true, caseType: true },
    orderBy: { id: 'asc' },
  });

  console.log(`[backfill-cases] Found ${convertedLeads.length} CONVERTED lead(s).`);

  let created = 0;
  let skipped = 0;
  let updated = 0;

  for (const lead of convertedLeads) {
    if (lead.case) {
      console.log(`  - ${lead.fullName}: already has case #${lead.case.id}, skipped`);
      skipped++;
      continue;
    }

    // Directly call the service — it seeds the checklist + records SIGNED stage.
    const c = await caseService.ensureCaseForLead(lead.id);
    console.log(`  - ${lead.fullName}: created case #${c.id}`);
    created++;

    // Apply known financials if we have them.
    const fin = lead.email ? KNOWN_FINANCIALS[lead.email.toLowerCase()] : null;
    if (fin) {
      await prisma.case.update({
        where: { id: c.id },
        data: {
          agreementAmount: fin.agreementAmount,
          amountPaid: fin.amountPaid,
          agreementDate: new Date(fin.agreementDate),
          currency: 'CAD',
        },
      });
      console.log(`      financials: agreement=$${fin.agreementAmount}, paid=$${fin.amountPaid}`);
      updated++;
    }
  }

  console.log(`\n[backfill-cases] Done. created=${created}, skipped=${skipped}, financials_applied=${updated}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
