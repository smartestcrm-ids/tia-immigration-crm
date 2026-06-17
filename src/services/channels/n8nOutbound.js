/**
 * n8n outbound adapter.
 *
 * When a user replies in the app, the reply is POSTed to an n8n workflow
 * (a Webhook-trigger workflow). n8n then delivers it to the real platform
 * — Telegram via the Telegram node, Email via the Gmail/SMTP node, etc.
 *
 * The app therefore holds NO platform credentials for these channels; all
 * the connections live inside n8n.
 *
 * Configure N8N_OUTBOUND_WEBHOOK_URL in phase1/.env.
 */

function webhookUrl() {
  return process.env.N8N_OUTBOUND_WEBHOOK_URL || '';
}

function isConfigured() {
  return Boolean(webhookUrl());
}

/**
 * POST an outbound message to the n8n webhook.
 * payload: { channel, conversationId, to, body, leadName?, leadEmail?,
 *            channelAccount?, externalThreadId? }
 */
async function send(payload) {
  if (!isConfigured()) {
    throw new Error(
      'n8n outbound webhook not configured. Set N8N_OUTBOUND_WEBHOOK_URL in .env'
    );
  }
  const res = await fetch(webhookUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`n8n webhook returned ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json().catch(() => ({}));
}

module.exports = { isConfigured, send };
