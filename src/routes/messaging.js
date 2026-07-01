const express = require('express');
const { z } = require('zod');
const asyncHandler = require('../middleware/asyncHandler');
const prisma = require('../db');
const emailService = require('../services/emailService');

const router = express.Router();

const SendEmailSchema = z.object({
  leadId:  z.number().int().positive().optional(),
  to:      z.string().email().optional(),
  subject: z.string().min(1).max(500),
  body:    z.string().min(1),
  // Attachments as an array of { filename, contentBase64, contentType }.
  attachments: z.array(
    z.object({
      filename: z.string().min(1),
      contentBase64: z.string().min(1),
      contentType: z.string().optional(),
    })
  ).optional(),
});

// -----------------------------------------------------------------------------
// GET /api/messaging/status — whether email is configured
// -----------------------------------------------------------------------------
router.get('/status', (req, res) => {
  res.json({
    email: {
      configured: emailService.isConfigured(),
      fromName:   process.env.SMTP_FROM_NAME || null,
      fromEmail:  process.env.SMTP_USER || null,
    },
  });
});

// -----------------------------------------------------------------------------
// POST /api/messaging/email — send an email + optional attachments
// Either pass "to" directly, or pass "leadId" and we use their email.
// -----------------------------------------------------------------------------
router.post(
  '/email',
  asyncHandler(async (req, res) => {
    const data = SendEmailSchema.parse(req.body);

    let recipient = data.to;
    let lead = null;
    if (data.leadId) {
      lead = await prisma.lead.findUnique({ where: { id: data.leadId } });
      if (!lead) return res.status(404).json({ error: 'Lead not found' });
      if (!recipient) recipient = lead.email;
    }
    if (!recipient) {
      return res.status(400).json({ error: 'Recipient email required (to or leadId with email).' });
    }

    const attachments = (data.attachments || []).map((a) => ({
      filename: a.filename,
      content:  Buffer.from(a.contentBase64, 'base64'),
      contentType: a.contentType,
    }));

    const result = await emailService.sendEmail({
      to: recipient,
      subject: data.subject,
      text: data.body,
      attachments: attachments.length ? attachments : undefined,
      replyTo: process.env.SMTP_USER,
    });

    // Log as a note on the lead so it shows up in the conversation history.
    if (lead) {
      const attachSummary = attachments.length
        ? `\n\nAttachments: ${attachments.map((a) => a.filename).join(', ')}`
        : '';
      await prisma.note.create({
        data: {
          leadId: lead.id,
          authorId: req.user.id,
          body: `📧 Email sent to ${recipient}\nSubject: ${data.subject}\n\n${data.body}${attachSummary}`,
        },
      });
    }

    res.json({ ok: true, messageId: result.messageId, accepted: result.accepted });
  })
);

module.exports = router;
