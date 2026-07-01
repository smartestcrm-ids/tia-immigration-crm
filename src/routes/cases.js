const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const prisma = require('../db');
const caseService = require('../services/caseService');
const { CASE_STAGES } = require('../caseTemplates');

const router = express.Router();

// -----------------------------------------------------------------------------
// GET /api/cases/stages — the fixed 12-step pipeline template
// -----------------------------------------------------------------------------
router.get('/stages', (req, res) => res.json(CASE_STAGES));

// -----------------------------------------------------------------------------
// GET /api/cases — list all cases
// -----------------------------------------------------------------------------
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const cases = await prisma.case.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        lead: { select: { id: true, fullName: true, email: true, phone: true } },
        caseType: { select: { id: true, name: true } },
        caseManager: { select: { id: true, name: true, email: true } },
        _count: { select: { requirements: true } },
      },
    });
    res.json(cases);
  })
);

// -----------------------------------------------------------------------------
// GET /api/cases/lead/:leadId — the case for a specific lead (or null)
// -----------------------------------------------------------------------------
router.get(
  '/lead/:leadId',
  asyncHandler(async (req, res) => {
    const c = await prisma.case.findUnique({
      where: { leadId: Number(req.params.leadId) },
      include: caseInclude,
    });
    res.json(c || null);
  })
);

// -----------------------------------------------------------------------------
// GET /api/cases/:id — full case detail (stages + requirements)
// -----------------------------------------------------------------------------
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const c = await prisma.case.findUnique({
      where: { id: Number(req.params.id) },
      include: caseInclude,
    });
    if (!c) return res.status(404).json({ error: 'Case not found' });
    res.json(c);
  })
);

// -----------------------------------------------------------------------------
// POST /api/cases — manually open a case for a lead (usually auto-created)
// -----------------------------------------------------------------------------
const CreateCaseSchema = z.object({ leadId: z.number().int().positive() });

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { leadId } = CreateCaseSchema.parse(req.body);
    const newCase = await caseService.ensureCaseForLead(leadId);
    const full = await prisma.case.findUnique({ where: { id: newCase.id }, include: caseInclude });
    res.status(201).json(full);
  })
);

// -----------------------------------------------------------------------------
// PATCH /api/cases/:id — update case fields (financial, manager, notes, status)
// -----------------------------------------------------------------------------
const UpdateCaseSchema = z.object({
  status: z.enum(['ACTIVE', 'ON_HOLD', 'SUBMITTED', 'CLOSED']).optional(),
  caseManagerId: z.number().int().positive().nullable().optional(),
  agreementAmount: z.number().nonnegative().nullable().optional(),
  amountPaid: z.number().nonnegative().nullable().optional(),
  currency: z.string().min(1).max(6).optional(),
  agreementDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const data = UpdateCaseSchema.parse(req.body);
    const patch = { ...data };
    if (data.agreementDate !== undefined) {
      patch.agreementDate = data.agreementDate ? new Date(data.agreementDate) : null;
    }
    const updated = await prisma.case.update({
      where: { id: Number(req.params.id) },
      data: patch,
      include: caseInclude,
    });
    res.json(updated);
  })
);

// -----------------------------------------------------------------------------
// POST /api/cases/:id/advance — mark current stage COMPLETED, move to next
//   body: { toStage?: string, notes?: string }
// -----------------------------------------------------------------------------
const AdvanceSchema = z.object({
  toStage: z.string().optional(),
  notes: z.string().optional(),
});

router.post(
  '/:id/advance',
  asyncHandler(async (req, res) => {
    const { toStage, notes } = AdvanceSchema.parse(req.body || {});
    await caseService.advanceCase({
      caseId: Number(req.params.id),
      toStage,
      completedById: req.user.id,
      notes,
    });
    const full = await prisma.case.findUnique({
      where: { id: Number(req.params.id) },
      include: caseInclude,
    });
    res.json(full);
  })
);

// -----------------------------------------------------------------------------
// Document requirements (checklist items)
// -----------------------------------------------------------------------------

const RequirementCreateSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  requiredForApplicant: z.boolean().optional(),
  familyMemberName: z.string().nullable().optional(),
});

const RequirementUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().optional(),
  status: z.enum(['PENDING', 'REQUESTED', 'RECEIVED', 'MISSING', 'NA']).optional(),
  requiredForApplicant: z.boolean().optional(),
  familyMemberName: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

router.post(
  '/:id/requirements',
  asyncHandler(async (req, res) => {
    const caseId = Number(req.params.id);
    const data = RequirementCreateSchema.parse(req.body);
    const req_ = await prisma.documentRequirement.create({
      data: { caseId, ...data, status: 'PENDING' },
    });
    res.status(201).json(req_);
  })
);

router.patch(
  '/:id/requirements/:reqId',
  asyncHandler(async (req, res) => {
    const data = RequirementUpdateSchema.parse(req.body);
    const patch = { ...data };
    if (data.status === 'RECEIVED') patch.receivedAt = new Date();
    if (data.status === 'REQUESTED') patch.requestedAt = new Date();
    const updated = await prisma.documentRequirement.update({
      where: { id: Number(req.params.reqId) },
      data: patch,
    });
    res.json(updated);
  })
);

router.delete(
  '/:id/requirements/:reqId',
  asyncHandler(async (req, res) => {
    await prisma.documentRequirement.delete({ where: { id: Number(req.params.reqId) } });
    res.json({ ok: true });
  })
);

// -----------------------------------------------------------------------------
// Shared prisma include for a full case response
// -----------------------------------------------------------------------------
const caseInclude = {
  lead: { select: { id: true, fullName: true, email: true, phone: true, status: true } },
  caseType: { select: { id: true, name: true } },
  caseManager: { select: { id: true, name: true, email: true } },
  stageHistory: {
    orderBy: { completedAt: 'desc' },
    include: { completedBy: { select: { id: true, name: true } } },
  },
  requirements: { orderBy: [{ status: 'asc' }, { createdAt: 'asc' }] },
};

module.exports = router;
