/**
 * Regression tests for frontend/netlify/functions/mfa-verify.js's JWT
 * signing helpers (signStagingJwt / signHS256 / signES256).
 *
 * Verifies the minted token's claim set is EXACTLY {personnel_id, role,
 * iss, iat, exp} on both signing paths -- no mutable role/division/
 * permissions claim, no invented `sub`, and the new `iss` claim required
 * by auth_personnel_id()'s fail-closed issuer check.
 *
 * Usage: node database/test_mfa_jwt_claims.js
 */
const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const { signStagingJwt, JWT_ISSUER } = require(path.join(
    '..', '..', 'frontend', 'netlify', 'functions', 'mfa-verify.js'
));

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  PASS: ${name}`);
        passed++;
    } catch (err) {
        console.log(`  FAIL: ${name}`);
        console.log(`        ${err.message}`);
        failed++;
    }
}

function base64urlDecode(segment) {
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

function decodeToken(token) {
    const [headerSeg, payloadSeg] = token.split('.');
    return { header: base64urlDecode(headerSeg), payload: base64urlDecode(payloadSeg) };
}

const ORIGINAL_ENV = { ...process.env };
function resetEnv() {
    delete process.env.SUPABASE_JWT_SIGNING_KEY;
    delete process.env.SUPABASE_JWT_SECRET;
}

console.log('mfa-verify.js JWT claim shape tests');
console.log('====================================');

// ---- HS256 path ----
resetEnv();
process.env.SUPABASE_JWT_SECRET = 'test-secret-not-a-real-key-0123456789';

test('HS256: issues a token with exactly the 5 expected claims', () => {
    const token = signStagingJwt(42);
    const { payload } = decodeToken(token);
    assert.deepStrictEqual(Object.keys(payload).sort(), ['exp', 'iat', 'iss', 'personnel_id', 'role']);
});

test('HS256: role is exactly "authenticated"', () => {
    const { payload } = decodeToken(signStagingJwt(42));
    assert.strictEqual(payload.role, 'authenticated');
});

test('HS256: iss matches the shared JWT_ISSUER constant', () => {
    const { payload } = decodeToken(signStagingJwt(42));
    assert.strictEqual(payload.iss, 'equipment-store-mfa-verify');
    assert.strictEqual(payload.iss, JWT_ISSUER);
});

test('HS256: personnel_id matches the input, no sub claim invented', () => {
    const { payload } = decodeToken(signStagingJwt(42));
    assert.strictEqual(payload.personnel_id, 42);
    assert.strictEqual(payload.sub, undefined);
});

test('HS256: exp is exactly iat + ttl (default 12h)', () => {
    const { payload } = decodeToken(signStagingJwt(42));
    assert.strictEqual(payload.exp - payload.iat, 12 * 60 * 60);
});

test('HS256: no mutable role/division/permissions claim present', () => {
    const { payload } = decodeToken(signStagingJwt(42));
    for (const forbidden of ['app_role', 'division', 'permissions', 'is_admin', 'is_manager']) {
        assert.strictEqual(payload[forbidden], undefined, `unexpected claim: ${forbidden}`);
    }
});

test('HS256: signature verifies against the configured secret', () => {
    const token = signStagingJwt(42);
    const [headerSeg, payloadSeg, sigSeg] = token.split('.');
    const signingInput = `${headerSeg}.${payloadSeg}`;
    const expected = crypto.createHmac('sha256', process.env.SUPABASE_JWT_SECRET).update(signingInput).digest();
    const expectedSeg = expected.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    assert.strictEqual(sigSeg, expectedSeg);
});

// ---- ES256 path ----
resetEnv();
const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const jwk = { ...privateKey.export({ format: 'jwk' }), kid: 'test-kid-001' };
process.env.SUPABASE_JWT_SIGNING_KEY = JSON.stringify(jwk);

test('ES256: preferred over HS256 when both env vars are set', () => {
    process.env.SUPABASE_JWT_SECRET = 'should-not-be-used';
    const { header } = decodeToken(signStagingJwt(7));
    assert.strictEqual(header.alg, 'ES256');
    delete process.env.SUPABASE_JWT_SECRET;
});

test('ES256: header carries the registered kid', () => {
    const { header } = decodeToken(signStagingJwt(7));
    assert.strictEqual(header.kid, 'test-kid-001');
});

test('ES256: issues a token with exactly the 5 expected claims, iss included', () => {
    const { payload } = decodeToken(signStagingJwt(7));
    assert.deepStrictEqual(Object.keys(payload).sort(), ['exp', 'iat', 'iss', 'personnel_id', 'role']);
    assert.strictEqual(payload.iss, 'equipment-store-mfa-verify');
    assert.strictEqual(payload.role, 'authenticated');
    assert.strictEqual(payload.personnel_id, 7);
});

test('ES256: signature verifies against the public key (raw r||s format)', () => {
    const token = signStagingJwt(7);
    const [headerSeg, payloadSeg, sigSeg] = token.split('.');
    const signingInput = Buffer.from(`${headerSeg}.${payloadSeg}`);
    const sig = Buffer.from(sigSeg.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    const publicKey = crypto.createPublicKey(privateKey);
    const ok = crypto.verify('sha256', signingInput, { key: publicKey, dsaEncoding: 'ieee-p1363' }, sig);
    assert.strictEqual(ok, true);
});

// ---- neither env var set ----
resetEnv();
test('Neither env var set: returns null (byte-identical pre-feature behaviour)', () => {
    assert.strictEqual(signStagingJwt(1), null);
});

process.env = ORIGINAL_ENV;

console.log('====================================');
console.log(`${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
