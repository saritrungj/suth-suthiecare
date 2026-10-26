-- Reverses 20261025_screening_round_grades.sql. Rounds go back to covering
-- the whole school. Records changed from screening to follow_up stay
-- follow_up (the original type was not kept).
DROP TABLE IF EXISTS school_screening_round_grades;
