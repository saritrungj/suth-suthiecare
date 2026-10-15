import { toDisplayText } from '../../../utils/textPresentation.js';
// ==========================================
// Helper Functions สำหรับ FormView
// ==========================================

export const normalizeLoginEnforcement = (value) =>
  ["strict", "optional", "none"].includes(value) ? value : "none";

export const normalizeResultDisplayMode = (value) =>
  ["realtime", "on_submit"].includes(value) ? value : "realtime";

export const canGuestSubmit = (loginEnforcement) =>
  normalizeLoginEnforcement(loginEnforcement) === "none";

export const shouldShowRealtimeResults = (resultDisplayMode) =>
  normalizeResultDisplayMode(resultDisplayMode) === "realtime";

export const formatThaiID = (value) => {
  const val = value.replace(/\D/g, "");
  if (val.length <= 1) return val;
  if (val.length <= 5) return `${val.slice(0, 1)}-${val.slice(1)}`;
  if (val.length <= 10)
    return `${val.slice(0, 1)}-${val.slice(1, 5)}-${val.slice(5)}`;
  if (val.length <= 12)
    return `${val.slice(0, 1)}-${val.slice(1, 5)}-${val.slice(5, 10)}-${val.slice(10)}`;
  return `${val.slice(0, 1)}-${val.slice(1, 5)}-${val.slice(5, 10)}-${val.slice(10, 12)}-${val.slice(12, 13)}`;
};

export const validateThaiID = (id) => {
  let val = id.replace(/\D/g, "");
  if (val.length !== 13) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseFloat(val.charAt(i)) * (13 - i);
  let checkDigit = (11 - (sum % 11)) % 10;
  return checkDigit === parseFloat(val.charAt(12));
};

export const formatPhoneNumber = (value) => {
  const val = value.replace(/\D/g, "");
  if (val.length <= 3) return val;
  if (val.length <= 6) return `${val.slice(0, 3)}-${val.slice(3)}`;
  return `${val.slice(0, 3)}-${val.slice(3, 6)}-${val.slice(6, 10)}`;
};

// Removes national ID questions (including those inside groups).
export const withoutNationalIdQuestions = (questions = []) =>
  questions
    .filter((question) => question?.type !== "national_id")
    .map((question) =>
      question?.type === "group"
        ? {
            ...question,
            subQuestions: withoutNationalIdQuestions(
              question.subQuestions || [],
            ),
          }
        : question,
    );

// A signed-in account that already holds a national ID is identified by it, so
// the form does not ask again. Everyone else sees the question together with
// the PDPA consent box, and the ID is only used once they consent.
export const prepareNationalIdQuestions = (
  questions = [],
  { accountHasIdentity = false } = {},
) => (accountHasIdentity ? withoutNationalIdQuestions(questions) : questions);

const isEmptyAnswer = (value) =>
  value === undefined || value === null || String(value).trim() === "";

// Answers to prefill from the signed-in account: the name (and phone) fields.
// Only empty answers are filled, so a restored draft or an edit always wins,
// and the fields stay editable.
export const accountPrefillAnswers = (
  questions = [],
  account,
  current = {},
) => {
  if (!account) return {};
  const fullName = [account.first_name, account.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const phone = String(account.phone || "").replace(/\D/g, "");
  const filled = {};
  const visit = (items) =>
    (items || []).forEach((question) => {
      if (!question) return;
      if (question.type === "group") return visit(question.subQuestions);
      if (!isEmptyAnswer(current[question.id])) return;
      if (
        fullName &&
        (question.type === "full_name" || question.systemRole === "name")
      )
        filled[question.id] = fullName;
      else if (phone.length === 10 && question.type === "phone_number")
        filled[question.id] = formatPhoneNumber(phone);
    });
  visit(questions);
  return filled;
};

// The national ID is sent to the server only with explicit consent. The first
// consented, valid ID answer wins.
export const consentedNationalId = (
  questions = [],
  answers = {},
  consents = {},
) => {
  let identity = null;
  const visit = (items) =>
    (items || []).forEach((question) => {
      if (identity || !question) return;
      if (question.type === "group") return visit(question.subQuestions);
      const answer = answers[question.id];
      if (
        question.type === "national_id" &&
        consents[question.id] === true &&
        answer &&
        validateThaiID(String(answer))
      )
        identity = String(answer).replace(/\D/g, "");
    });
  visit(questions);
  return identity;
};

// raw_answers is a readable summary; a national ID never appears in it in full.
export const maskThaiID = (value) => {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length !== 13) return digits ? "-" : "";
  return `${digits[0]}-${digits.slice(1, 3)}xx-xxxxx-x${digits[11]}-${digits[12]}`;
};

export const getQuestionTitles = (groupedSteps) => {
  const titles = {};
  groupedSteps.forEach((step) => {
    step.items.forEach((q) => {
      if (q.type === "group") {
        (q.subQuestions || []).forEach((sq) => {
          titles[sq.id] = sq.title
            ? sq.title.replace(/<[^>]+>/g, "")
            : "คำถามที่ไม่มีชื่อ";
        });
      } else {
        titles[q.id] = q.title
          ? q.title.replace(/<[^>]+>/g, "")
          : "คำถามที่ไม่มีชื่อ";
      }
    });
  });
  return titles;
};

