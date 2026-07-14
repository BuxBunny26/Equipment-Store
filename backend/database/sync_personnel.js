/**
 * Personnel Full Sync — reads directly from the Excel employee list
 *
 * - Upserts every person by employee_id (insert or update in one step)
 * - Sets is_active = FALSE for anyone whose employee_id is NOT in the file
 *
 * Usage:  node database/sync_personnel.js
 * Update EXCEL_PATH when you get a new employee list.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) { console.error('\nMissing env vars. Check backend/.env\n'); process.exit(1); }

const EXCEL_PATH = path.join(
    'C:', 'Users', 'Nadhira Bux', 'Desktop', 'Projects', 'Internal',
    'Equipment-Store', 'Employee List - 09.07.2026.xlsx'
);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function clean(v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim();
    return (s === '' || s.toUpperCase() === 'N/A') ? null : s;
}

function normaliseEmail(v) {
    const s = clean(v);
    return s ? s.toLowerCase() : null;
}

function makeNaCode(preferred, surname, email) {
    if (email) return `NA-${email.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 12)}`;
    return `NA-${(preferred || surname || 'unknown').replace(/\s+/g, '').toLowerCase().slice(0, 10)}`;
}

function loadExcel() {
    let wb;
    try { wb = XLSX.readFile(EXCEL_PATH); }
    catch (e) { console.error(`\nCannot open Excel:\n  ${EXCEL_PATH}\n  ${e.message}\n`); process.exit(1); }

    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const seen = new Set();
    const personnel = [];

    for (const row of rows) {
        const preferred = clean(row['Preferred Name']) || clean(row['First Names']);
        const surname   = clean(row['Surname']);
        const rawCode   = clean(row['Employee Code']);
        const email     = normaliseEmail(row['Email Address']);
        const jobTitle  = clean(row['Job Title']);
        const fullName  = [preferred, surname].filter(Boolean).join(' ');
        if (!fullName) continue;

        let code = rawCode ? rawCode.replace(/\s+/g, '') : null;
        if (!code || code.toUpperCase() === 'N/A') code = makeNaCode(preferred, surname, email);

        if (seen.has(code)) { console.warn(`  [WARN] Duplicate code "${code}" for "${fullName}" — skipped`); continue; }
        seen.add(code);

        personnel.push({ employee_id: code, full_name: fullName, first_name: preferred, last_name: surname, email, job_title: jobTitle });
    }
    return personnel;
}

async function run() {
    const PERSONNEL = loadExcel();

    console.log('\n----------------------------------------------');
    console.log(' Personnel Full Sync — WCK Equipment Store');
    console.log('----------------------------------------------');
    console.log(`  Source  : ${path.basename(EXCEL_PATH)}`);
    console.log(`  Records : ${PERSONNEL.length}\n`);

    const results = { upserted: [], deactivated: [], errors: [] };
    const activeCodesInExcel = new Set(PERSONNEL.map(p => p.employee_id.toLowerCase()));

    // -- STEP 1: Upsert every person by employee_id ---------------------------
    for (const person of PERSONNEL) {
        try {
            const payload = {
                employee_id: person.employee_id,
                full_name:   person.full_name,
                first_name:  person.first_name,
                last_name:   person.last_name,
                email:       person.email || null,
                job_title:   person.job_title,
                is_active:   true,
            };
            const { error } = await supabase
                .from('personnel')
                .upsert(payload, { onConflict: 'employee_id' });
            if (error) throw new Error(error.message);
            results.upserted.push(`${person.full_name} (${person.employee_id})`);
        } catch (err) {
            results.errors.push(`${person.full_name} (${person.employee_id}): ${err.message}`);
        }
    }

    // -- STEP 2: Deactivate anyone whose code is NOT in the Excel ------------
    const { data: existing, error: fetchErr } = await supabase
        .from('personnel').select('id, employee_id, full_name, is_active').eq('is_active', true);
    if (fetchErr) { console.error('Fetch failed:', fetchErr.message); process.exit(1); }

    for (const dbPerson of existing) {
        const codeKey = (dbPerson.employee_id || '').toLowerCase();
        if (activeCodesInExcel.has(codeKey)) continue; // still on list

        const { error } = await supabase.from('personnel').update({ is_active: false }).eq('id', dbPerson.id);
        if (error) {
            results.errors.push(`Deactivate ${dbPerson.full_name}: ${error.message}`);
        } else {
            results.deactivated.push(`${dbPerson.full_name} (${dbPerson.employee_id || '—'})`);
        }
    }

    console.log(`?  Upserted    : ${results.upserted.length}`);
    results.upserted.forEach(n => console.log(`    ~ ${n}`));
    console.log(`\n??  Deactivated : ${results.deactivated.length}`);
    results.deactivated.forEach(n => console.log(`    - ${n}`));
    if (results.errors.length) {
        console.log(`\n?  Errors      : ${results.errors.length}`);
        results.errors.forEach(n => console.log(`    ? ${n}`));
    }
    console.log('\n----------------------------------------------');
    console.log(` Done. ${results.upserted.length} upserted, ${results.deactivated.length} deactivated.`);
    console.log('----------------------------------------------\n');
}

run().catch(err => { console.error('Unexpected error:', err); process.exit(1); });
