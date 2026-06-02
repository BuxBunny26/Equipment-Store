const nodemailer = require('nodemailer');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request body' }) };
  }

  const { personnel_id, email } = body;

  if (!personnel_id || !email) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  // Basic email validation — no redirects or external lookups
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid email address' }) };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  // Rate-limit: max 1 new token per 60 seconds per person
  const { data: recent } = await supabase
    .from('mfa_tokens')
    .select('created_at')
    .eq('personnel_id', personnel_id)
    .eq('used', false)
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent) {
    const elapsed = (Date.now() - new Date(recent.created_at).getTime()) / 1000;
    if (elapsed < 60) {
      return {
        statusCode: 429,
        body: JSON.stringify({
          error: `Please wait ${Math.ceil(60 - elapsed)} seconds before requesting a new code`,
        }),
      };
    }
  }

  // Generate cryptographically secure 6-digit OTP
  const otp = String(crypto.randomInt(100000, 1000000));
  const tokenHash = crypto.createHash('sha256').update(otp).digest('hex');
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Delete any previous tokens for this person
  await supabase.from('mfa_tokens').delete().eq('personnel_id', personnel_id);

  // Insert new token
  const { error: insertError } = await supabase.from('mfa_tokens').insert({
    personnel_id,
    token_hash: tokenHash,
    expires_at: expiresAt,
    used: false,
  });

  if (insertError) {
    console.error('Token insert error:', insertError.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to generate verification code' }) };
  }

  // Send email via Office 365 SMTP
  const transporter = nodemailer.createTransport({
    host: 'smtp.office365.com',
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  });

  const emailHtml = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#f8f9fa;border-radius:8px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h2 style="color:#1a237e;margin:0;">WCK Equipment Store</h2>
        <p style="color:#546e7a;margin-top:8px;">Your login verification code</p>
      </div>
      <div style="background:#ffffff;border-radius:8px;padding:32px;text-align:center;border:1px solid #e0e0e0;">
        <div style="font-size:44px;font-weight:700;letter-spacing:14px;color:#1a237e;font-family:monospace;">${otp}</div>
        <p style="color:#546e7a;margin-top:16px;font-size:14px;">
          This code expires in <strong>10 minutes</strong>.<br/>Enter it in the Equipment Store to complete your login.
        </p>
      </div>
      <p style="color:#90a4ae;font-size:12px;text-align:center;margin-top:24px;">
        If you did not request this code, you can safely ignore this email.
      </p>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"WCK Equipment Store" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Your Equipment Store Login Code',
      html: emailHtml,
    });
  } catch (emailError) {
    console.error('Email send error:', emailError.message, emailError.code, emailError.response);
    await supabase.from('mfa_tokens').delete().eq('personnel_id', personnel_id);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: `Failed to send verification email: ${emailError.message}` }),
    };
  }

  // Mask email for display (e.g. na***@wearcheckrs.com)
  const atIdx = email.indexOf('@');
  const local = email.slice(0, atIdx);
  const maskedEmail = local.slice(0, Math.min(2, local.length)) + '***' + email.slice(atIdx);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, masked_email: maskedEmail }),
  };
};
