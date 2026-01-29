const express = require('express');
const router = express.Router();
const pool = require('../database/db');

// Get all roles
router.get('/roles', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM roles ORDER BY id
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all users
router.get('/', async (req, res) => {
  try {
    const { role_id, is_active, search } = req.query;
    
    let query = `
      SELECT 
        u.id,
        u.username,
        u.email,
        u.full_name,
        u.role_id,
        r.name AS role_name,
        r.permissions,
        u.personnel_id,
        p.employee_id,
        u.is_active,
        u.last_login,
        u.phone,
        u.department,
        u.created_at
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN personnel p ON u.personnel_id = p.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (role_id) {
      query += ` AND u.role_id = $${paramIndex++}`;
      params.push(role_id);
    }
    
    if (is_active !== undefined) {
      query += ` AND u.is_active = $${paramIndex++}`;
      params.push(is_active === 'true');
    }
    
    if (search) {
      query += ` AND (u.username ILIKE $${paramIndex} OR u.full_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    query += ' ORDER BY u.full_name';
    
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single user
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT 
        u.*,
        r.name AS role_name,
        r.permissions,
        p.employee_id,
        p.full_name AS personnel_name
      FROM users u
      JOIN roles r ON u.role_id = r.id
      LEFT JOIN personnel p ON u.personnel_id = p.id
      WHERE u.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Remove password hash from response
    const user = result.rows[0];
    delete user.password_hash;
    
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create user
router.post('/', async (req, res) => {
  try {
    const { username, email, full_name, role_id, personnel_id, is_active, phone, department } = req.body;
    
    // Check for existing username or email
    const existing = await pool.query(`
      SELECT id FROM users WHERE username = $1 OR email = $2
    `, [username, email]);
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    const result = await pool.query(`
      INSERT INTO users (username, email, full_name, role_id, personnel_id, is_active, phone, department)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [username, email, full_name, role_id || 3, personnel_id || null, is_active !== false, phone || null, department || null]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, full_name, role_id, personnel_id, is_active, phone, department } = req.body;
    
    // Check for existing username or email (excluding this user)
    const existing = await pool.query(`
      SELECT id FROM users WHERE (username = $1 OR email = $2) AND id != $3
    `, [username, email, id]);
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }
    
    const result = await pool.query(`
      UPDATE users 
      SET username = $1, email = $2, full_name = $3, role_id = $4, 
          personnel_id = $5, is_active = $6, phone = $7, department = $8,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $9
      RETURNING *
    `, [username, email, full_name, role_id, personnel_id || null, is_active, phone || null, department || null, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update user role
router.patch('/:id/role', async (req, res) => {
  try {
    const { id } = req.params;
    const { role_id } = req.body;
    
    const result = await pool.query(`
      UPDATE users 
      SET role_id = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [role_id, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user role:', error);
    res.status(500).json({ error: error.message });
  }
});

// Activate/Deactivate user
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    
    const result = await pool.query(`
      UPDATE users 
      SET is_active = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `, [is_active, id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete user
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'User deleted', user: result.rows[0] });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: error.message });
  }
});

// Bulk create users from personnel
router.post('/bulk-import', async (req, res) => {
  try {
    const { personnel_ids, role_id } = req.body;
    
    if (!personnel_ids || !Array.isArray(personnel_ids) || personnel_ids.length === 0) {
      return res.status(400).json({ error: 'No personnel selected' });
    }
    
    // Get personnel details
    const personnelResult = await pool.query(`
      SELECT id, full_name, email, employee_id
      FROM personnel
      WHERE id = ANY($1)
    `, [personnel_ids]);
    
    // Get existing users linked to these personnel
    const existingResult = await pool.query(`
      SELECT personnel_id FROM users WHERE personnel_id = ANY($1)
    `, [personnel_ids]);
    
    const existingPersonnelIds = new Set(existingResult.rows.map(r => r.personnel_id));
    
    const created = [];
    const skipped = [];
    
    for (const person of personnelResult.rows) {
      if (existingPersonnelIds.has(person.id)) {
        skipped.push({ id: person.id, name: person.full_name, reason: 'Already linked to a user' });
        continue;
      }
      
      // Generate username from employee_id or name
      const username = person.employee_id || 
        person.full_name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '');
      
      // Check if username already exists
      const usernameCheck = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
      if (usernameCheck.rows.length > 0) {
        skipped.push({ id: person.id, name: person.full_name, reason: 'Username already exists' });
        continue;
      }
      
      // Create user
      const result = await pool.query(`
        INSERT INTO users (username, email, full_name, role_id, personnel_id, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING *
      `, [username, person.email, person.full_name, role_id || 3, person.id]);
      
      created.push(result.rows[0]);
    }
    
    res.status(201).json({ 
      message: `Created ${created.length} users, skipped ${skipped.length}`,
      created,
      skipped
    });
  } catch (error) {
    console.error('Error bulk importing users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check permissions
router.get('/:id/permissions', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(`
      SELECT r.permissions
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0].permissions);
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create role
router.post('/roles', async (req, res) => {
  try {
    const { name, description, permissions } = req.body;
    
    const result = await pool.query(`
      INSERT INTO roles (name, description, permissions)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [name, description, JSON.stringify(permissions)]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update role
router.put('/roles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, permissions } = req.body;
    
    // Don't allow editing system roles
    const check = await pool.query('SELECT is_system_role FROM roles WHERE id = $1', [id]);
    if (check.rows.length > 0 && check.rows[0].is_system_role) {
      return res.status(400).json({ error: 'Cannot edit system roles' });
    }
    
    const result = await pool.query(`
      UPDATE roles 
      SET name = $1, description = $2, permissions = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `, [name, description, JSON.stringify(permissions), id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete role
router.delete('/roles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Don't allow deleting system roles
    const check = await pool.query('SELECT is_system_role FROM roles WHERE id = $1', [id]);
    if (check.rows.length > 0 && check.rows[0].is_system_role) {
      return res.status(400).json({ error: 'Cannot delete system roles' });
    }
    
    // Check if any users have this role
    const usersWithRole = await pool.query('SELECT COUNT(*) FROM users WHERE role_id = $1', [id]);
    if (parseInt(usersWithRole.rows[0].count) > 0) {
      return res.status(400).json({ error: 'Cannot delete role with assigned users' });
    }
    
    const result = await pool.query('DELETE FROM roles WHERE id = $1 RETURNING *', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    res.json({ message: 'Role deleted', role: result.rows[0] });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
