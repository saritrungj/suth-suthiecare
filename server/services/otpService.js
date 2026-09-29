const crypto = require("crypto");
const { sendOtpEmail } = require("./emailService");
const {
  reserveEmailBudget,
  releaseEmailBudget,
} = require("./emailBudgetService");

const ttlSeconds = () => Number(process.env.OTP_TTL_SECONDS || 300);
const cooldownSeconds = () =>
  Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60);
const maxAttempts = () => Number(process.env.OTP_MAX_ATTEMPTS || 5);
const secret = () => process.env.OTP_HMAC_SECRET || process.env.JWT_SECRET;
const normalizeEmail = (email) =>
  String(email || "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
const tokenHash = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
const otpHash = ({ id, accountType, accountId, purpose, generation, otp }) =>
  crypto
    .createHmac("sha256", secret())
    .update(`${id}:${accountType}:${accountId}:${purpose}:${generation}:${otp}`)
    .digest("hex");
const compare = (left, right) => {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const maskEmail = (email) => {
  const [local, domain] = normalizeEmail(email).split("@");
  if (!local || !domain) return "";
  return `${local.slice(0, 1)}${"*".repeat(Math.max(1, local.length - 2))}${local.slice(-1)}@${domain}`;
};
const newOtp = () => crypto.randomInt(0, 1000000).toString().padStart(6, "0");
const newToken = () => crypto.randomBytes(32).toString("base64url");

async function createChallenge(
  db,
  { accountType, accountId, email, purpose, authVersion = 0 },
) {
  const destination = normalizeEmail(email);
  if (!destination) {
    const error = new Error("Missing email");
    error.code = "MISSING_EMAIL";
    throw error;
  }
  const connection = await db.getConnection();
  let challenge;
  try {
    await connection.beginTransaction();
    await connection.query(
      "UPDATE auth_email_challenges SET invalidated_at = NOW() WHERE account_type=? AND account_id=? AND purpose=? AND consumed_at IS NULL AND invalidated_at IS NULL",
      [accountType, accountId, purpose],
    );
    const opaque = newToken();
    const otp = newOtp();
    const [result] = await connection.query(
      `INSERT INTO auth_email_challenges (token_hash, account_type, account_id, purpose, destination, otp_hmac, generation, auth_version_snapshot, attempts, expires_at, resend_after, send_status)
       VALUES (?, ?, ?, ?, ?, '', 1, ?, 0, DATE_ADD(NOW(), INTERVAL ? SECOND), DATE_ADD(NOW(), INTERVAL ? SECOND), 'sending')`,
      [
        tokenHash(opaque),
        accountType,
        accountId,
        purpose,
        destination,
        authVersion,
        ttlSeconds(),
        cooldownSeconds(),
      ],
    );
    const id = result.insertId;
    await connection.query(
      "UPDATE auth_email_challenges SET otp_hmac=? WHERE id=?",
      [
        otpHash({ id, accountType, accountId, purpose, generation: 1, otp }),
        id,
      ],
    );
    await connection.commit();
    challenge = {
      id,
      opaque,
      otp,
      destination,
      generation: 1,
      expiresAt: new Date(Date.now() + ttlSeconds() * 1000),
      resendAfter: new Date(Date.now() + cooldownSeconds() * 1000),
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  let budgetReserved = false;
  try {
    await reserveEmailBudget(db);
    budgetReserved = true;
    const providerMessageId = await sendOtpEmail({
      to: challenge.destination,
      otp: challenge.otp,
      purpose,
      idempotencyKey: `otp/${challenge.id}/${challenge.generation}`,
    });
    await db.query(
      "UPDATE auth_email_challenges SET send_status='sent', provider_message_id=? WHERE id=? AND generation=?",
      [providerMessageId, challenge.id, challenge.generation],
    );
  } catch (error) {
    if (budgetReserved)
      try {
        await releaseEmailBudget(db);
      } catch {}
    await db.query(
      "UPDATE auth_email_challenges SET send_status='failed' WHERE id=? AND generation=?",
      [challenge.id, challenge.generation],
    );
    await db.query(
      "UPDATE auth_email_challenges SET invalidated_at=NOW() WHERE id=?",
      [challenge.id],
    );
    throw error;
  }
  return {
    challengeToken: `${challenge.id}.${challenge.opaque}`,
    maskedEmail: maskEmail(challenge.destination),
    expiresAt: challenge.expiresAt.toISOString(),
    resendAfter: challenge.resendAfter.toISOString(),
  };
}

function parseToken(value) {
  const [id, opaque] = String(value || "").split(".");
  if (!/^\d+$/.test(id) || !opaque || opaque.length < 32) return null;
  return { id: Number(id), opaque };
}

async function verifyChallenge(
  db,
  { challengeToken, otp, accountType, purpose, loadAccount },
) {
  const parsed = parseToken(challengeToken);
  if (!parsed || !/^\d{6}$/.test(String(otp || "")))
    return { error: "รหัสยืนยันไม่ถูกต้องหรือหมดอายุ" };
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      "SELECT * FROM auth_email_challenges WHERE id=? AND token_hash=? FOR UPDATE",
      [parsed.id, tokenHash(parsed.opaque)],
    );
    const challenge = rows[0];
    if (
      !challenge ||
      challenge.account_type !== accountType ||
      challenge.purpose !== purpose ||
      challenge.consumed_at ||
      challenge.invalidated_at ||
      new Date(challenge.expires_at) <= new Date()
    ) {
      await connection.rollback();
      return { error: "รหัสยืนยันไม่ถูกต้องหรือหมดอายุ" };
    }
    if (Number(challenge.attempts) >= maxAttempts()) {
      await connection.query(
        "UPDATE auth_email_challenges SET invalidated_at=NOW() WHERE id=?",
        [challenge.id],
      );
      await connection.commit();
      return { error: "กรอกรหัสไม่ถูกต้องเกินจำนวนที่กำหนด" };
    }
    const account = await loadAccount(connection, challenge.account_id);
    // auth_version is 0 for most accounts; `||` would fall through to
    // token_version (which grows on every logout) and reject valid codes.
    const accountVersion = account?.auth_version ?? account?.token_version ?? 0;
    if (
      !account ||
      Number(accountVersion) !== Number(challenge.auth_version_snapshot)
    ) {
      await connection.query(
        "UPDATE auth_email_challenges SET invalidated_at=NOW() WHERE id=?",
        [challenge.id],
      );
      await connection.commit();
      return { error: "คำขอยืนยันนี้ไม่สามารถใช้งานได้" };
    }
    const expected = otpHash({
      id: challenge.id,
      accountType,
      accountId: challenge.account_id,
      purpose,
      generation: challenge.generation,
      otp: String(otp),
    });
    if (!compare(expected, challenge.otp_hmac)) {
      await connection.query(
        "UPDATE auth_email_challenges SET attempts=attempts+1 WHERE id=?",
        [challenge.id],
      );
      await connection.commit();
      return { error: "รหัสยืนยันไม่ถูกต้องหรือหมดอายุ" };
    }
    await connection.query(
      "UPDATE auth_email_challenges SET consumed_at=NOW() WHERE id=?",
      [challenge.id],
    );
    await connection.commit();
    return { account };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function resendChallenge(db, { challengeToken, accountType, purpose }) {
  const parsed = parseToken(challengeToken);
  if (!parsed) return { error: "คำขอยืนยันไม่ถูกต้องหรือหมดอายุ" };
  const connection = await db.getConnection();
  let delivery;
  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      "SELECT * FROM auth_email_challenges WHERE id=? AND token_hash=? FOR UPDATE",
      [parsed.id, tokenHash(parsed.opaque)],
    );
    const challenge = rows[0];
    if (
      !challenge ||
      challenge.account_type !== accountType ||
      challenge.purpose !== purpose ||
      challenge.consumed_at ||
      challenge.invalidated_at ||
      new Date(challenge.expires_at) <= new Date()
    ) {
      await connection.rollback();
      return { error: "คำขอยืนยันไม่ถูกต้องหรือหมดอายุ" };
    }
    if (new Date(challenge.resend_after) > new Date()) {
      await connection.rollback();
      return {
        error: "กรุณารอก่อนขอรหัสใหม่",
        resendAfter: new Date(challenge.resend_after).toISOString(),
      };
    }
    const generation = Number(challenge.generation) + 1;
    const otp = newOtp();
    await connection.query(
      "UPDATE auth_email_challenges SET generation=?, otp_hmac=?, resend_after=DATE_ADD(NOW(), INTERVAL ? SECOND), send_status='sending' WHERE id=?",
      [
        generation,
        otpHash({
          id: challenge.id,
          accountType,
          accountId: challenge.account_id,
          purpose,
          generation,
          otp,
        }),
        cooldownSeconds(),
        challenge.id,
      ],
    );
    await connection.commit();
    delivery = {
      id: challenge.id,
      generation,
      otp,
      destination: challenge.destination,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
  let budgetReserved = false;
  try {
    await reserveEmailBudget(db);
    budgetReserved = true;
    const providerMessageId = await sendOtpEmail({
      to: delivery.destination,
      otp: delivery.otp,
      purpose,
      idempotencyKey: `otp/${delivery.id}/${delivery.generation}`,
    });
    await db.query(
      "UPDATE auth_email_challenges SET send_status='sent', provider_message_id=? WHERE id=? AND generation=?",
      [providerMessageId, delivery.id, delivery.generation],
    );
    return {
      success: true,
      resendAfter: new Date(
        Date.now() + cooldownSeconds() * 1000,
      ).toISOString(),
    };
  } catch (error) {
    if (budgetReserved)
      try {
        await releaseEmailBudget(db);
      } catch {}
    await db.query(
      "UPDATE auth_email_challenges SET send_status='failed' WHERE id=? AND generation=?",
      [delivery.id, delivery.generation],
    );
    throw error;
  }
}

module.exports = {
  normalizeEmail,
  createChallenge,
  verifyChallenge,
  resendChallenge,
  maskEmail,
};
