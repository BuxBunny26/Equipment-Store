const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for photo uploads
const PHOTOS_DIR = path.join(
    'C:', 'Users', 'nadhi', 
    'OneDrive - Wearcheck Reliability Solutions',
    'WearCheck ARC Documents', 'RS', 'Equipment Photos'
);

// Ensure photos directory exists
if (!fs.existsSync(PHOTOS_DIR)) {
    fs.mkdirSync(PHOTOS_DIR, { recursive: true });
}

const photoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, PHOTOS_DIR);
    },
    filename: (req, file, cb) => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const action = req.body.action || 'movement';
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `${action}_${timestamp}${ext}`);
    }
});

const photoUpload = multer({
    storage: photoStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp|heic/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype) || file.mimetype.startsWith('image/');
        if (extname || mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// GET all movements with filters
router.get('/', async (req, res, next) => {
    try {
        const { 
            equipment_id, 
            action, 
            personnel_id,
            location_id,
            from_date,
            to_date,
            limit = 100 
        } = req.query;
        
        let query = `
            SELECT 
                m.id,
                m.equipment_id as equipment_pk,
                e.equipment_id,
                e.equipment_name,
                m.action,
                m.quantity,
                m.location_id,
                l.name as location,
                m.customer_id,
                cust.display_name as customer_name,
                m.personnel_id,
                p.full_name as personnel,
                p.employee_id as personnel_employee_id,
                m.notes,
                m.created_at,
                m.created_by
            FROM equipment_movements m
            JOIN equipment e ON m.equipment_id = e.id
            LEFT JOIN locations l ON m.location_id = l.id
            LEFT JOIN customers cust ON m.customer_id = cust.id
            LEFT JOIN personnel p ON m.personnel_id = p.id
        `;
        
        const conditions = [];
        const params = [];
        
        if (equipment_id) {
            params.push(equipment_id);
            conditions.push(`m.equipment_id = $${params.length}`);
        }
        
        if (action) {
            params.push(action);
            conditions.push(`m.action = $${params.length}`);
        }
        
        if (personnel_id) {
            params.push(personnel_id);
            conditions.push(`m.personnel_id = $${params.length}`);
        }
        
        if (location_id) {
            params.push(location_id);
            conditions.push(`m.location_id = $${params.length}`);
        }
        
        if (from_date) {
            params.push(from_date);
            conditions.push(`m.created_at >= $${params.length}`);
        }
        
        if (to_date) {
            params.push(to_date);
            conditions.push(`m.created_at <= $${params.length}`);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY m.created_at DESC';
        
        params.push(limit);
        query += ` LIMIT $${params.length}`;
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        next(error);
    }
});

// POST create movement (Check Out / Check In / Issue / Restock)
router.post('/', photoUpload.single('photo'), async (req, res, next) => {
    const client = await pool.connect();
    try {
        const {
            equipment_id,  // This is the primary key ID
            action,
            quantity = 1,
            location_id,
            customer_id,
            personnel_id,
            notes,
            created_by,
            destination_type,
            calibration_provider
        } = req.body;

        // For OUT and ISSUE, either location_id or customer_id or calibration_provider is required, plus personnel
        if (["OUT", "ISSUE"].includes(action.toUpperCase())) {
            if (!location_id && !customer_id && !(destination_type === 'calibration' && calibration_provider)) {
                return res.status(400).json({ error: { message: 'Location, Customer Site, or Calibration Provider is required for check-out' } });
            }
            if (!personnel_id) {
                return res.status(400).json({ error: { message: 'Personnel is required for check-out' } });
            }
        }

        // Condition check (required)
        const { condition } = req.body;
        if (!condition || !['Excellent', 'Good', 'Poor'].includes(condition)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: { message: 'Condition is required and must be Excellent, Good, or Poor.' } });
        }
        // Reason logic for condition
        const { reason } = req.body;
        let requireReason = false;
        if (condition !== 'Excellent') {
            // Get last OUT movement for this equipment
            const lastMovementRes = await pool.query(
                `SELECT notes FROM equipment_movements WHERE equipment_id = $1 AND action = 'OUT' ORDER BY created_at DESC LIMIT 1`,
                [equipment_id]
            );
            let lastCondition = 'Excellent';
            let lastReason = '';
            if (lastMovementRes.rows.length > 0) {
                const lastNotes = lastMovementRes.rows[0].notes || '';
                const condMatch = lastNotes.match(/\[Condition: (Excellent|Good|Poor)\]/);
                if (condMatch) lastCondition = condMatch[1];
                const reasonMatch = lastNotes.match(/Reason: ([^|]+)/);
                if (reasonMatch) lastReason = reasonMatch[1].trim();
            }
            // Require reason if no previous reason or condition worsened
            if (!lastReason || (lastCondition !== condition && ['Excellent','Good','Poor'].indexOf(condition) > ['Excellent','Good','Poor'].indexOf(lastCondition))) {
                requireReason = true;
            }
            if (requireReason && !reason) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: { message: 'Reason is required for non-Excellent condition or if condition worsened.' } });
            }
        }
        // Add condition and reason to movement notes
        let movementNotes = `[Condition: ${condition}]`;
        if (condition !== 'Excellent') movementNotes += ` | Reason: ${reason || ''}`;
        if (notes) movementNotes += ` | ${notes}`;

        // Handle TRANSFER action
        if (action.toUpperCase() === 'TRANSFER') {
            // Validate both sites
            const { from_site_id, to_site_id } = req.body;
            if (!from_site_id || !to_site_id) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: { message: 'Both From Site and To Site are required for transfer.' } });
            }
            // Compose transfer notes
            notes = `Transfer from Site ID: ${from_site_id} to Site ID: ${to_site_id}${notes ? ' | ' + notes : ''}`;
            movementLocationId = null;
            movementCustomerId = to_site_id;
        }

        await client.query('BEGIN');
        
        // Get equipment details to check state
        const equipmentResult = await client.query(`
            SELECT 
                e.id, e.equipment_id, e.equipment_name, e.status,
                e.is_quantity_tracked, e.available_quantity, e.total_quantity,
                c.is_consumable, c.is_checkout_allowed, c.name as category_name
            FROM equipment e
            JOIN categories c ON e.category_id = c.id
            WHERE e.id = $1
            FOR UPDATE
        `, [equipment_id]);
        
        if (equipmentResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: { message: 'Equipment not found' } });
        }
        
        const equipment = equipmentResult.rows[0];
        
        // Pre-validation based on action type
        const upperAction = action.toUpperCase();
        
        if (upperAction === 'OUT') {
            if (equipment.is_consumable) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: { message: 'Cannot check out consumable items. Use ISSUE action instead.' } 
                });
            }
            
            if (!equipment.is_checkout_allowed) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: { message: `Checkout is not allowed for category: ${equipment.category_name}` } 
                });
            }
            
            if (equipment.status !== 'Available') {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: { message: `Equipment is not available for checkout. Current status: ${equipment.status}` } 
                });
            }
            
            if (equipment.is_quantity_tracked && quantity > equipment.available_quantity) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: { message: `Insufficient quantity. Requested: ${quantity}, Available: ${equipment.available_quantity}` } 
                });
            }
        }
        
        if (upperAction === 'IN') {
            if (equipment.is_consumable) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: { message: 'Cannot check in consumable items.' } 
                });
            }
            
            if (!equipment.is_quantity_tracked && equipment.status !== 'Checked Out') {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: { message: `Equipment is not checked out. Current status: ${equipment.status}` } 
                });
            }
            
            if (equipment.is_quantity_tracked) {
                const maxReturnable = equipment.total_quantity - equipment.available_quantity;
                if (quantity > maxReturnable) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ 
                        error: { message: `Cannot return more than checked out. Max returnable: ${maxReturnable}` } 
                    });
                }
            }
        }
        
        if (upperAction === 'ISSUE') {
            if (!equipment.is_consumable) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: { message: 'ISSUE action is only for consumables. Use OUT for equipment.' } 
                });
            }
            
            if (quantity > equipment.available_quantity) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: { message: `Insufficient stock. Requested: ${quantity}, Available: ${equipment.available_quantity}` } 
                });
            }
        }
        
        if (upperAction === 'RESTOCK') {
            if (!equipment.is_consumable) {
                await client.query('ROLLBACK');
                return res.status(400).json({ 
                    error: { message: 'RESTOCK action is only for consumables.' } 
                });
            }
        }
        
        // Get photo info if uploaded
        const photoFilePath = req.file ? req.file.path : null;
        const photoFileName = req.file ? req.file.filename : null;
        const photoMimeType = req.file ? req.file.mimetype : null;
        
        // Insert movement record (trigger will update equipment state)
        const movementResult = await client.query(`
            INSERT INTO equipment_movements (
                equipment_id, action, quantity, location_id, customer_id, personnel_id, notes, created_by,
                photo_file_path, photo_file_name, photo_mime_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING *
        `, [
            equipment_id,
            upperAction,
            quantity,
            movementLocationId,
            movementCustomerId,
            personnel_id,
            movementNotes,
            created_by,
            photoFilePath,
            photoFileName,
            photoMimeType
        ]);
        
        await client.query('COMMIT');
        
        // Fetch updated equipment state
        const updatedEquipment = await pool.query(`
            SELECT 
                e.*,
                c.name as category_name,
                l.name as current_location,
                p.full_name as current_holder
            FROM equipment e
            JOIN categories c ON e.category_id = c.id
            LEFT JOIN locations l ON e.current_location_id = l.id
            LEFT JOIN personnel p ON e.current_holder_id = p.id
            WHERE e.id = $1
        `, [equipment_id]);
        
        res.status(201).json({
            movement: movementResult.rows[0],
            equipment: updatedEquipment.rows[0]
        });
        
    } catch (error) {
        await client.query('ROLLBACK');
        
        // Handle trigger errors gracefully
        if (error.message.includes('Cannot') || 
            error.message.includes('not available') ||
            error.message.includes('not allowed') ||
            error.message.includes('Insufficient')) {
            return res.status(400).json({ error: { message: error.message } });
        }
        
        next(error);
    } finally {
        client.release();
    }
});

