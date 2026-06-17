const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const ingestService = require('../services/messageIngestService');
const twilio = require('../services/channels/twilioWhatsApp');

const router = express.Router();

/**
 * Twilio WhatsApp inbound webhook.
 * Twilio posts as application/x-www-form-urlencoded, so we mount express.urlencoded() here.
 *
 * Configure in Twilio Console > Messaging > WhatsApp Sandbox:
 *   "WHEN A MESSAGE COMES IN" -> https://YOUR_PUBLIC_HOST/api/webhooks/whatsapp/twilio
 *
 * Twilio expects a TwiML XML response (or empty 200).
 */
router.post(
  '/whatsapp/twilio',
  express.urlencoded({ extended: false }),
  asyncHandler(async (req, res) => {
    if (!twilio.verifySignature(req)) {
      return res.status(403).type('text/plain').send('Invalid Twilio signature');
    }
    const payload = twilio.toIngestPayload(req.body);
    if (!payload.body) {
      return res.status(200).type('text/xml').send('<Response/>');
    }
    await ingestService.ingestInbound(payload);
    // Respond with empty TwiML so Twilio doesn't auto-reply.
    res.type('text/xml').status(200).send('<Response/>');
  })
);

module.exports = router;
