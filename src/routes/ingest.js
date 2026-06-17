const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const ingestService = require('../services/messageIngestService');

const router = express.Router();

/**
 * Shared-secret guard for the ingest endpoint.
 *
 * When INGEST_API_KEY is set in .env, every caller (n8n) must send the same
 * value in the "x-ingest-key" header. If the key is not set, posting is left
 * open and a warning is logged — fine for local dev, NOT for production.
 */
function requireIngestKey(req, res, next) {
  const expected = process.env.INGEST_API_KEY;
  if (!expected) {
    console.warn('[ingest] INGEST_API_KEY is not set - /api/ingest is OPEN. Set it in .env.');
    return next();
  }
  const provided = req.headers['x-ingest-key'];
  if (provided !== expected) {
    return res.status(401).json({ error: 'Invalid or missing x-ingest-key header' });
  }
  return next();
}

/**
 * Generic inbound webhook. n8n (and any other integration) POSTs a normalized
 * message payload here. See messageIngestService.ingestInbound for the shape.
 *
 * POST /api/ingest
 *   headers: { "x-ingest-key": "<INGEST_API_KEY>" }
 */
router.post(
  '/',
  requireIngestKey,
  asyncHandler(async (req, res) => {
    const result = await ingestService.ingestInbound(req.body);
    res.status(result.duplicate ? 200 : 201).json(result);
  })
);

module.exports = router;
