// Link certificates to equipment based on serial numbers in file names
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const pool = require('./db');
const fs = require('fs');
const path = require('path');

const CERT_FOLDER = 'C:\\Users\\nadhi\\OneDrive - Wearcheck Reliability Solutions\\WearCheck ARC Documents\\RS\\Calibration Certificates';

// Get all PDF files recursively
function getAllPDFs(dir, files = []) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            // Skip "Expired" folders
            if (!item.name.toLowerCase().includes('expired')) {
                getAllPDFs(fullPath, files);
            }
        } else if (item.name.toLowerCase().endsWith('.pdf')) {
            files.push({ name: item.name, path: fullPath });
        }
    }
    return files;
}

// Extract potential serial numbers from filename
function extractSerialNumbers(filename) {
    // Common patterns for serial numbers
    const serials = [];
    
    // Pattern: B21401234567 (starts with B followed by numbers)
    const bPattern = /\b(B\d{10,12})\b/gi;
    let match;
    while ((match = bPattern.exec(filename)) !== null) {
        serials.push(match[1].toUpperCase());
    }
    
    // Pattern: AT followed by numbers (All-Test Pro)
    const atPattern = /\b(AT[0-9A-Z]+)\b/gi;
    while ((match = atPattern.exec(filename)) !== null) {
        serials.push(match[1].toUpperCase());
    }
    
    // Pattern: Pure numbers 5+ digits
    const numPattern = /\b(\d{5,})\b/g;
    while ((match = numPattern.exec(filename)) !== null) {
        serials.push(match[1]);
    }
    
    return [...new Set(serials)]; // Remove duplicates
}

async function linkCertificates() {
    try {
        // Get all equipment with serial numbers
        const equipmentResult = await pool.query(`
            SELECT e.id, e.serial_number, e.equipment_name, cr.id as cal_id
            FROM equipment e
            LEFT JOIN calibration_records cr ON cr.equipment_id = e.id
            WHERE e.serial_number IS NOT NULL AND e.serial_number != ''
        `);
        
        const equipment = equipmentResult.rows;
        console.log(`Found ${equipment.length} equipment with serial numbers`);
        
        // Get all certificate PDFs
        const pdfFiles = getAllPDFs(CERT_FOLDER);
        console.log(`Found ${pdfFiles.length} PDF files (excluding Expired folders)`);
        
        // Create a map of serial -> equipment
        const serialMap = new Map();
        for (const eq of equipment) {
            const serial = eq.serial_number.toUpperCase().trim();
            if (!serialMap.has(serial)) {
                serialMap.set(serial, []);
            }
            serialMap.get(serial).push(eq);
        }
        
        // Match files to equipment
        let matched = 0;
        let updated = 0;
        
        for (const pdf of pdfFiles) {
            const serials = extractSerialNumbers(pdf.name);
            
            for (const serial of serials) {
                if (serialMap.has(serial)) {
                    matched++;
                    const equipmentList = serialMap.get(serial);
                    
                    for (const eq of equipmentList) {
                        // Convert local path to file:// URL
                        const fileUrl = 'file:///' + pdf.path.replace(/\\/g, '/');
                        
                        // Update calibration record if exists
                        if (eq.cal_id) {
                            const result = await pool.query(
                                'UPDATE calibration_records SET certificate_file_url = $1 WHERE id = $2 AND (certificate_file_url IS NULL OR certificate_file_url = $3)',
                                [fileUrl, eq.cal_id, '']
                            );
                            if (result.rowCount > 0) {
                                updated++;
                                console.log(`✓ Linked: ${pdf.name} -> ${eq.serial_number} (${eq.equipment_name})`);
                            }
                        }
                    }
                }
            }
        }
        
        console.log(`\n=== Summary ===`);
        console.log(`Matches found: ${matched}`);
        console.log(`Records updated: ${updated}`);
        
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

linkCertificates();
