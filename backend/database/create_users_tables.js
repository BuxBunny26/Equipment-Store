// Create users and roles tables on production database
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function createUsersTables() {
    console.log('Creating users and roles tables...\n');
    
    try {
        // Create roles table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS roles (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) NOT NULL UNIQUE,
                description TEXT,
                permissions JSONB DEFAULT '[]',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ roles table created');
        
        // Insert default roles
        await pool.query(`
            INSERT INTO roles (name, description) VALUES 
                ('admin', 'Full system access'),
                ('manager', 'Can manage equipment and users'),
                ('technician', 'Can check in/out equipment'),
                ('viewer', 'Read-only access')
            ON CONFLICT (name) DO NOTHING
        `);
        console.log('✅ Default roles inserted');
        
        // Create users table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(100) UNIQUE NOT NULL,
                email VARCHAR(255) UNIQUE,
                password_hash VARCHAR(255),
                full_name VARCHAR(200),
                role_id INTEGER REFERENCES roles(id),
                department VARCHAR(100),
                personnel_id INTEGER,
                is_active BOOLEAN DEFAULT TRUE,
                last_login TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ users table created');
        
        // Create indexes
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
            CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
            CREATE INDEX IF NOT EXISTS idx_users_role ON users(role_id);
        `);
        console.log('✅ Indexes created');
        
        console.log('\n✅ All user tables ready!');
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await pool.end();
    }
}

createUsersTables();
