-- Account-first ownership for assessment submissions. Run after patient_auth.sql.
-- This migration is idempotent and does not backfill data; use the accompanying
-- script with --apply only after reviewing its dry-run report.

DELIMITER $$
DROP PROCEDURE IF EXISTS upgrade_patient_account_identity_v1$$
CREATE PROCEDURE upgrade_patient_account_identity_v1()
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mastercases' AND COLUMN_NAME = 'patient_account_id') THEN
    ALTER TABLE mastercases ADD COLUMN patient_account_id INT NULL AFTER id;
  END IF;

  ALTER TABLE mastercases MODIFY identityValue VARCHAR(255) NULL;

  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'mastercases' AND INDEX_NAME = 'idx_mastercases_account_clinic_status') THEN
    CREATE INDEX idx_mastercases_account_clinic_status ON mastercases (patient_account_id, clinicType, status);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'form_responses' AND INDEX_NAME = 'idx_form_responses_patient_account') THEN
    CREATE INDEX idx_form_responses_patient_account ON form_responses (patient_account_id, submitted_at);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'mastercases' AND CONSTRAINT_NAME = 'fk_mastercases_patient_account') THEN
    ALTER TABLE mastercases ADD CONSTRAINT fk_mastercases_patient_account FOREIGN KEY (patient_account_id) REFERENCES patient_accounts(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'form_responses' AND CONSTRAINT_NAME = 'fk_form_responses_patient_account') THEN
    ALTER TABLE form_responses ADD CONSTRAINT fk_form_responses_patient_account FOREIGN KEY (patient_account_id) REFERENCES patient_accounts(id) ON DELETE SET NULL;
  END IF;

  CREATE TABLE IF NOT EXISTS patient_identity_backfill_log (
    id BIGINT NOT NULL AUTO_INCREMENT,
    run_id CHAR(36) NOT NULL,
    entity_type ENUM('form_response', 'master_case') NOT NULL,
    record_id BIGINT NOT NULL,
    previous_patient_account_id INT NULL,
    patient_account_id INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_patient_identity_backfill (run_id, entity_type, record_id),
    KEY idx_patient_identity_backfill_record (entity_type, record_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
END$$
CALL upgrade_patient_account_identity_v1()$$
DROP PROCEDURE upgrade_patient_account_identity_v1$$
DELIMITER ;
