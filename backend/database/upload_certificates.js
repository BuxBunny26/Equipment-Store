// Bulk Upload Calibration Certificates to Supabase Storage
// Scans the OneDrive folder and links PDFs to existing calibration records

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');

// Database connection - use DATABASE_URL if provided (production), otherwise use db.js config
const pool = process.env.DATABASE_URL 
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    })
    : require('./db');

// Supabase configuration (same as calibration.js)
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://widwzjnfxhsxzhqrzthy.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpZHd6am5meGhzeHpocXJ6dGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2ODI5MzcsImV4cCI6MjA4NTI1ODkzN30.e3leUBqvZeo_gPMj75mlzgP7uQg-iWTZvcLwQx1_Hpo';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const BUCKET_NAME = 'certificates';

// Certificate folder path
const CERT_FOLDER = 'C:\\Users\\nadhi\\OneDrive - Wearcheck Reliability Solutions\\WearCheck ARC Documents\\RS\\Calibration Certificates';

// Extract serial number from filename using various patterns
function extractSerialNumber(filename) {
    // Remove .pdf extension
    const name = filename.replace(/\.pdf$/i, '');
    
    // Common patterns:
    // "B21401216478. Exp 10.2025" -> B21401216478
    // "49004275 -Pruftechnik Align 7 Sensor - Exp 04.12.2026" -> 49004275
    // "All-Test Pro 5 AT5X1119 Exp. 13.07.2026" -> AT5X1119 or ATSX1119
    // "Flir E40 - 49002016 - Exp 07.2025" -> 49002016
    // "03362 - Fixturlaser R2 Kibali" -> 03362
    
    const patterns = [
        // AMS2140 pattern: B followed by numbers
        /\b(B\d{10,13})\b/i,
        // AT pattern for All Test Pro
        /\b(AT[57X]\d+)\b/i,
        // ATSX pattern
        /\b(ATSX\d+)\b/i,
        // Pure number at start (most common)
        /^(\d{5,15})/,
        // Number after "SN" or "Serial"
        /(?:SN|Serial(?:\s+number)?)\s*[-:.]?\s*(\d+)/i,
        // Number between spaces/dashes
        /[- ](\d{7,15})[- .]/,
        // Flir style: number after dash
        /^[\d\w\s]+?[-]\s*(\d{7,10})\s*[-]/i,
        // WM(A) pattern
        /\(WM\(A\)(\d+)/i,
    ];
    
    for (const pattern of patterns) {
        const match = name.match(pattern);
        if (match) {
            return match[1].trim();
        }
    }
    
    // Last resort: first number sequence of 5+ digits
    const lastResort = name.match(/(\d{5,})/);
    if (lastResort) {
        return lastResort[1];
    }
    
    return null;
}

// Get all PDF files recursively
function getAllPdfFiles(dir, files = []) {
    try {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            
            if (item.isDirectory()) {
                getAllPdfFiles(fullPath, files);
            } else if (item.name.toLowerCase().endsWith('.pdf')) {
                files.push({
                    path: fullPath,
                    name: item.name,
                    folder: path.basename(dir)
                });
            }
        }
    } catch (err) {
        console.error(`Error reading directory ${dir}:`, err.message);
    }
    
    return files;
}

