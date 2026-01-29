const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// ============================================
// SUPABASE STORAGE CONFIGURATION
// ============================================

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://widwzjnfxhsxzhqrzthy.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndpZHd6am5meGhzeHpocXJ6dGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2ODI5MzcsImV4cCI6MjA4NTI1ODkzN30.e3leUBqvZeo_gPMj75mlzgP7uQg-iWTZvcLwQx1_Hpo';
const BUCKET_NAME = 'certificates';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Check if running in cloud mode (DATABASE_URL set)
const isCloudMode = !!process.env.DATABASE_URL;

// ============================================
// FILE UPLOAD CONFIGURATION
// ============================================

// Use memory storage for cloud (Supabase), disk storage for local
const storage = isCloudMode 
    ? multer.memoryStorage()
    : multer.diskStorage({
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
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        // Allow PDF, images, and common document types
        const allowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/tiff',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Allowed: PDF, JPEG, PNG, TIFF, DOC, DOCX'), false);
        }
    }
});

// Helper function to upload file to Supabase
async function uploadToSupabase(file, equipmentId) {
    const timestamp = Date.now();
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${equipmentId}/${timestamp}_${safeName}`;
    
    const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(fileName, file.buffer, {
            contentType: file.mimetype,
            upsert: false
        });
    
    if (error) {
        console.error('Supabase upload error:', error);
        throw new Error('Failed to upload certificate to storage');
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
        .from(BUCKET_NAME)
        .getPublicUrl(fileName);
    
    return {
        path: fileName,
        url: urlData.publicUrl,
        fileName: file.originalname,
        mimeType: file.mimetype
    };
}

// ============================================
// GET ALL EQUIPMENT CALIBRATION STATUS
// ============================================

router.get('/status', async (req, res) => {
    try {
        const { status, category, search } = req.query;
        
        let query = `
            SELECT *
            FROM v_equipment_calibration_status
            WHERE requires_calibration = TRUE
        `;
        const params = [];
        let paramCount = 0;

        if (status) {
            paramCount++;
            query += ` AND calibration_status = $${paramCount}`;
            params.push(status);
        }

        if (category) {
            paramCount++;
            query += ` AND category = $${paramCount}`;
            params.push(category);
        }

        if (search) {
            paramCount++;
            query += ` AND (
                equipment_name ILIKE $${paramCount} 
                OR serial_number ILIKE $${paramCount}
                OR manufacturer ILIKE $${paramCount}
                OR equipment_code ILIKE $${paramCount}
            )`;
            params.push(`%${search}%`);
        }

        query += ` ORDER BY 
            CASE calibration_status 
                WHEN 'Expired' THEN 1 
                WHEN 'Due Soon' THEN 2 
                WHEN 'Valid' THEN 3
                WHEN 'Not Calibrated' THEN 4
                ELSE 5
            END,
            calibration_expiry_date ASC NULLS LAST`;

        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching calibration status:', err);
        res.status(500).json({ error: 'Failed to fetch calibration status' });
    }
});

// ============================================
// GET EQUIPMENT DUE FOR CALIBRATION
// ============================================

router.get('/due', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT *
            FROM v_calibration_due
        `);
        res.json(result.rows);
    } catch (err) {
        console.error('Error fetching calibration due:', err);
        res.status(500).json({ error: 'Failed to fetch equipment due for calibration' });
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
            FROM v_equipment_calibration_status
            WHERE requires_calibration = TRUE
            GROUP BY calibration_status
            ORDER BY 
                CASE calibration_status 
                    WHEN 'Expired' THEN 1 
                    WHEN 'Due Soon' THEN 2 
                    WHEN 'Valid' THEN 3
                    WHEN 'Not Calibrated' THEN 4
                END
        `);
        
        // Also get total count
        const totalResult = await pool.query(`
            SELECT COUNT(*) as total
            FROM v_equipment_calibration_status
            WHERE requires_calibration = TRUE
        `);

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
// GET CALIBRATION HISTORY FOR EQUIPMENT
// ============================================

router.get('/history/:equipmentId', async (req, res) => {
    try {
        const { equipmentId } = req.params;
        
        // First, find the equipment by either numeric ID or equipment_id string
        const equipmentResult = await pool.query(`
            SELECT id FROM equipment 
            WHERE id = $1::integer OR equipment_id = $1::text
        `, [equipmentId]);
        
        if (equipmentResult.rows.length === 0) {
            return res.json([]);
        }
        
        const dbEquipmentId = equipmentResult.rows[0].id;
        
        const result = await pool.query(`
            SELECT 
                cr.id,
                cr.calibration_date,
                cr.expiry_date,
                cr.certificate_number,
                cr.certificate_file_path,
                cr.certificate_file_name,
                cr.certificate_mime_type,
                cr.calibration_provider,
                cr.notes,
                cr.created_at,
                cr.created_by,
                (cr.expiry_date - cr.calibration_date) as validity_days
            FROM calibration_records cr
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
// ADD NEW CALIBRATION RECORD
// ============================================

router.post('/', upload.single('certificate'), async (req, res) => {
    try {
        const {
            equipment_id,
            calibration_date,
            expiry_date,
            certificate_number,
            calibration_provider,
            notes
        } = req.body;

        // Validate required fields
        if (!equipment_id || !calibration_date || !expiry_date) {
            return res.status(400).json({ 
                error: 'equipment_id, calibration_date, and expiry_date are required' 
            });
        }

        // Get equipment internal ID if equipment_id is the code
        const equipmentResult = await pool.query(`
            SELECT id FROM equipment 
            WHERE id = $1::integer OR equipment_id = $1
        `, [equipment_id]);

        if (equipmentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Equipment not found' });
        }

        const equipmentInternalId = equipmentResult.rows[0].id;

        // Prepare file info if uploaded
        let filePath = null;
        let fileName = null;
        let mimeType = null;

        if (req.file) {
            if (isCloudMode) {
                // Upload to Supabase Storage
                const uploadResult = await uploadToSupabase(req.file, equipmentInternalId);
                filePath = uploadResult.url; // Store the public URL
                fileName = uploadResult.fileName;
                mimeType = uploadResult.mimeType;
            } else {
                // Local storage
                filePath = req.file.path;
                fileName = req.file.originalname;
                mimeType = req.file.mimetype;
            }
        }

        // Insert calibration record
        const result = await pool.query(`
            INSERT INTO calibration_records (
                equipment_id,
                calibration_date,
                expiry_date,
                certificate_number,
                certificate_file_path,
                certificate_file_name,
                certificate_mime_type,
                calibration_provider,
                notes,
                created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `, [
            equipmentInternalId,
            calibration_date,
            expiry_date,
            certificate_number,
            filePath,
            fileName,
            mimeType,
            calibration_provider,
            notes,
            req.body.created_by || 'System'
        ]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error('Error adding calibration record:', err);
        res.status(500).json({ error: 'Failed to add calibration record' });
    }
});

// ============================================
// UPDATE CALIBRATION RECORD
// ============================================

router.put('/:id', upload.single('certificate'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            calibration_date,
            expiry_date,
            certificate_number,
            calibration_provider,
            notes
        } = req.body;

        // Build update query dynamically
        const updates = [];
        const params = [];
        let paramCount = 0;

        if (calibration_date) {
            paramCount++;
            updates.push(`calibration_date = $${paramCount}`);
            params.push(calibration_date);
        }

        if (expiry_date) {
            paramCount++;
            updates.push(`expiry_date = $${paramCount}`);
            params.push(expiry_date);
        }

        if (certificate_number !== undefined) {
            paramCount++;
            updates.push(`certificate_number = $${paramCount}`);
            params.push(certificate_number);
        }

        if (calibration_provider !== undefined) {
            paramCount++;
            updates.push(`calibration_provider = $${paramCount}`);
            params.push(calibration_provider);
        }

        if (notes !== undefined) {
            paramCount++;
            updates.push(`notes = $${paramCount}`);
            params.push(notes);
        }

        // Handle file upload
        if (req.file) {
            if (isCloudMode) {
                // Upload to Supabase Storage
                // Get equipment_id from the record first
                const recordResult = await pool.query('SELECT equipment_id FROM calibration_records WHERE id = $1', [id]);
                const equipmentId = recordResult.rows[0]?.equipment_id || 'unknown';
                const uploadResult = await uploadToSupabase(req.file, equipmentId);
                
                paramCount++;
                updates.push(`certificate_file_path = $${paramCount}`);
                params.push(uploadResult.url);

                paramCount++;
                updates.push(`certificate_file_name = $${paramCount}`);
                params.push(uploadResult.fileName);

                paramCount++;
                updates.push(`certificate_mime_type = $${paramCount}`);
                params.push(uploadResult.mimeType);
            } else {
                // Local storage
                paramCount++;
                updates.push(`certificate_file_path = $${paramCount}`);
                params.push(req.file.path);

                paramCount++;
                updates.push(`certificate_file_name = $${paramCount}`);
                params.push(req.file.originalname);

                paramCount++;
                updates.push(`certificate_mime_type = $${paramCount}`);
                params.push(req.file.mimetype);
            }
        }

        updates.push('updated_at = CURRENT_TIMESTAMP');

        paramCount++;
        params.push(id);

        const result = await pool.query(`
            UPDATE calibration_records
            SET ${updates.join(', ')}
            WHERE id = $${paramCount}
            RETURNING *
        `, params);

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

        // Get file path before deleting
        const fileResult = await pool.query(`
            SELECT certificate_file_path FROM calibration_records WHERE id = $1
        `, [id]);

        if (fileResult.rows.length === 0) {
            return res.status(404).json({ error: 'Calibration record not found' });
        }

        // Delete the record
        await pool.query('DELETE FROM calibration_records WHERE id = $1', [id]);

        // Delete the certificate file if exists
        const filePath = fileResult.rows[0].certificate_file_path;
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.json({ message: 'Calibration record deleted successfully' });
    } catch (err) {
        console.error('Error deleting calibration record:', err);
        res.status(500).json({ error: 'Failed to delete calibration record' });
    }
});

