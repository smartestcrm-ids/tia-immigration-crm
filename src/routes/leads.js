const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const { requireRole } = require('../middleware/auth');
const prisma = require('../db');
const leadService = require('../services/leadService');
const caseService = require('../services/caseService');
const { CHANNELS, LEAD_STATUSES } = require('../constants');

const router = express.Router();

const LeadCreateSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  source: z.enum(CHANNELS).optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  caseTypeId: z.number().int().optional().nullable(),
  assignedToId: z.number().int().optional().nullable(),
  externalContactId: z.string().optional().nullable(),
  // Optional financial fields — only used when status is CONVERTED and a case
  // is auto-created. Ignored for non-converted leads.
  agreementAmount: z.number().nonnegative().optional().nullable(),
  amountPaid: z.number().nonnegative().optional().nullable(),
  agreementDate: z.string().optional().nullable(),
  currency: z.string().min(1).max(6).optional(),
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
    const raw = LeadCreateSchema.parse(req.body);
    // Extract financial fields so they don't get passed to Lead.create.
    const { agreementAmount, amountPaid, agreementDate, currency, ...leadData } = raw;
    // Default source to WEB_FORM for manually-entered leads.
    if (!leadData.source) leadData.source = 'WEB_FORM';
    // For manually-created records with no external contact id, use a synthetic
    // one so the unique constraint doesn't collide.
    if (!leadData.externalContactId) {
      const key = leadData.email || leadData.phone || `manual:${Date.now()}`;
      leadData.externalContactId = `manual:${key}`;
    }

    const lead = await leadService.createLead(leadData);

    // If created directly as CONVERTED, auto-open the case + apply financials.
    if (lead.status === 'CONVERTED') {
      try {
        const c = await caseService.ensureCaseForLead(lead.id);
        const patch = {};
        if (agreementAmount != null) patch.agreementAmount = agreementAmount;
        if (amountPaid != null)      patch.amountPaid      = amountPaid;
        if (currency)                patch.currency        = currency;
        if (agreementDate)           patch.agreementDate   = new Date(agreementDate);
        if (Object.keys(patch).length) {
          await prisma.case.update({ where: { id: c.id }, data: patch });
        }
      } catch (e) {
        console.warn(`[leads] failed to open case for new lead ${lead.id}:`, e.message);
      }
    }

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
