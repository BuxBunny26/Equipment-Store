const fs = require('fs');
const path = require('path');

// Read personnel CSV and generate SQL
const personnelPath = path.join(__dirname, 'employee information.csv');
const personnelData = fs.readFileSync(personnelPath, 'utf8');

const lines = personnelData.split('\n').slice(1); // Skip header

console.log('-- PERSONNEL INSERT STATEMENTS');
console.log('-- Run this in Supabase after complete_setup.sql');
console.log('');

const seen = new Set();

lines.forEach(line => {
    if (!line.trim()) return;
    
    const parts = line.split(';');
    if (parts.length < 8) return;
    
    const department = parts[0]?.trim() || '';
    const employeeCode = parts[2]?.trim() || '';
    const firstName = parts[5]?.trim() || '';
    const surname = parts[6]?.trim() || '';
    const email = parts[7]?.trim() || '';
    
    if (!employeeCode || employeeCode === 'Unknown' || seen.has(employeeCode)) return;
    seen.add(employeeCode);
    
    const fullName = `${firstName} ${surname}`.trim().replace(/'/g, "''");
    const cleanEmail = email.replace(/'/g, "''");
    const cleanDept = department.replace(/'/g, "''");
    
    if (fullName && employeeCode) {
        console.log(`INSERT INTO personnel (employee_id, full_name, email, department, is_active) VALUES ('${employeeCode}', '${fullName}', '${cleanEmail}', '${cleanDept}', TRUE) ON CONFLICT (employee_id) DO NOTHING;`);
    }
});

console.log('');
console.log('-- EQUIPMENT INSERT STATEMENTS');
console.log('');

// Read equipment CSV and generate SQL
const equipmentPath = path.join(__dirname, 'ARC Equipment Calibration Register.csv');
const equipmentData = fs.readFileSync(equipmentPath, 'utf8');

const equipLines = equipmentData.split('\n').slice(1); // Skip header

// Map categories
const categoryMap = {
    'Laser Alignment': { cat: 'Laser Alignment', sub: 'Shaft Alignment' },
    'Thermal Camera': { cat: 'Thermal Equipment', sub: 'Thermal Cameras' },
    'Thermal Equipment': { cat: 'Thermal Equipment', sub: 'Thermal Cameras' },
    'Motor Circuit Analysis': { cat: 'Motor Circuit Analysis', sub: 'MCA Testers' },
    'Vibration Analysis': { cat: 'Vibration Analysis', sub: 'Analyzers' },
    'Ultrasound': { cat: 'Ultrasound', sub: 'Ultrasound Detectors' },
    'Balancing': { cat: 'Balancing Equipment', sub: 'Balancing Machines' }
};

let equipNum = 1;
const seenSerials = new Set();

equipLines.forEach(line => {
    if (!line.trim()) return;
    
    const parts = line.split(';');
    if (parts.length < 5) return;
    
    const categoryRaw = parts[0]?.trim() || '';
    const equipmentName = parts[1]?.trim().replace(/'/g, "''") || '';
    const manufacturer = parts[2]?.trim().replace(/'/g, "''") || '';
    const serialNumber = parts[3]?.trim() || '';
    const lastCalDate = parts[4]?.trim() || '';
    const expiryDate = parts[5]?.trim() || '';
    const certificate = parts[6]?.trim() || '';
    
    if (!equipmentName || !serialNumber || seenSerials.has(serialNumber)) return;
    seenSerials.add(serialNumber);
    
    const mapping = categoryMap[categoryRaw] || { cat: 'General Tools', sub: 'Hand Tools' };
    const equipId = `EQ-${String(equipNum).padStart(5, '0')}`;
    equipNum++;
    
    // Convert date format from YYYY/MM/DD to YYYY-MM-DD
    const formatDate = (d) => d ? d.replace(/\//g, '-') : null;
    const calDate = formatDate(lastCalDate);
    const expDate = formatDate(expiryDate);
    
    console.log(`
-- Equipment: ${equipmentName} (${serialNumber})
INSERT INTO equipment (equipment_id, equipment_name, manufacturer, serial_number, category_id, subcategory_id, status, requires_calibration)
SELECT '${equipId}', '${equipmentName}', '${manufacturer}', '${serialNumber}', 
       c.id, s.id, 'Available', TRUE
FROM categories c
JOIN subcategories s ON s.category_id = c.id
WHERE c.name = '${mapping.cat}' AND s.name = '${mapping.sub}'
ON CONFLICT (equipment_id) DO NOTHING;`);

    if (calDate && expDate) {
        console.log(`
INSERT INTO calibration_records (equipment_id, calibration_date, expiry_date, certificate_number, calibration_provider)
SELECT e.id, '${calDate}'::DATE, '${expDate}'::DATE, '${certificate}', '${manufacturer}'
FROM equipment e WHERE e.serial_number = '${serialNumber}'
ON CONFLICT DO NOTHING;`);
    }
});

console.log('');
console.log('-- Summary');
console.log(`SELECT 'Personnel imported: ' || COUNT(*) FROM personnel;`);
console.log(`SELECT 'Equipment imported: ' || COUNT(*) FROM equipment;`);
console.log(`SELECT 'Calibration records: ' || COUNT(*) FROM calibration_records;`);
