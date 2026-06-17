const crypto = require('crypto');
const url = require('url');

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+16479177766';

function isConfigured() {
  return Boolean(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN);
}

/**
 * Verify the X-Twilio-Signature header.
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 *
 * In production this prevents spoofed webhooks. In dev with no auth token, we skip.
 */
function verifySignature(req) {
  if (!TWILIO_AUTH_TOKEN) return true; // dev mode: skip
  const signature = req.headers['x-twilio-signature'];
  if (!signature) return false;

  // Twilio signs: full URL + concatenated sorted form params
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const fullUrl = `${proto}://${host}${req.originalUrl || req.url}`;

  const params = req.body || {};
  const sortedKeys = Object.keys(params).sort();
  const data = fullUrl + sortedKeys.map((k) => k + params[k]).join('');

  const expected = crypto
    .createHmac('sha1', TWILIO_AUTH_TOKEN)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * Convert Twilio webhook form fields to our normalized ingest payload.
 */
function toIngestPayload(body) {
  // Typical Twilio WhatsApp inbound fields:
  // From: "whatsapp:+14165550199"
  // To: "whatsapp:+14155238886"
  // Body: "Hi, can you help with my work permit?"
  // ProfileName: "Mary Tan"
  // MessageSid: "SMxxxxxxxxxxxxxx"
  const from = body.From || '';
  const phone = from.replace(/^whatsapp:/, '');
  return {
    channel: 'WHATSAPP',
    externalContactId: from, // e.g. "whatsapp:+14165550199"
    externalThreadId: from,
    externalMessageId: body.MessageSid || `wa:${from}:${Date.now()}`,
    from: {
      name: body.ProfileName || phone,
      handle: phone,
      phone,
    },
    body: body.Body || '',
    sentAt: new Date().toISOString(),
  };
}

/**
 * Send an outbound WhatsApp message via Twilio's REST API.
 * `to` should be a "whatsapp:+E164" string (we accept just E164 too and prefix it).
 */
async function sendMessage(to, body) {
  if (!isConfigured()) {
    throw new Error('Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env');
  }
  const dest = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const apiUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const params = new URLSearchParams({
    From: TWILIO_WHATSAPP_FROM,
    To: dest,
    Body: body,
  });

  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(`Twilio error: ${data.message || res.statusText}`);
    err.twilio = data;
    throw err;
  }
  return data;
}

module.exports = {
  isConfigured,
  verifySignature,
  toIngestPayload,
  sendMessage,
};
