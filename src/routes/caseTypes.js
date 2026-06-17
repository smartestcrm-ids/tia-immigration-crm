const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const { requireRole } = require('../middleware/auth');
const prisma = require('../db');

const router = express.Router();

const CaseTypeSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  active: z.boolean().optional(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const types = await prisma.caseType.findMany({ orderBy: { name: 'asc' } });
    res.json(types);
  })
);

router.post(
  '/',
  requireRole('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const data = CaseTypeSchema.parse(req.body);
    const created = await prisma.caseType.create({ data });
    res.status(201).json(created);
  })
);

router.patch(
  '/:id',
  requireRole('ADMIN', 'MANAGER'),
  asyncHandler(async (req, res) => {
    const data = CaseTypeSchema.partial().parse(req.body);
    const updated = await prisma.caseType.update({
      where: { id: Number(req.params.id) },
      data,
    });
    res.json(updated);
  })
);

module.exports = router;
