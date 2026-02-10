const express = require('express');
const router = express.Router();
const pool = require('../database/db');

// GET dashboard summary
router.get('/dashboard', async (req, res, next) => {
    try {
        const overdueThresholdDays = parseInt(process.env.OVERDUE_THRESHOLD_DAYS) || 14;
        
        // Total equipment count
        const totalEquipment = await pool.query(`
            SELECT COUNT(*) as count FROM equipment e
            JOIN categories c ON e.category_id = c.id
            WHERE c.is_consumable = FALSE
        `);
        
        // Available equipment
        const availableEquipment = await pool.query(`
            SELECT COUNT(*) as count FROM equipment e
            JOIN categories c ON e.category_id = c.id
            WHERE e.status = 'Available' AND c.is_consumable = FALSE
        `);
        
        // Checked out equipment
        const checkedOutEquipment = await pool.query(`
            SELECT COUNT(*) as count FROM equipment e
            JOIN categories c ON e.category_id = c.id
            WHERE e.status = 'Checked Out' AND c.is_consumable = FALSE
        `);
        
        // Overdue equipment
        const overdueEquipment = await pool.query(`
            SELECT COUNT(*) as count FROM equipment e
            JOIN categories c ON e.category_id = c.id
            WHERE e.status = 'Checked Out' 
                AND c.is_consumable = FALSE
                AND e.last_action_timestamp < (CURRENT_TIMESTAMP - INTERVAL '${overdueThresholdDays} days')
        `);
        
        // Low stock consumables
        const lowStockConsumables = await pool.query(`
            SELECT COUNT(*) as count FROM equipment e
            JOIN categories c ON e.category_id = c.id
            WHERE c.is_consumable = TRUE
                AND e.available_quantity <= e.reorder_level
        `);
        
        // Total consumable items
        const totalConsumables = await pool.query(`
            SELECT COUNT(*) as count FROM equipment e
            JOIN categories c ON e.category_id = c.id
            WHERE c.is_consumable = TRUE
        `);
        
        // Recent movements (last 10)
        const recentMovements = await pool.query(`
            SELECT 
                m.id,
                e.equipment_id,
                e.equipment_name,
                m.action,
                m.quantity,
                l.name as location,
                p.full_name as personnel,
                m.created_at
            FROM equipment_movements m
            JOIN equipment e ON m.equipment_id = e.id
            LEFT JOIN locations l ON m.location_id = l.id
            LEFT JOIN personnel p ON m.personnel_id = p.id
            ORDER BY m.created_at DESC
            LIMIT 10
        `);
        
        res.json({
            summary: {
                total_equipment: parseInt(totalEquipment.rows[0].count),
                available_equipment: parseInt(availableEquipment.rows[0].count),
                checked_out_equipment: parseInt(checkedOutEquipment.rows[0].count),
                overdue_equipment: parseInt(overdueEquipment.rows[0].count),
                total_consumables: parseInt(totalConsumables.rows[0].count),
                low_stock_consumables: parseInt(lowStockConsumables.rows[0].count),
                overdue_threshold_days: overdueThresholdDays
            },
            recent_movements: recentMovements.rows
        });
    } catch (error) {
        next(error);
    }
});

// GET checked out equipment list
router.get('/checked-out', async (req, res, next) => {
    try {
        const overdueThresholdDays = parseInt(process.env.OVERDUE_THRESHOLD_DAYS) || 14;
        
        const result = await pool.query(`
            SELECT 
                e.id,
                e.equipment_id,
                e.equipment_name,
                c.name AS category,
                s.name AS subcategory,
                e.serial_number,
                e.status,
                l.name AS current_location,
                p.full_name AS checked_out_to,
                p.employee_id AS holder_employee_id,
                p.email AS holder_email,
                e.last_action_timestamp AS checked_out_at,
                EXTRACT(DAY FROM (CURRENT_TIMESTAMP - e.last_action_timestamp))::INTEGER AS days_out,
                CASE 
                    WHEN e.last_action_timestamp < (CURRENT_TIMESTAMP - INTERVAL '${overdueThresholdDays} days') 
                    THEN TRUE 
                    ELSE FALSE 
                END AS is_overdue
            FROM equipment e
            JOIN categories c ON e.category_id = c.id
            JOIN subcategories s ON e.subcategory_id = s.id
            LEFT JOIN locations l ON e.current_location_id = l.id
            LEFT JOIN personnel p ON e.current_holder_id = p.id
            WHERE e.status = 'Checked Out'
                AND c.is_consumable = FALSE
            ORDER BY e.last_action_timestamp ASC
        `);
        
        res.json(result.rows);
    } catch (error) {
        next(error);
    }
});

