/* eslint-disable no-console */
// =============================================================================
// Production seed for Tia Immigration Office
// =============================================================================
// Wipes ALL existing data, then loads the real Tia office structure:
//   * 5 team users (Elaheh, Farshid, Ensieh, Dubai Reception, Ms Elaheh Dubai)
//   * 13 case types (10 Canada services + 3 Dubai services)
//   * 24 channel accounts (10 emails + 4 numbers x 3 channels + 2 Instagram)
//
// Initial password for ALL team members: TiaTemp2026!
// EVERY USER SHOULD CHANGE THEIR PASSWORD ON FIRST LOGIN.
//
// Run inside the backend container in Coolify Terminal:
//   npm run seed:tia
// =============================================================================

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { PERMISSIONS, DEFAULT_ROLES } = require('../src/permissions');

const prisma = new PrismaClient();

const TEMP_PASSWORD = 'TiaTemp2026!';

async function hashed(plain) {
  return bcrypt.hash(plain, 10);
}

async function main() {
  console.log('[seed-tia] WARNING: this resets the database.');
  console.log('[seed-tia] Resetting...');

  await prisma.document.deleteMany();
  await prisma.familyMember.deleteMany();
  await prisma.clientProfile.deleteMany();
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.channelAccount.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.note.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.user.deleteMany();
  await prisma.caseType.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.role.deleteMany();
  await prisma.permission.deleteMany();

  // ---------------------------------------------------------------------------
  // Permissions and Roles
  // ---------------------------------------------------------------------------
  console.log('[seed-tia] Permissions...');
  for (const p of PERMISSIONS) {
    await prisma.permission.create({ data: p });
  }
  const allPerms = await prisma.permission.findMany();
  const permByKey = Object.fromEntries(allPerms.map((p) => [p.key, p]));

  console.log('[seed-tia] Roles...');
  const roles = {};
  for (const [name, def] of Object.entries(DEFAULT_ROLES)) {
    const role = await prisma.role.create({
      data: {
        name,
        description: def.description,
        isSystem: def.isSystem,
        permissions: {
          create: def.permissions.map((key) => ({ permissionId: permByKey[key].id })),
        },
      },
    });
    roles[name] = role;
  }

  // ---------------------------------------------------------------------------
  // Team Users
  // ---------------------------------------------------------------------------
  console.log('[seed-tia] Users...');
  const passwordHash = await hashed(TEMP_PASSWORD);

  const elaheh = await prisma.user.create({
    data: {
      email: 'elaheh@insightful-ds.ca',
      name: 'Elaheh Rezaei',
      role: 'ADMIN',
      roleId: roles.ADMIN.id,
      passwordHash,
    },
  });

  const farshid = await prisma.user.create({
    data: {
      email: 'farshid@insightful-ds.ca',
      name: 'Farshid Tourani',
      role: 'MANAGER',
      roleId: roles.MANAGER.id,
      passwordHash,
    },
  });

  const ensieh = await prisma.user.create({
    data: {
      email: 'ensieh@insightful-ds.ca',
      name: 'Ensieh (Canada Reception)',
      role: 'CONSULTANT',
      roleId: roles.CONSULTANT.id,
      passwordHash,
    },
  });

  const dubaiReception = await prisma.user.create({
    data: {
      email: 'dubai.reception@insightful-ds.ca',
      name: 'Dubai Reception / Admin',
      role: 'CONSULTANT',
      roleId: roles.CONSULTANT.id,
      passwordHash,
    },
  });

  const dubaiElaheh = await prisma.user.create({
    data: {
      email: 'elaheh.dubai@insightful-ds.ca',
      name: 'Elaheh (Dubai)',
      role: 'CONSULTANT',
      roleId: roles.CONSULTANT.id,
      passwordHash,
    },
  });

  void ensieh; void dubaiReception; void dubaiElaheh; // silence unused-var lint

  // ---------------------------------------------------------------------------
  // Case Types
  // ---------------------------------------------------------------------------
  console.log('[seed-tia] Case types...');
  const caseTypes = [
    // --- Canada Office services ---
    ['Job Offer', 'Canadian job offer support', 'Canada'],
    ['Work Permit', 'Closed and open work permits for Canada', 'Canada'],
    ['Entrepreneur / Business Immigration', 'Business immigration to Canada', 'Canada'],
    ['Visitor Visa', 'Canadian visitor visa applications', 'Canada'],
    ['Start-Up Visa', 'Canadian Start-Up Visa program (SUV)', 'Canada'],
    ['Open Work Permit for Iranians', 'OWP for Iranian nationals (OWP-N)', 'Canada'],
    ['Passport Extension', 'Iranian passport renewal / extension', 'Canada'],
    ['Dependent / Family Visa', 'Family-class sponsorship to Canada', 'Canada'],
    ['Express Entry', 'Canadian Express Entry (FSW, CEC, FST)', 'Canada'],
    ['Ontario Provincial Program (OINP)', 'Ontario PNP nomination', 'Canada'],

    // --- Dubai Office services ---
    ['Canada Immigration (Dubai)', 'Canada immigration services via Dubai office', 'Dubai'],
    ['Spain Residency', 'Spanish residency programs', 'Dubai'],
    ['Second Passport Programs', 'Citizenship / passport by investment', 'Dubai'],
  ];

  for (const [name, description] of caseTypes) {
    await prisma.caseType.create({ data: { name, description } });
  }

  // ---------------------------------------------------------------------------
  // Channel Accounts
  // ---------------------------------------------------------------------------
  console.log('[seed-tia] Channel accounts (email)...');
  const emails = [
    ['TIA Immigration — Main',     'tiaimmigration@gmail.com'],
    ['TIA Express',                'Tiaexpress21@gmail.com'],
    ['Smart Startup',              'Smart.t.startup@gmail.com'],
    ['TIA Client',                 'tia.client2023@gmail.com'],
    ['TIA Star Broker (Dubai)',    'info@tiastarbroker.com'],
    ['TIA ICT',                    'tiaict2023@gmail.com'],
    ['TIA Global Residency (Dubai)', 'tiaglobalresidency@gmail.com'],
    ['TIA Immigration 123',        'tiaimmigration123@gmail.com'],
    ['TIA Star Investment',        'tiastarinvestment@gmail.com'],
    ['Startup TIA',                'startuptia@gmail.com'],
  ];
  for (const [label, identifier] of emails) {
    await prisma.channelAccount.create({
      data: { channel: 'EMAIL', label, identifier },
    });
  }

  console.log('[seed-tia] Channel accounts (phone: WhatsApp + Telegram + SMS)...');
  // Each phone number is registered under WhatsApp + Telegram + SMS,
  // because the same number is used for all three (per the requirements doc).
  const phones = [
    { country: 'Canada', office: 'TIA Immigration', number: '+14378481002' },
    { country: 'Canada', office: 'STS',             number: '+16477611002' },
    { country: 'Dubai',  office: 'TIA',             number: '+971586973002' },
    { country: 'Dubai',  office: 'STS',             number: '+971554861002' },
  ];
  for (const p of phones) {
    for (const channel of ['WHATSAPP', 'TELEGRAM', 'SMS']) {
      await prisma.channelAccount.create({
        data: {
          channel,
          label: `${p.country} ${p.office} (${channel})`,
          identifier: p.number,
        },
      });
    }
  }

  console.log('[seed-tia] Channel accounts (Instagram)...');
  const instagrams = [
    ['TIA Immigration',  '@Tiaimmigration'],
    ['TIA Star Capital', '@Tiastar_Capital'],
  ];
  for (const [label, identifier] of instagrams) {
    await prisma.channelAccount.create({
      data: { channel: 'INSTAGRAM', label, identifier },
    });
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  const counts = {
    permissions: await prisma.permission.count(),
    roles: await prisma.role.count(),
    users: await prisma.user.count(),
    caseTypes: await prisma.caseType.count(),
    channelAccounts: await prisma.channelAccount.count(),
  };
  console.log('\n[seed-tia] DONE:', counts);

  console.log('\n================================================================');
  console.log('LOGIN CREDENTIALS (all use the same temp password — change ASAP):');
  console.log('================================================================');
  console.log(`  Password: ${TEMP_PASSWORD}`);
  console.log('');
  console.log(`  ${elaheh.email}             (Owner / Admin — full access)`);
  console.log(`  ${farshid.email}            (Manager — lead + team management)`);
  console.log('  ensieh@insightful-ds.ca           (Canada Reception)');
  console.log('  dubai.reception@insightful-ds.ca  (Dubai Reception / Admin)');
  console.log('  elaheh.dubai@insightful-ds.ca     (Dubai team)');
  console.log('');
  console.log('Login at: https://crm.insightful-ds.ca');
  console.log('Each user should sign in once, then change their password.');
  console.log('================================================================');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
