const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const prisma = require('../db');
const { canSeeAllLeads } = require('../middleware/auth');

const router = express.Router();

const NoteCreateSchema = z.object({
  body: z.string().min(1),
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
  '/:id/notes',
  asyncHandler(async (req, res) => {
    const leadId = Number(req.params.id);
    await ensureCanAccessLead(leadId, req.user);
    const notes = await prisma.note.findMany({
      where: { leadId },
      include: { author: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(notes);
  })
);

router.post(
  '/:id/notes',
  asyncHandler(async (req, res) => {
    const leadId = Number(req.params.id);
    await ensureCanAccessLead(leadId, req.user);
    const data = NoteCreateSchema.parse(req.body);
    const note = await prisma.note.create({
      data: { body: data.body, leadId, authorId: req.user.id },
      include: { author: true },
    });
    res.status(201).json(note);
  })
);

module.exports = router;
