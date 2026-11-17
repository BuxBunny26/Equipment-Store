/**
 * Merge duplicate personnel records
 *
 * Background: reconciliation against employee - 12.08.2026.csv found several
 * personnel rows that are the same real person duplicated under two ids
 * (same email, different id). This reassigns MUTABLE foreign-key references
 * from the duplicate id onto the canonical id, then deactivates the
 * duplicate (soft delete — never hard-deleted). HISTORICAL/audit references
 * are deliberately left untouched — see FK_TARGETS below for the handling
 * policy per table.
 *
 * FK_TARGETS below is now LIVE-VERIFIED production information — the user
 * ran the information_schema query directly in the Supabase SQL Editor on
 * 2026-08-14 and confirmed these are the only seven FK constraints pointing
 * at personnel.id (constraint names: equipment_current_holder_id_fkey,
 * equipment_movements_personnel_id_fkey, mfa_tokens_personnel_id_fkey,
 * monthly_audit_log_personnel_id_fkey, reservations_personnel_id_fkey,
 * software_assignments_personnel_id_fkey, users_personnel_id_fkey). This is
 * no longer a repository-inferred guess. assertLiveFkListMatches() below
 * fails closed (throws, does nothing) if FK_TARGETS is ever edited to no
 * longer match this live-verified list exactly.
 *
 * Canonical record = whichever of the pair currently has is_active = true,
 * UNLESS a pair specifies an explicit `canonical` id (used when identity was
 * confirmed by the business owner via email/login rather than is_active —
 * see David Lipange below). If both/neither are active and no explicit
 * canonical is given, the pair is skipped and flagged for manual review.
 *
 * David Lipange (confirmed 2026-08-14): canonical = id268 (email
 * davidl@wearcheckrs.com, HAS an active login "david.lipangue") even though
 * id144 is also active — login/email match wins over is_active per business
 * confirmation. id143 (email david@wearcheckrs.com — Dave Viljoen's email,
 * confirmed erroneous) is a separate bad-data record, intentionally NOT
 * included in this pair. This whole pair is marked status: 'MANUAL_REVIEW'
 * below — David Lipange is absent from the current employee CSV, so no
 * merge/deactivation may run for him until that discrepancy is resolved
 * externally, even though the canonical id is confirmed.
 *
 * Excluded on purpose: Dave Viljoen (WEC081, id20) / David Lipange (id143)
 * share an email but are confirmed DIFFERENT people — david@wearcheckrs.com
 * belongs to Dave Viljoen; id143's copy of that email is incorrect data, not
 * evidence of shared identity. Not part of this automated merge.
 *
 * Safety: DRY RUN by default — only prints what would change. Nothing is
 * written to Supabase unless you pass --apply. Pairs marked
 * status: 'MANUAL_REVIEW' are never written even with --apply.
 *
 * Usage:
 *   node database/merge_duplicate_personnel.js            # dry run
 *   node database/merge_duplicate_personnel.js --apply     # write changes
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

// Confirmed duplicate pairs (2026-08-14). ids are personnel.id.
// `canonical` (optional) overrides the is_active auto-detection when
// identity was confirmed via email/login instead.
// `status: 'MANUAL_REVIEW'` marks a pair as inspect-only — the script will
// never write for it, even with --apply, until the status is removed.
//
// Roger Henwood (id94 canonical / id137 duplicate) is REMOVED from this
// list — resolved 2026-08-14 by directly deleting id137 after confirming
// all 7 live FK counts were zero and no active login was linked (not a
// merge, a plain DELETE — see repo memory for the verified pre/post-check).
const PAIRS = [
    { label: 'Antonio Ehrke', a: 10, b: 141 },
    { label: 'Colleen Pyper / Collett Pyper', a: 142, b: 17 },
    { label: 'David Lipange / Lipangue', a: 144, b: 268, canonical: 268, status: 'MANUAL_REVIEW', statusReason: 'David Lipange is absent from the current employee CSV — preserve his active canonical account until that discrepancy is resolved externally.' },
    { label: 'Lorraine Mokgethi', a: 61, b: 130 },
];

// Tables/columns that reference personnel.id, and the explicit handling
// policy for each. A merge is refused (see requireExplicitPolicy) if a
// referencing table shows up that isn't listed here.
//
//   repoint    — mutable/current-state relationship: safe to reassign onto
//                the canonical id automatically under --apply.
//   preserve   — immutable historical/event fact (who did what, when). Left
//                untouched always — repointing would rewrite who the
//                historical record actually referred to at the time.
//   review     — neither clearly mutable nor clearly historical; never
//                auto-repointed. If a duplicate has rows here, deactivation
//                is blocked until a human explicitly resolves them.
const FK_TARGETS = [
    { table: 'users', column: 'personnel_id', handling: 'repoint',
      reason: 'Current login linkage — the login should follow the canonical person.' },
    { table: 'equipment', column: 'current_holder_id', handling: 'repoint',
      reason: 'Current state (who holds it right now) — not a historical fact.' },
    { table: 'reservations', column: 'personnel_id', handling: 'repoint',
      reason: 'Current/future booking — mutable, should follow the canonical person.' },
    { table: 'software_assignments', column: 'personnel_id', handling: 'repoint',
      reason: 'Current assignment state — mutable, should follow the canonical person.' },
    { table: 'mfa_tokens', column: 'personnel_id', handling: 'review',
      reason: 'Ephemeral auth artifact tied to a specific login attempt. Short-lived enough that this should rarely fire, but not auto-repointed — a live token belongs to whichever id the user actually authenticated against.' },
    { table: 'equipment_movements', column: 'personnel_id', handling: 'preserve',
      reason: 'Immutable historical fact — records who actually held/received the equipment at that point in time. Repointing would misrepresent history even if it is the "same human".' },
    { table: 'monthly_audit_log', column: 'personnel_id', handling: 'preserve',
      reason: 'Immutable period-based audit snapshot tied to a specific person-month. Same reasoning as equipment_movements.' },
];

// Live-verified FK list (Supabase SQL Editor, 2026-08-14) — used only to
// fail closed if FK_TARGETS ever drifts out of sync with production.
const LIVE_VERIFIED_FKS = new Set([
    'equipment.current_holder_id',
    'equipment_movements.personnel_id',
    'mfa_tokens.personnel_id',
    'monthly_audit_log.personnel_id',
    'reservations.personnel_id',
    'software_assignments.personnel_id',
    'users.personnel_id',
]);

function assertLiveFkListMatches() {
    const declared = new Set(FK_TARGETS.map((fk) => `${fk.table}.${fk.column}`));
    const missing = [...LIVE_VERIFIED_FKS].filter((k) => !declared.has(k));
    const extra = [...declared].filter((k) => !LIVE_VERIFIED_FKS.has(k));
    if (missing.length || extra.length) {
        throw new Error(
            `FK_TARGETS no longer matches the live-verified FK list — refusing to run.\n` +
            (missing.length ? `  Missing from FK_TARGETS: ${missing.join(', ')}\n` : '') +
            (extra.length ? `  Not in the live-verified list (unknown FK — needs an explicit policy or removal): ${extra.join(', ')}\n` : '')
        );
    }
}

async function run() {
    assertLiveFkListMatches();

    console.log('\n----------------------------------------------');
    console.log(' Duplicate Personnel Merge — WCK Equipment Store');
    console.log('----------------------------------------------');
    console.log(`  Mode: ${APPLY ? 'APPLY (writing changes)' : 'DRY RUN (no changes written)'}\n`);

    for (const pair of PAIRS) {
        const { data: rows, error } = await supabase
            .from('personnel')
            .select('id, full_name, email, is_active')
            .in('id', [pair.a, pair.b]);
        if (error) { console.error(`  [${pair.label}] fetch failed: ${error.message}`); continue; }
        if (rows.length !== 2) {
            console.log(`  [${pair.label}] SKIPPED — expected ids ${pair.a}/${pair.b}, found ${rows.length} row(s).`);
            continue;
        }

        let canonical;
        if (pair.canonical) {
            canonical = rows.find((r) => r.id === pair.canonical);
        } else {
            const active = rows.filter((r) => r.is_active);
            if (active.length !== 1) {
                console.log(`  [${pair.label}] MANUAL REVIEW NEEDED — expected exactly one active row, found ${active.length}. Skipped.`);
                continue;
            }
            canonical = active[0];
        }
        const duplicate = rows.find((r) => r.id !== canonical.id);

        // Fail closed: if BOTH personnel ids have their own active login, this
        // isn't a safe auto-merge — it means two active accounts would
        // collide on one login the moment users.personnel_id is repointed.
        const { data: bothUsers, error: usersErr } = await supabase
            .from('users').select('id, personnel_id, is_active').in('personnel_id', [canonical.id, duplicate.id]);
        if (usersErr) { console.log(`  [${pair.label}] SKIPPED — users lookup failed: ${usersErr.message}`); continue; }
        const activeUserCount = (bothUsers || []).filter((u) => u.is_active).length;
        if (activeUserCount > 1) {
            console.log(`  [${pair.label}] BLOCKED — both canonical and duplicate have an active login (two active users conflict). Requires manual resolution, not an automated merge.`);
            continue;
        }

        console.log(`  [${pair.label}]${pair.status ? `  ** ${pair.status} **` : ''}`);
        if (pair.statusReason) console.log(`      reason: ${pair.statusReason}`);
        console.log(`      canonical: id=${canonical.id} "${canonical.full_name}" (${canonical.email})`);
        console.log(`      duplicate: id=${duplicate.id} "${duplicate.full_name}" (${duplicate.email})`);
        console.log(`      Table                    | FK              | Dup rows | Handling  | Reason`);

        let blockedByReview = false;
        const toRepoint = [];
        for (const fk of FK_TARGETS) {
            const { data: affected, error: countErr } = await supabase
                .from(fk.table)
                .select('id', { count: 'exact', head: false })
                .eq(fk.column, duplicate.id);
            if (countErr) { console.log(`      ${fk.table}.${fk.column}: check failed — ${countErr.message}`); continue; }
            console.log(`      ${fk.table.padEnd(24)} | ${fk.column.padEnd(15)} | ${String(affected.length).padEnd(8)} | ${fk.handling.padEnd(9)} | ${fk.reason}`);

            if (fk.handling === 'repoint' && affected.length > 0) toRepoint.push(fk);
            if (fk.handling === 'review' && affected.length > 0) blockedByReview = true;
        }

        const canWrite = APPLY && !pair.status;
        if (canWrite && blockedByReview) {
            console.log(`      BLOCKED — one or more 'review' tables have rows referencing the duplicate. Resolve manually before merging.`);
        } else if (canWrite) {
            for (const fk of toRepoint) {
                const { error: updateErr } = await supabase
                    .from(fk.table)
                    .update({ [fk.column]: canonical.id })
                    .eq(fk.column, duplicate.id);
                if (updateErr) console.log(`        ERROR reassigning ${fk.table}: ${updateErr.message}`);
                else console.log(`        reassigned ${fk.table}.${fk.column} to canonical id ${canonical.id}`);
            }
            const { error: deactivateErr } = await supabase
                .from('personnel')
                .update({ is_active: false })
                .eq('id', duplicate.id);
            if (deactivateErr) console.log(`      ERROR deactivating duplicate: ${deactivateErr.message}`);
            else console.log(`      duplicate id ${duplicate.id} set is_active = false`);
        } else if (pair.status) {
            console.log(`      NOT WRITTEN — pair is marked ${pair.status}, inspect-only regardless of --apply.`);
        }
        console.log('');
    }

    if (!APPLY) console.log('Dry run complete. Re-run with --apply to write these changes.\n');
    else console.log('Done.\n');
}

run();
