#!/usr/bin/env node
// Load test: one homeroom period, every student behind the school's single IP.
//
// Each simulated student runs the real first-day flow against a running API:
//   login -> first-login password change -> assessment tasks -> open the round's
//   form (form + privacy notice) -> submit the answers.
// All students of a level start at the same moment. The report gives, per step
// and overall, p50/p95/max latency, error count and 429 count.
//
// SAFETY: only for a throwaway API on this machine that points at a clone
// database in the local docker MySQL. The script refuses a non-local API URL
// and a database whose name does not start with suth_sim_ or suth_load_.
//
// Usage (from server/):
//   node scripts/loadTestSchoolLogin.js --api http://127.0.0.1:5056 \
//     --db suth_load_20261021 --school 1 --classroom 1 --levels 40,120,400
// Options:
//   --origin   Origin header the API accepts (CORS_ORIGINS), default http://localhost:3001
//   --form     form id to open when the student has no pending round
//   --json     also write the full result to this file
// The API must run with DISABLE_TURNSTILE=true (no captcha in a script).
const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

const INITIAL_PASSWORD = "Temp-Load-2569";
const NEW_PASSWORD = "Load-Test-2569!";
const SEED_PASSWORD_COST = 10; // same as TEMP_PASSWORD_COST in schoolRoutes.js

function parseArgs(argv) {
  const args = {
    api: "http://127.0.0.1:5056",
    db: "",
    school: 1,
    classroom: 1,
    levels: [40, 120, 400],
    origin: "http://localhost:3001",
    form: null,
    json: "",
  };
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index].replace(/^--/, "");
    const value = argv[index + 1];
    if (name === "levels") args.levels = value.split(",").map(Number);
    else if (["school", "classroom", "form"].includes(name))
      args[name] = Number(value);
    else args[name] = value;
  }
  return args;
}

function assertSafeTarget({ api, db }) {
  const host = new URL(api).hostname;
  if (!["127.0.0.1", "localhost", "::1", "[::1]"].includes(host))
    throw new Error(`Refusing a non-local API: ${api}`);
  if (!/^suth_(sim|load)_[a-z0-9_]+$/.test(db))
    throw new Error(
      `Refusing database "${db}": use a clone named suth_sim_* or suth_load_*`,
    );
  const dbHost = process.env.DB_HOST || "localhost";
  if (!["127.0.0.1", "localhost"].includes(dbHost))
    throw new Error(`Refusing a non-local database host: ${dbHost}`);
}

async function seedStudents(connection, { school, classroom }, prefix, count) {
  const hash = await bcrypt.hash(INITIAL_PASSWORD, SEED_PASSWORD_COST);
  const usernames = [];
  for (let index = 1; index <= count; index += 1) {
    const username = `${prefix}-${String(index).padStart(3, "0")}`;
    const [account] = await connection.query(
      `INSERT INTO patient_accounts (username,password_hash,status,verified_at,must_change_password)
       VALUES (?,?,'active',NOW(),1)`,
      [username, hash],
    );
    // The school import files every student as a person linked to the
    // account (resolvePerson), so a submission finds that person.
    const [person] = await connection.query(
      "INSERT INTO persons (patient_account_id) VALUES (?)",
      [account.insertId],
    );
    await connection.query(
      `INSERT INTO school_students (school_id,classroom_id,student_code,person_id,patient_account_id,status)
       VALUES (?,?,?,?,?,'active')`,
      [
        school,
        classroom,
        username.toUpperCase(),
        person.insertId,
        account.insertId,
      ],
    );
    usernames.push(username);
  }
  return usernames;
}

function percentile(values, fraction) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1)
  ];
}

// One browser: keeps the session cookie and CSRF token between requests.
class Student {
  constructor(args, username, record) {
    this.args = args;
    this.username = username;
    this.record = record;
    this.cookies = new Map();
    this.csrf = "";
  }

