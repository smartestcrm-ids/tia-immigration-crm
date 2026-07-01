const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const { requireRole } = require('../middleware/auth');
const leadService = require('../services/leadService');
const caseService = require('../services/caseService');
const { CHANNELS, LEAD_STATUSES } = require('../constants');

const router = express.Router();

const LeadCreateSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  source: z.enum(CHANNELS),
  status: z.enum(LEAD_STATUSES).optional(),
  caseTypeId: z.number().int().optional().nullable(),
  assignedToId: z.number().int().optional().nullable(),
  externalContactId: z.string().optional().nullable(),
});

const LeadUpdateSchema = LeadCreateSchema.partial();

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const leads = await leadService.listLeads({ ...req.query, actor: req.user });
    res.json(leads);
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const lead = await leadService.getLead(req.params.id, { actor: req.user });
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  })
);

router.post(
  '/',
  requireRole('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const data = LeadCreateSchema.parse(req.body);
    const lead = await leadService.createLead(data);
    res.status(201).json(lead);
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = LeadUpdateSchema.parse(req.body);
    const lead = await leadService.updateLead(req.params.id, data, { actor: req.user });
    // When a lead transitions to CONVERTED, auto-create the case + checklist
    // (safe to call every time — the underlying method is idempotent).
    if (lead && lead.status === 'CONVERTED') {
      try { await caseService.ensureCaseForLead(lead.id); }
      catch (e) { console.warn(`[leads] failed to open case for lead ${lead.id}:`, e.message); }
    }
    res.json(lead);
  })
);

router.delete(
  '/:id',
  requireRole('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    await leadService.deleteLead(req.params.id, { actor: req.user });
    res.status(204).end();
  })
);

module.exports = router;
