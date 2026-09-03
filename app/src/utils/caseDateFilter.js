const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MYSQL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/;
export const BANGKOK_TIME_ZONE = "Asia/Bangkok";

const bangkokParts = (date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type)?.value;
  return { year: value("year"), month: value("month"), day: value("day") };
};

const bangkokDateFromParts = (year, month, day, hour = 0, minute = 0, second = 0) =>
  new Date(Date.UTC(year, month - 1, day, hour - 7, minute, second));

// Date inputs and MySQL DATETIME values represent Bangkok calendar values.
export function parseCaseDate(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (!value) return null;
  const text = String(value).trim();
  const dateOnly = text.match(DATE_ONLY);
  if (dateOnly) {
    return bangkokDateFromParts(
      Number(dateOnly[1]),
      Number(dateOnly[2]),
      Number(dateOnly[3]),
    );
  }
  const mysqlDateTime = text.match(MYSQL_DATETIME);
  if (mysqlDateTime) {
    return bangkokDateFromParts(
      Number(mysqlDateTime[1]), Number(mysqlDateTime[2]), Number(mysqlDateTime[3]),
      Number(mysqlDateTime[4]), Number(mysqlDateTime[5]), Number(mysqlDateTime[6] || 0),
    );
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function bangkokDateKey(value) {
  const date = value instanceof Date ? value : parseCaseDate(value);
  if (!date || Number.isNaN(date.getTime())) return "";
  const { year, month, day } = bangkokParts(date);
  return `${year}-${month}-${day}`;
}

export function formatBangkokDate(value, locale = "th-TH", options = {}) {
  const date = value instanceof Date ? value : parseCaseDate(value);
  if (!date || Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale, {
    timeZone: BANGKOK_TIME_ZONE,
    ...options,
  }).format(date);
}

export function getCurrentMonthDateRange(referenceDate = new Date()) {
  const today = parseCaseDate(referenceDate) || new Date();
  const [year, month] = bangkokDateKey(today).split("-");
  return {
    startDate: `${year}-${month}-01`,
    endDate: bangkokDateKey(today),
  };
}

export function caseRecordDate(record) {
  return parseCaseDate(record?.submitted_at || record?.updated_at || record?.createdAt || record?.created_at || record?.appointment_date || record?.appointment);
}

export function isCaseInDateRange(record, startDate, endDate) {
  const date = caseRecordDate(record);
  if (!date) return !startDate && !endDate;
  const key = bangkokDateKey(date);
  return (!startDate || key >= startDate) && (!endDate || key <= endDate);
}

export function normaliseDateRange(startDate, endDate) {
  return startDate && endDate && startDate > endDate ? [endDate, startDate] : [startDate, endDate];
}
