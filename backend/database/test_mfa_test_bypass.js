/**
 * Unit tests for mfa_test_bypass.js (allowlist parsing only — see that
 * file for the full security model). Pure logic, no Supabase/network.
 * Usage: node database/test_mfa_test_bypass.js
 */
const assert = require('assert');
const { parseTestBypassPersonnelIds, isTestBypassPersonnel, isBypassFeatureEnabled } = require('./mfa_test_bypass');

let passed = 0;
function test(name, fn) {
    try {
        fn();
        console.log(`  PASS: ${name}`);
        passed++;
    } catch (err) {
        console.log(`  FAIL: ${name}`);
        console.log(`        ${err.message}`);
        process.exitCode = 1;
    }
}

console.log('\nmfa_test_bypass tests\n');

test('parses a clean comma-separated list', () => {
    assert.deepStrictEqual(parseTestBypassPersonnelIds('501,502'), [501, 502]);
});

test('trims whitespace around entries', () => {
    assert.deepStrictEqual(parseTestBypassPersonnelIds(' 501 , 502 '), [501, 502]);
});

test('de-dupes repeated ids', () => {
    assert.deepStrictEqual(parseTestBypassPersonnelIds('501,501,502'), [501, 502]);
});

// --- E: missing env var -> no bypass ---
test('undefined env value returns null (fail closed)', () => {
    assert.strictEqual(parseTestBypassPersonnelIds(undefined), null);
});

test('empty string env value returns null (fail closed)', () => {
    assert.strictEqual(parseTestBypassPersonnelIds(''), null);
    assert.strictEqual(parseTestBypassPersonnelIds('   '), null);
});

// --- F: malformed/unrecognised id -> no bypass at all (whole list rejected) ---
test('a single malformed entry rejects the entire list, not just that entry', () => {
    assert.strictEqual(parseTestBypassPersonnelIds('501,abc'), null);
    assert.strictEqual(parseTestBypassPersonnelIds('501,,502'), null); // stray empty entry
    assert.strictEqual(parseTestBypassPersonnelIds('501, 502.5'), null); // non-integer
    assert.strictEqual(parseTestBypassPersonnelIds('-501'), null); // negative
    assert.strictEqual(parseTestBypassPersonnelIds('0'), null); // not a valid personnel id
});

test('a name, email, role, or division string is never treated as an id', () => {
    assert.strictEqual(parseTestBypassPersonnelIds('AFS Test Employee'), null);
    assert.strictEqual(parseTestBypassPersonnelIds('afs-test@equipmentstore.invalid'), null);
    assert.strictEqual(parseTestBypassPersonnelIds('manager'), null);
    assert.strictEqual(parseTestBypassPersonnelIds('AFS'), null);
});

// --- A/B: allowlisted test accounts bypass ---
test('an allowlisted personnel id is recognised', () => {
    assert.strictEqual(isTestBypassPersonnel(501, '501,502'), true);
    assert.strictEqual(isTestBypassPersonnel(502, '501,502'), true);
});

// --- C/D: a real employee/manager id not on the list never bypasses ---
test('a personnel id not on the list never bypasses', () => {
    assert.strictEqual(isTestBypassPersonnel(44, '501,502'), false); // e.g. Jaco Venter's real id
});

// --- E again, from the isTestBypassPersonnel entry point ---
test('missing env var means nobody bypasses, even a real allowlist-looking id', () => {
    assert.strictEqual(isTestBypassPersonnel(501, undefined), false);
    assert.strictEqual(isTestBypassPersonnel(501, ''), false);
});

// --- F again, from the isTestBypassPersonnel entry point ---
test('a malformed env var means nobody bypasses, even the intended test id', () => {
    assert.strictEqual(isTestBypassPersonnel(501, '501,abc'), false);
});

// --- G: browser/client manipulation cannot make a real account qualify ---
test('a client-supplied personnel_id can only ever match the exact allowlisted value, never a different real account', () => {
    assert.strictEqual(isTestBypassPersonnel('501', '501,502'), true); // numeric string is fine (JSON bodies)
    assert.strictEqual(isTestBypassPersonnel('501x', '501,502'), false); // non-numeric junk never coerces
    assert.strictEqual(isTestBypassPersonnel(null, '501,502'), false);
    assert.strictEqual(isTestBypassPersonnel(undefined, '501,502'), false);
    assert.strictEqual(isTestBypassPersonnel({}, '501,502'), false); // object type rejected outright, not coerced
    assert.strictEqual(isTestBypassPersonnel([501], '501,502'), false); // array type rejected outright, not coerced
    // Real accounts (e.g. Jaco Venter id 44, Roger Henwood id 94) can never
    // be made to match no matter what shape/format personnel_id takes —
    // there is no string transformation of 44 or 94 that equals 501/502.
    assert.strictEqual(isTestBypassPersonnel(44, '501,502'), false);
    assert.strictEqual(isTestBypassPersonnel('44', '501,502'), false);
});

// --- E/F for the feature flag itself: missing/wrong value means disabled ---
test('isBypassFeatureEnabled requires the exact string "true"', () => {
    assert.strictEqual(isBypassFeatureEnabled('true'), true);
    assert.strictEqual(isBypassFeatureEnabled(undefined), false);
    assert.strictEqual(isBypassFeatureEnabled(''), false);
    assert.strictEqual(isBypassFeatureEnabled('True'), false); // case-sensitive, no fuzzy truthy coercion
    assert.strictEqual(isBypassFeatureEnabled('1'), false);
    assert.strictEqual(isBypassFeatureEnabled(true), false); // must be the env-var string, not a JS boolean
});

console.log(`\n${passed} test(s) passed.\n`);
