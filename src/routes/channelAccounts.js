const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const { requirePermission } = require('../middleware/auth');
const prisma = require('../db');
const { CHANNELS } = require('../constants');

const router = express.Router();

const CreateSchema = z.object({
  channel:    z.enum(CHANNELS),
  label:      z.string().min(1).max(80),
  identifier: z.string().min(1).max(200),
  config:     z.string().optional().nullable(),
  active:     z.boolean().optional(),
});

router.get(
  '/',
  requirePermission('channel_accounts.manage'),
  asyncHandler(async (req, res) => {
    const accounts = await prisma.channelAccount.findMany({
      orderBy: [{ channel: 'asc' }, { label: 'asc' }],
    });
    res.json(accounts);
  })
);

router.post(
  '/',
  requirePermission('channel_accounts.manage'),
  asyncHandler(async (req, res) => {
    const data = CreateSchema.parse(req.body);
    const created = await prisma.channelAccount.create({ data });
    res.status(201).json(created);
  })
);

router.patch(
  '/:id',
  requirePermission('channel_accounts.manage'),
  asyncHandler(async (req, res) => {
    const data = CreateSchema.partial().parse(req.body);
    const updated = await prisma.channelAccount.update({
      where: { id: Number(req.params.id) },
      data,
    });
    res.json(updated);
  })
);

router.delete(
  '/:id',
  requirePermission('channel_accounts.manage'),
  asyncHandler(async (req, res) => {
    await prisma.channelAccount.delete({ where: { id: Number(req.params.id) } });
    res.status(204).end();
  })
);

module.exports = router;
