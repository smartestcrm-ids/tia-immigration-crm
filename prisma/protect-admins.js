/* eslint-disable no-console */
// =============================================================================
// One-off: mark owner / admin accounts as protected (cannot be disabled,
// role-changed, or deleted) and optionally as hidden (do not appear in the
// Users list).
//
//   npm run protect:admins
//
// Edit the PROTECTED_ACCOUNTS list below to add / change protected accounts.
// =============================================================================

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const PROTECTED_ACCOUNTS = [
  // System admin account — fully hidden so even other admins don't see it.
  { email: 'admin@insightful-ds.ca',   hidden: true  },
  // Owner — protected, but still visible in the Users list (real person).
  { email: 'elaheh@insightful-ds.ca',  hidden: false },
];

async function main() {
  let touched = 0;
  for (const { email, hidden } of PROTECTED_ACCOUNTS) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.log(`  - ${email}: not found, skipped`);
      continue;
    }
    if (user.isProtected === true && user.hidden === hidden) {
      console.log(`  - ${email}: already configured, skipped`);
      continue;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { isProtected: true, hidden, active: true },
    });
    console.log(`  - ${email}: protected ✓ hidden=${hidden}`);
    touched++;
  }
  console.log(`[protect-admins] Done. ${touched} user(s) updated.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