// ============================================
// DOWNLOAD/VIEW CERTIFICATE FILE
// ============================================

router.get('/certificate/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT 
                certificate_file_path,
                certificate_file_name,
                certificate_mime_type
            FROM calibration_records 
            WHERE id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Calibration record not found' });
        }

        const { certificate_file_path, certificate_file_name, certificate_mime_type } = result.rows[0];

        if (!certificate_file_path) {
            return res.status(404).json({ error: 'Certificate file not found' });
        }

        // Check if it's a Supabase URL (cloud storage)
        if (certificate_file_path.startsWith('http')) {
            // Redirect to the Supabase public URL
            return res.redirect(certificate_file_path);
        }

        // Local file handling
        if (!fs.existsSync(certificate_file_path)) {
            return res.status(404).json({ error: 'Certificate file not found' });
        }

        // Set headers for file download/view
        res.setHeader('Content-Type', certificate_mime_type || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${certificate_file_name || 'certificate'}"`);

        // Stream the file
        const fileStream = fs.createReadStream(certificate_file_path);
        fileStream.pipe(res);
    } catch (err) {
        console.error('Error downloading certificate:', err);
        res.status(500).json({ error: 'Failed to download certificate' });
    }
});

// ============================================
// DOWNLOAD CERTIFICATE (FORCE DOWNLOAD)
// ============================================

router.get('/certificate/:id/download', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await pool.query(`
            SELECT 
                certificate_file_path,
                certificate_file_name,
                certificate_mime_type
            FROM calibration_records 
            WHERE id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Calibration record not found' });
        }

        const { certificate_file_path, certificate_file_name } = result.rows[0];

        if (!certificate_file_path) {
            return res.status(404).json({ error: 'Certificate file not found' });
        }

        // Check if it's a Supabase URL (cloud storage)
        if (certificate_file_path.startsWith('http')) {
            // Redirect to the Supabase public URL with download parameter
            return res.redirect(certificate_file_path);
        }

        // Local file handling
        if (!fs.existsSync(certificate_file_path)) {
            return res.status(404).json({ error: 'Certificate file not found' });
        }

        res.download(certificate_file_path, certificate_file_name);
    } catch (err) {
        console.error('Error downloading certificate:', err);
        res.status(500).json({ error: 'Failed to download certificate' });
    }
});

module.exports = router;
