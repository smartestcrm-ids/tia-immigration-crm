const prisma = require('../db');
const { CHANNELS } = require('../constants');

/**
 * Resolve the ChannelAccount this message arrived on, so the conversation can
 * be tagged to the right inbox/number (e.g. "Canada WhatsApp" vs "Dubai line").
 * `identifier` is the account's identifier string (bot @handle, inbox email,
 * WhatsApp number, etc.) Add accounts on the Channel Accounts admin page.
 */
async function resolveChannelAccountId(channel, identifier) {
  if (!identifier) return null;
  const acct = await prisma.channelAccount.findUnique({
    where: { uniq_channel_identifier: { channel, identifier } },
  });
  return acct ? acct.id : null;
}

/**
 * Ingest a normalized inbound message from any channel (posted by n8n to
 * /api/ingest, or by the website form). Auto-creates a Lead and Conversation
 * if needed. Idempotent on externalMessageId.
 *
 * payload: {
 *   channel, externalContactId, externalThreadId?, externalMessageId?,
 *   channelAccount?,                       // identifier of the receiving account
 *   from: { name, handle, email?, phone? },
 *   body, sentAt?
 * }
 */
async function ingestInbound(payload) {
  if (!CHANNELS.includes(payload.channel)) {
    const err = new Error(`Unknown channel: ${payload.channel}`);
    err.status = 400;
    throw err;
  }
  if (!payload.body || !payload.from || !payload.externalContactId) {
    const err = new Error('Missing required fields: channel, externalContactId, from, body');
    err.status = 400;
    throw err;
  }

  // Idempotency: if we already saved this message, return early.
  if (payload.externalMessageId) {
    const existing = await prisma.message.findUnique({
      where: { externalMessageId: payload.externalMessageId },
      include: { conversation: { include: { lead: true } } },
    });
    if (existing) return { duplicate: true, message: existing };
  }

  // Which of our accounts received this message (for multi-number/inbox setups).
  const channelAccountId = await resolveChannelAccountId(
    payload.channel,
    payload.channelAccount
  );

  // Find or create Lead by (channel, externalContactId).
  let lead = await prisma.lead.findUnique({
    where: {
      uniq_lead_per_channel_contact: {
        source: payload.channel,
        externalContactId: payload.externalContactId,
      },
    },
  });

  if (!lead) {
    // Round-robin assign to the consultant with the fewest open leads.
    const consultant = await pickConsultant();
    lead = await prisma.lead.create({
      data: {
        fullName: payload.from.name || payload.from.handle || 'Unknown contact',
        email: payload.from.email || null,
        phone: payload.from.phone || null,
        source: payload.channel,
        status: 'NEW',
        externalContactId: payload.externalContactId,
        assignedToId: consultant ? consultant.id : null,
      },
    });
  }

  // Find or create Conversation for this lead/channel.
  let conversation = await prisma.conversation.findFirst({
    where: {
      leadId: lead.id,
      channel: payload.channel,
      externalThreadId: payload.externalThreadId || null,
    },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        leadId: lead.id,
        channel: payload.channel,
        externalThreadId: payload.externalThreadId || null,
        channelAccountId,
      },
    });
  } else if (channelAccountId && !conversation.channelAccountId) {
    // Backfill the account tag on an older conversation if we now know it.
    conversation = await prisma.conversation.update({
      where: { id: conversation.id },
      data: { channelAccountId },
    });
  }

  const sentAt = payload.sentAt ? new Date(payload.sentAt) : new Date();

  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: 'IN',
      channel: payload.channel,
      body: payload.body,
      externalMessageId: payload.externalMessageId || null,
      status: 'RECEIVED',
      sentAt,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: sentAt, unreadCount: { increment: 1 } },
  });

  return { duplicate: false, message, lead, conversation };
}

