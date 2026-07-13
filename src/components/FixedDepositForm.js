import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Header } from "./Header";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3001";

// Same projects/codes as ReceiptForm & SiteBookingForm.
const PROJECTS = [
  { name: "Gruhakalpa", code: "GK" },
  { name: "New City", code: "NC" },
  { name: "Sri Sai Nagar", code: "SSN" },
];

const CURRENT_YEAR = new Date().getFullYear();
const yearOptions = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - 2 + i);

// Build full membership ID: CODE + year + zero-padded number e.g. GK2026005
const buildMembershipId = (projectCode, year, number) => {
  if (!projectCode || !year || !number) return "";
  return `${projectCode}${year}${String(number).padStart(3, "0")}`;
};

// ── Compact Indian number-to-words (preview only; backend is authoritative) ──
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
const two = (n) => (n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : ""));
const three = (n) => {
  const h = Math.floor(n / 100), r = n % 100;
  return (h ? ONES[h] + " Hundred" : "") + (r ? (h ? " " : "") + two(r) : "");
};
const numberToWords = (amount) => {
  let n = Math.floor(Math.max(0, Number(amount) || 0));
  if (!n) return "Rupees Zero Only";
  const parts = [];
  const cr = Math.floor(n / 10000000); n %= 10000000;
  const la = Math.floor(n / 100000); n %= 100000;
  const th = Math.floor(n / 1000); n %= 1000;
  if (cr) parts.push(three(cr) + " Crore");
  if (la) parts.push(two(la) + " Lakh");
  if (th) parts.push(two(th) + " Thousand");
  if (n) parts.push(three(n));
  return ("Rupees " + parts.join(" ") + " Only").replace(/\s+/g, " ").trim();
};

const FD_TENURE_DAYS = 367;
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const todayISO = () => new Date().toISOString().split("T")[0];

const label = "font-semibold text-[14px] pb-1 block";
const field =
  "border border-gray-300 px-4 py-2.5 w-full bg-white rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed";