export const calculateQuestionScore = (q, rawAns) => {
  let totalScore = 0;

  // 🟢 ฟังก์ชันช่วยหา Index ของตัวเลือกแบบยืดหยุ่น (ลบ HTML และ Trim ก่อนเทียบ)
  const findItemIndex = (list, val) => {
    if (!val || !list || !Array.isArray(list)) return -1;
    const cleanVal = String(val)
      .replace(/<[^>]+>/g, "")
      .trim()
      .toLowerCase();
    return list.findIndex(
      (item) =>
        String(item)
          .replace(/<[^>]+>/g, "")
          .trim()
          .toLowerCase() === cleanVal,
    );
  };

  if (q.type === "bmi") {
    const w = parseFloat(rawAns.weight) || 0;
    const hCm = parseFloat(rawAns.height) || 0;
    if (w > 0 && hCm > 0) {
      const hM = hCm / 100;
      totalScore = Number((w / (hM * hM)).toFixed(2));
    }
  } else if (q.type === "grid_multiple" || q.type === "grid_checkbox") {
    const colScores = q.colScores || [];
    const rowScores = q.rowScores || [];
    const mode = q.scoreMode || "column";

    Object.entries(rawAns).forEach(([rowIndex, val]) => {
      const rIdx = Number(rowIndex);

      const getScoreForCell = (colIdx) => {
        // 🟢 กรณีโหมด Cell: ใช้คะแนนรายช่อง (ถ้ามีการกำหนดไว้)
        if (
          mode === "cell" &&
          q.cellScores &&
          q.cellScores[rIdx] &&
          q.cellScores[rIdx][colIdx] !== undefined
        ) {
          return Number(q.cellScores[rIdx][colIdx]);
        }
        // 🟢 กรณีโหมด Column: ใช้คะแนนของคอลัมน์นั้นๆ
        if (mode === "column") return Number(colScores[colIdx]) || 0;
        // 🟢 กรณีโหมด Row: ใช้คะแนนของแถวนั้นๆ
        if (mode === "row") return Number(rowScores[rIdx]) || 0;
        return 0;
      };

      if (Array.isArray(val)) {
        val.forEach((v) => {
          const colIdx = findItemIndex(q.cols, v);
          if (colIdx !== -1) totalScore += getScoreForCell(colIdx);
        });
      } else {
        const colIdx = findItemIndex(q.cols, val);
        if (colIdx !== -1) totalScore += getScoreForCell(colIdx);
      }
    });
  } else if (
    q.type === "multiple_choice" ||
    q.type === "dropdown" ||
    q.type === "faculty"
  ) {
    const optIdx = findItemIndex(q.options, rawAns);
    if (optIdx !== -1 && q.optionScores)
      totalScore += Number(q.optionScores[optIdx]) || 0;
  } else if (q.type === "checkboxes") {
    if (Array.isArray(rawAns)) {
      rawAns.forEach((v) => {
        const optIdx = findItemIndex(q.options, v);
        if (optIdx !== -1 && q.optionScores)
          totalScore += Number(q.optionScores[optIdx]) || 0;
      });
    }
  }
  return totalScore;
};

const stripHtml = (value, fallback) =>
  toDisplayText(value) || fallback;

const resolveScoreResult = (question, score, fallbackTitle) => {
  const matchedRule = (question.scoringRules || []).find(
    (rule) => score >= Number(rule.min) && score <= Number(rule.max),
  );

  return {
    question_id: question.id,
    title: stripHtml(question.title, fallbackTitle),
    score,
    label: matchedRule?.label || "ประเมินผลเสร็จสิ้น",
    color: matchedRule?.color || "#35756d",
    advice: matchedRule?.advice || "",
  };
};

export const buildScoreResults = (questions = [], answers = {}) => {
  const results = [];

  questions.forEach((question) => {
    if (question.type === "group") {
      if (question.isScored) {
        let groupScore = 0;
        let hasAnswer = false;

        (question.subQuestions || []).forEach((subQuestion) => {
          const answer = answers[subQuestion.id];
          if (answer !== undefined && answer !== null && answer !== "") {
            hasAnswer = true;
            groupScore += calculateQuestionScore(subQuestion, answer);
          }
        });

        if (hasAnswer) {
          results.push(resolveScoreResult(question, groupScore, "กลุ่มคำถาม"));
        }
        return;
      }

      (question.subQuestions || []).forEach((subQuestion) => {
        const answer = answers[subQuestion.id];
        if (
          subQuestion.isScored &&
          answer !== undefined &&
          answer !== null &&
          answer !== ""
        ) {
          results.push(
            resolveScoreResult(
              subQuestion,
              calculateQuestionScore(subQuestion, answer),
              "คำถาม",
            ),
          );
        }
      });
      return;
    }

    const answer = answers[question.id];
    if (
      question.isScored &&
      answer !== undefined &&
      answer !== null &&
      answer !== ""
    ) {
      results.push(
        resolveScoreResult(
          question,
          calculateQuestionScore(question, answer),
          "คำถาม",
        ),
      );
    }
  });

  return results;
};

export const countScoredTargets = (questions = []) =>
  questions.reduce((count, question) => {
    if (question.type !== "group") return count + (question.isScored ? 1 : 0);
    if (question.isScored) return count + 1;
    return (
      count +
      (question.subQuestions || []).filter(
        (subQuestion) => subQuestion.isScored,
      ).length
    );
  }, 0);
