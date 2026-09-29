-- Roll back 20260901_clinics_forms_organization.sql.
-- Confirm all organization ownership assignments have been handled before running.

ALTER TABLE clinics
  DROP FOREIGN KEY fk_clinics_organization,
  DROP INDEX idx_clinics_organization,
  DROP COLUMN organization_id;

ALTER TABLE forms
  DROP FOREIGN KEY fk_forms_organization,
  DROP INDEX idx_forms_organization,
  DROP COLUMN organization_id;
