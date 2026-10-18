// Every write of a school_teachers row goes through here, so the Add User
// modal, the teacher list and the teacher import keep the same fields and
// rules. A field passed as undefined is left unchanged on an existing row;
// adding someone who used to teach here reactivates their old row.
async function upsertSchoolTeacher(
  connection,
  {
    schoolId,
    userId,
    teacherTypeId,
    employeeCode,
    position,
    phoneEncrypted,
    status = "active",
  },
) {
  const fields = Object.entries({
    teacher_type_id: teacherTypeId,
    employee_code: employeeCode,
    position,
    phone_encrypted: phoneEncrypted,
  }).filter(([, value]) => value !== undefined);
  const columns = ["school_id", "user_id", ...fields.map(([name]) => name)];
  const updates = [
    ...fields.map(([name]) => `${name}=VALUES(${name})`),
    "status=VALUES(status)",
    "id=LAST_INSERT_ID(id)",
  ];
  const [result] = await connection.query(
    `INSERT INTO school_teachers (${columns.join(",")},status)
     VALUES (${columns.map(() => "?").join(",")},?)
     ON DUPLICATE KEY UPDATE ${updates.join(",")}`,
    [schoolId, userId, ...fields.map(([, value]) => value), status],
  );
  return result.insertId;
}

// Removing a teacher keeps the row (classroom links, history) and switches it
// off, the same way removing someone from a unit does.
async function deactivateSchoolTeacher(connection, { schoolId, userId }) {
  await connection.query(
    "UPDATE school_teachers SET status='inactive' WHERE school_id=? AND user_id=?",
    [schoolId, userId],
  );
}

module.exports = { deactivateSchoolTeacher, upsertSchoolTeacher };
