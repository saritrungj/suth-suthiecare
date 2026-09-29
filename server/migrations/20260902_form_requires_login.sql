-- Add per-form login requirement.
-- When requires_login = 1, guests must authenticate before they can
-- view or interact with the form.  Existing forms default to public (0).

ALTER TABLE forms
  ADD COLUMN requires_login TINYINT(1) NOT NULL DEFAULT 0
  AFTER publish_end_date;
