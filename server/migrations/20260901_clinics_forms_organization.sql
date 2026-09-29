-- Add organization ownership to clinics and forms.
-- Prerequisite: organizations table must already exist.
-- Existing records remain NULL (unassigned) until a System Admin assigns them.

ALTER TABLE clinics
  ADD COLUMN organization_id INT NULL,
  ADD KEY idx_clinics_organization (organization_id),
  ADD CONSTRAINT fk_clinics_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);

ALTER TABLE forms
  ADD COLUMN organization_id INT NULL,
  ADD KEY idx_forms_organization (organization_id),
  ADD CONSTRAINT fk_forms_organization
    FOREIGN KEY (organization_id) REFERENCES organizations(id);
