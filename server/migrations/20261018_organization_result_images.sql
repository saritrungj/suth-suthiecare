-- Result images per organization. Each organization may replace the bundled
-- low, medium and high risk pictures shown on the assessment result page.
-- Levels without a row fall back to the bundled images.
CREATE TABLE IF NOT EXISTS organization_result_images (
  organization_id INT NOT NULL,
  level ENUM('low', 'medium', 'high') NOT NULL,
  image MEDIUMTEXT NOT NULL,
  filename VARCHAR(255) NULL,
  updated_by INT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, level),
  CONSTRAINT fk_result_images_organization FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
