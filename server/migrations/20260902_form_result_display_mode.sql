-- Control when interactive results are shown to the user.
-- 'realtime'  = results update live as the user answers (default)
-- 'on_submit' = results hidden until after successful submission
--
-- Idempotent: safe to re-run.

DELIMITER $$

DROP PROCEDURE IF EXISTS upgrade_result_display_mode$$
CREATE PROCEDURE upgrade_result_display_mode()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'forms'
      AND COLUMN_NAME = 'result_display_mode'
  ) THEN
    ALTER TABLE forms
      ADD COLUMN result_display_mode ENUM('realtime','on_submit') NOT NULL DEFAULT 'realtime'
      AFTER publish_end_date;
  END IF;
END$$

CALL upgrade_result_display_mode$$
DROP PROCEDURE upgrade_result_display_mode$$

DELIMITER ;
