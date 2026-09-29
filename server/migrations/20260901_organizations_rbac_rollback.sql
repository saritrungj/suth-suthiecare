-- Rollback only before production data has been assigned to organizations.
-- Take a backup and verify no organization_id values are non-NULL first.
ALTER TABLE form_responses DROP FOREIGN KEY fk_form_responses_organization, DROP INDEX idx_form_responses_organization, DROP COLUMN organization_id;
ALTER TABLE mastercases DROP FOREIGN KEY fk_mastercases_organization, DROP INDEX idx_mastercases_organization, DROP COLUMN organization_id;
ALTER TABLE clinics DROP FOREIGN KEY fk_clinics_organization, DROP INDEX idx_clinics_organization, DROP COLUMN organization_id;
ALTER TABLE forms DROP FOREIGN KEY fk_forms_organization, DROP INDEX idx_forms_organization, DROP COLUMN organization_id;
DROP TABLE IF EXISTS authorization_audit_logs;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS organization_memberships;
DROP TABLE IF EXISTS user_system_roles;
DROP TABLE IF EXISTS system_roles;
DROP TABLE IF EXISTS organizations;
