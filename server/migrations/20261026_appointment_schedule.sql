-- One shared counseling schedule per school (for example Monday to Friday
-- 16:20-17:00) that every counselor of the school offers. Rerunnable.
-- Real slots are made from it ahead of time in school_appointment_slots, so
-- booking works exactly as for slots a teacher opens by hand. A made slot
-- remembers its school schedule (schedule_school_id): closing one (a holiday)
-- keeps it from being made again.
CREATE TABLE IF NOT EXISTS school_appointment_schedules (
 school_id INT NOT NULL PRIMARY KEY,
 weekdays VARCHAR(20) NOT NULL DEFAULT '1,2,3,4,5',
 start_time TIME NOT NULL,
 end_time TIME NOT NULL,
 slot_minutes SMALLINT UNSIGNED NOT NULL,
 capacity TINYINT UNSIGNED NOT NULL DEFAULT 1,
 status ENUM('active','inactive') NOT NULL DEFAULT 'active',
 materialized_on DATE NULL,
 materialized_staff VARCHAR(500) NULL,
 updated_by INT NULL,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(school_id) REFERENCES schools(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
SET @has=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='school_appointment_slots' AND COLUMN_NAME='schedule_school_id');
SET @sql=IF(@has=0,'ALTER TABLE school_appointment_slots ADD COLUMN schedule_school_id INT NULL, ADD KEY idx_slot_schedule (schedule_school_id,starts_at)','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