  async call(step, method, url, body) {
    const headers = { Origin: this.args.origin };
    if (body) headers["Content-Type"] = "application/json";
    if (this.csrf) headers["X-CSRF-Token"] = this.csrf;
    if (this.cookies.size)
      headers.Cookie = [...this.cookies]
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
    const started = performance.now();
    let status = 0;
    let data = null;
    try {
      const response = await fetch(this.args.api + url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
      status = response.status;
      for (const cookie of response.headers.getSetCookie()) {
        const [pair] = cookie.split(";");
        const index = pair.indexOf("=");
        this.cookies.set(pair.slice(0, index), pair.slice(index + 1));
      }
      data = await response.json().catch(() => null);
    } catch (error) {
      data = { network_error: error.cause?.code || error.message };
    }
    this.record(step, performance.now() - started, status);
    if (data?.csrf_token) this.csrf = data.csrf_token;
    return { status, data };
  }

  async run() {
    const login = await this.call(
      "1 login",
      "POST",
      "/api/patient-auth/login",
      {
        username: this.username,
        password: INITIAL_PASSWORD,
      },
    );
    if (login.status !== 200) return `login ${login.status}`;
    const change = await this.call(
      "2 password change",
      "POST",
      "/api/patient-auth/password/change",
      { current_password: INITIAL_PASSWORD, new_password: NEW_PASSWORD },
    );
    if (change.status !== 200) return `password change ${change.status}`;
    const tasks = await this.call(
      "3 assessment tasks",
      "GET",
      "/api/patient/me/assessment-tasks",
    );
    if (tasks.status !== 200) return `tasks ${tasks.status}`;
    const formId = tasks.data?.rounds?.[0]?.form_id || this.args.form;
    if (!formId) return "no pending round";
    const [form, notice] = await Promise.all([
      this.call("4 open form", "GET", `/api/forms/${formId}`),
      this.call("4 open form", "GET", `/api/forms/${formId}/privacy-notice`),
    ]);
    if (form.status !== 200) return `form ${form.status}`;
    const payload = buildSubmission(form.data, notice.data);
    const submit = await this.call(
      "5 submit",
      "POST",
      `/api/forms/${formId}/submit`,
      payload,
    );
    if (submit.status !== 200 && submit.status !== 201)
      return `submit ${submit.status}`;
    return "ok";
  }
}

// Answers every question with a random choice, the way FormView sends them.
function buildSubmission(formResponse, notice) {
  const form = formResponse?.data || formResponse?.form || formResponse || {};
  let questions = form.questions || [];
  if (typeof questions === "string") questions = JSON.parse(questions);
  const answers = {};
  const questionTitles = {};
  let score = 0;
  for (const question of questions) {
    questionTitles[question.id] = question.title || question.id;
    if (["grid_multiple", "grid_checkbox"].includes(question.type)) {
      answers[question.id] = {};
      question.rows.forEach((_, row) => {
        const col = Math.floor(Math.random() * question.cols.length);
        answers[question.id][row] = question.cols[col];
        score += Number(question.colScores?.[col] || 0);
      });
    } else if (question.options?.length) {
      const option = question.options[0];
      answers[question.id] =
        typeof option === "object" ? option.text || option.label : option;
    } else if (question.required) {
      answers[question.id] = "-";
    }
  }
  return {
    processing_consent: true,
    notice_version: notice?.notice_version,
    answers,
    questionTitles,
    summaryData: {
      display_name: "-",
      score_results: [{ question_id: "load", title: "load", score }],
      raw_answers: {},
      consent_given: false,
    },
    consent_given: false,
  };
}

async function runLevel(args, usernames) {
  const samples = new Map();
  const record = (step, ms, status) => {
    if (!samples.has(step)) samples.set(step, []);
    samples.get(step).push({ ms, status });
  };
  const started = performance.now();
  const outcomes = await Promise.all(
    usernames.map((username) => new Student(args, username, record).run()),
  );
  const wall = performance.now() - started;
  const summarize = (list) => {
    const times = list.map((item) => item.ms);
    return {
      requests: list.length,
      p50_ms: Math.round(percentile(times, 0.5)),
      p95_ms: Math.round(percentile(times, 0.95)),
      max_ms: Math.round(Math.max(...times)),
      errors: list.filter((item) => item.status === 0 || item.status >= 400)
        .length,
      status_429: list.filter((item) => item.status === 429).length,
    };
  };
  const steps = {};
  for (const [step, list] of [...samples].sort()) steps[step] = summarize(list);
  const failures = {};
  for (const outcome of outcomes)
    if (outcome !== "ok") failures[outcome] = (failures[outcome] || 0) + 1;
  return {
    students: usernames.length,
    completed: outcomes.filter((outcome) => outcome === "ok").length,
    wall_seconds: Number((wall / 1000).toFixed(1)),
    overall: summarize([...samples.values()].flat()),
    steps,
    failures,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  assertSafeTarget(args);
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: args.db,
  });
  const run = Date.now().toString(36);
  const results = [];
  try {
    for (const level of args.levels) {
      const usernames = await seedStudents(
        connection,
        args,
        `lt${run}n${level}`,
        level,
      );
      console.log(`\n== ${level} students from one IP ==`);
      const result = await runLevel(args, usernames);
      results.push(result);
      console.log(
        `completed ${result.completed}/${result.students} in ${result.wall_seconds}s`,
      );
      console.table({ overall: result.overall, ...result.steps });
      if (Object.keys(result.failures).length)
        console.log("failures:", result.failures);
    }
  } finally {
    await connection.end();
  }
  if (args.json) fs.writeFileSync(args.json, JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
