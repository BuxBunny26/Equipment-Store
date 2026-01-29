// Create audit_log table on production database
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function createAuditTable() {
    console.log('Creating audit_log table...\n');
    
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS audit_log (
                id SERIAL PRIMARY KEY,
                table_name VARCHAR(100) NOT NULL,
                record_id INTEGER NOT NULL,
                action VARCHAR(20) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
                changed_fields JSONB,
                old_values JSONB,
                new_values JSONB,
                changed_by INTEGER,
                changed_by_name VARCHAR(200),
                ip_address VARCHAR(50),
                user_agent TEXT,
                notes TEXT,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ audit_log table created');
        
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_log(table_name);
            CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_log(record_id);
            CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
            CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_log(created_at);
        `);
        console.log('✅ Indexes created');
        
        console.log('\n✅ Audit log table ready!');
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

createAuditTable();
