// src/templates/resetPasswordEmail.js
const brand = process.env.BRAND_NAME || 'Flare Auto Earning'

module.exports = function resetPasswordEmail({name, otp}) {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #eee;border-radius:12px;overflow:hidden">
    <div style="background:#111827;color:#fff;padding:20px 24px">
      <h1 style="margin:0;font-size:20px">${brand}</h1>
    </div>
    <div style="padding:24px">
      <p style="font-size:16px;margin:0 0 12px">Hi ${name || 'there'},</p>
      <p style="margin:0 0 16px">Use the OTP below to reset your password:</p>
      <p style="font-size:28px;letter-spacing:4px;margin:0 0 16px"><strong>${otp}</strong></p>
      <p style="color:#6b7280;font-size:12px">This OTP will expire in 10 minutes.</p>
    </div>
    <div style="background:#f9fafb;color:#6b7280;padding:16px 24px;font-size:12px">
      <p style="margin:0">If you didn’t request this, ignore this email.</p>
    </div>
  </div>
  `
}
