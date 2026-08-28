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

  const { personnel_id, token } = body;

  if (!personnel_id || !token) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  // Validate format before hitting the database
  if (!/^\d{6}$/.test(token)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Code must be 6 digits' }) };
  }

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const { data: stored, error } = await supabase
    .from('mfa_tokens')
    .select('id, expires_at, used')
    .eq('personnel_id', personnel_id)
    .eq('token_hash', tokenHash)
    .eq('used', false)
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error || !stored) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid or expired verification code' }),
    };
  }

  // Mark as used so it cannot be replayed
  await supabase.from('mfa_tokens').update({ used: true }).eq('id', stored.id);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true }),
  };
};
