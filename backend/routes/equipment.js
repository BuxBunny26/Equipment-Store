const express = require('express');
const router = express.Router();
const pool = require('../database/db');

// GET all equipment with filters
router.get('/', async (req, res, next) => {
    try {
        const { 
            status, 
            category_id, 
            subcategory_id, 
            search,
            is_consumable,
            include_non_checkout
        } = req.query;
        
        let query = `
            SELECT 
                e.id,
                e.equipment_id,
                e.equipment_name,
                e.description,
                e.category_id,
                c.name as category_name,
                c.is_checkout_allowed,
                c.is_consumable,
                e.subcategory_id,
                s.name as subcategory_name,
                e.is_serialised,
                e.serial_number,
                e.is_quantity_tracked,
                e.total_quantity,
                e.available_quantity,
                e.unit,
                e.reorder_level,
                e.status,
                e.current_location_id,
                l.name as current_location,
                e.current_holder_id,
                p.full_name as current_holder,
                p.employee_id as holder_employee_id,
                e.last_action,
                e.last_action_timestamp,
                e.notes,
                e.created_at,
                e.updated_at
            FROM equipment e
            JOIN categories c ON e.category_id = c.id
            JOIN subcategories s ON e.subcategory_id = s.id
            LEFT JOIN locations l ON e.current_location_id = l.id
            LEFT JOIN personnel p ON e.current_holder_id = p.id
        `;
        
        const conditions = [];
        const params = [];
        
        if (status) {
            params.push(status);
            conditions.push(`e.status = $${params.length}`);
        }
        
        if (category_id) {
            params.push(category_id);
            conditions.push(`e.category_id = $${params.length}`);
        }
        
        if (subcategory_id) {
            params.push(subcategory_id);
            conditions.push(`e.subcategory_id = $${params.length}`);
        }
        
        if (is_consumable === 'true') {
            conditions.push('c.is_consumable = TRUE');
        } else if (is_consumable === 'false') {
            conditions.push('c.is_consumable = FALSE');
        }
        
        if (include_non_checkout !== 'true') {
            // By default, exclude non-checkout categories for main equipment views
            // conditions.push('c.is_checkout_allowed = TRUE');
        }
        
        if (search) {
            params.push(`%${search}%`);
            conditions.push(`(
                e.equipment_id ILIKE $${params.length} OR 
                e.equipment_name ILIKE $${params.length} OR 
                e.serial_number ILIKE $${params.length} OR
                e.description ILIKE $${params.length}
            )`);
        }
        
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }
        
        query += ' ORDER BY e.equipment_name';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        next(error);
    }
});