// GET overdue equipment list
router.get('/overdue', async (req, res, next) => {
    try {
        const overdueThresholdDays = parseInt(process.env.OVERDUE_THRESHOLD_DAYS) || 14;
        
        const result = await pool.query(`
            SELECT 
                e.id,
                e.equipment_id,
                e.equipment_name,
                c.name AS category,
                s.name AS subcategory,
                e.serial_number,
                l.name AS current_location,
                p.full_name AS checked_out_to,
                p.employee_id AS holder_employee_id,
                p.email AS holder_email,
                e.last_action_timestamp AS checked_out_at,
                EXTRACT(DAY FROM (CURRENT_TIMESTAMP - e.last_action_timestamp))::INTEGER AS days_overdue
            FROM equipment e
            JOIN categories c ON e.category_id = c.id
            JOIN subcategories s ON e.subcategory_id = s.id
            LEFT JOIN locations l ON e.current_location_id = l.id
            LEFT JOIN personnel p ON e.current_holder_id = p.id
            WHERE e.status = 'Checked Out'
                AND c.is_consumable = FALSE
                AND e.last_action_timestamp < (CURRENT_TIMESTAMP - INTERVAL '${overdueThresholdDays} days')
            ORDER BY e.last_action_timestamp ASC
        `);
        
        res.json({
            threshold_days: overdueThresholdDays,
            count: result.rows.length,
            items: result.rows
        });
    } catch (error) {
        next(error);
    }
});

// GET available equipment list
router.get('/available', async (req, res, next) => {
    try {
        const { category_id } = req.query;
        
        let query = `
            SELECT 
                e.id,
                e.equipment_id,
                e.equipment_name,
                c.name AS category,
                c.is_checkout_allowed,
                s.name AS subcategory,
                e.serial_number,
                e.is_quantity_tracked,
                e.available_quantity,
                e.unit,
                l.name AS current_location,
                cal.expiry_date AS calibration_expiry_date,
                CASE 
                    WHEN cal.expiry_date IS NULL THEN 'N/A'
                    WHEN cal.expiry_date < CURRENT_DATE THEN 'Expired'
                    WHEN cal.expiry_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'Due Soon'
                    ELSE 'Valid'
                END AS calibration_status
            FROM equipment e
            JOIN categories c ON e.category_id = c.id
            JOIN subcategories s ON e.subcategory_id = s.id
            LEFT JOIN locations l ON e.current_location_id = l.id
            LEFT JOIN LATERAL (
                SELECT expiry_date 
                FROM calibration_records 
                WHERE equipment_id = e.id 
                ORDER BY calibration_date DESC 
                LIMIT 1
            ) cal ON true
            WHERE e.status = 'Available'
                AND c.is_consumable = FALSE
        `;
        
        const params = [];
        
        if (category_id) {
            params.push(category_id);
            query += ` AND e.category_id = $${params.length}`;
        }
        
        query += ' ORDER BY e.equipment_name';
        
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        next(error);
    }
});

// GET low stock consumables
router.get('/low-stock', async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT 
                e.id,
                e.equipment_id,
                e.equipment_name,
                c.name AS category,
                s.name AS subcategory,
                e.available_quantity,
                e.total_quantity,
                e.reorder_level,
                e.unit,
                l.name AS current_location
            FROM equipment e
            JOIN categories c ON e.category_id = c.id
            JOIN subcategories s ON e.subcategory_id = s.id
            LEFT JOIN locations l ON e.current_location_id = l.id
            WHERE c.is_consumable = TRUE
                AND e.available_quantity <= e.reorder_level
            ORDER BY (e.available_quantity::float / NULLIF(e.reorder_level, 0)) ASC
        `);
        
        res.json(result.rows);
    } catch (error) {
        next(error);
    }
});

// GET consumables inventory
router.get('/consumables', async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT 
                e.id,
                e.equipment_id,
                e.equipment_name,
                c.name AS category,
                s.name AS subcategory,
                e.available_quantity,
                e.total_quantity,
                e.reorder_level,
                e.unit,
                l.name AS current_location,
                CASE 
                    WHEN e.available_quantity <= e.reorder_level THEN TRUE 
                    ELSE FALSE 
                END AS is_low_stock
            FROM equipment e
            JOIN categories c ON e.category_id = c.id
            JOIN subcategories s ON e.subcategory_id = s.id
            LEFT JOIN locations l ON e.current_location_id = l.id
            WHERE c.is_consumable = TRUE
            ORDER BY e.equipment_name
        `);
        
        res.json(result.rows);
    } catch (error) {
        next(error);
    }
});

