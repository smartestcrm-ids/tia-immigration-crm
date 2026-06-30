/* eslint-disable no-console */
// =============================================================================
// One-off backfill: any user with a role string but a NULL roleId gets the
// roleId filled in from the matching Role row. Run once after deploying the
// fix that sets roleId on user create/update.
//
//   npm run backfill:roleids
// =============================================================================

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { roleId: null },
    select: { id: true, email: true, role: true },
  });

  if (users.length === 0) {
    console.log('[backfill] No users need a roleId backfill.');
    return;
  }

  console.log(`[backfill] Found ${users.length} user(s) missing roleId:`);
  for (const u of users) {
    const role = await prisma.role.findUnique({ where: { name: u.role } });
    if (!role) {
      console.warn(`  - ${u.email}: role "${u.role}" not found in Role table — skipped.`);
      continue;
    }
    await prisma.user.update({
      where: { id: u.id },
      data: { roleId: role.id },
    });
    console.log(`  - ${u.email}: role="${u.role}" -> roleId=${role.id} ✓`);
  }
  console.log('[backfill] Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
