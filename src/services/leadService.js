const prisma = require('../db');
const { canSeeAllLeads } = require('../middleware/auth');

function scopeWhereForActor(actor, where = {}) {
  if (!actor || canSeeAllLeads(actor)) return where;
  return { ...where, assignedToId: actor.id };
}

async function listLeads({ status, assignedToId, q, take = 100, skip = 0, actor } = {}) {
  let where = {};
  if (status) where.status = status;
  if (assignedToId) where.assignedToId = Number(assignedToId);
  if (q) {
    where.OR = [
      { fullName: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
    ];
  }
  where = scopeWhereForActor(actor, where);
  return prisma.lead.findMany({
    where,
    include: { assignedTo: true, caseType: true },
    orderBy: { updatedAt: 'desc' },
    take: Number(take),
    skip: Number(skip),
  });
}

async function getLead(id, { actor } = {}) {
  const lead = await prisma.lead.findUnique({
    where: { id: Number(id) },
    include: {
      assignedTo: true,
      caseType: true,
      notes: { include: { author: true }, orderBy: { createdAt: 'desc' } },
      reminders: { orderBy: { dueAt: 'asc' } },
      conversations: { orderBy: { lastMessageAt: 'desc' } },
    },
  });
  if (!lead) return null;
  if (actor && !canSeeAllLeads(actor) && lead.assignedToId !== actor.id) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
  return lead;
}

async function createLead(data) {
  return prisma.lead.create({ data, include: { assignedTo: true, caseType: true } });
}

async function updateLead(id, data, { actor } = {}) {
  if (actor && !canSeeAllLeads(actor)) {
    const existing = await prisma.lead.findUnique({ where: { id: Number(id) } });
    if (!existing || existing.assignedToId !== actor.id) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
    delete data.assignedToId;
  }
  return prisma.lead.update({
    where: { id: Number(id) },
    data,
    include: { assignedTo: true, caseType: true },
  });
}

async function deleteLead(id, { actor } = {}) {
  if (actor && !canSeeAllLeads(actor)) {
    const err = new Error('Forbidden: only managers/admins can delete leads');
    err.status = 403;
    throw err;
  }
  return prisma.lead.delete({ where: { id: Number(id) } });
}

module.exports = { listLeads, getLead, createLead, updateLead, deleteLead };