// Upload file to Supabase Storage
async function uploadToSupabase(filePath, fileName) {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        const timestamp = Date.now();
        const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `calibration/${timestamp}_${safeName}`;
        
        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(storagePath, fileBuffer, {
                contentType: 'application/pdf',
                upsert: true
            });
        
        if (error) {
            console.error(`Upload error for ${fileName}:`, error.message);
            return null;
        }
        
        // Get public URL
        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(storagePath);
        
        return urlData.publicUrl;
    } catch (err) {
        console.error(`Error uploading ${fileName}:`, err.message);
        return null;
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('BULK CERTIFICATE UPLOAD TOOL');
    console.log('='.repeat(60));
    console.log(`\nScanning folder: ${CERT_FOLDER}\n`);
    
    // Get all calibration records with their serial numbers
    const recordsResult = await pool.query(`
        SELECT cr.id, cr.equipment_id, cr.certificate_number, cr.calibration_date, 
               cr.expiry_date, cr.certificate_file_path,
               e.serial_number, e.equipment_name
        FROM calibration_records cr
        JOIN equipment e ON cr.equipment_id = e.id
        WHERE cr.certificate_file_path IS NULL OR cr.certificate_file_path = ''
        ORDER BY e.serial_number
    `);
    
    console.log(`Found ${recordsResult.rows.length} calibration records without certificates\n`);
    
    // Build a map of serial numbers to records
    const serialToRecords = new Map();
    for (const record of recordsResult.rows) {
        const serial = record.serial_number;
        if (serial) {
            if (!serialToRecords.has(serial)) {
                serialToRecords.set(serial, []);
            }
            serialToRecords.get(serial).push(record);
        }
    }
    
    console.log(`Unique serial numbers in database: ${serialToRecords.size}\n`);
    
    // Get all PDF files
    const pdfFiles = getAllPdfFiles(CERT_FOLDER);
    console.log(`Found ${pdfFiles.length} PDF files in folder\n`);
    
    // Try to match and upload
    let matched = 0;
    let uploaded = 0;
    let failed = 0;
    let noMatch = [];
    
    for (const pdf of pdfFiles) {
        const extractedSerial = extractSerialNumber(pdf.name);
        
        if (!extractedSerial) {
            noMatch.push({ file: pdf.name, reason: 'Could not extract serial number' });
            continue;
        }
        
        // Try to find matching record(s)
        // Check exact match first, then try variations
        let records = serialToRecords.get(extractedSerial);
        
        // Try without leading zeros
        if (!records) {
            const noLeadingZeros = extractedSerial.replace(/^0+/, '');
            records = serialToRecords.get(noLeadingZeros);
        }
        
        // Try case variations for alphanumeric serials
        if (!records) {
            for (const [serial, recs] of serialToRecords) {
                if (serial.toLowerCase() === extractedSerial.toLowerCase()) {
                    records = recs;
                    break;
                }
                // Check if serial contains the extracted number
                if (serial.includes(extractedSerial) || extractedSerial.includes(serial)) {
                    records = recs;
                    break;
                }
            }
        }
        
        if (!records || records.length === 0) {
            noMatch.push({ file: pdf.name, serial: extractedSerial, reason: 'No matching record in database' });
            continue;
        }
        
        matched++;
        console.log(`Match: ${pdf.name}`);
        console.log(`  -> Serial: ${extractedSerial}`);
        console.log(`  -> Equipment: ${records[0].equipment_name}`);
        
        // Upload to Supabase
        const publicUrl = await uploadToSupabase(pdf.path, pdf.name);
        
        if (publicUrl) {
            // Update all matching calibration records
            for (const record of records) {
                await pool.query(`
                    UPDATE calibration_records 
                    SET certificate_file_path = $1, certificate_file_name = $2
                    WHERE id = $3
                `, [publicUrl, pdf.name, record.id]);
            }
            console.log(`  -> Uploaded: ${publicUrl.substring(0, 60)}...`);
            uploaded++;
        } else {
            console.log(`  -> FAILED to upload`);
            failed++;
        }
        
        console.log('');
    }
    
    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total PDF files found: ${pdfFiles.length}`);
    console.log(`Matched to records: ${matched}`);
    console.log(`Successfully uploaded: ${uploaded}`);
    console.log(`Failed uploads: ${failed}`);
    console.log(`Unmatched files: ${noMatch.length}`);
    
    if (noMatch.length > 0) {
        console.log('\n' + '-'.repeat(60));
        console.log('UNMATCHED FILES (first 20):');
        console.log('-'.repeat(60));
        noMatch.slice(0, 20).forEach(item => {
            console.log(`  ${item.file}`);
            console.log(`    Serial: ${item.serial || 'N/A'} | Reason: ${item.reason}`);
        });
        
        if (noMatch.length > 20) {
            console.log(`  ... and ${noMatch.length - 20} more`);
        }
    }
    
    await pool.end();
    console.log('\nDone!');
}

main().catch(err => {
    console.error('Error:', err);
    pool.end();
    process.exit(1);
});
