const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { loadSchoolAccess, studentScopeClause, canSeeStudent, canViewStudentHealth, canViewPhysicalHealth, canUpdateStudentHealth, publicAccess } = require('../utils/schoolAccess');
const { membershipPermissions } = require('../authorization/dataPermissions');

let linked = true, active = true;
const query = async sql => {
  if (sql.includes('FROM school_student_guardians')) return [linked && active ? [{ id: 11, school_id: 2 }] : []];
  if (sql.includes('FROM school_staff_roles')) return [active ? [{ school_id: 2, role_code: 'guardian' }] : []];
  if (sql.includes('FROM school_teachers')) return [[{ id: 3, school_id: 2 }]];
  if (sql.includes('FROM organization_membership_data_permissions')) return [[]];
  if (sql.includes('FROM school_students')) return [[{ id: 11, school_id: 2, classroom_id: 7 }]];
  if (sql.includes('school_student_insights') || sql.includes('school_guidance_records')) return [[]];
  throw Error('Unexpected SQL: ' + sql);
};
require.cache[require.resolve('../config/db')] = { exports: { query } };
const request = () => ({ user: { id: 5 }, organizationContext: 9, authorization: { membership: { role_name: 'school_guardian' }, permissions: new Set(['students.view', 'students.update', 'school.create', 'clinical.view']) } });

test('guardian scope wins over inherited permissions and teacher classrooms; unlinked and archived children are denied', async () => {
  active = true; linked = true;
  const access = await loadSchoolAccess({ query }, request());
  const child = { id: 11, school_id: 2, classroom_id: 7 };
  assert.equal(access.canViewAllStudents, false);
  assert.equal(access.canCreateStudents, false);
  assert.equal(access.canManageStaff, false);
  assert.deepEqual(studentScopeClause(access).params, [[11]]);
  for (const check of [canSeeStudent, canViewStudentHealth, canViewPhysicalHealth]) {
    assert.equal(Boolean(check(access, child)), true);
    assert.equal(Boolean(check(access, { ...child, id: 12 })), false);
    assert.equal(Boolean(check(access, { ...child, school_id: 3 })), false);
    assert.equal(Boolean(check(access, { ...child, archived_at: '2026-10-01' })), false);
  }
  assert.equal(canUpdateStudentHealth(access, child), false);
  assert.equal(publicAccess(access).can_update_health, false);
  linked = false;
  assert.equal(canViewStudentHealth(await loadSchoolAccess({ query }, request()), child), false);
  linked = true; active = false;
  assert.deepEqual(studentScopeClause(await loadSchoolAccess({ query }, request())).params, [[0]]);
});

test('guardian membership drops broad role permissions and stays empty after role revocation', async () => {
  active = true;
  const membership = { id: 1, organization_id: 9, organization_type: 'school', role_name: 'school_guardian' };
  const keys = await membershipPermissions({ query }, membership, ['school.create', 'students.update', 'forms.view', 'master_data.manage']);
  assert.ok(keys.includes('students.view') && keys.includes('clinical.view'));
  assert.equal(keys.includes('students.update'), false);
  assert.equal(keys.includes('forms.view'), false);
  active = false;
  assert.deepEqual(await membershipPermissions({ query }, membership, ['students.view', 'master_data.manage']), []);
});

test('guardian can read linked insights but cannot write insights or guidance and cannot guess another child ID', async () => {
  active = true; linked = true;
  const access = await loadSchoolAccess({ query }, request());
  const app = express(); app.use(express.json());
  app.use((req, res, next) => { Object.assign(req, request(), { schoolAccess: access }); next(); });
  app.use(require('../routes/schoolInsightRoutes'));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    const res = await fetch(url + '/students/11/insights');
    assert.equal(res.status, 200); assert.equal((await res.json()).can_update, false);
    for (const path of ['/students/11/insights', '/students/11/guidance']) {
      assert.equal((await fetch(url + path, { method: path.endsWith('guidance') ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 404);
    }
    // The fake lookup returns a different student to model an unauthorized subject.
    linked = false;
    access.guardianStudents = [];
    assert.equal((await fetch(url + '/students/12/insights')).status, 404);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
