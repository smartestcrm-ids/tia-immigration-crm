const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const prisma = require('../db');
const { canSeeAllLeads } = require('../middleware/auth');

const router = express.Router();

const ReminderCreateSchema = z.object({
  title: z.string().min(1),
  dueAt: z.string(),
  ownerId: z.number().int().optional().nullable(),
});

const ReminderUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  dueAt: z.string().optional(),
  completed: z.boolean().optional(),
  ownerId: z.number().int().optional().nullable(),
});

async function ensureCanAccessLead(leadId, actor) {
  if (canSeeAllLeads(actor)) return;
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { assignedToId: true } });
  if (!lead || lead.assignedToId !== actor.id) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
}

router.get(
  '/:id/reminders',
  asyncHandler(async (req, res) => {
    const leadId = Number(req.params.id);
    await ensureCanAccessLead(leadId, req.user);
    const reminders = await prisma.reminder.findMany({
      where: { leadId },
      include: { owner: true },
      orderBy: { dueAt: 'asc' },
    });
    res.json(reminders);
  })
);

router.post(
  '/:id/reminders',
  asyncHandler(async (req, res) => {
    const leadId = Number(req.params.id);
    await ensureCanAccessLead(leadId, req.user);
    const data = ReminderCreateSchema.parse(req.body);
    const reminder = await prisma.reminder.create({
      data: {
        title: data.title,
        dueAt: new Date(data.dueAt),
        ownerId: data.ownerId ?? req.user.id,
        leadId,
      },
      include: { owner: true },
    });
    res.status(201).json(reminder);
  })
);

router.patch(
  '/:leadId/reminders/:reminderId',
  asyncHandler(async (req, res) => {
    const leadId = Number(req.params.leadId);
    await ensureCanAccessLead(leadId, req.user);
    const data = ReminderUpdateSchema.parse(req.body);
    const updated = await prisma.reminder.update({
      where: { id: Number(req.params.reminderId) },
      data: {
        ...data,
        ...(data.dueAt ? { dueAt: new Date(data.dueAt) } : {}),
      },
      include: { owner: true },
    });
    res.json(updated);
  })
);

module.exports = router;
