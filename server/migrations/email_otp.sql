-- Run once against the production database before enabling STAFF_EMAIL_OTP_MODE=required.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at DATETIME NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email VARCHAR(254) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version INT NOT NULL DEFAULT 0;
ALTER TABLE patient_accounts ADD COLUMN IF NOT EXISTS email VARCHAR(254) NULL;
ALTER TABLE patient_accounts ADD COLUMN IF NOT EXISTS email_verified_at DATETIME NULL;
ALTER TABLE patient_accounts ADD COLUMN IF NOT EXISTS pending_email VARCHAR(254) NULL;
ALTER TABLE patient_accounts ADD COLUMN IF NOT EXISTS auth_version INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS auth_email_challenges (
  id BIGINT NOT NULL AUTO_INCREMENT,
  token_hash CHAR(64) NOT NULL,
  account_type ENUM('staff','patient') NOT NULL,
  account_id INT NOT NULL,
  purpose ENUM('staff_login','email_verification','account_recovery') NOT NULL,
  destination VARCHAR(254) NOT NULL,
  otp_hmac CHAR(64) NOT NULL,
  generation INT NOT NULL DEFAULT 1,
  auth_version_snapshot INT NOT NULL DEFAULT 0,
  attempts INT NOT NULL DEFAULT 0,
  expires_at DATETIME NOT NULL,
  resend_after DATETIME NOT NULL,
  consumed_at DATETIME NULL,
  invalidated_at DATETIME NULL,
  send_status ENUM('sending','sent','failed') NOT NULL DEFAULT 'sending',
  provider_message_id VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_auth_email_challenge_token (token_hash),
  KEY idx_auth_email_challenge_account (account_type, account_id, purpose, created_at),
  KEY idx_auth_email_challenge_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS email_send_usage (
  period ENUM('day','month') NOT NULL,
  bucket CHAR(10) NOT NULL,
  sent_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (period, bucket)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