// GET equipment by category summary
router.get('/by-category', async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT 
                c.id as category_id,
                c.name as category,
                c.is_checkout_allowed,
                c.is_consumable,
                COUNT(e.id) as total_items,
                COUNT(CASE WHEN e.status = 'Available' THEN 1 END) as available,
                COUNT(CASE WHEN e.status = 'Checked Out' THEN 1 END) as checked_out
            FROM categories c
            LEFT JOIN equipment e ON c.id = e.category_id
            GROUP BY c.id, c.name, c.is_checkout_allowed, c.is_consumable
            ORDER BY c.name
        `);
        
        res.json(result.rows);
    } catch (error) {
        next(error);
    }
});

// GET equipment by location summary
router.get('/by-location', async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT 
                l.id as location_id,
                l.name as location,
                COUNT(e.id) as total_items,
                COUNT(CASE WHEN e.status = 'Available' THEN 1 END) as available,
                COUNT(CASE WHEN e.status = 'Checked Out' THEN 1 END) as checked_out
            FROM locations l
            LEFT JOIN equipment e ON l.id = e.current_location_id
            WHERE l.is_active = TRUE
            GROUP BY l.id, l.name
            ORDER BY l.name
        `);
        
        res.json(result.rows);
    } catch (error) {
        next(error);
    }
});

// GET movement history for date range
router.get('/movement-history', async (req, res, next) => {
    try {
        const { 
            from_date, 
            to_date, 
            action,
            personnel_id,
            limit = 500 
        } = req.query;
        
        let query = `
            SELECT 
                m.id,
                e.equipment_id,
                e.equipment_name,
                c.name as category,
                m.action,
                m.quantity,
                l.name as location,
                p.full_name as personnel,
                p.employee_id as personnel_employee_id,
                m.notes,
                m.created_at,
                m.created_by
            FROM equipment_movements m
            JOIN equipment e ON m.equipment_id = e.id
            JOIN categories c ON e.category_id = c.id
            LEFT JOIN locations l ON m.location_id = l.id
            LEFT JOIN personnel p ON m.personnel_id = p.id
        `;
        
        const conditions = [];
        const params = [];
        
        if (from_date) {
            params.push(from_date);
            conditions.push(`m.created_at >= $${params.length}`);
        }
        
        if (to_date) {
            params.push(to_date);
            conditions.push(`m.created_at <= $${params.length}`);
        }
        
        if (action) {
            params.push(action);
            conditions.push(`m.action = $${params.length}`);
        }
        
        if (personnel_id) {
            params.push(personnel_id);
            conditions.push(`m.personnel_id = $${params.length}`);
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

// GET usage statistics
router.get('/usage-stats', async (req, res, next) => {
    try {
        const { from_date, to_date } = req.query;
        
        let dateFilter = '';
        const params = [];
        
        if (from_date) {
            params.push(from_date);
            dateFilter += ` AND m.created_at >= $${params.length}`;
        }
        
        if (to_date) {
            params.push(to_date);
            dateFilter += ` AND m.created_at <= $${params.length}`;
        }
        
        // Most checked out equipment
        const mostCheckedOut = await pool.query(`
            SELECT 
                e.equipment_id,
                e.equipment_name,
                COUNT(*) as checkout_count
            FROM equipment_movements m
            JOIN equipment e ON m.equipment_id = e.id
            WHERE m.action = 'OUT' ${dateFilter}
            GROUP BY e.id, e.equipment_id, e.equipment_name
            ORDER BY checkout_count DESC
            LIMIT 10
        `, params);
        
        // Most active personnel
        const mostActivePersonnel = await pool.query(`
            SELECT 
                p.employee_id,
                p.full_name,
                COUNT(*) as movement_count,
                COUNT(CASE WHEN m.action = 'OUT' THEN 1 END) as checkouts,
                COUNT(CASE WHEN m.action = 'IN' THEN 1 END) as checkins
            FROM equipment_movements m
            JOIN personnel p ON m.personnel_id = p.id
            WHERE m.action IN ('OUT', 'IN') ${dateFilter}
            GROUP BY p.id, p.employee_id, p.full_name
            ORDER BY movement_count DESC
            LIMIT 10
        `, params);
        
        // Movements by action type
        const movementsByAction = await pool.query(`
            SELECT 
                action,
                COUNT(*) as count
            FROM equipment_movements m
            WHERE 1=1 ${dateFilter}
            GROUP BY action
            ORDER BY count DESC
        `, params);
        
        res.json({
            most_checked_out: mostCheckedOut.rows,
            most_active_personnel: mostActivePersonnel.rows,
            movements_by_action: movementsByAction.rows
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
