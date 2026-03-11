-- ============================================
-- AUDIT TRIGGERS FOR KEY TABLES
-- Run this in Supabase SQL Editor
-- ============================================

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, record_id, action, new_values, changed_by, created_at)
        VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', to_jsonb(NEW), current_setting('request.jwt.claims', true)::json->>'email', NOW());
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, changed_by, created_at)
        VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), current_setting('request.jwt.claims', true)::json->>'email', NOW());
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (table_name, record_id, action, old_values, changed_by, created_at)
        VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', to_jsonb(OLD), current_setting('request.jwt.claims', true)::json->>'email', NOW());
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if any (idempotent)
DROP TRIGGER IF EXISTS audit_trigger ON equipment;
DROP TRIGGER IF EXISTS audit_trigger ON equipment_movements;
DROP TRIGGER IF EXISTS audit_trigger ON calibration_records;
DROP TRIGGER IF EXISTS audit_trigger ON maintenance_log;
DROP TRIGGER IF EXISTS audit_trigger ON reservations;
DROP TRIGGER IF EXISTS audit_trigger ON categories;
DROP TRIGGER IF EXISTS audit_trigger ON subcategories;
DROP TRIGGER IF EXISTS audit_trigger ON locations;
DROP TRIGGER IF EXISTS audit_trigger ON personnel;
DROP TRIGGER IF EXISTS audit_trigger ON customers;
DROP TRIGGER IF EXISTS audit_trigger ON users;

-- Create triggers on key tables
CREATE TRIGGER audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON equipment
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON equipment_movements
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON calibration_records
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON maintenance_log
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON reservations
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON categories
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON subcategories
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON locations
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON personnel
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON customers
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();

CREATE TRIGGER audit_trigger
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
