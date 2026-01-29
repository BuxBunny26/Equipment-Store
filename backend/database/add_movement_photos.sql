-- Add photo columns to equipment_movements table
ALTER TABLE equipment_movements 
ADD COLUMN IF NOT EXISTS photo_file_path TEXT,
ADD COLUMN IF NOT EXISTS photo_file_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS photo_mime_type VARCHAR(100);

-- Add index for movements with photos
CREATE INDEX IF NOT EXISTS idx_movements_has_photo 
ON equipment_movements(id) WHERE photo_file_path IS NOT NULL;