export function FixedDepositForm() {
  const [project, setProject] = useState(PROJECTS[0].name);
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [membershipInput, setMembershipInput] = useState("");
  const [membershipId, setMembershipId] = useState("");
  const [memberStatus, setMemberStatus] = useState("idle"); // idle | found | not_found
  const [checking, setChecking] = useState(false);

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState("");
  const [amountPaidDate, setAmountPaidDate] = useState(todayISO());
  const [tenureMonths, setTenureMonths] = useState(12);
  const [interestRate, setInterestRate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const projectCode = PROJECTS.find((p) => p.name === project)?.code || "";

  // Build the full membership id whenever inputs change
  useEffect(() => {
    setMembershipId(buildMembershipId(projectCode, year, membershipInput));
  }, [projectCode, year, membershipInput]);

  // Debounced member lookup once a complete number is entered
  useEffect(() => {
    if (membershipInput.length >= 3 && membershipId) {
      const t = setTimeout(() => lookupMember(membershipId), 500);
      return () => clearTimeout(t);
    }
    setMemberStatus("idle");
  }, [membershipId, membershipInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const lookupMember = async (id) => {
    setChecking(true);
    setMemberStatus("idle");
    try {
      const res = await axios.get(`${API_BASE}/members`);
      const members = res.data.data || [];
      const m = members.find((x) => x.membership_id === id);
      if (m) {
        setName(m.name || "");
        setMobile(String(m.mobile ?? m.mobilenumber ?? m.mobile_number ?? ""));
        setMemberStatus("found");
        toast.success("Member found — details auto-filled");
      } else {
        setMemberStatus("not_found");
      }
    } catch (e) {
      console.error(e);
      setMemberStatus("not_found");
      toast.error("Error looking up member");
    } finally {
      setChecking(false);
    }
  };

  // ── Live preview ──
  const principal = Number(amount) || 0;
  const rate = Number(interestRate) || 0;
  const maturityDate = amountPaidDate ? addDays(amountPaidDate, FD_TENURE_DAYS) : null;
  const interestAmount = principal && rate ? (principal * rate * (FD_TENURE_DAYS / 365)) / 100 : 0;
  const maturityAmount = principal + interestAmount;

  const handleMembershipInput = (e) =>
    setMembershipInput(e.target.value.replace(/\D/g, "").slice(0, 4));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (memberStatus !== "found") return toast.error("Enter a valid membership number (member must exist)");
    if (!name.trim()) return toast.error("Name is required");
    if (!principal) return toast.error("Amount is required");
    if (!rate) return toast.error("Custom interest rate is required");

    setSubmitting(true);
    try {
      const payload = {
        membershipId,
        name,
        date,
        amount: principal,
        amountPaid: principal,
        amountPaidDate,
        tenureMonths: Number(tenureMonths) || 12,
        interestRate: rate,
      };
      const res = await axios.post(`${API_BASE}/fixed-deposit`, payload);
      toast.success(`Fixed Deposit created — ${res.data?.data?.fdrNo || ""}`);
      // reset
      setMembershipInput("");
      setMembershipId("");
      setMemberStatus("idle");
      setName("");
      setMobile("");
      setAmount("");
      setInterestRate("");
      setTenureMonths(12);
      setDate(todayISO());
      setAmountPaidDate(todayISO());
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create fixed deposit");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <Header />
      <div className="w-[791px] px-10 ml-10">
        <h1 className="font-semibold text-2xl mt-[50px] mb-[40px]">Fixed Deposit</h1>

        <form className="bg-[#EF742C]/10 mb-10 p-[30px] rounded-xl" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Project */}
            <div>
              <label className={label}>Project <span className="text-red-500">*</span></label>
              <select className={field} value={project} onChange={(e) => setProject(e.target.value)}>
                {PROJECTS.map((p) => (
                  <option key={p.code} value={p.name}>{p.name}</option>
                ))}
              </select>
              <div className="text-xs text-gray-400 mt-1">Code: <span className="font-semibold text-gray-500">{projectCode}</span></div>
            </div>

            {/* Year */}
            <div>
              <label className={label}>Year <span className="text-red-500">*</span></label>
              <select className={field} value={year} onChange={(e) => setYear(e.target.value)}>
                {yearOptions.map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>

            {/* Membership number */}
            <div>
              <label className={label}>Membership Id <span className="text-red-500">*</span></label>
              <div className="flex items-stretch rounded border border-gray-300 overflow-hidden bg-white focus-within:ring-2 focus-within:ring-orange-400">
                <span className="flex items-center px-3 bg-orange-50 border-r border-gray-300 text-sm font-semibold text-[#EF742C] whitespace-nowrap">
                  {projectCode || "--"}{year || "----"}
                </span>
                <input
                  type="text"
                  placeholder="001"
                  value={membershipInput}
                  onChange={handleMembershipInput}
                  maxLength={4}
                  className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
                />
                {checking && <span className="flex items-center px-3 text-xs text-gray-400 animate-pulse">Checking…</span>}
              </div>
              {memberStatus === "found" && (
                <div className="text-xs mt-1.5 px-2.5 py-1.5 rounded-md font-medium text-green-700 bg-green-50 border border-green-200">
                  ✓ Member found — {membershipId}
                </div>
              )}
              {memberStatus === "not_found" && (
                <div className="text-xs mt-1.5 px-2.5 py-1.5 rounded-md font-medium text-amber-700 bg-amber-50 border border-amber-200">
                  ○ {membershipId} not found — add the member first
                </div>
              )}
            </div>

            {/* FDR No (auto) */}
            <div>
              <label className={label}>FDR No.</label>
              <input className={field} value="Auto-generated on save (FDR……)" readOnly disabled />
            </div>

            {/* Name */}
            <div>
              <label className={label}>Name <span className="text-red-500">*</span></label>
              <input className={field} value={name} onChange={(e) => setName(e.target.value)} placeholder="Member name" disabled={memberStatus === "found"} />
            </div>

            {/* Mobile */}
            <div>
              <label className={label}>Mobile</label>
              <input className={field} value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="Mobile" disabled={memberStatus === "found"} />
            </div>

            {/* Date */}
            <div>
              <label className={label}>Date <span className="text-red-500">*</span></label>
              <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>

            {/* Amount */}
            <div>
              <label className={label}>Amount (₹) <span className="text-red-500">*</span></label>
              <input type="number" min="1" className={field} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 100000" />
            </div>

            {/* Sum of Rupees (words, auto) */}
            <div className="md:col-span-2">
              <label className={label}>Sum of Rupees (in words)</label>
              <input className={`${field} bg-gray-50`} value={principal ? numberToWords(principal) : ""} readOnly placeholder="Auto-filled from amount" />
            </div>

            {/* Amount Paid Date */}
            <div>
              <label className={label}>Amount Paid Date <span className="text-red-500">*</span></label>
              <input type="date" className={field} value={amountPaidDate} onChange={(e) => setAmountPaidDate(e.target.value)} />
              <div className="text-xs text-gray-400 mt-1">Maturity is 367 days from this date. Editable later per transaction.</div>
            </div>

            {/* Maturity Date (auto) */}
            <div>
              <label className={label}>Maturity Date (auto)</label>
              <input className={`${field} bg-gray-50`} value={fmtDate(maturityDate)} readOnly />
            </div>

            {/* Tenure */}
            <div>
              <label className={label}>Tenure (months)</label>
              <input type="number" min="1" className={field} value={tenureMonths} onChange={(e) => setTenureMonths(e.target.value)} />
            </div>

            {/* Custom interest */}
            <div>
              <label className={label}>Custom Interest (% p.a.) <span className="text-red-500">*</span></label>
              <input type="number" min="0" step="0.01" className={field} value={interestRate} onChange={(e) => setInterestRate(e.target.value)} placeholder="e.g. 8" />
            </div>
          </div>

          {/* Interest preview */}
          {principal > 0 && rate > 0 && (
            <div className="mt-6 bg-white border border-[#EF742C]/20 rounded-xl p-5">
              <h3 className="font-semibold text-[14px] mb-3 text-[#EF742C]">Interest Preview</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><div className="text-xs text-gray-500 uppercase">Principal</div><div className="font-semibold">{inr(principal)}</div></div>
                <div><div className="text-xs text-gray-500 uppercase">Interest ({rate}%)</div><div className="font-semibold text-green-600">{inr(interestAmount)}</div></div>
                <div><div className="text-xs text-gray-500 uppercase">Maturity Value</div><div className="font-bold text-[#EF742C]">{inr(maturityAmount)}</div></div>
                <div><div className="text-xs text-gray-500 uppercase">Matures On</div><div className="font-semibold">{fmtDate(maturityDate)}</div></div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-400">
                Simple interest = principal × rate% × (367 / 365).
              </div>
            </div>
          )}

          <div className="flex justify-end mt-6">
            <button
              type="submit"
              disabled={submitting}
              className={`bg-gradient-to-r from-orange-200 via-orange-500 to-orange-600 text-white font-bold px-8 py-2.5 rounded-full shadow-lg ${submitting ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {submitting ? "Saving..." : "Create Fixed Deposit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default FixedDepositForm;