const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Staging-only trusted identity token (see rls_afs_design_PROPOSAL.sql).
//
// IMPORTANT: the payload carries ONLY the stable application identity
// (personnel_id) plus the standard PostgREST/Postgres role claim. It
// intentionally does NOT carry mutable authorisation state (application
// role, division, permissions) — those must always be resolved live from
// the database by RLS helper functions, never trusted from a token that
// could outlive a permission change made mid-session.
//
// Two signing paths, no new npm dependency (Node's built-in `crypto`
// covers both HMAC and ECDSA signing):
//
//   1. ES256 (asymmetric, PREFERRED for production) — used when
//      SUPABASE_JWT_SIGNING_KEY is set to the JSON of a private key you
//      generated with `supabase gen signing-key --algorithm ES256` and
//      imported as a standby key via Settings > JWT in the Supabase
//      dashboard (2026-08-17 confirmed: this project's
//      /auth/v1/.well-known/jwks.json already advertises an ES256 P-256
//      key, so the project is already on the Signing Keys system, not
//      legacy-secret-only). The private key never leaves this server-side
//      function; only the short-lived signed token reaches the browser.
//   2. HS256 (legacy shared secret, NOT production-approved) — used only
//      when SUPABASE_JWT_SIGNING_KEY is absent but SUPABASE_JWT_SECRET is
//      set. Kept purely as a fallback for local/manual testing against the
//      legacy secret; Supabase's own docs mark HS256 "not recommended for
//      production applications" (revocation requires redeploying every
//      verifier, no independent key rotation). Do not enable this in a
//      real deployment — prefer path 1.
//
// If NEITHER env var is set (true in every environment today), no token
// field is added and the response is byte-for-byte identical to before
// this feature existed — zero production behaviour change.
//
// `iss` identifies this function as the token's origin so auth_personnel_id()
// can reject any token that isn't ours, even if it were otherwise validly
// signed by a key PostgREST trusts for some unrelated purpose.
const JWT_ISSUER = 'equipment-store-mfa-verify';

function base64url(buffer) {
    return buffer.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function signHS256(personnelId, secret, ttlSeconds) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = { personnel_id: personnelId, role: 'authenticated', iss: JWT_ISSUER, iat: nowSeconds, exp: nowSeconds + ttlSeconds };
    const signingInput = `${base64url(Buffer.from(JSON.stringify(header)))}.${base64url(Buffer.from(JSON.stringify(payload)))}`;
    const signature = crypto.createHmac('sha256', secret).update(signingInput).digest();
    return `${signingInput}.${base64url(signature)}`;
}

function signES256(personnelId, signingKeyJson, ttlSeconds) {
    // signingKeyJson is the JWK exported by `supabase gen signing-key`, e.g.
    // { kty: 'EC', kid: '...', d: '...', crv: 'P-256', x: '...', y: '...' }.
    const jwk = JSON.parse(signingKeyJson);
    const privateKey = crypto.createPrivateKey({ key: jwk, format: 'jwk' });
    const nowSeconds = Math.floor(Date.now() / 1000);
    // kid in the header must match the key id registered in the Supabase
    // dashboard so PostgREST knows which public key to verify against.
    const header = { alg: 'ES256', kid: jwk.kid, typ: 'JWT' };
    const payload = { personnel_id: personnelId, role: 'authenticated', iss: JWT_ISSUER, iat: nowSeconds, exp: nowSeconds + ttlSeconds };
    const signingInput = `${base64url(Buffer.from(JSON.stringify(header)))}.${base64url(Buffer.from(JSON.stringify(payload)))}`;
    // JOSE requires the raw (r||s) signature format, not the DER encoding
    // Node produces by default — dsaEncoding: 'ieee-p1363' gives raw format.
    const signature = crypto.sign('sha256', Buffer.from(signingInput), { key: privateKey, dsaEncoding: 'ieee-p1363' });
    return `${signingInput}.${base64url(signature)}`;
}

function signStagingJwt(personnelId, ttlSeconds = 12 * 60 * 60) {
    if (process.env.SUPABASE_JWT_SIGNING_KEY) return signES256(personnelId, process.env.SUPABASE_JWT_SIGNING_KEY, ttlSeconds);
    if (process.env.SUPABASE_JWT_SECRET) return signHS256(personnelId, process.env.SUPABASE_JWT_SECRET, ttlSeconds);
    return null;
}

// Exported for the JWT-claim-shape regression test only — Netlify only ever
// invokes exports.handler below; these extra names are inert in production.
module.exports.signStagingJwt = signStagingJwt;
module.exports.JWT_ISSUER = JWT_ISSUER;

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

  // Staging-only: only issue a token once SUPABASE_JWT_SIGNING_KEY (preferred,
  // ES256) or SUPABASE_JWT_SECRET (legacy fallback, HS256) is explicitly
  // configured in Netlify env vars (neither set today). Until then, the
  // response shape is byte-for-byte identical to before this feature
  // existed — zero production behaviour change.
  const responseBody = { success: true };
  const signedToken = signStagingJwt(personnel_id);
  if (signedToken) responseBody.token = signedToken;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(responseBody),
  };
};
