const express = require('express');
const router = express.Router();
const pool = require('../database/db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure storage for equipment images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads/equipment_images');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `eq-${req.params.equipmentId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed'));
  }
});

// Get all images for equipment
router.get('/:equipmentId', async (req, res) => {
  try {
    const { equipmentId } = req.params;
    
    const result = await pool.query(`
      SELECT 
        ei.*,
        u.full_name AS uploaded_by_name
      FROM equipment_images ei
      LEFT JOIN users u ON ei.uploaded_by = u.id
      WHERE ei.equipment_id = $1
      ORDER BY ei.is_primary DESC, ei.sort_order, ei.created_at
    `, [equipmentId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching equipment images:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get image file
router.get('/file/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    
    const result = await pool.query(`
      SELECT file_path, mime_type, original_filename
      FROM equipment_images
      WHERE id = $1
    `, [imageId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    const image = result.rows[0];
    
    if (!fs.existsSync(image.file_path)) {
      return res.status(404).json({ error: 'Image file not found' });
    }
    
    res.setHeader('Content-Type', image.mime_type || 'image/jpeg');
    res.sendFile(image.file_path);
  } catch (error) {
    console.error('Error serving image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload new image
router.post('/:equipmentId', upload.single('image'), async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const { caption, is_primary, uploaded_by } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    
    // If this is set as primary, unset other primary images
    if (is_primary === 'true' || is_primary === true) {
      await pool.query(`
        UPDATE equipment_images 
        SET is_primary = false 
        WHERE equipment_id = $1
      `, [equipmentId]);
    }
    
    // Get current max sort order
    const maxOrder = await pool.query(`
      SELECT COALESCE(MAX(sort_order), 0) + 1 as next_order
      FROM equipment_images
      WHERE equipment_id = $1
    `, [equipmentId]);
    
    const result = await pool.query(`
      INSERT INTO equipment_images 
        (equipment_id, filename, original_filename, file_path, file_size, mime_type, caption, is_primary, sort_order, uploaded_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      equipmentId,
      req.file.filename,
      req.file.originalname,
      req.file.path,
      req.file.size,
      req.file.mimetype,
      caption || null,
      is_primary === 'true' || is_primary === true,
      maxOrder.rows[0].next_order,
      uploaded_by || null
    ]);
    
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload multiple images
router.post('/:equipmentId/multiple', upload.array('images', 10), async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const { uploaded_by } = req.body;
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files provided' });
    }
    
    // Get current max sort order
    const maxOrder = await pool.query(`
      SELECT COALESCE(MAX(sort_order), 0) as max_order
      FROM equipment_images
      WHERE equipment_id = $1
    `, [equipmentId]);
    
    let currentOrder = maxOrder.rows[0].max_order;
    const uploadedImages = [];
    
    for (const file of req.files) {
      currentOrder++;
      
      const result = await pool.query(`
        INSERT INTO equipment_images 
          (equipment_id, filename, original_filename, file_path, file_size, mime_type, sort_order, uploaded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [
        equipmentId,
        file.filename,
        file.originalname,
        file.path,
        file.size,
        file.mimetype,
        currentOrder,
        uploaded_by || null
      ]);
      
      uploadedImages.push(result.rows[0]);
    }
    
    res.status(201).json(uploadedImages);
  } catch (error) {
    console.error('Error uploading images:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update image (caption, primary status)
router.put('/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    const { caption, is_primary, sort_order } = req.body;
    
    // Get current image to find equipment_id
    const current = await pool.query('SELECT equipment_id FROM equipment_images WHERE id = $1', [imageId]);
    
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // If setting as primary, unset other primary images
    if (is_primary === true) {
      await pool.query(`
        UPDATE equipment_images 
        SET is_primary = false 
        WHERE equipment_id = $1
      `, [current.rows[0].equipment_id]);
    }
    
    const result = await pool.query(`
      UPDATE equipment_images 
      SET caption = COALESCE($1, caption),
          is_primary = COALESCE($2, is_primary),
          sort_order = COALESCE($3, sort_order)
      WHERE id = $4
      RETURNING *
    `, [caption, is_primary, sort_order, imageId]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Set primary image
router.patch('/:imageId/primary', async (req, res) => {
  try {
    const { imageId } = req.params;
    
    // Get current image to find equipment_id
    const current = await pool.query('SELECT equipment_id FROM equipment_images WHERE id = $1', [imageId]);
    
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Unset all primary images for this equipment
    await pool.query(`
      UPDATE equipment_images 
      SET is_primary = false 
      WHERE equipment_id = $1
    `, [current.rows[0].equipment_id]);
    
    // Set this image as primary
    const result = await pool.query(`
      UPDATE equipment_images 
      SET is_primary = true
      WHERE id = $1
      RETURNING *
    `, [imageId]);
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error setting primary image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reorder images
router.patch('/:equipmentId/reorder', async (req, res) => {
  try {
    const { equipmentId } = req.params;
    const { imageIds } = req.body; // Array of image IDs in new order
    
    for (let i = 0; i < imageIds.length; i++) {
      await pool.query(`
        UPDATE equipment_images 
        SET sort_order = $1
        WHERE id = $2 AND equipment_id = $3
      `, [i + 1, imageIds[i], equipmentId]);
    }
    
    // Fetch updated images
    const result = await pool.query(`
      SELECT * FROM equipment_images
      WHERE equipment_id = $1
      ORDER BY sort_order
    `, [equipmentId]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error reordering images:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete image
router.delete('/:imageId', async (req, res) => {
  try {
    const { imageId } = req.params;
    
    // Get image info before deleting
    const image = await pool.query('SELECT * FROM equipment_images WHERE id = $1', [imageId]);
    
    if (image.rows.length === 0) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Delete file from disk
    if (fs.existsSync(image.rows[0].file_path)) {
      fs.unlinkSync(image.rows[0].file_path);
    }
    
    // Delete from database
    await pool.query('DELETE FROM equipment_images WHERE id = $1', [imageId]);
    
    res.json({ message: 'Image deleted', image: image.rows[0] });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get primary image for equipment (thumbnail)
router.get('/:equipmentId/primary', async (req, res) => {
  try {
    const { equipmentId } = req.params;
    
    const result = await pool.query(`
      SELECT * FROM equipment_images
      WHERE equipment_id = $1
      ORDER BY is_primary DESC, sort_order, created_at
      LIMIT 1
    `, [equipmentId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No images found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching primary image:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
