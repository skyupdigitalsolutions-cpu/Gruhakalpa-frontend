// ─────────────────────────────────────────────────────────────────────────
// Phone helpers — one place that decides India vs UK (vs other) format.
// Mirrors Gruhakalpa-backend/utils/phone.js.
//
//   • India: 10 digits starting 6-9 (optionally +91 / 0).
//     Displayed as "+91 98765 43210".
//   • UK: MUST be entered with +44 (e.g. +447911123456).
//     Displayed as "+44 7911 123456".
//   • Other countries: entered with +code, displayed as "+<digits>".
//
// A UK local number like 07911123456 can't be told apart from an Indian
// "0" + 7911123456 — that's why UK numbers must carry +44.
// ─────────────────────────────────────────────────────────────────────────

// Form validation: Indian (as before) OR international with "+country code".
export const PHONE_REGEX = /^(?:(?:\+91|0)?[6-9]\d{9}|\+[1-9]\d{7,14})$/;

export const PHONE_ERROR =
  "Enter a 10-digit Indian number, or a UK number with +44 (e.g. +447911123456)";

export const PHONE_PLACEHOLDER = "e.g. 9876543210 or +447911123456";

const digitsOf = (v) =>
  String(v ?? "")
    .replace(/\D/g, "")
    .replace(/^00/, "");

// Returns the 10-digit Indian local number, or null if not Indian.
const indianLocal = (d) => {
  if (/^[6-9]\d{9}$/.test(d)) return d;
  if (/^0[6-9]\d{9}$/.test(d)) return d.slice(1);
  if (/^91[6-9]\d{9}$/.test(d)) return d.slice(2);
  return null;
};

// Display: "+91 98765 43210" / "+44 7911 123456". Empty → "".
export const formatPhone = (v) => {
  const d = digitsOf(v);
  if (!d) return "";
  const local = indianLocal(d);
  if (local) return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
  if (/^447\d{9}$/.test(d)) return `+44 ${d.slice(2, 6)} ${d.slice(6)}`;
  if (d.startsWith("44") && d.length >= 11) return `+44 ${d.slice(2)}`;
  if (d.length >= 8 && d.length <= 15) return `+${d}`;
  return String(v);
};

// Canonical comparison key: India → 10-digit local, else full digits.
export const phoneKey = (v) => {
  const d = digitsOf(v);
  if (!d) return "";
  return indianLocal(d) || d;
};

// For Number-typed backend fields (site booking mobilenumber, etc.).
export const toPhoneNumber = (v) => {
  const k = phoneKey(v);
  if (!k) return undefined;
  const n = Number(k);
  return isNaN(n) ? undefined : n;
};