const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Force redeploy - calibration data restored 2026-02-03
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Routes
app.use('/api/categories', require('./routes/categories'));
app.use('/api/subcategories', require('./routes/subcategories'));
app.use('/api/locations', require('./routes/locations'));
app.use('/api/personnel', require('./routes/personnel'));
app.use('/api/equipment', require('./routes/equipment'));
app.use('/api/movements', require('./routes/movements'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/calibration', require('./routes/calibration'));

// New feature routes
app.use('/api/reservations', require('./routes/reservations'));
app.use('/api/maintenance', require('./routes/maintenance'));
app.use('/api/audit', require('./routes/audit'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/exports', require('./routes/exports'));
app.use('/api/users', require('./routes/users'));
app.use('/api/equipment-images', require('./routes/equipmentImages'));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root route - API info
app.get('/', (req, res) => {
    res.json({
        name: 'Equipment Store API',
        version: '1.0.0',
        status: 'running',
        endpoints: {
            health: '/api/health',
            categories: '/api/categories',
            subcategories: '/api/subcategories',
            locations: '/api/locations',
            personnel: '/api/personnel',
            equipment: '/api/equipment',
            movements: '/api/movements',
            customers: '/api/customers',
            calibration: '/api/calibration',
            reservations: '/api/reservations',
            maintenance: '/api/maintenance',
            reports: '/api/reports'
        }
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    console.error(err.stack);
    
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal server error',
            code: err.code || 'INTERNAL_ERROR'
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: {
            message: 'Endpoint not found',
            code: 'NOT_FOUND'
        }
    });
});

app.listen(PORT, () => {
    console.log(`Equipment Store API running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
