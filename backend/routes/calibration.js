const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ============================================
// SHAREPOINT CERTIFICATE URL CONFIGURATION
// ============================================

// Shared folder link for all certificates
const SHAREPOINT_FOLDER_URL = 'https://wearcheckrs-my.sharepoint.com/:f:/p/nadhira/IgB6x1TbBtpITZdiTDhf6_JfAWh3dPLS_2N4rxvWB8b4wWk?e=V3z8D6';

// Path for direct file access (download format)
const SHAREPOINT_DOWNLOAD_BASE = 'https://wearcheckrs-my.sharepoint.com/personal/nadhira_wearcheckrs_com/_layouts/15/download.aspx?SourceUrl=/personal/nadhira_wearcheckrs_com/Documents/WearCheck%20ARC%20Documents/RS/Calibration%20Certificates';

// Generate certificate filename based on serial number and expiry date
// Format: {serial} Exp.{MM}.{YYYY}.pdf
function generateCertificateFileName(serialNumber, expiryDate) {
    if (!serialNumber || !expiryDate) return null;
    
    const expiry = new Date(expiryDate);
    const month = String(expiry.getMonth() + 1).padStart(2, '0');
    const year = expiry.getFullYear();
    
    return `${serialNumber} Exp.${month}.${year}.pdf`;
}

// Generate full SharePoint URL for certificate using download.aspx format
function generateCertificateUrl(serialNumber, expiryDate) {
    const fileName = generateCertificateFileName(serialNumber, expiryDate);
    if (!fileName) return null;
    
    const encodedFileName = encodeURIComponent(fileName);
    return `${SHAREPOINT_DOWNLOAD_BASE}/${encodedFileName}`;
}

// Add certificate URL to calibration record (uses stored URL only)
function addCertificateUrl(record) {
    // Just return the record with its stored certificate_file_url
    // URLs are manually added per record since SharePoint sharing links are unique
    return record;
}

// ============================================
// FILE UPLOAD CONFIGURATION (Local Storage)
// ============================================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadsDir = path.join(__dirname, '../uploads/certificates');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, `cert_${timestamp}_${safeName}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: PDF, JPEG, PNG, TIFF'), false);
        }
    }
});

// ============================================
// GET ALL CALIBRATION RECORDS
// ============================================

router.get('/', async (req, res) => {
    try {
        const { status, category, search } = req.query;
        
        let query = `
            SELECT 
                cr.id,
                cr.equipment_id,
                cr.serial_number,
                cr.calibration_date,
                cr.expiry_date,
                cr.certificate_number,
                cr.calibration_status,
                cr.calibration_provider,
                cr.certificate_file_url,
                cr.notes,
                cr.created_at,
                e.equipment_id AS equipment_code,
                e.equipment_name,
                e.manufacturer,
                c.name AS category
            FROM calibration_records cr
            LEFT JOIN equipment e ON cr.equipment_id = e.id
            LEFT JOIN categories c ON e.category_id = c.id
            WHERE 1=1
        `;
        const params = [];
        let paramCount = 0;

        if (status) {
            paramCount++;
            query += ` AND cr.calibration_status = $${paramCount}`;
            params.push(status);
        }

        if (category) {
            paramCount++;
            query += ` AND c.name = $${paramCount}`;
            params.push(category);
        }

        if (search) {
            paramCount++;
            query += ` AND (
                e.equipment_name ILIKE $${paramCount} 
                OR cr.serial_number ILIKE $${paramCount}
                OR e.manufacturer ILIKE $${paramCount}
                OR e.equipment_id ILIKE $${paramCount}
            )`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY 
            CASE cr.calibration_status 
                WHEN 'Expired' THEN 1 
                WHEN 'Due Soon' THEN 2 
                WHEN 'Valid' THEN 3
                ELSE 4
            END,
            cr.expiry_date ASC NULLS LAST`;

        const result = await pool.query(query, params);
        
        // Add certificate URLs to each record
        const recordsWithUrls = result.rows.map(addCertificateUrl);
        res.json(recordsWithUrls);
    } catch (err) {
        console.error('Error fetching calibration records:', err);
        res.status(500).json({ error: 'Failed to fetch calibration records' });
    }
});

// ============================================
// GET CALIBRATION STATUS SUMMARY
// ============================================

router.get('/summary', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                calibration_status,
                COUNT(*) as count
            FROM calibration_records
            GROUP BY calibration_status
            ORDER BY 
                CASE calibration_status 
                    WHEN 'Expired' THEN 1 
                    WHEN 'Due Soon' THEN 2 
                    WHEN 'Valid' THEN 3
                    ELSE 4
                END
        `);
        
        const totalResult = await pool.query(`SELECT COUNT(*) as total FROM calibration_records`);

        res.json({
            summary: result.rows,
            total: parseInt(totalResult.rows[0].total)
        });
    } catch (err) {
        console.error('Error fetching calibration summary:', err);
        res.status(500).json({ error: 'Failed to fetch calibration summary' });
    }
});

