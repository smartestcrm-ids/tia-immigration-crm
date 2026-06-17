const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const inboxService = require('../services/inboxService');
const ingestService = require('../services/messageIngestService');

const router = express.Router();

const SendSchema = z.object({
  body: z.string().min(1),
});

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const conv = await inboxService.getConversation(req.params.id, { actor: req.user });
    if (!conv) return res.status(404).json({ error: 'Conversation not found' });
    res.json(conv);
  })
);

router.post(
  '/:id/messages',
  asyncHandler(async (req, res) => {
    await inboxService.getConversation(req.params.id, { actor: req.user });
    const data = SendSchema.parse(req.body);
    const msg = await ingestService.sendOutbound(req.params.id, data.body, {
      authorId: req.user.id,
    });
    res.status(201).json(msg);
  })
);

router.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await inboxService.markRead(req.params.id, { actor: req.user });
    res.status(204).end();
  })
);

module.exports = router;
