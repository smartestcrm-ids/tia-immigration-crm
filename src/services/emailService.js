// Simple SMTP email sender. Uses nodemailer with a single global SMTP account
// (typically the office's main Gmail with an app password). Configure via env:
//
//   SMTP_HOST=smtp.gmail.com
//   SMTP_PORT=465
//   SMTP_USER=tiaimmigration@gmail.com
//   SMTP_PASS=<16-char Gmail app password>
//   SMTP_FROM_NAME="Tia Immigration"
//
// Per-account-per-user sending is a future enhancement.

const nodemailer = require('nodemailer');

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT) || 465;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    throw new Error('SMTP not configured (need SMTP_HOST, SMTP_USER, SMTP_PASS).');
  }
  cachedTransporter = nodemailer.createTransport({
    host, port,
    secure: port === 465,
    auth: { user, pass },
  });
  return cachedTransporter;
}

function isConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

/**
 * Send an email.
 * @param {object} opts
 * @param {string} opts.to  Recipient email
 * @param {string} opts.subject
 * @param {string} opts.text  Plain text body
 * @param {string} [opts.html]  Optional HTML body
 * @param {Array<{filename:string, content:string, encoding?:string, contentType?:string}>} [opts.attachments]
 * @param {string} [opts.replyTo]
 * @returns {Promise<{messageId:string, accepted:string[]}>}
 */
async function sendEmail({ to, subject, text, html, attachments, replyTo }) {
  const transporter = getTransporter();
  const fromName = process.env.SMTP_FROM_NAME || 'Tia Immigration';
  const fromAddr = process.env.SMTP_USER;
  const info = await transporter.sendMail({
    from: `"${fromName}" <${fromAddr}>`,
    to,
    subject,
    text,
    html,
    attachments,
    replyTo,
  });
  return { messageId: info.messageId, accepted: info.accepted };
}

module.exports = { sendEmail, isConfigured };
