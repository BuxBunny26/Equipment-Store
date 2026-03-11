/**
 * Upload calibration certificates from OneDrive to Supabase Storage
 * and link them to calibration records.
 *
 * Usage:
 *   set SUPABASE_URL=https://YOUR_PROJECT.supabase.co
 *   set SUPABASE_SERVICE_KEY=your_service_role_key
 *   node upload_certificates_supabase.js
 *
 * Get both values from: Supabase Dashboard → Settings → API
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing env vars. Set SUPABASE_URL and SUPABASE_SERVICE_KEY');
    console.error('  set SUPABASE_URL=https://YOUR_PROJECT.supabase.co');
    console.error('  set SUPABASE_SERVICE_KEY=your_service_role_key');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const CERT_FOLDER = path.join(
    'C:', 'Users', 'nadhi',
    'OneDrive - Wearcheck Reliability Solutions',
    'WearCheck ARC Documents', 'RS', 'Calibration Certificates'
);

const BUCKET = 'calibration-certificates';

// Recursively get all PDFs, skip "Expired" folders
function getAllPDFs(dir, files = []) {
    let items;
    try {
        items = fs.readdirSync(dir, { withFileTypes: true });
    } catch (err) {
        console.warn(`Cannot read directory: ${dir}`);
        return files;
    }
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            if (!item.name.toLowerCase().includes('expired')) {
                getAllPDFs(fullPath, files);
            }
        } else if (item.name.toLowerCase().endsWith('.pdf')) {
            files.push({ name: item.name, path: fullPath });
        }
    }
    return files;
}

// Extract serial numbers from filename
function extractSerialNumbers(filename) {
    const serials = [];
    let match;

    // B followed by 10-12 digits
    const bPattern = /\b(B\d{10,12})\b/gi;
    while ((match = bPattern.exec(filename)) !== null) serials.push(match[1].toUpperCase());

    // AT followed by alphanumeric (All-Test Pro)
    const atPattern = /\b(AT[0-9A-Z]+)\b/gi;
    while ((match = atPattern.exec(filename)) !== null) serials.push(match[1].toUpperCase());

    // ATSX pattern
    const atsxPattern = /\b(ATSX\d+)\b/gi;
    while ((match = atsxPattern.exec(filename)) !== null) serials.push(match[1].toUpperCase());

    // MY followed by digits (e.g. Fluke meters)
    const myPattern = /\b(MY\d+)\b/gi;
    while ((match = myPattern.exec(filename)) !== null) serials.push(match[1].toUpperCase());

    // Pure numbers 5+ digits
    const numPattern = /\b(\d{5,})\b/g;
    while ((match = numPattern.exec(filename)) !== null) serials.push(match[1]);

    return [...new Set(serials)];
}

async function run() {
    console.log(`Scanning: ${CERT_FOLDER}\n`);

    if (!fs.existsSync(CERT_FOLDER)) {
        console.error('Certificate folder not found. Check the path.');
        process.exit(1);
    }

    // Get all calibration records from Supabase
    const { data: records, error: fetchErr } = await supabase
        .from('calibration_records')
        .select('id, equipment_id, serial_number, certificate_file_url');

    if (fetchErr) {
        console.error('Error fetching calibration records:', fetchErr.message);
        process.exit(1);
    }

    console.log(`Found ${records.length} calibration records in database`);

    // Build serial number -> records map
    const serialMap = new Map();
    for (const rec of records) {
        if (rec.serial_number) {
            const key = rec.serial_number.toUpperCase().trim();
            if (!serialMap.has(key)) serialMap.set(key, []);
            serialMap.get(key).push(rec);
        }
    }

    // Scan PDFs
    const pdfFiles = getAllPDFs(CERT_FOLDER);
    console.log(`Found ${pdfFiles.length} PDF files\n`);

    let uploaded = 0;
    let linked = 0;
    let skipped = 0;
    let errors = 0;

    for (const pdf of pdfFiles) {
        const serials = extractSerialNumbers(pdf.name);
        if (serials.length === 0) continue;

        for (const serial of serials) {
            const matchedRecords = serialMap.get(serial);
            if (!matchedRecords) continue;

            for (const rec of matchedRecords) {
                // Skip if already has a valid Supabase URL
                if (rec.certificate_file_url && rec.certificate_file_url.includes('supabase')) {
                    skipped++;
                    continue;
                }

                try {
                    // Read the file
                    const fileBuffer = fs.readFileSync(pdf.path);
                    const fileName = `cert_${rec.id}_${serial}_${Date.now()}.pdf`;

                    // Upload to Supabase Storage
                    const { error: uploadErr } = await supabase
                        .storage
                        .from(BUCKET)
                        .upload(fileName, fileBuffer, {
                            contentType: 'application/pdf',
                            upsert: false
                        });

                    if (uploadErr) {
                        console.error(`  ✗ Upload failed for ${pdf.name}: ${uploadErr.message}`);
                        errors++;
                        continue;
                    }

                    // Get public URL
                    const { data: urlData } = supabase
                        .storage
                        .from(BUCKET)
                        .getPublicUrl(fileName);

                    // Update calibration record
                    const { error: updateErr } = await supabase
                        .from('calibration_records')
                        .update({ certificate_file_url: urlData.publicUrl })
                        .eq('id', rec.id);

                    if (updateErr) {
                        console.error(`  ✗ Update failed for record ${rec.id}: ${updateErr.message}`);
                        errors++;
                        continue;
                    }

                    uploaded++;
                    linked++;
                    console.log(`  ✓ ${pdf.name} → S/N ${serial} (record #${rec.id})`);

                    // Mark as done so we don't re-upload
                    rec.certificate_file_url = urlData.publicUrl;
                } catch (err) {
                    console.error(`  ✗ Error processing ${pdf.name}: ${err.message}`);
                    errors++;
                }
            }
        }
    }

    console.log(`\n=== Summary ===`);
    console.log(`PDFs uploaded:  ${uploaded}`);
    console.log(`Records linked: ${linked}`);
    console.log(`Already linked: ${skipped}`);
    console.log(`Errors:         ${errors}`);
}

run().catch(console.error);
