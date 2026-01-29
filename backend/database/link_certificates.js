const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const pool = require('./db');

// OneDrive Calibration Certificates folder
const CERTIFICATES_BASE_PATH = 'C:\\Users\\nadhi\\OneDrive - Wearcheck Reliability Solutions\\WearCheck ARC Documents\\RS\\Calibration Certificates';

// Subfolder mappings for equipment types
const SUBFOLDER_MAPPINGS = {
    'All Test Pro': ['All Test Pro', 'ATTP', 'AT5X', 'AT701'],
    'AMS2140 Loggers': ['AMS2140', 'B2140'],
    'Fixturlaser': ['Fixturlaser', 'Acoem', 'sensALIGN', '03362', '85889', '95889', '41718'],
    'Flir Cameras': ['Flir', 'FLIR', 'T640', 'T530', 'T540', 'E54', 'E40', 'E76'],
    'FLUKE': ['Fluke', 'FLUKE', '30420'],
    'Function Waveform Generator': ['Waveform', 'Generator', 'Agilent'],
};

async function scanAndLinkCertificates() {
    console.log('Scanning OneDrive for calibration certificates...\n');
    console.log(`Base path: ${CERTIFICATES_BASE_PATH}\n`);

    try {
        // Get all equipment with serial numbers
        const equipmentResult = await pool.query(`
            SELECT 
                e.id, 
                e.equipment_id, 
                e.equipment_name, 
                e.serial_number,
                e.manufacturer,
                cr.id as existing_calibration_id,
                cr.certificate_file_path as existing_file_path
            FROM equipment e
            LEFT JOIN (
                SELECT DISTINCT ON (equipment_id) *
                FROM calibration_records
                ORDER BY equipment_id, calibration_date DESC
            ) cr ON e.id = cr.equipment_id
            WHERE e.serial_number IS NOT NULL
            ORDER BY e.equipment_name
        `);

        console.log(`Found ${equipmentResult.rows.length} equipment items with serial numbers\n`);

        let matched = 0;
        let alreadyLinked = 0;
        let notFound = 0;

        for (const equipment of equipmentResult.rows) {
            // Skip if already has a certificate file linked
            if (equipment.existing_file_path && fs.existsSync(equipment.existing_file_path)) {
                alreadyLinked++;
                continue;
            }

            // Search for certificate file
            const certificatePath = findCertificateFile(equipment);

            if (certificatePath) {
                console.log(`✓ Found: ${equipment.serial_number} → ${path.basename(certificatePath)}`);
                
                // Update the calibration record with the file path
                if (equipment.existing_calibration_id) {
                    await pool.query(`
                        UPDATE calibration_records 
                        SET 
                            certificate_file_path = $1,
                            certificate_file_name = $2,
                            certificate_mime_type = 'application/pdf',
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = $3
                    `, [certificatePath, path.basename(certificatePath), equipment.existing_calibration_id]);
                } else {
                    console.log(`  ⚠ No calibration record exists - skipping file link`);
                }
                matched++;
            } else {
                console.log(`✗ Not found: ${equipment.serial_number} (${equipment.equipment_name})`);
                notFound++;
            }
        }

        console.log('\n========================================');
        console.log('SUMMARY');
        console.log('========================================');
        console.log(`✓ Matched & linked: ${matched}`);
        console.log(`○ Already linked: ${alreadyLinked}`);
        console.log(`✗ Not found: ${notFound}`);
        console.log('========================================\n');

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

function findCertificateFile(equipment) {
    const { serial_number, equipment_name, manufacturer } = equipment;
    
    // Search recursively through all folders
    const found = searchRecursive(CERTIFICATES_BASE_PATH, serial_number);
    if (found) return found;
    
    return null;
}

function searchRecursive(folderPath, serialNumber, depth = 0) {
    // Limit recursion depth to prevent infinite loops
    if (depth > 4) return null;
    
    try {
        const items = fs.readdirSync(folderPath, { withFileTypes: true });
        
        // First, check files in current folder
        for (const item of items) {
            if (item.isFile()) {
                const filePath = path.join(folderPath, item.name);
                if (matchesSerialNumber(item.name, serialNumber)) {
                    return filePath;
                }
            }
        }
        
        // Then, recurse into subfolders
        for (const item of items) {
            if (item.isDirectory()) {
                const subfolderPath = path.join(folderPath, item.name);
                const found = searchRecursive(subfolderPath, serialNumber, depth + 1);
                if (found) return found;
            }
        }
    } catch (err) {
        // Folder doesn't exist or can't be read
    }
    
    return null;
}

function matchesSerialNumber(filename, serialNumber) {
    // Normalize both for comparison
    const normalizedSerial = serialNumber.replace(/[-\s]/g, '').toLowerCase();
    const normalizedFilename = filename.replace(/[-\s]/g, '').toLowerCase();
    
    // Direct match
    if (normalizedFilename.includes(normalizedSerial)) {
        return true;
    }
    
    // Check if filename starts with serial number (common pattern)
    if (normalizedFilename.startsWith(normalizedSerial)) {
        return true;
    }
    
    return false;
}

scanAndLinkCertificates();
