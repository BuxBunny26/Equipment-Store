// Create maintenance tables on production database
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function createMaintenanceTables() {
    console.log('Creating maintenance tables...\n');
    
    try {
        // Create maintenance_types table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS maintenance_types (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL UNIQUE,
                description TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ maintenance_types table created');
        
        // Insert default types
        await pool.query(`
            INSERT INTO maintenance_types (name, description) VALUES 
                ('Repair', 'Equipment repair due to damage or malfunction'),
                ('Service', 'Scheduled preventive maintenance'),
                ('Cleaning', 'Cleaning and decontamination'),
                ('Software Update', 'Firmware or software updates'),
                ('Battery Replacement', 'Battery replacement or charging system service'),
                ('Accessory Replacement', 'Cables, probes, or other accessories replaced'),
                ('Inspection', 'General inspection and testing')
            ON CONFLICT (name) DO NOTHING
        `);
        console.log('✅ Default maintenance types inserted');
        
        // Create maintenance_log table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS maintenance_log (
                id SERIAL PRIMARY KEY,
                equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
                maintenance_type_id INTEGER NOT NULL REFERENCES maintenance_types(id),
                maintenance_date DATE NOT NULL,
                completed_date DATE,
                description TEXT NOT NULL,
                performed_by VARCHAR(200),
                external_provider VARCHAR(200),
                cost DECIMAL(10, 2),
                cost_currency VARCHAR(3) DEFAULT 'ZAR',
                downtime_days INTEGER DEFAULT 0,
                next_maintenance_date DATE,
                status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                    CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
                work_order_number VARCHAR(100),
                notes TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                created_by INTEGER
            )
        `);
        console.log('✅ maintenance_log table created');
        
        // Create indexes
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_maintenance_equipment ON maintenance_log(equipment_id);
            CREATE INDEX IF NOT EXISTS idx_maintenance_date ON maintenance_log(maintenance_date);
            CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_log(status);
            CREATE INDEX IF NOT EXISTS idx_maintenance_next ON maintenance_log(next_maintenance_date);
        `);
        console.log('✅ Indexes created');
        
        console.log('\n✅ All maintenance tables ready!');
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

createMaintenanceTables();
