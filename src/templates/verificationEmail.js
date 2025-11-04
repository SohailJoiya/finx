// src/templates/verificationEmail.js
const brand = process.env.BRAND_NAME || 'Flare Auto Earning'
const frontend = process.env.FRONTEND_URL || 'https://flareautoearn.com'

module.exports = function verificationEmail({name, url}) {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden">
    <div style="background:#111827;color:#fff;padding:20px 24px">
      <h1 style="margin:0;font-size:20px">${brand}</h1>
    </div>
    <div style="padding:24px">
      <p style="font-size:16px;margin:0 0 12px">Hi ${name || 'there'},</p>
      <p style="margin:0 0 16px">Thanks for signing up! Please verify your email address to activate your account.</p>
      <p style="margin:0 0 24px">
        <a href="${url}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block">Verify Email</a>
      </p>
      <p style="color:#6b7280;font-size:12px">If the button doesn't work, paste this link in your browser:<br><span>${url}</span></p>
    </div>
    <div style="background:#f9fafb;color:#6b7280;padding:16px 24px;font-size:12px">
      <p style="margin:0">This link expires in 24 hours.</p>
    </div>
  </div>
  `
}
