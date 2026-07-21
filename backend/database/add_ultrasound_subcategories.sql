-- Add subcategories for the Ultrasound category
-- Safe to run multiple times (skips existing entries)

DO $$
DECLARE
    v_category_id INTEGER;
BEGIN
    SELECT id INTO v_category_id FROM categories WHERE LOWER(name) = 'ultrasound' LIMIT 1;

    IF v_category_id IS NULL THEN
        RAISE EXCEPTION 'Ultrasound category not found. Run add_ultrasound_category.sql first.';
    END IF;

    INSERT INTO subcategories (name, category_id)
    SELECT name, v_category_id
    FROM (VALUES
        ('Thickness Gauges'),
        ('Flaw Detectors'),
        ('General')
    ) AS t(name)
    WHERE NOT EXISTS (
        SELECT 1 FROM subcategories s
        WHERE s.category_id = v_category_id AND LOWER(s.name) = LOWER(t.name)
    );
END $$;