// GET single equipment with full details
router.get('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        
        const result = await pool.query(`
            SELECT 
                e.*,
                c.name as category_name,
                c.is_checkout_allowed,
                c.is_consumable,
                s.name as subcategory_name,
                l.name as current_location,
                p.full_name as current_holder,
                p.employee_id as holder_employee_id,
                p.email as holder_email
            FROM equipment e
            JOIN categories c ON e.category_id = c.id
            JOIN subcategories s ON e.subcategory_id = s.id
            LEFT JOIN locations l ON e.current_location_id = l.id
            LEFT JOIN personnel p ON e.current_holder_id = p.id
            WHERE e.id = $1
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: { message: 'Equipment not found' } });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// GET equipment by equipment_id (string ID)
router.get('/by-code/:equipmentId', async (req, res, next) => {
    try {
        const { equipmentId } = req.params;
        
        const result = await pool.query(`
            SELECT 
                e.*,
                c.name as category_name,
                c.is_checkout_allowed,
                c.is_consumable,
                s.name as subcategory_name,
                l.name as current_location,
                p.full_name as current_holder,
                p.employee_id as holder_employee_id
            FROM equipment e
            JOIN categories c ON e.category_id = c.id
            JOIN subcategories s ON e.subcategory_id = s.id
            LEFT JOIN locations l ON e.current_location_id = l.id
            LEFT JOIN personnel p ON e.current_holder_id = p.id
            WHERE e.equipment_id = $1
        `, [equipmentId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: { message: 'Equipment not found' } });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        next(error);
    }
});

// POST create equipment
router.post('/', async (req, res, next) => {
    try {
        const {
            equipment_id,
            equipment_name,
            description,
            category_id,
            subcategory_id,
            is_serialised = true,
            serial_number,
            is_quantity_tracked = false,
            total_quantity = 1,
            unit = 'ea',
            reorder_level = 0,
            current_location_id,
            notes
        } = req.body;
        
        // Validations
        if (!equipment_id || equipment_id.trim() === '') {
            return res.status(400).json({ error: { message: 'Equipment ID is required' } });
        }
        
        if (!equipment_name || equipment_name.trim() === '') {
            return res.status(400).json({ error: { message: 'Equipment name is required' } });
        }
        
        if (!category_id) {
            return res.status(400).json({ error: { message: 'Category is required' } });
        }
        
        if (!subcategory_id) {
            return res.status(400).json({ error: { message: 'Subcategory is required' } });
        }
        
        // Verify subcategory belongs to category
        const subcatCheck = await pool.query(
            'SELECT id FROM subcategories WHERE id = $1 AND category_id = $2',
            [subcategory_id, category_id]
        );
        
        if (subcatCheck.rows.length === 0) {
            return res.status(400).json({ 
                error: { message: 'Subcategory does not belong to the selected category' } 
            });
        }
        
        // Serial number validation
        if (is_serialised && (!serial_number || serial_number.trim() === '')) {
            return res.status(400).json({ 
                error: { message: 'Serial number is required for serialised equipment' } 
            });
        }
        
        const result = await pool.query(`
            INSERT INTO equipment (
                equipment_id, equipment_name, description,
                category_id, subcategory_id,
                is_serialised, serial_number,
                is_quantity_tracked, total_quantity, available_quantity, unit, reorder_level,
                status, current_location_id, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, $10, $11, 'Available', $12, $13)
            RETURNING *
        `, [
            equipment_id.trim(),
            equipment_name.trim(),
            description,
            category_id,
            subcategory_id,
            is_serialised,
            serial_number ? serial_number.trim() : null,
            is_quantity_tracked,
            total_quantity,
            unit,
            reorder_level,
            current_location_id,
            notes
        ]);
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            if (error.constraint === 'equipment_equipment_id_key') {
                return res.status(400).json({ error: { message: 'Equipment ID already exists' } });
            }
            if (error.constraint === 'idx_unique_serial_number') {
                return res.status(400).json({ error: { message: 'Serial number already exists' } });
            }
            return res.status(400).json({ error: { message: 'Duplicate value error' } });
        }
        next(error);
    }
});

// PUT update equipment (metadata only - not state)
router.put('/:id', async (req, res, next) => {
    try {
        const { id } = req.params;
        const {
            equipment_name,
            description,
            category_id,
            subcategory_id,
            is_serialised,
            serial_number,
            is_quantity_tracked,
            total_quantity,
            unit,
            reorder_level,
            notes
        } = req.body;
        
        // If changing category/subcategory, verify the relationship
        if (category_id && subcategory_id) {
            const subcatCheck = await pool.query(
                'SELECT id FROM subcategories WHERE id = $1 AND category_id = $2',
                [subcategory_id, category_id]
            );
            
            if (subcatCheck.rows.length === 0) {
                return res.status(400).json({ 
                    error: { message: 'Subcategory does not belong to the selected category' } 
                });
            }
        }
        
        const result = await pool.query(`
            UPDATE equipment SET
                equipment_name = COALESCE($1, equipment_name),
                description = COALESCE($2, description),
                category_id = COALESCE($3, category_id),
                subcategory_id = COALESCE($4, subcategory_id),
                is_serialised = COALESCE($5, is_serialised),
                serial_number = COALESCE($6, serial_number),
                is_quantity_tracked = COALESCE($7, is_quantity_tracked),
                total_quantity = COALESCE($8, total_quantity),
                unit = COALESCE($9, unit),
                reorder_level = COALESCE($10, reorder_level),
                notes = COALESCE($11, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $12
            RETURNING *
        `, [
            equipment_name,
            description,
            category_id,
            subcategory_id,
            is_serialised,
            serial_number,
            is_quantity_tracked,
            total_quantity,
            unit,
            reorder_level,
            notes,
            id
        ]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: { message: 'Equipment not found' } });
        }
        
        res.json(result.rows[0]);
    } catch (error) {
        if (error.code === '23505') {
            return res.status(400).json({ error: { message: 'Duplicate value error' } });
        }
        next(error);
    }
});

// GET equipment movement history
router.get('/:id/history', async (req, res, next) => {
    try {
        const { id } = req.params;
        const { limit = 50 } = req.query;
        
        const result = await pool.query(`
            SELECT 
                m.id,
                m.action,
                m.quantity,
                l.name as location,
                p.full_name as personnel,
                p.employee_id as personnel_employee_id,
                m.notes,
                m.created_at,
                m.created_by
            FROM equipment_movements m
            LEFT JOIN locations l ON m.location_id = l.id
            LEFT JOIN personnel p ON m.personnel_id = p.id
            WHERE m.equipment_id = $1
            ORDER BY m.created_at DESC
            LIMIT $2
        `, [id, limit]);
        
        res.json(result.rows);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
