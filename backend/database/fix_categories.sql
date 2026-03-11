-- Fix equipment categories - run this in Supabase SQL Editor
-- This corrects category_id and subcategory_id for all equipment based on CSV data

DO $$
DECLARE
    v_category_id INTEGER;
    v_subcategory_id INTEGER;
BEGIN

    -- Laser Alignment (13 items)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Laser Alignment' LIMIT 1;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    
    UPDATE equipment SET category_id = v_category_id, subcategory_id = v_subcategory_id
    WHERE serial_number IN (
        '03362', '41718', '85889', '95889', '49004275', '49022264', '49110800',
        '87984', '87986', '87988', '97984', '97986', '97988'
    );

    -- Thermal Camera (1 item)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Thermal Camera' LIMIT 1;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    
    UPDATE equipment SET category_id = v_category_id, subcategory_id = v_subcategory_id
    WHERE serial_number IN ('49002016');

    -- Thermal Equipment (8 items)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Thermal Equipment' LIMIT 1;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    
    UPDATE equipment SET category_id = v_category_id, subcategory_id = v_subcategory_id
    WHERE serial_number IN (
        '55905783', '79302627', '79318361', '84510173', '30420018',
        '63945556', '845009095', '84508577'
    );

    -- Motor Circuit Analysis (2 items)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Motor Circuit Analysis' LIMIT 1;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    
    UPDATE equipment SET category_id = v_category_id, subcategory_id = v_subcategory_id
    WHERE serial_number IN ('ATSX1119', 'AT701667');

    -- Electrical / electronic test instrumentation (1 item)
    SELECT id INTO v_category_id FROM categories WHERE name = 'Electrical / electronic test instrumentation' LIMIT 1;
    SELECT id INTO v_subcategory_id FROM subcategories WHERE category_id = v_category_id LIMIT 1;
    
    UPDATE equipment SET category_id = v_category_id, subcategory_id = v_subcategory_id
    WHERE serial_number IN ('MY52100243');

    RAISE NOTICE 'Equipment categories fixed successfully - 25 items updated';
END $$;
