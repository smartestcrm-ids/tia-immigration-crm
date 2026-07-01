/* eslint-disable no-console */
// =============================================================================
// One-off: assign default case managers to the 4 imported clients based on
// the office routing rules from the requirements document.
//
//   npm run assign:managers
//
// Edit the ASSIGNMENTS map below to change who gets which client. Idempotent.
// =============================================================================

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// email of client -> email of the user who should be case manager
const ASSIGNMENTS = {
  'leila55araji@gmail.com':      'ensieh@insightful-ds.ca',  // Visitor Visa -> Canada Reception
  'kianakazemii2002@gmail.com':  'farshid@insightful-ds.ca', // Express Entry -> Manager
  'atemehtakloo@gmail.com':      'ensieh@insightful-ds.ca',  // Dependent Visa -> Canada Reception
  'safoura.janosepah@gmail.com': 'elaheh@insightful-ds.ca',  // SUV / Business -> Owner
};

async function main() {
  let touched = 0;
  let skipped = 0;
  for (const [clientEmail, managerEmail] of Object.entries(ASSIGNMENTS)) {
    const lead = await prisma.lead.findFirst({
      where: { email: clientEmail },
      include: { case: true },
    });
    if (!lead || !lead.case) {
      console.log(`  - ${clientEmail}: lead or case not found, skipped`);
      skipped++;
      continue;
    }

    const manager = await prisma.user.findUnique({ where: { email: managerEmail } });
    if (!manager) {
      console.log(`  - ${clientEmail}: manager ${managerEmail} not found, skipped`);
      skipped++;
      continue;
    }

    if (lead.case.caseManagerId === manager.id) {
      console.log(`  - ${clientEmail}: already assigned to ${manager.name}, skipped`);
      skipped++;
      continue;
    }

    await prisma.case.update({
      where: { id: lead.case.id },
      data: { caseManagerId: manager.id },
    });
    console.log(`  - ${clientEmail}: assigned to ${manager.name}`);
    touched++;
  }
  console.log(`\n[assign:managers] Done. updated=${touched}, skipped=${skipped}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
