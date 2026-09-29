-- Aligns the database with what the application code already expects.
-- Safe to run more than once (MySQL 8+).

-- 1. clinics.name_en is written by POST/PUT /api/clinics and read by the landing page.
SET @has_name_en := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'clinics' AND COLUMN_NAME = 'name_en'
);
SET @sql := IF(@has_name_en = 0,
  'ALTER TABLE clinics ADD COLUMN name_en VARCHAR(255) NULL AFTER name',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. users.name stores AES-256-GCM Base64 ciphertext and VARCHAR(300) truncates long Thai names.
--    (Keep comments free of semicolons: the migration runner splits statements on them.)
SET @name_is_text := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'name'
     AND DATA_TYPE LIKE '%text%'
);
SET @sql := IF(@name_is_text = 0,
  'ALTER TABLE users MODIFY COLUMN name TEXT CHARACTER SET utf8mb4 NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. The original RBAC seed only copied the *.view key for forms, clinics,
--    help_center and content. Write endpoints require *.create/*.update/*.delete,
--    so roles that had can_manage/can_full in the legacy matrix lost write access.
INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT p.role_id, k.permission_key
  FROM permissions p
  CROSS JOIN (
    SELECT 'forms.create' permission_key UNION ALL SELECT 'forms.update' UNION ALL SELECT 'forms.delete'
  ) k
 WHERE p.module IN ('Form Management', 'จัดการฟอร์ม') AND (p.can_manage OR p.can_full);

INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT p.role_id, k.permission_key
  FROM permissions p
  CROSS JOIN (
    SELECT 'clinics.create' permission_key UNION ALL SELECT 'clinics.update' UNION ALL SELECT 'clinics.delete'
  ) k
 WHERE p.module = 'Clinic Management' AND (p.can_manage OR p.can_full);

INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT p.role_id, k.permission_key
  FROM permissions p
  CROSS JOIN (
    SELECT 'help_center.create' permission_key UNION ALL SELECT 'help_center.update' UNION ALL SELECT 'help_center.delete'
  ) k
 WHERE p.module = 'Help Center Management' AND (p.can_manage OR p.can_full);

INSERT IGNORE INTO role_permissions (role_id, permission_key)
SELECT p.role_id, k.permission_key
  FROM permissions p
  CROSS JOIN (
    SELECT 'content.create' permission_key UNION ALL SELECT 'content.update' UNION ALL SELECT 'content.delete'
  ) k
 WHERE p.module = 'Content Management' AND (p.can_manage OR p.can_full);
