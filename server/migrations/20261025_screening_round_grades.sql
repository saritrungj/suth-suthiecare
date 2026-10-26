-- Screening is done by rounds for a group of students, follow-up per student.
-- Rerunnable.
-- 1) A screening round can be limited to some grade levels. A round with no
--    rows here covers the whole school.
-- 2) Guidance records and tasks made for one student are follow-ups, never
--    screenings, so earlier "screening" ones become "follow_up".
CREATE TABLE IF NOT EXISTS school_screening_round_grades (
 round_id INT NOT NULL,
 grade_level_id INT NOT NULL,
 PRIMARY KEY (round_id, grade_level_id),
 KEY idx_round_grade (grade_level_id),
 FOREIGN KEY(round_id) REFERENCES school_screening_rounds(id) ON DELETE CASCADE,
 FOREIGN KEY(grade_level_id) REFERENCES school_grade_levels(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
UPDATE school_guidance_records SET record_type='follow_up' WHERE record_type='screening';
UPDATE school_rescreen_tasks SET task_kind='follow_up' WHERE task_kind='screening';
