/**
 * Backfill personnel.supervisor_id from the existing free-text
 * personnel.supervisor column.
 *
 * Resolution order per row:
 *   1. Explicit confirmed alias (spelling mismatches the business owner
 *      manually confirmed 2026-08-14 — see ALIASES below).
 *   2. Exact case-insensitive full_name match against ACTIVE personnel.
 *      Skipped (left NULL) if zero or 2+ active personnel share that name
 *      (ambiguous — never guessed).
 *   3. Explicit blocklist (FRANCOIS_PRETORIUS_TEXT) — always stays
 *      unresolved even if a future data change would otherwise make it
 *      match, because two distinct real Pretorius employees exist
 *      (WEC080 Michael Francios, WEC076 Micheal Francios) and the intended
 *      supervisor was never confirmed.
 *   4. No supervisor text at all, or self-referencing -> NULL, flagged.
 *
 * Excluded (2026-08-17): known duplicate/obsolete/manual-review personnel
 * records never receive supervisor_id, even if technically resolvable —
 * the goal is populating canonical/current records, not improving records
 * we already intend to retire or merge. See EXCLUDED_IDS below. This
 * applies fail-closed: an excluded id is skipped before resolution runs.
 *
 * Prerequisite: run add_personnel_supervisor_id.sql first (adds the
 * nullable supervisor_id column). This script only reads/prints by
 * default — nothing is written to Supabase unless you pass --apply.
 *
 * Usage:
 *   node database/fix_supervisor_id.js            # dry run
 *   node database/fix_supervisor_id.js --apply     # write changes
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('\nMissing env vars. Check backend/.env\n');
    process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Confirmed 2026-08-14: free-text supervisor spelling -> the actual
// personnel.full_name it refers to. Only applied when the free-text does
// NOT already exact-match an active personnel full_name.
const ALIASES = new Map([
    ['riaan du plooy', 'adriaan du plooy'],
    ['eddie pieterse snr', 'edward snr pieterse'],
    ['edward pieterse jnr', 'eddie jnr pieterse'],
]);

// Never auto-resolved, even if a future data change makes it ambiguously
// matchable — the intended supervisor among the two real Pretorius
// employees (WEC080, WEC076) was never confirmed.
const FRANCOIS_PRETORIUS_TEXT = 'francois pretorius';

// Known duplicate/obsolete/manual-review personnel ids — fails closed,
// never written to, regardless of whether their supervisor text would
// otherwise resolve. Cross-referenced against merge_duplicate_personnel.js
// PAIRS and repo memory manual-review notes (2026-08-17):
const EXCLUDED_IDS = new Set([
    10,  // Antonio Ehrke — duplicate of canonical id141 (merge_duplicate_personnel.js)
    17,  // Collett Pyper — duplicate of canonical id142 (merge_duplicate_personnel.js)
    144, // David Lipange — duplicate of canonical id268, MANUAL_REVIEW pair
    130, // Lorraine Mokgethi (dup) — duplicate of canonical id61
    143, // David Lipange (WEC081 email, confirmed bad data) — stale/bad-data record, not part of any merge
    116, // RS-1001 — unresolved identity re: Lea Bodenstein WC316, flagged MISSING/INCORRECT PERSONNEL PROFILE
]);

function norm(name) {
    return (name || '').trim().toLowerCase();
}

async function run() {
    const { data: personnel, error } = await supabase
        .from('personnel')
        .select('id, employee_id, full_name, supervisor, is_active');
    if (error) { console.error('Fetch failed:', error.message); process.exit(1); }

    // Map of exact-match candidates, active personnel only, excluding known
    // duplicate/manual-review ids so they can never be resolved AS a
    // supervisor either.
    const byActiveName = new Map();
    for (const p of personnel) {
        if (!p.is_active) continue;
        if (EXCLUDED_IDS.has(p.id)) continue;
        const key = norm(p.full_name);
        if (!byActiveName.has(key)) byActiveName.set(key, []);
        byActiveName.get(key).push(p);
    }

    const resolved = [];
    const unresolved = { noSupervisorText: [], ambiguous: [], blocklisted: [], noMatch: [], selfReference: [], excluded: [] };

    for (const p of personnel) {
        if (EXCLUDED_IDS.has(p.id)) { unresolved.excluded.push(p); continue; }
        const rawText = norm(p.supervisor);
        if (!rawText) { unresolved.noSupervisorText.push(p); continue; }
        if (rawText === FRANCOIS_PRETORIUS_TEXT) { unresolved.blocklisted.push(p); continue; }

        const lookupKey = ALIASES.get(rawText) || rawText;
        const candidates = byActiveName.get(lookupKey) || [];

        if (candidates.length === 0) { unresolved.noMatch.push(p); continue; }
        if (candidates.length > 1) { unresolved.ambiguous.push({ p, candidates }); continue; }

        const supervisor = candidates[0];
        if (supervisor.id === p.id) { unresolved.selfReference.push(p); continue; }

        resolved.push({
            id: p.id, employee_id: p.employee_id, full_name: p.full_name,
            supervisor_text: p.supervisor, supervisor_id: supervisor.id,
            supervisor_name: supervisor.full_name, via_alias: ALIASES.has(rawText),
        });
    }

    console.log('\n----------------------------------------------');
    console.log(' Supervisor ID Backfill — WCK Equipment Store');
    console.log('----------------------------------------------');
    console.log(`  Mode                 : ${APPLY ? 'APPLY (writing changes)' : 'DRY RUN (no changes written)'}`);
    console.log(`  Total personnel      : ${personnel.length}`);
    console.log(`  Resolved (safe write): ${resolved.length}`);
    console.log(`    via exact name match : ${resolved.filter((r) => !r.via_alias).length}`);
    console.log(`    via confirmed alias  : ${resolved.filter((r) => r.via_alias).length}`);
    console.log(`  Unresolved (stay NULL):`);
    console.log(`    excluded (duplicate/manual-review) : ${unresolved.excluded.length}`);
    console.log(`    no supervisor text     : ${unresolved.noSupervisorText.length}`);
    console.log(`    blocklisted (Francois)  : ${unresolved.blocklisted.length}`);
    console.log(`    no matching personnel   : ${unresolved.noMatch.length}`);
    console.log(`    ambiguous (2+ matches)  : ${unresolved.ambiguous.length}`);
    console.log(`    self-reference anomaly  : ${unresolved.selfReference.length}`);
    const totalCheck = resolved.length + unresolved.excluded.length + unresolved.noSupervisorText.length + unresolved.blocklisted.length
        + unresolved.noMatch.length + unresolved.ambiguous.length + unresolved.selfReference.length;
    console.log(`  Sum check            : ${totalCheck} (should equal total personnel)\n`);

    if (unresolved.excluded.length) {
        console.log('--- Excluded (known duplicate/obsolete/manual-review — never written to) ---');
        for (const p of unresolved.excluded) console.log(`  [${p.employee_id}] ${p.full_name} (id=${p.id})`);
        console.log('');
    }

    if (unresolved.blocklisted.length) {
        console.log('--- Blocklisted (Francois Pretorius — unresolved by design) ---');
        for (const p of unresolved.blocklisted) console.log(`  [${p.employee_id}] ${p.full_name} (id=${p.id})`);
        console.log('');
    }

    if (unresolved.ambiguous.length) {
        console.log('--- Ambiguous (2+ active personnel share the supervisor name — needs manual resolution) ---');
        for (const { p, candidates } of unresolved.ambiguous) {
            console.log(`  [${p.employee_id}] ${p.full_name} (id=${p.id}) -> "${p.supervisor}" matches: ${candidates.map((c) => `${c.full_name}(id=${c.id})`).join(', ')}`);
        }
        console.log('');
    }

    if (unresolved.selfReference.length) {
        console.log('--- Self-reference anomalies (supervisor text resolves to the same person) ---');
        for (const p of unresolved.selfReference) console.log(`  [${p.employee_id}] ${p.full_name} (id=${p.id}) -> "${p.supervisor}"`);
        console.log('');
    }

    console.log('--- Resolved rows (would receive supervisor_id) ---');
    for (const r of resolved) {
        console.log(`  [${r.employee_id}] ${r.full_name} (id=${r.id}) -> supervisor_id=${r.supervisor_id} "${r.supervisor_name}"${r.via_alias ? ' (via confirmed alias)' : ''}`);
    }

    if (!APPLY) {
        console.log('\nDry run complete. Re-run with --apply to write these changes.\n');
        return;
    }

    console.log('\nApplying changes...');
    let updated = 0;
    const errors = [];
    for (const r of resolved) {
        const { error: updateErr } = await supabase
            .from('personnel').update({ supervisor_id: r.supervisor_id }).eq('id', r.id);
        if (updateErr) errors.push(`${r.full_name} (${r.employee_id}): ${updateErr.message}`);
        else updated++;
    }
    console.log(`  Updated: ${updated}`);
    if (errors.length) {
        console.log(`  Errors: ${errors.length}`);
        errors.forEach((e) => console.log(`    - ${e}`));
    }
    console.log('\nDone.\n');
}

run();
