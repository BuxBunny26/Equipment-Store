// Create customers table on production database
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function createCustomersTables() {
    console.log('Creating customers and locations tables...\n');
    
    try {
        // Create customers table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS customers (
                id SERIAL PRIMARY KEY,
                customer_number VARCHAR(50) UNIQUE,
                display_name VARCHAR(255) NOT NULL,
                region VARCHAR(50) NOT NULL DEFAULT 'Local',
                country VARCHAR(100),
                province_state VARCHAR(100),
                city VARCHAR(100),
                billing_city VARCHAR(100),
                shipping_city VARCHAR(100),
                email VARCHAR(255),
                vat_number VARCHAR(50),
                vat_treatment VARCHAR(50),
                currency_code VARCHAR(10) DEFAULT 'ZAR',
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ customers table created');
        
        // Add customer_id to equipment_movements if it doesn't exist
        await pool.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns 
                    WHERE table_name = 'equipment_movements' AND column_name = 'customer_id'
                ) THEN
                    ALTER TABLE equipment_movements ADD COLUMN customer_id INTEGER REFERENCES customers(id);
                END IF;
            END $$
        `);
        console.log('✅ customer_id column added to equipment_movements');
        
        // Create indexes
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_customers_number ON customers(customer_number);
            CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(display_name);
            CREATE INDEX IF NOT EXISTS idx_customers_region ON customers(region);
        `);
        console.log('✅ Indexes created');
        
        console.log('\n✅ All customer tables ready!');
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

createCustomersTables();
