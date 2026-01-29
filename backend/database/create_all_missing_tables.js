// Create all missing tables on production database
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function createAllTables() {
    console.log('Creating all missing tables...\n');
    
    try {
        // 1. Reservations table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS reservations (
                id SERIAL PRIMARY KEY,
                equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
                requested_by INTEGER,
                requested_by_name VARCHAR(200),
                reserved_from DATE NOT NULL,
                reserved_until DATE NOT NULL,
                purpose TEXT,
                destination VARCHAR(255),
                status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'completed')),
                approved_by INTEGER,
                approved_at TIMESTAMP,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ reservations table created');

        // 2. Notifications table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT,
                severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'success')),
                related_table VARCHAR(100),
                related_id INTEGER,
                is_read BOOLEAN DEFAULT FALSE,
                user_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ notifications table created');

        // 3. Settings table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS settings (
                id SERIAL PRIMARY KEY,
                key VARCHAR(100) UNIQUE NOT NULL,
                value TEXT,
                description TEXT,
                category VARCHAR(50) DEFAULT 'general',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ settings table created');

        // Insert default settings
        await pool.query(`
            INSERT INTO settings (key, value, description, category) VALUES
                ('company_name', 'WearCheck ARC', 'Company name', 'general'),
                ('calibration_warning_days', '30', 'Days before calibration expiry to show warning', 'calibration'),
                ('low_stock_threshold', '5', 'Threshold for low stock alerts', 'inventory')
            ON CONFLICT (key) DO NOTHING
        `);
        console.log('✅ Default settings inserted');

        // 4. Create indexes
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_reservations_equipment ON reservations(equipment_id);
            CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
            CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations(reserved_from, reserved_until);
            CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
            CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
        `);
        console.log('✅ Indexes created');

        console.log('\n✅ All tables ready!');
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

createAllTables();
