-- A screening round can also be limited to some classrooms, so each class
-- does it in its own homeroom period. Rerunnable.
-- Who a round is for: no grade and no classroom rows covers the whole
-- school, grade rows cover every classroom of those grades, classroom rows
-- cover those classrooms, and both together cover either.
CREATE TABLE IF NOT EXISTS school_screening_round_classrooms (
 round_id INT NOT NULL,
 classroom_id INT NOT NULL,
 PRIMARY KEY (round_id, classroom_id),
 KEY idx_round_classroom (classroom_id),
 FOREIGN KEY(round_id) REFERENCES school_screening_rounds(id) ON DELETE CASCADE,
 FOREIGN KEY(classroom_id) REFERENCES school_classrooms(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