// ============================================
// GET EQUIPMENT DUE FOR CALIBRATION
// ============================================

router.get('/due', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                cr.id,
                cr.serial_number,
                cr.expiry_date,
                cr.calibration_status,
                cr.certificate_number,
                e.equipment_id AS equipment_code,
                e.equipment_name,
                e.manufacturer,
                c.name AS category,
                CURRENT_DATE - cr.expiry_date AS days_overdue
            FROM calibration_records cr
            JOIN equipment e ON cr.equipment_id = e.id
            LEFT JOIN categories c ON e.category_id = c.id
            WHERE cr.calibration_status IN ('Expired', 'Due Soon')
               OR cr.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
            ORDER BY cr.expiry_date ASC
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching calibration due:', err);
        res.status(500).json({ error: 'Failed to fetch equipment due for calibration' });
    }
});

// ============================================
// GET CALIBRATION HISTORY FOR EQUIPMENT
// ============================================

router.get('/history/:equipmentId', async (req, res) => {
    try {
        const { equipmentId } = req.params;
        
        // Find equipment by ID or equipment_id code
        const equipmentResult = await pool.query(`
            SELECT id FROM equipment 
            WHERE id::text = $1 OR equipment_id = $1
        `, [equipmentId]);
        
        if (equipmentResult.rows.length === 0) {
            return res.json([]);
        }
        
        const dbEquipmentId = equipmentResult.rows[0].id;
        
        const result = await pool.query(`
            SELECT 
                cr.id,
                cr.serial_number,
                cr.calibration_date,
                cr.expiry_date,
                cr.certificate_number,
                cr.calibration_provider,
                cr.calibration_status,
                cr.certificate_file_url,
                cr.notes,
                cr.created_at
            FROM calibration_records cr
            WHERE cr.equipment_id = $1
            ORDER BY cr.calibration_date DESC
        `, [dbEquipmentId]);

        // Add certificate URLs to each record
        const recordsWithUrls = result.rows.map(addCertificateUrl);
        res.json(recordsWithUrls);
    } catch (err) {
        console.error('Error fetching calibration history:', err);
        res.status(500).json({ error: 'Failed to fetch calibration history' });
    }
});

// ============================================
// GET SINGLE CALIBRATION RECORD
// ============================================

router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT 
                cr.*,
                e.equipment_id AS equipment_code,
                e.equipment_name,
                e.manufacturer,
                c.name AS category
            FROM calibration_records cr
            LEFT JOIN equipment e ON cr.equipment_id = e.id
            LEFT JOIN categories c ON e.category_id = c.id
            WHERE cr.id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Calibration record not found' });
        }

        res.json(addCertificateUrl(result.rows[0]));
    } catch (err) {
        console.error('Error fetching calibration record:', err);
        res.status(500).json({ error: 'Failed to fetch calibration record' });
    }
});

// ============================================
// ADD NEW CALIBRATION RECORD
// ============================================

