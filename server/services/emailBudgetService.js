function limit(name, fallback) {
  const value = Number(process.env[name] || fallback);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}
function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}
function monthKey(date = new Date()) {
  return date.toISOString().slice(0, 7);
}

async function reserveEmailBudget(db) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const keys = [
      ["day", dayKey(), limit("EMAIL_DAILY_BUDGET", 100)],
      ["month", monthKey(), limit("EMAIL_MONTHLY_BUDGET", 3000)],
    ];
    for (const [period, bucket, max] of keys) {
      await connection.query(
        "INSERT IGNORE INTO email_send_usage (period, bucket, sent_count) VALUES (?, ?, 0)",
        [period, bucket],
      );
      const [rows] = await connection.query(
        "SELECT sent_count FROM email_send_usage WHERE period=? AND bucket=? FOR UPDATE",
        [period, bucket],
      );
      if (Number(rows[0].sent_count) >= max) {
        await connection.rollback();
        const error = new Error("Email quota exhausted");
        error.code = "EMAIL_QUOTA_EXCEEDED";
        throw error;
      }
    }
    for (const [period, bucket] of keys)
      await connection.query(
        "UPDATE email_send_usage SET sent_count=sent_count+1 WHERE period=? AND bucket=?",
        [period, bucket],
      );
    await connection.commit();
  } catch (error) {
    try {
      await connection.rollback();
    } catch {}
    throw error;
  } finally {
    connection.release();
  }
}

async function releaseEmailBudget(db) {
  const keys = [
    ["day", dayKey()],
    ["month", monthKey()],
  ];
  for (const [period, bucket] of keys)
    await db.query(
      "UPDATE email_send_usage SET sent_count=GREATEST(0,sent_count-1) WHERE period=? AND bucket=?",
      [period, bucket],
    );
}
module.exports = { reserveEmailBudget, releaseEmailBudget };
