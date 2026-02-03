-- Run this SQL in Supabase SQL Editor to create the locations table
-- and add internal branch locations

-- Create the locations table
CREATE TABLE IF NOT EXISTS locations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert internal branch locations
INSERT INTO locations (name, description, is_active) VALUES
    ('RBMR Stores', 'RBMR Main Equipment Stores', TRUE),
    ('ARC Head Office - Longmeadow', 'WearCheck ARC Head Office, Longmeadow Business Estate', TRUE),
    ('ARC Springs', 'WearCheck ARC Springs Branch', TRUE),
    ('WearCheck KZN', 'WearCheck KwaZulu-Natal Branch', TRUE)
ON CONFLICT (name) DO UPDATE SET 
    is_active = TRUE,
    description = EXCLUDED.description;

-- Show the locations
SELECT * FROM locations WHERE is_active = TRUE ORDER BY name;
