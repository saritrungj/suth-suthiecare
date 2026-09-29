-- Roll back 20260902_form_login_enforcement.sql

-- Recreate the old boolean column
ALTER TABLE forms
  ADD COLUMN requires_login TINYINT(1) NOT NULL DEFAULT 0
  AFTER result_display_mode;

-- Migrate back: 'optional' or 'strict' → 1, 'none' → 0
UPDATE forms SET requires_login = 1 WHERE login_enforcement IN ('strict', 'optional');

ALTER TABLE forms DROP COLUMN login_enforcement;
