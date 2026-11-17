/**
 * Fix personnel.division / personnel.payment_centre
 *
 * Background: personnel.division has historically held payment_centre-style
 * values (e.g. "GP Consult", "RS") instead of the true AFS/ARC division for
 * ~69% of rows. The CSV `employee - 12.08.2026.csv` is the authoritative
 * source for both fields (columns: division, payment_centre) — EXCEPT where
 * an explicit confirmed override exists below, which always wins.
 *
 * Precedence: explicit override > CSV > existing DB value (existing value is
 * only kept when neither an override nor a CSV row applies).
 *
 * This script is intentionally limited to `division` and `payment_centre`.
 * It never touches `department` or any other column — do not expand its
 * scope without separate approval.
 *
 * Safety: DRY RUN by default — only prints the diff. Nothing is written to
 * Supabase unless you pass --apply.
 *
 * Prerequisite: run database/add_personnel_payment_centre.sql first.
 *
 * Usage:
 *   node database/fix_division_payment_centre.js            # dry run
 *   node database/fix_division_payment_centre.js --apply     # write changes
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('\nMissing env vars. Check backend/.env\n');
    process.exit(1);
}

const CSV_PATH = path.join(__dirname, '..', '..', 'employee - 12.08.2026.csv');
const APPLY = process.argv.includes('--apply');

// ---------------------------------------------------------------------------
// Confirmed manual overrides (2026-08-14). One entry per person, keyed by
// employee_code — every person here IS represented in the source CSV; this
// script stays scoped to CSV-represented employees plus explicit source
// corrections for them, nothing else.
//
// David Lipange is deliberately NOT here: he has no CSV row at all, so
// including him would silently expand this CSV-reconciliation script into
// unrelated application cleanup. His confirmed payment_centre=WearCheck is
// tracked as a separate single-record proposal instead of this file.
// ---------------------------------------------------------------------------
const OVERRIDES = [
    {
        label: 'Johan Stols', employee_code: 'WC508',
        division: 'AFS', payment_centre: 'WearCheck',
        reason: 'CSV row is self-inconsistent (division=ARC, payment_centre=AFS). Confirmed authoritative by business owner 2026-08-14.',
    },
    {
        label: 'Leané Bodenstein', employee_code: 'WEC144',
        division: 'ARC', payment_centre: 'WearCheck',
        reason: 'Confirmed authoritative 2026-08-14. NOTE: conflicts with CSV payment_centre value "GP Consult" — override wins.',
    },
    {
        label: 'Dave Viljoen', employee_code: 'WEC081',
        division: 'ARC', payment_centre: 'GP Consult',
        reason: 'CSV division value (AFS) confirmed incorrect for this person. payment_centre matches CSV already, restated for clarity.',
    },
];

// Lea Bodenstein (WC316) has NO override entry on purpose: no personnel row
// with employee_id WC316 exists today. She must not be silently mapped onto
// RS-1001. See the MISSING PERSONNEL PROFILE report section below instead.

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function normaliseCode(code) {
    return (code || '').replace(/\s+/g, '').toUpperCase();
}

function parseCsv(text) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const headers = lines[0].split(';').map((h) => h.trim());
    return lines.slice(1).map((line) => {
        const cells = line.split(';');
        const row = {};
        headers.forEach((h, i) => { row[h] = (cells[i] || '').trim(); });
        return row;
    });
}

function findOverride(personnelRow) {
    const code = normaliseCode(personnelRow.employee_id);
    return OVERRIDES.find((o) =>
        (o.employee_code && normaliseCode(o.employee_code) === code) ||
        (o.personnel_id && o.personnel_id === personnelRow.id)
    );
}

async function run() {
    const csvText = fs.readFileSync(CSV_PATH, 'utf8');
    const csvRows = parseCsv(csvText);

    const csvByCode = new Map();
    for (const row of csvRows) {
        const code = normaliseCode(row.employee_code);
        if (!code || code === 'N/A') continue; // unmatched rows handled separately, not by code
        csvByCode.set(code, row);
    }

    const { data: personnel, error } = await supabase
        .from('personnel')
        .select('id, employee_id, full_name, division, payment_centre');
    if (error) { console.error('Fetch failed:', error.message); process.exit(1); }

    const changes = [];
    const overrideRows = [];
    const conflicts = [];

    for (const p of personnel) {
        const code = normaliseCode(p.employee_id);
        const csvRow = csvByCode.get(code);
        const override = findOverride(p);

        if (!csvRow && !override) continue; // no source of truth for this row — leave untouched

        const csvDivision = csvRow ? (csvRow.division || null) : null;
        const csvPaymentCentre = csvRow ? (csvRow.payment_centre || null) : null;

        const newDivision = (override && 'division' in override) ? override.division
            : (csvRow ? csvDivision : p.division);
        const newPaymentCentre = (override && 'payment_centre' in override) ? override.payment_centre
            : (csvRow ? csvPaymentCentre : p.payment_centre);

        if (override) {
            const divisionConflict = 'division' in override && csvRow && csvDivision && csvDivision !== override.division;
            const pcConflict = 'payment_centre' in override && csvRow && csvPaymentCentre && csvPaymentCentre !== override.payment_centre;
            if (divisionConflict || pcConflict) {
                conflicts.push({ label: override.label, employee_id: p.employee_id, csv_division: csvDivision, override_division: override.division, csv_payment_centre: csvPaymentCentre, override_payment_centre: override.payment_centre });
            }
            overrideRows.push({
                label: override.label, employee_id: p.employee_id, id: p.id,
                source_division: csvDivision, source_payment_centre: csvPaymentCentre,
                override_division: 'division' in override ? override.division : '(not overridden)',
                override_payment_centre: 'payment_centre' in override ? override.payment_centre : '(not overridden)',
                current_division: p.division, proposed_division: newDivision,
                current_payment_centre: p.payment_centre, proposed_payment_centre: newPaymentCentre,
                reason: override.reason,
            });
        }

        if (newDivision !== p.division || newPaymentCentre !== (p.payment_centre || null)) {
            changes.push({
                id: p.id,
                employee_id: p.employee_id,
                full_name: p.full_name,
                old_division: p.division,
                new_division: newDivision,
                old_payment_centre: p.payment_centre || null,
                new_payment_centre: newPaymentCentre,
                override_used: !!override,
            });
        }
        if (csvRow) csvByCode.delete(code);
    }

    const unmatchedCsvRows = [...csvByCode.keys()];
    const missingPersonnelProfiles = [];
    if (csvByCode.has('WC316')) {
        missingPersonnelProfiles.push('WC316 (Lea Bodenstein) — no personnel row exists. Classified MISSING/INCORRECT PERSONNEL PROFILE. NOT mapped to RS-1001. Excluded from this backfill entirely.');
    }

    console.log('\n----------------------------------------------');
    console.log(' Division / Payment Centre Fix — WCK Equipment Store');
    console.log('----------------------------------------------');
    console.log(`  Mode         : ${APPLY ? 'APPLY (writing changes)' : 'DRY RUN (no changes written)'}`);
    console.log(`  Personnel    : ${personnel.length}`);
    console.log(`  CSV rows     : ${csvRows.length}`);
    console.log(`  Changes found: ${changes.length}\n`);

    console.log('--- Override rows (explicit confirmed corrections) ---');
    for (const o of overrideRows) console.log(JSON.stringify(o, null, 2));

    if (conflicts.length) {
        console.log('\n--- CONFLICTS: CSV value disagrees with confirmed override (override wins) ---');
        for (const c of conflicts) console.log(JSON.stringify(c));
    }

    console.log('\n--- All changed rows ---');
    for (const c of changes) {
        console.log(`  [${c.employee_id}]${c.override_used ? ' (OVERRIDE)' : ''} ${c.full_name}`);
        console.log(`      division:       "${c.old_division}" -> "${c.new_division}"`);
        console.log(`      payment_centre: "${c.old_payment_centre}" -> "${c.new_payment_centre}"`);
    }

    if (missingPersonnelProfiles.length) {
        console.log('\n--- Missing / incorrect personnel profiles (excluded from backfill) ---');
        missingPersonnelProfiles.forEach((m) => console.log(`  ${m}`));
    }

    if (unmatchedCsvRows.length) {
        console.log(`\n  CSV codes with no matching personnel row (${unmatchedCsvRows.length}): ${unmatchedCsvRows.join(', ')}`);
    }

    if (!APPLY) {
        console.log('\nDry run complete. Re-run with --apply to write these changes.\n');
        return;
    }

    console.log('\nApplying changes...');
    const results = { updated: [], errors: [] };
    for (const c of changes) {
        const { error: updateErr } = await supabase
            .from('personnel')
            .update({ division: c.new_division, payment_centre: c.new_payment_centre })
            .eq('id', c.id);
        if (updateErr) results.errors.push(`${c.full_name} (${c.employee_id}): ${updateErr.message}`);
        else results.updated.push(`${c.full_name} (${c.employee_id})`);
    }

    console.log(`  Updated: ${results.updated.length}`);
    if (results.errors.length) {
        console.log(`  Errors: ${results.errors.length}`);
        results.errors.forEach((e) => console.log(`    - ${e}`));
    }
    console.log('\nDone.\n');
}

run();
