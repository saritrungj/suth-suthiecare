-- Reverses 20261026_appointment_schedule.sql. Slots already made from a
-- schedule stay as ordinary slots.
DROP TABLE IF EXISTS school_appointment_schedules;
SET @has=(SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='school_appointment_slots' AND COLUMN_NAME='schedule_school_id');
SET @sql=IF(@has=1,'ALTER TABLE school_appointment_slots DROP KEY idx_slot_schedule, DROP COLUMN schedule_school_id','SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
