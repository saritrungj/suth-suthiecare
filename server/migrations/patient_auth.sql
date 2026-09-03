-- Patient authentication schema
-- Run after selecting the application database:
--   USE suthiecare_db;
-- This script is idempotent and safe to re-run.

CREATE TABLE IF NOT EXISTS patient_accounts (
  id INT NOT NULL AUTO_INCREMENT,
  username VARCHAR(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name_encrypted TEXT NULL,
  last_name_encrypted TEXT NULL,
  identity_hash CHAR(64) NULL,
  phone_hash CHAR(64) NULL,
  phone_encrypted TEXT NULL,
  status ENUM('pending_verification','active','locked','disabled') NOT NULL DEFAULT 'pending_verification',
  verified_at DATETIME NULL,
  last_login_at DATETIME NULL,
  failed_login_count INT NOT NULL DEFAULT 0,
  locked_until DATETIME NULL,
  token_version INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_patient_username (username),
  UNIQUE KEY uq_patient_identity_hash (identity_hash),
  KEY idx_patient_phone_hash (phone_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Upgrade databases created with the previous patient-auth schema.
-- MySQL condition checks keep this section safe to run more than once.
DELIMITER $$
DROP PROCEDURE IF EXISTS upgrade_patient_auth_v2$$
CREATE PROCEDURE upgrade_patient_auth_v2()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'patient_accounts'
      AND COLUMN_NAME = 'first_name_encrypted'
  ) THEN
    ALTER TABLE patient_accounts
      ADD COLUMN first_name_encrypted TEXT NULL AFTER password_hash;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'patient_accounts'
      AND COLUMN_NAME = 'last_name_encrypted'
  ) THEN
    ALTER TABLE patient_accounts
      ADD COLUMN last_name_encrypted TEXT NULL AFTER first_name_encrypted;
  END IF;

  ALTER TABLE patient_accounts MODIFY identity_hash CHAR(64) NULL;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'form_responses'
      AND COLUMN_NAME = 'patient_account_id'
  ) THEN
    ALTER TABLE form_responses
      ADD COLUMN patient_account_id INT NULL AFTER master_case_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'form_responses'
      AND INDEX_NAME = 'idx_form_responses_patient_account'
  ) THEN
    CREATE INDEX idx_form_responses_patient_account
      ON form_responses (patient_account_id, submitted_at);
  END IF;
END$$
CALL upgrade_patient_auth_v2()$$
DROP PROCEDURE upgrade_patient_auth_v2$$
DELIMITER ;

CREATE TABLE IF NOT EXISTS patient_auth_audit_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  patient_account_id INT NULL,
  event_type VARCHAR(60) NOT NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(255) NULL,
  metadata JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_patient_audit_account (patient_account_id, created_at),
  CONSTRAINT fk_patient_audit_account
    FOREIGN KEY (patient_account_id) REFERENCES patient_accounts(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
