-- V6: Add role column to profiles view

-- Drop and recreate triggers first
DROP TRIGGER IF EXISTS profiles_insert ON profiles;
DROP TRIGGER IF EXISTS profiles_update ON profiles;

-- Recreate the view with role subquery
CREATE OR REPLACE VIEW profiles AS
SELECT
    u.id,
    u.first_name || ' ' || u.last_name AS full_name,
    u.first_name,
    u.last_name,
    u.middle_name,
    u.avatar_url,
    u.phone,
    u.email,
    u.gender,
    u.date_of_birth,
    u.is_active,
    u.is_verified,
    u.language,
    u.country,
    u.last_login_at,
    u.created_at,
    u.updated_at,
    (SELECT ur.role FROM user_roles ur WHERE ur.user_id = u.id ORDER BY ur.granted_at LIMIT 1) AS role
FROM users u;

-- Re-create triggers
CREATE TRIGGER profiles_insert
    INSTEAD OF INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION profiles_insert_trigger();

CREATE TRIGGER profiles_update
    INSTEAD OF UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION profiles_update_trigger();
