const test = require("node:test");
const assert = require("node:assert/strict");
const schedule = require("../services/schoolAppointmentSchedule");

test("the shared schedule defaults to Monday to Friday 16:20-17:00", () => {
  assert.deepEqual(schedule.DEFAULT_SCHEDULE.weekdays, [1, 2, 3, 4, 5]);
  assert.equal(schedule.DEFAULT_SCHEDULE.start_time, "16:20");
  assert.equal(schedule.DEFAULT_SCHEDULE.end_time, "17:00");
  assert.deepEqual(schedule.slotTimes(schedule.DEFAULT_SCHEDULE), [
    { start: "16:20", end: "17:00" },
  ]);
  // 20-minute slots split the same hour in two.
  assert.deepEqual(
    schedule.slotTimes({ ...schedule.DEFAULT_SCHEDULE, slot_minutes: 20 }),
    [
      { start: "16:20", end: "16:40" },
      { start: "16:40", end: "17:00" },
    ],
  );
  assert.equal(schedule.weekdayOf("2026-10-19"), 1); // Monday
  assert.equal(schedule.weekdayOf("2026-10-25"), 7); // Sunday
});

test("schedule input is validated", () => {
  const ok = {
    weekdays: [5, 1, 3],
    start_time: "16:20",
    end_time: "17:00",
    slot_minutes: 40,
    capacity: 1,
  };
  assert.deepEqual(schedule.validateSchedule(ok).value.weekdays, [1, 3, 5]);
  for (const bad of [
    { ...ok, weekdays: [] },
    { ...ok, weekdays: [8] },
    { ...ok, end_time: "16:00" },
    { ...ok, start_time: "4:20" },
    { ...ok, slot_minutes: 5 },
    { ...ok, slot_minutes: 60 },
    { ...ok, capacity: 0 },
    { ...ok, end_time: "21:00" },
    { ...ok, status: "maybe" },
  ])
    assert.ok(schedule.validateSchedule(bad).error, JSON.stringify(bad));
});