router.post('/', upload.single('certificate'), async (req, res) => {
    try {
        const {
            equipment_id,
            serial_number,
            calibration_date,
            expiry_date,
            certificate_number,
            calibration_provider,
            calibration_status,
            notes
        } = req.body;

        if (!calibration_date || !expiry_date) {
            return res.status(400).json({ 
                error: 'calibration_date and expiry_date are required' 
            });
        }

        // Get equipment internal ID if provided
        let equipmentInternalId = null;
        if (equipment_id) {
            const equipmentResult = await pool.query(`
                SELECT id FROM equipment 
                WHERE id::text = $1 OR equipment_id = $1
            `, [equipment_id]);

            if (equipmentResult.rows.length > 0) {
                equipmentInternalId = equipmentResult.rows[0].id;
            }
        }

        // Calculate status if not provided
        const today = new Date();
        const expiry = new Date(expiry_date);
        const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        
        let status = calibration_status;
        if (!status) {
            if (daysUntilExpiry < 0) status = 'Expired';
            else if (daysUntilExpiry <= 30) status = 'Due Soon';
            else status = 'Valid';
        }

        const result = await pool.query(`
            INSERT INTO calibration_records (
                equipment_id, serial_number, calibration_date, expiry_date,
                certificate_number, calibration_provider, calibration_status, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [
            equipmentInternalId, serial_number, calibration_date, expiry_date,
            certificate_number, calibration_provider, status, notes
        ]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error creating calibration record:', err);
        res.status(500).json({ error: 'Failed to create calibration record' });
    }
});

// ============================================
// UPDATE CALIBRATION RECORD
// ============================================

router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            calibration_date,
            expiry_date,
            certificate_number,
            calibration_provider,
            calibration_status,
            notes
        } = req.body;

        const result = await pool.query(`
            UPDATE calibration_records SET
                calibration_date = COALESCE($1, calibration_date),
                expiry_date = COALESCE($2, expiry_date),
                certificate_number = COALESCE($3, certificate_number),
                calibration_provider = COALESCE($4, calibration_provider),
                calibration_status = COALESCE($5, calibration_status),
                notes = COALESCE($6, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $7
            RETURNING *
        `, [calibration_date, expiry_date, certificate_number, calibration_provider, calibration_status, notes, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Calibration record not found' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error updating calibration record:', err);
        res.status(500).json({ error: 'Failed to update calibration record' });
    }
});

// ============================================
// DELETE CALIBRATION RECORD
// ============================================

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(
            'DELETE FROM calibration_records WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Calibration record not found' });
        }

        res.json({ message: 'Calibration record deleted successfully' });
    } catch (err) {
        console.error('Error deleting calibration record:', err);
        res.status(500).json({ error: 'Failed to delete calibration record' });
    }
});

// ============================================
// UPDATE CALIBRATION STATUSES (Batch)
// ============================================

router.post('/update-statuses', async (req, res) => {
    try {
        // Update all calibration statuses based on expiry dates
        const result = await pool.query(`
            UPDATE calibration_records SET
                calibration_status = CASE
                    WHEN expiry_date < CURRENT_DATE THEN 'Expired'
                    WHEN expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Due Soon'
                    ELSE 'Valid'
                END,
                updated_at = CURRENT_TIMESTAMP
            WHERE expiry_date IS NOT NULL
            RETURNING id, calibration_status
        `);

        res.json({
            message: 'Calibration statuses updated',
            updated: result.rows.length
        });
    } catch (err) {
        console.error('Error updating calibration statuses:', err);
        res.status(500).json({ error: 'Failed to update calibration statuses' });
    }
});

// ============================================
// SERVE CERTIFICATE FILE
// ============================================

router.get('/:id/certificate', async (req, res) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(
            'SELECT certificate_file_url FROM calibration_records WHERE id = $1',
            [id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Calibration record not found' });
        }
        
        const fileUrl = result.rows[0].certificate_file_url;
        
        if (!fileUrl) {
            return res.status(404).json({ error: 'No certificate file linked' });
        }
        
        // If it's a web URL (SharePoint, etc.), redirect to it
        if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
            return res.redirect(fileUrl);
        }
        
        // Convert file:// URL to local path
        let filePath = fileUrl;
        if (fileUrl.startsWith('file:///')) {
            filePath = decodeURIComponent(fileUrl.replace('file:///', ''));
        }
        
        // Check if file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: 'Certificate file not found on disk' });
        }
        
        // Serve the file
        res.sendFile(filePath);
    } catch (err) {
        console.error('Error serving certificate:', err);
        res.status(500).json({ error: 'Failed to serve certificate' });
    }
});

module.exports = router;
