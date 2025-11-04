// src/services/emailService.js
const nodemailer = require('nodemailer')

function createTransport() {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_SECURE,
    SMTP_USER,
    SMTP_PASS,
    SMTP_FROM
  } = process.env

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    console.warn('[emailService] Missing SMTP_* env. Emails will be skipped.')
    return null
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 587),
    secure: String(SMTP_SECURE || 'false') === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  })

  return { transporter, from: SMTP_FROM || SMTP_USER }
}

async function sendEmail({ to, subject, html, text }) {
  const setup = createTransport()
  if (!setup) return { skipped: true, reason: 'Missing SMTP env' }

  const { transporter, from } = setup
  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text
  })
  return info
}

module.exports = { sendEmail }