async function pickConsultant() {
  // Pick the active consultant with the fewest non-closed leads.
  const consultants = await prisma.user.findMany({
    where: { role: 'CONSULTANT', active: true },
  });
  if (consultants.length === 0) return null;
  let best = null;
  let bestCount = Infinity;
  for (const c of consultants) {
    const count = await prisma.lead.count({
      where: { assignedToId: c.id, status: { notIn: ['CLOSED', 'CONVERTED'] } },
    });
    if (count < bestCount) {
      best = c;
      bestCount = count;
    }
  }
  return best;
}

/** Record a message that failed to send, so it still shows in the conversation. */
async function recordFailedMessage(conversation, body) {
  return prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: 'OUT',
      channel: conversation.channel,
      body,
      status: 'FAILED',
      sentAt: new Date(),
    },
  });
}

/** The recipient address/id to send a reply to, per channel. */
function recipientFor(conversation) {
  if (conversation.channel === 'EMAIL') {
    return (conversation.lead && conversation.lead.email) || conversation.externalThreadId;
  }
  if (conversation.channel === 'WHATSAPP') {
    return (conversation.lead && conversation.lead.phone) || conversation.externalThreadId;
  }
  return conversation.externalThreadId;
}

/**
 * Send an outbound message.
 *   WhatsApp / Telegram / Email -> handed to an n8n workflow when n8n is
 *      configured (N8N_OUTBOUND_WEBHOOK_URL set); n8n delivers it to the
 *      real platform.
 *   WhatsApp fallback           -> if n8n is NOT configured, sent via Twilio.
 *   Anything else               -> recorded locally as a mock.
 */
async function sendOutbound(conversationId, body, { authorId } = {}) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: Number(conversationId) },
    include: { lead: true, channelAccount: true },
  });
  if (!conversation) {
    const err = new Error('Conversation not found');
    err.status = 404;
    throw err;
  }

  let status = 'SENT';
  let externalMessageId = null;

  const n8n = require('./channels/n8nOutbound');
  const N8N_CHANNELS = ['WHATSAPP', 'TELEGRAM', 'EMAIL'];

  if (N8N_CHANNELS.includes(conversation.channel) && n8n.isConfigured()) {
    // --- Preferred path: deliver via an n8n workflow. ---
    try {
      await n8n.send({
        channel: conversation.channel,
        conversationId: conversation.id,
        to: recipientFor(conversation),
        externalThreadId: conversation.externalThreadId,
        leadName: conversation.lead ? conversation.lead.fullName : null,
        leadEmail: conversation.lead ? conversation.lead.email : null,
        leadPhone: conversation.lead ? conversation.lead.phone : null,
        channelAccount: conversation.channelAccount
          ? conversation.channelAccount.identifier
          : null,
        body,
      });
    } catch (e) {
      const message = await recordFailedMessage(conversation, body);
      const err = new Error(`n8n send failed: ${e.message}`);
      err.status = 502;
      err.message_id = message.id;
      throw err;
    }
  } else if (conversation.channel === 'WHATSAPP') {
    // --- Fallback: WhatsApp via Twilio when n8n is not configured. ---
    const twilio = require('./channels/twilioWhatsApp');
    if (twilio.isConfigured() && conversation.externalThreadId) {
      try {
        const twilioMsg = await twilio.sendMessage(conversation.externalThreadId, body);
        externalMessageId = twilioMsg.sid || null;
      } catch (e) {
        const message = await recordFailedMessage(conversation, body);
        const err = new Error(`WhatsApp send failed: ${e.message}`);
        err.status = 502;
        err.message_id = message.id;
        throw err;
      }
    }
  }
  // (Telegram/Email with no n8n configured fall through as a local mock.)

  const sentAt = new Date();
  const message = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: 'OUT',
      channel: conversation.channel,
      body,
      status,
      externalMessageId,
      sentAt,
    },
  });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: sentAt },
  });

  // First reply auto-advances NEW -> CONTACTED.
  if (conversation.lead && conversation.lead.status === 'NEW') {
    await prisma.lead.update({
      where: { id: conversation.lead.id },
      data: { status: 'CONTACTED' },
    });
  }

  return message;
}

module.exports = { ingestInbound, sendOutbound };
