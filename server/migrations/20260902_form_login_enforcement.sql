-- Replace requires_login boolean with a 3-state login_enforcement enum:
--   'strict'  → user MUST log in, no guest access at all
--   'optional' → auth modal shown, but "Try it first" allows guest access
--   'none'     → no auth prompt, fully public (default)
--
-- Idempotent: safe to re-run.

DELIMITER $$

DROP PROCEDURE IF EXISTS upgrade_login_enforcement$$
CREATE PROCEDURE upgrade_login_enforcement()
BEGIN
  -- Add the new column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'forms'
      AND COLUMN_NAME = 'login_enforcement'
  ) THEN
    ALTER TABLE forms
      ADD COLUMN login_enforcement ENUM('strict','optional','none') NOT NULL DEFAULT 'none'
      AFTER result_display_mode;

    -- Migrate existing data: requires_login=1 → 'optional'
    IF EXISTS (
      SELECT 1 FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'forms'
        AND COLUMN_NAME = 'requires_login'
    ) THEN
      UPDATE forms SET login_enforcement = 'optional' WHERE requires_login = 1;
      ALTER TABLE forms DROP COLUMN requires_login;
    END IF;
  END IF;
END$$

CALL upgrade_login_enforcement$$
DROP PROCEDURE upgrade_login_enforcement$$

DELIMITER ;
