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

// ── Date helpers — maturity is issue date + tenure (calendar months) + 2 days,
//    which is inherently leap-year aware (uses real month lengths). ──
const addMonths = (base, months) => {
  const d = new Date(base);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + Number(months || 0));
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
};
const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days || 0));
  return d;
};
const GRACE_DAYS = 2;
const fdMaturityDate = (issueDate, tenureMonths) =>
  issueDate ? addDays(addMonths(issueDate, tenureMonths), GRACE_DAYS) : null;
const daysBetween = (a, b) => {
  if (!a || !b) return 0;
  const ms = new Date(b).setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0);
  return Math.round(ms / (24 * 60 * 60 * 1000));
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

  const [fdrNo, setFdrNo] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [tenureMonths, setTenureMonths] = useState(12);
  const [date, setDate] = useState(todayISO()); // issued date
  const [interestRate, setInterestRate] = useState("");
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Linked FD receipts for the member (the "amount paid dates" to pick from).
  const [fdReceipts, setFdReceipts] = useState([]);
  const [selectedReceiptIds, setSelectedReceiptIds] = useState([]);
  const [loadingReceipts, setLoadingReceipts] = useState(false);

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
    setFdReceipts([]);
    setSelectedReceiptIds([]);
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
        fetchFdReceipts(id);
      } else {
        setMemberStatus("not_found");
        setFdReceipts([]);
        setSelectedReceiptIds([]);
      }
    } catch (e) {
      console.error(e);
      setMemberStatus("not_found");
      toast.error("Error looking up member");
    } finally {
      setChecking(false);
    }
  };

  // Fetch this member's Fixed Deposit receipts, to pick which ones fund the FD.
  const fetchFdReceipts = async (id) => {
    setLoadingReceipts(true);
    setSelectedReceiptIds([]);
    try {
      const res = await axios.get(`${API_BASE}/receipts`, {
        params: { membershipid: id, paymentcategory: "fixed_deposit" },
      });
      const list = (res.data.data || [])
        .filter((r) => !r.cancelled)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
      setFdReceipts(list);
      if (!list.length) {
        toast.info("No Fixed Deposit receipts found for this member yet");
      }
    } catch (e) {
      console.error(e);
      setFdReceipts([]);
      toast.error("Error fetching receipts");
    } finally {
      setLoadingReceipts(false);
    }
  };

  const toggleReceipt = (rid) =>
    setSelectedReceiptIds((prev) =>
      prev.includes(rid) ? prev.filter((x) => x !== rid) : [...prev, rid]
    );

  const selectedReceipts = fdReceipts.filter((r) => selectedReceiptIds.includes(r._id));
  const selectedTotal = selectedReceipts.reduce((s, r) => s + (Number(r.amountpaid) || 0), 0);

  // ── Live preview ──
  const principal = Number(amount) || 0;
  const rate = Number(interestRate) || 0;
  const maturityDate = fdMaturityDate(date, tenureMonths);
  const termDays = daysBetween(date, maturityDate);
  const interestAmount = principal && rate ? (principal * rate * (termDays / 365)) / 100 : 0;
  const maturityAmount = principal + interestAmount;

  const handleMembershipInput = (e) =>
    setMembershipInput(e.target.value.replace(/\D/g, "").slice(0, 4));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (memberStatus !== "found") return toast.error("Enter a valid membership number (member must exist)");
    if (!fdrNo.trim()) return toast.error("FDR No is required");
    if (!name.trim()) return toast.error("Name is required");
    if (!principal) return toast.error("Amount is required");
    if (!rate) return toast.error("Custom interest rate is required");

    setSubmitting(true);
    try {
      const receipts = selectedReceipts.map((r) => ({
        receipt_id: r._id,
        receipt_no: r.receipt_no,
        date: r.date,
        amount: Number(r.amountpaid) || 0,
      }));
      const payload = {
        fdrNo: fdrNo.trim(),
        membershipId,
        name,
        date,
        amount: principal,
        amountPaid: selectedTotal || principal,
        tenureMonths: Number(tenureMonths) || 12,
        interestRate: rate,
        receipts,
      };
      const res = await axios.post(`${API_BASE}/fixed-deposit`, payload);
      toast.success(`Fixed Deposit created — ${res.data?.data?.fdrNo || ""}`);
      // reset
      setMembershipInput("");
      setMembershipId("");
      setMemberStatus("idle");
      setFdrNo("");
      setName("");
      setMobile("");
      setAmount("");
      setInterestRate("");
      setTenureMonths(12);
      setDate(todayISO());
      setFdReceipts([]);
      setSelectedReceiptIds([]);
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
            {/* Membership Id (with project + year selectors used to build it) */}
            <div className="md:col-span-2">
              <label className={label}>Membership Id <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select className={field} value={project} onChange={(e) => setProject(e.target.value)}>
                  {PROJECTS.map((p) => (
                    <option key={p.code} value={p.name}>{p.name} ({p.code})</option>
                  ))}
                </select>
                <select className={field} value={year} onChange={(e) => setYear(e.target.value)}>
                  {yearOptions.map((y) => (
                    <option key={y} value={String(y)}>{y}</option>
                  ))}
                </select>
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
                    className="flex-1 px-3 py-2.5 text-sm focus:outline-none w-full"
                  />
                  {checking && <span className="flex items-center px-2 text-xs text-gray-400 animate-pulse">…</span>}
                </div>
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

            {/* FDR No (user-entered) */}
            <div>
              <label className={label}>FDR No. <span className="text-red-500">*</span></label>
              <input
                className={field}
                value={fdrNo}
                onChange={(e) => setFdrNo(e.target.value)}
                placeholder="e.g. FDR2026001"
              />
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

            {/* Tenure */}
            <div>
              <label className={label}>Tenure (months) <span className="text-red-500">*</span></label>
              <input type="number" min="1" className={field} value={tenureMonths} onChange={(e) => setTenureMonths(e.target.value)} placeholder="e.g. 12" />
            </div>

            {/* Issued Date */}
            <div>
              <label className={label}>Issued Date <span className="text-red-500">*</span></label>
              <input type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
              <div className="text-xs text-gray-400 mt-1">Maturity = issued date + tenure + 2 days.</div>
            </div>

            {/* Maturity Date (auto from issued date + tenure) */}
            <div>
              <label className={label}>Maturity Date (auto)</label>
              <input className={`${field} bg-gray-50`} value={fmtDate(maturityDate)} readOnly />
              <div className="text-xs text-gray-400 mt-1">{termDays ? `${termDays} days` : ""}</div>
            </div>

            {/* Interest */}
            <div>
              <label className={label}>Custom Interest (% p.a.) <span className="text-red-500">*</span></label>
              <input type="number" min="0" step="0.01" className={field} value={interestRate} onChange={(e) => setInterestRate(e.target.value)} placeholder="e.g. 8" />
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
          </div>

          {/* Amount Paid Date(s) — pick the receipts that fund this FD */}
          <div className="mt-6 bg-white border border-[#EF742C]/20 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[14px] text-[#EF742C]">Amount Paid Date(s) — Linked Receipts</h3>
              {selectedReceipts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(String(selectedTotal))}
                  className="text-xs font-semibold text-[#EF742C] underline"
                >
                  Use selected total ({inr(selectedTotal)}) as amount
                </button>
              )}
            </div>

            {memberStatus !== "found" ? (
              <div className="text-sm text-gray-400">Enter a valid membership id to load its Fixed Deposit receipts.</div>
            ) : loadingReceipts ? (
              <div className="text-sm text-gray-400 animate-pulse">Loading receipts…</div>
            ) : fdReceipts.length === 0 ? (
              <div className="text-sm text-amber-600">No Fixed Deposit receipts found for this member.</div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {fdReceipts.map((r) => {
                  const checked = selectedReceiptIds.includes(r._id);
                  return (
                    <label
                      key={r._id}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer text-sm ${checked ? "border-[#EF742C] bg-orange-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}
                    >
                      <input type="checkbox" checked={checked} onChange={() => toggleReceipt(r._id)} className="accent-[#EF742C]" />
                      <span className="font-semibold w-28">{fmtDate(r.date)}</span>
                      <span className="w-28">{inr(r.amountpaid)}</span>
                      <span className="text-gray-500 truncate">#{r.receipt_no}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {selectedReceipts.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 text-sm">
                <span className="text-gray-500">Selected: </span>
                <span className="font-semibold">{selectedReceipts.length} receipt(s) · {inr(selectedTotal)}</span>
              </div>
            )}
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
                Simple interest = principal × rate% × ({termDays} / 365). Term derived from tenure ({tenureMonths} months) + 2 days, leap-year aware.
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