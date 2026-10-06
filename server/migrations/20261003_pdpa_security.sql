CREATE TABLE IF NOT EXISTS form_invitations (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, token_hash CHAR(64) NOT NULL UNIQUE,
 form_id INT NOT NULL, organization_id INT NOT NULL, response_id INT NOT NULL, master_case_id INT NOT NULL,
 patient_account_id INT NOT NULL, created_by INT NOT NULL, expires_at DATETIME NOT NULL,
 consumed_at DATETIME NULL, consumed_response_id INT NULL, revoked_at DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_invitation_patient (patient_account_id,expires_at), INDEX idx_invitation_org (organization_id)
);
CREATE TABLE IF NOT EXISTS organization_referral_links (
 source_organization_id INT NOT NULL, destination_organization_id INT NOT NULL,
 enabled TINYINT NOT NULL DEFAULT 0, updated_by INT NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (source_organization_id,destination_organization_id)
);
CREATE TABLE IF NOT EXISTS organization_notification_targets (
 organization_id INT NOT NULL PRIMARY KEY, provider VARCHAR(20) NOT NULL DEFAULT 'telegram',
 destination_encrypted TEXT NOT NULL, enabled TINYINT NOT NULL DEFAULT 0,
 verified_by INT NULL, verified_at DATETIME NULL, updated_by INT NOT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS organization_notification_events (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, organization_id INT NULL, response_id INT NULL,
 status VARCHAR(20) NOT NULL, reason_code VARCHAR(40) NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_notification_org (organization_id,created_at)
);
CREATE TABLE IF NOT EXISTS organization_membership_data_permissions (
 membership_id INT NOT NULL, permission_key VARCHAR(100) NOT NULL, granted TINYINT NOT NULL,
 source VARCHAR(30) NOT NULL DEFAULT 'explicit', updated_by INT NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 PRIMARY KEY (membership_id,permission_key)
);
CREATE TABLE IF NOT EXISTS auth_sessions (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, token_hash CHAR(64) NOT NULL UNIQUE,
 account_type VARCHAR(10) NOT NULL, account_id INT NOT NULL, auth_version INT NOT NULL,
 csrf_hash CHAR(64) NOT NULL, mfa_verified_at DATETIME NULL,
 last_seen_at DATETIME NOT NULL, expires_at DATETIME NOT NULL, revoked_at DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_session_account (account_type,account_id,revoked_at), INDEX idx_session_expiry (expires_at)
);
CREATE TABLE IF NOT EXISTS pdpa_migration_progress (
 migration_key VARCHAR(100) NOT NULL PRIMARY KEY, last_id BIGINT NOT NULL DEFAULT 0,
 completed_count BIGINT NOT NULL DEFAULT 0, failed_count BIGINT NOT NULL DEFAULT 0,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS pdpa_migration_issues (
 migration_key VARCHAR(100) NOT NULL, record_id BIGINT NOT NULL, reason_code VARCHAR(80) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (migration_key,record_id)
);
CREATE TABLE IF NOT EXISTS pdpa_rights_requests (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, patient_account_id INT NOT NULL,
 organization_id INT NOT NULL, request_type VARCHAR(30) NOT NULL, detail_encrypted TEXT NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'submitted', version INT NOT NULL DEFAULT 1,
 verified_by INT NULL, verified_at DATETIME NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX idx_rights_patient (patient_account_id), INDEX idx_rights_org (organization_id,status)
);
CREATE TABLE IF NOT EXISTS pdpa_rights_request_events (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, request_id BIGINT NOT NULL,
 actor_type VARCHAR(10) NOT NULL, actor_id INT NOT NULL, status VARCHAR(30) NOT NULL,
 reason_code VARCHAR(80) NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_rights_request (request_id,id)
);
CREATE TABLE IF NOT EXISTS pdpa_retention_policies (
 organization_id INT NOT NULL, data_type VARCHAR(40) NOT NULL, retention_days INT NULL,
 enabled TINYINT NOT NULL DEFAULT 0, version INT NOT NULL DEFAULT 1,
 approved_by INT NULL, approved_at DATETIME NULL,
 PRIMARY KEY (organization_id,data_type)
);
CREATE TABLE IF NOT EXISTS pdpa_legal_holds (
 organization_id INT NOT NULL, target_type VARCHAR(40) NOT NULL, target_id BIGINT NOT NULL,
 created_by INT NOT NULL, released_at DATETIME NULL,
 PRIMARY KEY (organization_id,target_type,target_id)
);
CREATE TABLE IF NOT EXISTS pdpa_consent_evidence (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, organization_id INT NULL,
 patient_account_id INT NULL, response_id INT NULL, purpose VARCHAR(80) NOT NULL,
 notice_version VARCHAR(80) NOT NULL, granted TINYINT NOT NULL, representative_type VARCHAR(30) NULL,
 withdrawn_at DATETIME NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_consent_account (patient_account_id,purpose)
);
CREATE TABLE IF NOT EXISTS pdpa_processing_purposes (
 organization_id INT NOT NULL,form_id INT NOT NULL,purpose VARCHAR(80) NOT NULL,legal_basis VARCHAR(40) NOT NULL,
 notice_version VARCHAR(80) NOT NULL,notice_text TEXT NOT NULL,approved_by INT NOT NULL,approved_at DATETIME NOT NULL,
 PRIMARY KEY (organization_id,form_id)
);
CREATE TABLE IF NOT EXISTS pdpa_crypto_key_checks (
 key_id VARCHAR(100) NOT NULL PRIMARY KEY,
 payload JSON NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS pdpa_notice_versions (
 organization_id INT NOT NULL,form_id INT NOT NULL,notice_version VARCHAR(80) NOT NULL,
 purpose VARCHAR(80) NOT NULL,legal_basis VARCHAR(40) NOT NULL,notice_text TEXT NOT NULL,
 approved_by INT NOT NULL,approved_at DATETIME NOT NULL,
 PRIMARY KEY (organization_id,form_id,notice_version)
);
CREATE TABLE IF NOT EXISTS pdpa_retention_policy_versions (
 organization_id INT NOT NULL,data_type VARCHAR(40) NOT NULL,version INT NOT NULL,
 retention_days INT NOT NULL,approved_by INT NOT NULL,approved_at DATETIME NOT NULL,
 PRIMARY KEY (organization_id,data_type,version)
);
