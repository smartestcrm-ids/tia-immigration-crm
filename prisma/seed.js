/* eslint-disable no-console */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { PERMISSIONS, DEFAULT_ROLES } = require('../src/permissions');

const prisma = new PrismaClient();

async function hashed(plain) {
  return bcrypt.hash(plain, 10);
}

async function main() {
  console.log('[seed] resetting...');
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

  console.log('[seed] permissions...');
  for (const p of PERMISSIONS) {
    await prisma.permission.create({ data: p });
  }
  const allPerms = await prisma.permission.findMany();
  const permByKey = Object.fromEntries(allPerms.map((p) => [p.key, p]));

  console.log('[seed] roles...');
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

  console.log('[seed] users...');
  const safoura = await prisma.user.create({
    data: {
      email: 'safoura@ids.example',
      name: 'Safoura Janosepah',
      role: 'ADMIN',
      roleId: roles.ADMIN.id,
      passwordHash: await hashed('Admin123!'),
    },
  });
  const manager = await prisma.user.create({
    data: {
      email: 'manager@ids.example',
      name: 'Maria Manager',
      role: 'MANAGER',
      roleId: roles.MANAGER.id,
      passwordHash: await hashed('Manager123!'),
    },
  });
  const consultantA = await prisma.user.create({
    data: {
      email: 'arman@ids.example',
      name: 'Arman R.',
      role: 'CONSULTANT',
      roleId: roles.CONSULTANT.id,
      passwordHash: await hashed('Consultant123!'),
    },
  });
  const consultantB = await prisma.user.create({
    data: {
      email: 'leila@ids.example',
      name: 'Leila K.',
      role: 'CONSULTANT',
      roleId: roles.CONSULTANT.id,
      passwordHash: await hashed('Consultant123!'),
    },
  });

  console.log('[seed] case types...');
  const caseTypes = await Promise.all(
    [
      ['Work Permit', 'Closed and open work permits'],
      ['Study Permit', 'Initial and extension study permits'],
      ['Permanent Residence', 'Express Entry, PNP, family class'],
      ['Citizenship', 'Citizenship application & test prep'],
      ['Startup Visa', 'Business immigration via designated organization'],
      ['Refugee', 'Refugee claim and protected person applications'],
    ].map(([name, description]) =>
      prisma.caseType.create({ data: { name, description } })
    )
  );
  const byName = Object.fromEntries(caseTypes.map((c) => [c.name, c]));

  console.log('[seed] channel accounts...');
  const channelAccounts = await Promise.all([
    prisma.channelAccount.create({ data: { channel: 'WHATSAPP',  label: 'Main WhatsApp',       identifier: 'whatsapp:+14155238886' } }),
    prisma.channelAccount.create({ data: { channel: 'EMAIL',     label: 'Info Inbox',          identifier: 'info@ids.example' } }),
    prisma.channelAccount.create({ data: { channel: 'EMAIL',     label: 'Intake Inbox',        identifier: 'intake@ids.example' } }),
    prisma.channelAccount.create({ data: { channel: 'TELEGRAM',  label: 'Main Telegram Bot',   identifier: '@ids_bot' } }),
    prisma.channelAccount.create({ data: { channel: 'INSTAGRAM', label: 'IDS Instagram',       identifier: '@ids_immigration' } }),
    prisma.channelAccount.create({ data: { channel: 'SMS',       label: 'Main SMS Line',       identifier: '+14385551020' } }),
    prisma.channelAccount.create({ data: { channel: 'WEB_FORM',  label: 'Website Contact Form', identifier: 'website-form' } }),
  ]);
  const accountByChannel = {};
  for (const a of channelAccounts) {
    if (!accountByChannel[a.channel]) accountByChannel[a.channel] = a;
  }

  console.log('[seed] leads + conversations...');

  async function seedConversation({
    fullName, email, phone, channel, externalContactId,
    caseType, assignedTo, status, messages,
  }) {
    const lead = await prisma.lead.create({
      data: {
        fullName, email, phone,
        source: channel,
        status: status || 'NEW',
        caseTypeId: caseType ? caseType.id : null,
        assignedToId: assignedTo ? assignedTo.id : null,
        externalContactId,
      },
    });
    const conv = await prisma.conversation.create({
      data: {
        leadId: lead.id,
        channel,
        externalThreadId: externalContactId,
        channelAccountId: accountByChannel[channel] ? accountByChannel[channel].id : null,
      },
    });
    let lastAt = new Date(Date.now() - messages.length * 60000);
    for (const m of messages) {
      lastAt = new Date(lastAt.getTime() + 60000);
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          direction: m.direction,
          channel,
          body: m.body,
          status: m.direction === 'IN' ? 'RECEIVED' : 'SENT',
          sentAt: lastAt,
        },
      });
    }
    const unread = messages.filter((m) => m.direction === 'IN').length;
    await prisma.conversation.update({
      where: { id: conv.id },
      data: { lastMessageAt: lastAt, unreadCount: unread },
    });
    return lead;
  }

  const ali = await seedConversation({
    fullName: 'Ali Rezaei',
    email: 'ali.r@example.com',
    phone: '+989121234567',
    channel: 'WHATSAPP',
    externalContactId: 'wa:989121234567',
    caseType: byName['Study Permit'],
    assignedTo: safoura,
    status: 'NEW',
    messages: [
      { direction: 'IN', body: 'Hi, I want to apply for a study permit to Canada. Can you help?' },
      { direction: 'IN', body: "I have a Master's degree in Computer Engineering." },
    ],
  });

  const sara = await seedConversation({
    fullName: 'Sara Mohammadi',
    email: 'sara.m@example.com',
    phone: '+14165550101',
    channel: 'INSTAGRAM',
    externalContactId: 'ig:saram_2024',
    caseType: byName['Permanent Residence'],
    assignedTo: consultantA,
    status: 'CONTACTED',
    messages: [
      { direction: 'IN', body: 'Hello! I saw your post about Express Entry.' },
      { direction: 'IN', body: 'My CRS score is 478. Is this enough?' },
      { direction: 'OUT', body: "Hi Sara - 478 is competitive in recent draws. Let's book a consultation." },
    ],
  });

  const john = await seedConversation({
    fullName: 'John Patel',
    email: 'john.patel@example.com',
    phone: null,
    channel: 'WEB_FORM',
    externalContactId: 'web:john.patel@example.com',
    caseType: byName['Startup Visa'],
    assignedTo: consultantB,
    status: 'CONVERTED',
    messages: [
      { direction: 'IN', body: 'Submitted via website: I run a SaaS company in Dubai and want to relocate to Canada under the Startup Visa program.' },
      { direction: 'OUT', body: "Thanks John. I've attached our intake form. Let's schedule a call." },
      { direction: 'IN', body: 'Sounds good. Tuesday 3pm EST works.' },
    ],
  });

  // John is CONVERTED -> seed a client profile + family for demo
  const johnClient = await prisma.clientProfile.create({
    data: {
      leadId: john.id,
      dateOfBirth: new Date('1985-03-12'),
      nationality: 'Indian',
      passportNumber: 'P1234567',
      passportExpiry: new Date('2031-06-30'),
      address: 'Dubai, UAE',
      notes: 'SaaS founder, $1.2M ARR. SUV applicant.',
    },
  });
  await prisma.familyMember.create({
    data: {
      clientProfileId: johnClient.id,
      relation: 'SPOUSE',
      fullName: 'Priya Patel',
      dateOfBirth: new Date('1987-09-04'),
      nationality: 'Indian',
      passportNumber: 'P7654321',
    },
  });
  await prisma.familyMember.create({
    data: {
      clientProfileId: johnClient.id,
      relation: 'CHILD',
      fullName: 'Arjun Patel',
      dateOfBirth: new Date('2018-11-22'),
      nationality: 'Indian',
    },
  });

  const mary = await seedConversation({
    fullName: 'Mary Tan',
    email: null,
    phone: '+14165550199',
    channel: 'TELEGRAM',
    externalContactId: 'tg:104872',
    caseType: byName['Work Permit'],
    assignedTo: safoura,
    status: 'NEW',
    messages: [
      { direction: 'IN', body: 'My LMIA was approved last week, can you help with the work permit application?' },
    ],
  });

  await seedConversation({
    fullName: 'David Nguyen',
    email: 'd.nguyen@example.com',
    phone: '+12369998877',
    channel: 'EMAIL',
    externalContactId: 'email:d.nguyen@example.com',
    caseType: byName['Citizenship'],
    assignedTo: consultantA,
    status: 'CONSULTATION',
    messages: [
      { direction: 'IN', body: "Subject: Citizenship test prep - I've been a PR for 4 years and want to apply for citizenship." },
      { direction: 'OUT', body: 'Hi David - happy to help. We offer test prep and document review.' },
      { direction: 'IN', body: "Great. What's the fee structure?" },
    ],
  });

  await seedConversation({
    fullName: 'Fatima Al-Sayed',
    email: null,
    phone: '+14385551020',
    channel: 'SMS',
    externalContactId: 'sms:+14385551020',
    caseType: byName['Refugee'],
    assignedTo: consultantB,
    status: 'NEW',
    messages: [
      { direction: 'IN', body: 'Hello, I need help with a refugee claim. Is this the right number?' },
    ],
  });

  console.log('[seed] notes + reminders...');
  await prisma.note.create({
    data: {
      leadId: sara.id,
      authorId: consultantA.id,
      body: 'CRS 478 - recent EE draws have ranged 471-491. Worth booking paid consultation.',
    },
  });

  const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await prisma.reminder.create({ data: { leadId: ali.id, ownerId: safoura.id, title: 'Follow up with Ali on study permit documents', dueAt: tomorrow } });
  await prisma.reminder.create({ data: { leadId: john.id, ownerId: consultantB.id, title: 'Send retainer agreement for Startup Visa', dueAt: inThreeDays } });
  await prisma.reminder.create({ data: { leadId: mary.id, ownerId: safoura.id, title: 'Reply to Mary about LMIA-based work permit', dueAt: tomorrow } });

  void manager;

  const counts = {
    permissions: await prisma.permission.count(),
    roles: await prisma.role.count(),
    users: await prisma.user.count(),
    caseTypes: await prisma.caseType.count(),
    channelAccounts: await prisma.channelAccount.count(),
    leads: await prisma.lead.count(),
    conversations: await prisma.conversation.count(),
    messages: await prisma.message.count(),
    clientProfiles: await prisma.clientProfile.count(),
    familyMembers: await prisma.familyMember.count(),
  };
  console.log('[seed] done', counts);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