// POST quick handover (IN then OUT as atomic transaction)
const { body } = require('express-validator');
const validate = require('../middleware/validate');
const auth = require('../middleware/auth');

router.post(
    '/',
    auth,
    [
        body('equipment_id').isInt().withMessage('equipment_id must be integer'),
        body('action').isString().isIn(['OUT', 'IN', 'ISSUE', 'RESTOCK', 'TRANSFER']).withMessage('Invalid action'),
        body('quantity').isInt({ min: 1 }).withMessage('quantity must be positive integer'),
        body('personnel_id').isInt().withMessage('personnel_id must be integer'),
        body('notes').optional().isString(),
        body('location_id').optional().isInt(),
        body('customer_id').optional().isInt(),
        body('created_by').optional().isString(),
        body('condition').isString().isIn(['Excellent', 'Good', 'Poor']).withMessage('Invalid condition'),
        body('reason').optional().isString()
    ],
    validate,
    photoUpload.single('photo'),
    async (req, res, next) => {
        const client = await pool.connect();
        try {
            const {
                equipment_id,  // This is the primary key ID
                action,
                quantity = 1,
                location_id,
                customer_id,
                personnel_id,
                notes,
                created_by,
                destination_type,
                calibration_provider,
                condition,
                reason
            } = req.body;

            // For OUT and ISSUE, either location_id or customer_id or calibration_provider is required, plus personnel
            if (["OUT", "ISSUE"].includes(action.toUpperCase())) {
                if (!location_id && !customer_id && !(destination_type === 'calibration' && calibration_provider)) {
                    return res.status(400).json({ error: { message: 'Location, Customer Site, or Calibration Provider is required for check-out' } });
                }
                if (!personnel_id) {
                    return res.status(400).json({ error: { message: 'Personnel is required for check-out' } });
                }
            }

            // Reason logic for condition
            let requireReason = false;
            if (condition !== 'Excellent') {
                // Get last OUT movement for this equipment
                const lastMovementRes = await pool.query(
                    `SELECT notes FROM equipment_movements WHERE equipment_id = $1 AND action = 'OUT' ORDER BY created_at DESC LIMIT 1`,
                    [equipment_id]
                );
                let lastCondition = 'Excellent';
                let lastReason = '';
                if (lastMovementRes.rows.length > 0) {
                    const lastNotes = lastMovementRes.rows[0].notes || '';
                    const condMatch = lastNotes.match(/\[Condition: (Excellent|Good|Poor)\]/);
                    if (condMatch) lastCondition = condMatch[1];
                    const reasonMatch = lastNotes.match(/Reason: ([^|]+)/);
                    if (reasonMatch) lastReason = reasonMatch[1].trim();
                }
                // Require reason if no previous reason or condition worsened
                if (!lastReason || (lastCondition !== condition && ['Excellent','Good','Poor'].indexOf(condition) > ['Excellent','Good','Poor'].indexOf(lastCondition))) {
                    requireReason = true;
                }
                if (requireReason && !reason) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: { message: 'Reason is required for non-Excellent condition or if condition worsened.' } });
                }
            }
            // Add condition and reason to movement notes
            let movementNotes = `[Condition: ${condition}]`;
            if (condition !== 'Excellent') movementNotes += ` | Reason: ${reason || ''}`;
            if (notes) movementNotes += ` | ${notes}`;

            // Handle TRANSFER action
            if (action.toUpperCase() === 'TRANSFER') {
                // Validate both sites
                const { from_site_id, to_site_id } = req.body;
                if (!from_site_id || !to_site_id) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: { message: 'Both From Site and To Site are required for transfer.' } });
                }
                // Compose transfer notes
                notes = `Transfer from Site ID: ${from_site_id} to Site ID: ${to_site_id}${notes ? ' | ' + notes : ''}`;
                movementLocationId = null;
                movementCustomerId = to_site_id;
            }

            await client.query('BEGIN');
            // ...existing code...
        } catch (error) {
            await client.query('ROLLBACK');
            // Handle trigger errors gracefully
            if (error.message.includes('Cannot') || 
                    error.message.includes('not available') ||
                    error.message.includes('not allowed') ||
                    error.message.includes('Insufficient')) {
                return res.status(400).json({ error: { message: error.message } });
            }
            next(error);
        } finally {
            client.release();
        }
    }
);
        client.release();
    }
});

// GET photo for a movement
router.get('/photo/:movementId', async (req, res, next) => {
    try {
        const { movementId } = req.params;
        
        const result = await pool.query(`
            SELECT photo_file_path, photo_file_name, photo_mime_type
            FROM equipment_movements
            WHERE id = $1
        `, [movementId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Movement not found' });
        }
        
        const { photo_file_path, photo_file_name, photo_mime_type } = result.rows[0];
        
        if (!photo_file_path) {
            return res.status(404).json({ error: 'No photo for this movement' });
        }
        
        if (!fs.existsSync(photo_file_path)) {
            return res.status(404).json({ error: 'Photo file not found on disk' });
        }
        
        res.setHeader('Content-Type', photo_mime_type || 'image/jpeg');
        res.setHeader('Content-Disposition', `inline; filename="${photo_file_name}"`);
        res.sendFile(photo_file_path);
        
    } catch (error) {
        next(error);
    }
});

module.exports = router;
