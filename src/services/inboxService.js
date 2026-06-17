const prisma = require('../db');
const { canSeeAllLeads } = require('../middleware/auth');

async function listInbox({ channel, assignedToId, status, take = 50, skip = 0, actor } = {}) {
  const where = {};
  if (channel) where.channel = channel;

  const leadFilter = {};
  if (assignedToId) leadFilter.assignedToId = Number(assignedToId);
  if (status) leadFilter.status = status;
  if (actor && !canSeeAllLeads(actor)) {
    leadFilter.assignedToId = actor.id;
  }
  if (Object.keys(leadFilter).length > 0) where.lead = leadFilter;

  const conversations = await prisma.conversation.findMany({
    where,
    include: {
      lead: { include: { assignedTo: true, caseType: true } },
      messages: { orderBy: { sentAt: 'desc' }, take: 1 },
    },
    orderBy: { lastMessageAt: 'desc' },
    take: Number(take),
    skip: Number(skip),
  });
  return conversations.map((c) => ({
    id: c.id,
    channel: c.channel,
    leadId: c.leadId,
    leadName: c.lead.fullName,
    leadStatus: c.lead.status,
    caseType: c.lead.caseType ? c.lead.caseType.name : null,
    assignedTo: c.lead.assignedTo ? { id: c.lead.assignedTo.id, name: c.lead.assignedTo.name } : null,
    lastMessageAt: c.lastMessageAt,
    unreadCount: c.unreadCount,
    preview: c.messages[0] ? c.messages[0].body.slice(0, 140) : null,
    direction: c.messages[0] ? c.messages[0].direction : null,
  }));
}

async function getConversation(id, { actor } = {}) {
  const conv = await prisma.conversation.findUnique({
    where: { id: Number(id) },
    include: {
      lead: { include: { assignedTo: true, caseType: true } },
      messages: { orderBy: { sentAt: 'asc' } },
    },
  });
  if (!conv) return null;
  if (actor && !canSeeAllLeads(actor) && conv.lead.assignedToId !== actor.id) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  return conv;
}

async function markRead(id, { actor } = {}) {
  if (actor && !canSeeAllLeads(actor)) {
    const conv = await prisma.conversation.findUnique({
      where: { id: Number(id) },
      include: { lead: true },
    });
    if (!conv || conv.lead.assignedToId !== actor.id) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
  }
  return prisma.conversation.update({
    where: { id: Number(id) },
    data: { unreadCount: 0 },
  });
}

module.exports = { listInbox, getConversation, markRead };
