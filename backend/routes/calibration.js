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
// GET CALIBRATION TABLE SCHEMA (for debugging)
// ============================================

router.get('/debug-schema', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'calibration_records' 
            ORDER BY ordinal_position
        `);
        res.json({ columns: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
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
                e.serial_number,
                cr.calibration_date,
                cr.expiry_date,
                cr.certificate_number,
                CASE 
                    WHEN cr.expiry_date < CURRENT_DATE THEN 'Expired'
                    WHEN cr.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Due Soon'
                    ELSE 'Valid'
                END AS calibration_status,
                cr.calibration_provider,
                cr.notes,
                cr.created_at,
                e.equipment_id AS equipment_code,
                e.equipment_name,
                e.manufacturer,
                c.name AS category
            FROM calibration_records cr
            LEFT JOIN equipment e ON cr.equipment_id = e.id
            LEFT JOIN categories c ON e.category_id = c.id
        `;
        const params = [];
        let paramCount = 0;
        const conditions = [];

        if (status) {
            // Filter by computed status using CASE expression
            conditions.push(`CASE 
                WHEN cr.expiry_date < CURRENT_DATE THEN 'Expired'
                WHEN cr.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Due Soon'
                ELSE 'Valid'
            END = $${++paramCount}`);
            params.push(status);
        }

        if (category) {
            paramCount++;
            conditions.push(`c.name = $${paramCount}`);
            params.push(category);
        }

        if (search) {
            paramCount++;
            conditions.push(`(
                e.equipment_name ILIKE $${paramCount} 
                OR e.serial_number ILIKE $${paramCount}
                OR e.manufacturer ILIKE $${paramCount}
                OR e.equipment_id ILIKE $${paramCount}
            )`);
            params.push(`%${search}%`);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ` ORDER BY 
            CASE 
                WHEN cr.expiry_date < CURRENT_DATE THEN 1
                WHEN cr.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 2
                ELSE 3
            END,
            cr.expiry_date ASC NULLS LAST`;

        const result = await pool.query(query, params);
        res.json(result.rows || []);
    } catch (err) {
        console.error('Error fetching calibration records:', err.message);
        res.status(500).json({ error: 'Failed to fetch calibration records', details: err.message });
    }
});

// ============================================
// GET CALIBRATION STATUS SUMMARY
// ============================================

router.get('/summary', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                CASE 
                    WHEN expiry_date IS NULL THEN 'N/A'
                    WHEN expiry_date < CURRENT_DATE THEN 'Expired'
                    WHEN expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Due Soon'
                    ELSE 'Valid'
                END as calibration_status,
                COUNT(*) as count
            FROM calibration_records
            GROUP BY 1
        `);
        
        const totalResult = await pool.query(`SELECT COUNT(*) as total FROM calibration_records`);

        res.json({
            summary: Array.isArray(result.rows) ? result.rows : [],
            total: parseInt(totalResult.rows[0]?.total || 0)
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
                e.serial_number,
                cr.expiry_date,
                CASE 
                    WHEN cr.expiry_date IS NULL THEN 'N/A'
                    WHEN cr.expiry_date < CURRENT_DATE THEN 'Expired'
                    WHEN cr.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Due Soon'
                    ELSE 'Valid'
                END as calibration_status,
                cr.certificate_number,
                e.equipment_id AS equipment_code,
                e.equipment_name,
                e.manufacturer,
                c.name AS category,
                CURRENT_DATE - cr.expiry_date AS days_overdue
            FROM calibration_records cr
            JOIN equipment e ON cr.equipment_id = e.id
            LEFT JOIN categories c ON e.category_id = c.id
            WHERE cr.expiry_date IS NOT NULL 
              AND cr.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
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
                e.serial_number,
                cr.calibration_date,
                cr.expiry_date,
                cr.certificate_number,
                cr.calibration_provider,
                CASE 
                    WHEN cr.expiry_date < CURRENT_DATE THEN 'Expired'
                    WHEN cr.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Due Soon'
                    ELSE 'Valid'
                END AS calibration_status,
                cr.notes,
                cr.created_at
            FROM calibration_records cr
            LEFT JOIN equipment e ON cr.equipment_id = e.id
            WHERE cr.equipment_id = $1
            ORDER BY cr.calibration_date DESC
        `, [dbEquipmentId]);

        res.json(result.rows);
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
                cr.id,
                cr.equipment_id,
                e.serial_number,
                cr.calibration_date,
                cr.expiry_date,
                cr.certificate_number,
                cr.calibration_provider,
                CASE 
                    WHEN cr.expiry_date < CURRENT_DATE THEN 'Expired'
                    WHEN cr.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Due Soon'
                    ELSE 'Valid'
                END AS calibration_status,
                cr.notes,
                cr.created_at,
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

        res.json(result.rows[0]);
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

        const result = await pool.query(`
            INSERT INTO calibration_records (
                equipment_id, serial_number, calibration_date, expiry_date,
                certificate_number, calibration_provider, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING 
                id,
                equipment_id,
                serial_number,
                calibration_date,
                expiry_date,
                certificate_number,
                calibration_provider,
                notes,
                created_at,
                CASE 
                    WHEN expiry_date < CURRENT_DATE THEN 'Expired'
                    WHEN expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Due Soon'
                    ELSE 'Valid'
                END AS calibration_status
        `, [
            equipmentInternalId, serial_number, calibration_date, expiry_date,
            certificate_number, calibration_provider, notes
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
            notes
        } = req.body;

        const result = await pool.query(`
            UPDATE calibration_records SET
                calibration_date = COALESCE($1, calibration_date),
                expiry_date = COALESCE($2, expiry_date),
                certificate_number = COALESCE($3, certificate_number),
                calibration_provider = COALESCE($4, calibration_provider),
                notes = COALESCE($5, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $6
            RETURNING 
                id,
                equipment_id,
                serial_number,
                calibration_date,
                expiry_date,
                certificate_number,
                calibration_provider,
                notes,
                created_at,
                updated_at,
                CASE 
                    WHEN expiry_date < CURRENT_DATE THEN 'Expired'
                    WHEN expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Due Soon'
                    ELSE 'Valid'
                END AS calibration_status
        `, [calibration_date, expiry_date, certificate_number, calibration_provider, notes, id]);

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
        // Status is now computed dynamically from expiry_date in all queries
        // This endpoint is kept for backwards compatibility but doesn't need to update anything
        const result = await pool.query(`
            SELECT COUNT(*) as count FROM calibration_records WHERE expiry_date IS NOT NULL
        `);

        res.json({
            message: 'Calibration statuses are computed dynamically',
            count: parseInt(result.rows[0].count)
        });
    } catch (err) {
        console.error('Error fetching calibration count:', err);
        res.status(500).json({ error: 'Failed to process request' });
    }
});

// ============================================
// SERVE CERTIFICATE FILE
// ============================================

router.get('/:id/certificate', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Certificate file URLs are no longer stored in the database
        // This endpoint is kept for future use
        return res.status(404).json({ error: 'Certificate feature not available in this version' });
    } catch (err) {
        console.error('Error serving certificate:', err);
        res.status(500).json({ error: 'Failed to serve certificate' });
    }
});

module.exports = router;
