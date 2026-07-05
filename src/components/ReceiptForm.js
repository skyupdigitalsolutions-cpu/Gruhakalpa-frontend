/* eslint-disable */
import { useState, useEffect, useRef } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import axios from "axios";
import { toast } from "react-toastify";
import { Header } from "./Header";
import { ChevronDown, Check, CircleX, Eye } from "lucide-react";

const API_BASE = process.env.REACT_APP_API_BASE || "https://gruhakalpa-api.skyupdigitalsolutions.workers.dev";

// ── Projects Config (parity with SiteBookingForm) ──
const PROJECTS = [
  { name: "Gruhakalpa", code: "GK" },
  { name: "New City", code: "NC" },
  { name: "Sri Sai Nagar", code: "SSN" },
];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS_BACK = 2;
const YEARS_FORWARD = 3;
const yearOptions = Array.from(
  { length: YEARS_BACK + YEARS_FORWARD + 1 },
  (_, i) => CURRENT_YEAR - YEARS_BACK + i,
).map((y) => ({ label: String(y), value: String(y) }));

// Build full membership ID: CODE + year + zero-padded number e.g. GK2026005
const buildMembershipId = (projectCode, year, number) => {
  if (!projectCode || !year || !number) return "";
  const padded = String(number).padStart(3, "0");
  return `${projectCode}${year}${padded}`;
};

// Default form values
const defaultFormData = {
  societyName: "NAVANAGARA HOUSE BUILDING CO-OPERATIVE SOCIETY LTD.",
  societyNameKannada: "ನವನಗರ ಹೌಸ್ ಬಿಲ್ಡಿಂಗ್ ಕೋ-ಆಪರೇಟಿವ್ ಸೊಸೈಟಿ ಲಿ.",
  societyAddress:
    "No.1123, 'A' Block, 20th Cross, Sahakara Nagar, Bangalore - 560092",
  regNo: "Reg. No: JRB/RGN/CR-04/51588/2024-2025",
  website: "www.navanagarahousebuildingsociety.in",
  email: "Email-navanagarahousingsociety@gmail.com",
  receiptNo: "",
  receiptDate: new Date().toISOString().split("T")[0],
  receivedFrom: "",
  membershipId: "",
  phoneNumber: "",
  Email: "",
  siteDimension: "",
  flatNumber: "",
  projectType: PROJECTS[0].name,
  projectName: PROJECTS[0].name,
  year: String(CURRENT_YEAR),
  seniorityNumber: "",
  paymentMode: "Cheque",
  bankName: "State Bank Of India",
  branch: "",
  chequeNo: "",
};

// Payment items list
// Optional separate fees kept alongside the Enter-Amount waterfall.
// These are NOT part of the down-payment / installment schedule — they are
// added on top of whatever the entered amount is allocated to.
const OPTIONAL_FEE_ITEMS = [
  "Share",
  "Membership Fee",
  "Admission Fee",
  "Share Fee",
  "Deposits",
  "Penalty",
  "Miscellaneous",
];

// Payment buckets that the entered amount waterfalls into, in order.
// Down Payment first, then Installment 1..14 (matches SiteBookingForm schedule).
const INSTALLMENT_PAYMENT_NAMES = [
  "Down Payment",
  ...Array.from({ length: 14 }, (_, i) => `Installment ${i + 1}`),
];

// Single-bucket name used when the booking's payment plan is "full".
const FULL_PAYMENT_BUCKET = "Full Payment";

// Buckets that behave like a down payment: labelled "Booking Advance" while
// incomplete, and by their real name once completed.
const ADVANCE_BUCKETS = ["Down Payment", FULL_PAYMENT_BUCKET];

// ── Waterfall allocator ──
// Given the ordered buckets (with due + already-paid), and an amount to apply,
// fills the first unfilled bucket then cascades to the next.
// Returns an array of { bucket, label, amount } describing THIS payment's split.
//   - A bucket flagged `bookingAdvance` (Down Payment, or Full Payment) is
//     labelled "Booking Advance" while still incomplete after this payment,
//     and by its real name once this payment completes it.
//   - All other buckets (installments) are labelled by their own name.
const allocateWaterfall = (buckets, amountToApply) => {
  let remaining = Math.max(0, Math.round(amountToApply || 0));
  const allocations = [];

  for (const b of buckets) {
    if (remaining <= 0) break;
    const dueLeft = Math.max(0, (b.due || 0) - (b.paid || 0));
    if (dueLeft <= 0) continue; // bucket already full — skip
    const applied = Math.min(dueLeft, remaining);
    remaining -= applied;

    let label = b.name;
    if (b.bookingAdvance) {
      const after = (b.paid || 0) + applied;
      label = after >= (b.due || 0) ? b.name : "Booking Advance";
    }
    allocations.push({ bucket: b.name, label, amount: applied });
  }

  return { allocations, leftover: remaining };
};
// ── Reusable Custom Dropdown ──
const CustomSelect = ({
  options,
  value,
  onChange,
  onBlur,
  placeholder,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setOpen(false);
    if (onBlur) onBlur();
  };

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md border bg-white text-sm transition-all duration-300
          ${disabled ? "bg-gray-100 cursor-not-allowed text-gray-400" : "cursor-pointer"}
          ${open ? "border-[#EF742C] ring-2 ring-[#EF742C]/20" : "border-gray-300 hover:border-[#EF742C]"}`}
      >
        <span className={selectedOption ? "text-gray-800 font-medium truncate" : "text-gray-400 truncate"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`transition-all duration-300 flex-shrink-0 ml-2 ${open ? "rotate-180 text-[#EF742C]" : "text-gray-400"}`}
        />
      </button>

      <div
        className={`absolute top-full left-0 mt-1.5 w-full origin-top rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden z-50 transition-all duration-300 ease-out
          ${open ? "opacity-100 scale-100 translate-y-0 pointer-events-auto" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"}`}
      >
        <div className="py-1 max-h-60 overflow-y-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-all duration-150
                ${value === option.value
                  ? "bg-orange-50 text-[#EF742C] font-medium"
                  : "text-gray-700 hover:bg-gray-50"
                }`}
            >
              <span className="truncate">{option.label}</span>
              {value === option.value && (
                <Check size={16} className="text-[#EF742C] flex-shrink-0 ml-2" />
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── Reusable Custom Date Picker ──
const CustomDatePicker = ({
  value,
  onChange,
  onBlur,
  placeholder = "Select Date",
  disabled = false,
  maxDate = "",
  minDate = "",
}) => {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() =>
    value ? new Date(value).getFullYear() : new Date().getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState(() =>
    value ? new Date(value).getMonth() : new Date().getMonth(),
  );
  const [mode, setMode] = useState("day");
  const ref = useRef(null);

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  useEffect(() => {
    const handleOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setMode("day");
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  useEffect(() => {
    if (value) {
      const d = new Date(value);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  const formatDisplay = (val) => {
    if (!val) return "";
    const d = new Date(val);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const handleDayClick = (day) => {
    const month = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    const dateStr = `${viewYear}-${month}-${d}`;
    onChange(dateStr);
    if (onBlur) onBlur();
    setOpen(false);
    setMode("day");
  };

  const isSelected = (day) => {
    if (!value) return false;
    const month = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return value === `${viewYear}-${month}-${d}`;
  };

  const isDisabled = (day) => {
    const month = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    const dateStr = `${viewYear}-${month}-${d}`;
    if (maxDate && dateStr > maxDate) return true;
    if (minDate && dateStr < minDate) return true;
    return false;
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  };

  const currentYear = new Date().getFullYear();
  const yearRange = Array.from({ length: 101 }, (_, i) => currentYear - 100 + i).reverse();

  const renderDayView = () => {
    const daysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(<div key={`e-${i}`} />);
    for (let d = 1; d <= daysInMonth; d++) {
      const disabled = isDisabled(d);
      const selected = isSelected(d);
      cells.push(
        <button
          key={d}
          type="button"
          disabled={disabled}
          onClick={() => handleDayClick(d)}
          className={`w-8 h-8 rounded-full text-xs font-medium transition-all duration-150 flex items-center justify-center
            ${selected ? "bg-[#EF742C] text-white" : ""}
            ${!selected && !disabled ? "hover:bg-orange-50 hover:text-[#EF742C] text-gray-700" : ""}
            ${disabled ? "text-gray-300 cursor-not-allowed" : "cursor-pointer"}`}
        >
          {d}
        </button>,
      );
    }
    return cells;
  };

  return (
    <div className="relative w-full" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-md border bg-white text-sm transition-all duration-300
          ${disabled ? "bg-gray-100 cursor-not-allowed text-gray-400" : "cursor-pointer"}
          ${open ? "border-[#EF742C] ring-2 ring-[#EF742C]/20" : "border-gray-300 hover:border-[#EF742C]"}`}
      >
        <span className={value ? "text-gray-800 font-medium" : "text-gray-400"}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`transition-all duration-300 flex-shrink-0 ml-2 ${open ? "rotate-180 text-[#EF742C]" : "text-gray-400"}`}
        />
      </button>

      <div
        className={`absolute top-full left-0 mt-1.5 w-72 origin-top rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden z-50 transition-all duration-300 ease-out
          ${open ? "opacity-100 scale-100 translate-y-0 pointer-events-auto" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"}`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button type="button" onClick={prevMonth} className="p-1 rounded-full hover:bg-orange-50 text-gray-500 hover:text-[#EF742C] transition-colors">
            <ChevronDown size={16} className="rotate-90" />
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setMode(mode === "month" ? "day" : "month")} className="text-sm font-semibold text-gray-800 hover:text-[#EF742C] transition-colors px-1 py-0.5 rounded hover:bg-orange-50">
              {MONTHS[viewMonth]}
            </button>
            <button type="button" onClick={() => setMode(mode === "year" ? "day" : "year")} className="text-sm font-semibold text-gray-800 hover:text-[#EF742C] transition-colors px-1 py-0.5 rounded hover:bg-orange-50">
              {viewYear}
            </button>
          </div>
          <button type="button" onClick={nextMonth} className="p-1 rounded-full hover:bg-orange-50 text-gray-500 hover:text-[#EF742C] transition-colors">
            <ChevronDown size={16} className="-rotate-90" />
          </button>
        </div>

        {mode === "month" && (
          <div className="grid grid-cols-3 gap-2 p-3">
            {MONTHS.map((m, i) => (
              <button key={m} type="button" onClick={() => { setViewMonth(i); setMode("day"); }}
                className={`py-2 rounded-lg text-xs font-medium transition-all duration-150 ${viewMonth === i ? "bg-[#EF742C] text-white" : "text-gray-700 hover:bg-orange-50 hover:text-[#EF742C]"}`}>
                {m}
              </button>
            ))}
          </div>
        )}

        {mode === "year" && (
          <div className="max-h-48 overflow-y-auto p-2">
            <div className="grid grid-cols-3 gap-1">
              {yearRange.map((y) => (
                <button key={y} type="button" onClick={() => { setViewYear(y); setMode("day"); }}
                  className={`py-2 rounded-lg text-xs font-medium transition-all duration-150 ${viewYear === y ? "bg-[#EF742C] text-white" : "text-gray-700 hover:bg-orange-50 hover:text-[#EF742C]"}`}>
                  {y}
                </button>
              ))}
            </div>
          </div>
        )}

        {mode === "day" && (
          <div className="p-3">
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map((d) => (
                <div key={d} className="w-8 h-6 flex items-center justify-center text-xs font-semibold text-[#EF742C]">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">{renderDayView()}</div>
          </div>
        )}

        {mode === "day" && (
          <div className="border-t border-gray-100 px-3 py-2 flex justify-center">
            <button
              type="button"
              onClick={() => {
                const today = new Date().toISOString().split("T")[0];
                if ((!maxDate || today <= maxDate) && (!minDate || today >= minDate)) {
                  onChange(today);
                  if (onBlur) onBlur();
                  setOpen(false);
                  setMode("day");
                }
              }}
              className="text-xs font-semibold text-[#EF742C] hover:underline"
            >
              Today
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const ReceiptForm = ({ initialData = {}, onReceiptGenerate = null }) => {
  const [, setShowReceipt] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [paymentItemsError, setPaymentItemsError] = useState("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [memberExists, setMemberExists] = useState(false);
  const [hasExistingReceipt, setHasExistingReceipt] = useState(false);
  const [memberValidationMessage, setMemberValidationMessage] = useState("");
  const [isCheckingMember, setIsCheckingMember] = useState(false);
  const receiptRef = useRef(null);
  const [memberAddresses, setMemberAddresses] = useState([]);

  // Numeric part the user types — full id is CODE + year + this (e.g. GK2026005)
  const [membershipInput, setMembershipInput] = useState("");

  // Created By retained internally (field removed from UI) — still sent in payload.
  const ADMIN_NAMES = ["Vanita", "Sonakshi"];
  const [createdBy] = useState(ADMIN_NAMES[0]);

  const [transactionIds, setTransactionIds] = useState([""]);
  const [selectedBanks, setSelectedBanks] = useState([{ bank: "State Bank Of India", branch: "" }]);

  // Single "Enter Amount" the admin types — waterfalls into DP + installments
  const [enteredAmount, setEnteredAmount] = useState("");

  // Booking breakdown (bucket → due) auto-filled from site booking when member found
  const [bookingBreakdown, setBookingBreakdown] = useState(null);
  // Payment plan of the looked-up booking: "installments" | "full"
  const [paymentPlan, setPaymentPlan] = useState("installments");
  // Already-paid per bucket, summed from previous receipts' allocations
  const [paidAmountsState, setPaidAmountsState] = useState({});

  // Optional extra fees (Share / Penalty / Miscellaneous …) — added on top
  const [optionalFees, setOptionalFees] = useState(
    OPTIONAL_FEE_ITEMS.map((name) => ({ name, checked: false, amount: 0 })),
  );

  const paymentModes = ["Cheque", "Cash", "Online Transfer", "DD", "UPI", "NEFT/RTGS"];
  const banks = [
    "State Bank Of India", "HDFC Bank", "ICICI Bank", "Axis Bank",
    "Punjab National Bank", "Bank of Baroda", "Canara Bank",
    "Union Bank of India", "Kotak Mahindra Bank", "IndusInd Bank",
  ];

  // Build option arrays for CustomSelect
  const paymentModeOptions = paymentModes.map((m) => ({ label: m, value: m }));
  const bankOptions = [
    { label: "Select Bank", value: "" },
    ...banks.map((b) => ({ label: b, value: b })),
  ];
  const projectOptions = PROJECTS.map((p) => ({ label: p.name, value: p.name }));

  // Transaction ID Handlers
  const addTransactionId = () => {
    if (transactionIds.length < 3) setTransactionIds([...transactionIds, ""]);
  };
  const removeTransactionId = (index) => {
    if (transactionIds.length > 1) {
      const updated = transactionIds.filter((_, i) => i !== index);
      setTransactionIds(updated);
      formik.setFieldValue("chequeNo", updated[0] || "");
    }
  };
  const updateTransactionId = (index, value) => {
    const updated = [...transactionIds];
    updated[index] = value;
    setTransactionIds(updated);
    formik.setFieldValue("chequeNo", updated[0] || "");
  };

  // Bank Handlers
  const addBank = () => {
    if (selectedBanks.length < 3) setSelectedBanks([...selectedBanks, { bank: "", branch: "" }]);
  };
  const removeBank = (index) => {
    if (selectedBanks.length > 1) {
      const updated = selectedBanks.filter((_, i) => i !== index);
      setSelectedBanks(updated);
      formik.setFieldValue("bankName", updated[0]?.bank || "");
      formik.setFieldValue("branch", updated[0]?.branch || "");
    }
  };
  const updateBankField = (index, field, value) => {
    const updated = [...selectedBanks];
    updated[index][field] = value;
    setSelectedBanks(updated);
    formik.setFieldValue("bankName", updated[0]?.bank || "");
    formik.setFieldValue("branch", updated[0]?.branch || "");
  };

  // Optional-fee handlers (Share / Penalty / Miscellaneous …)
  const updateOptionalFee = (index, field, value) => {
    setOptionalFees((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
    if (field === "checked" && value === true) setPaymentItemsError("");
  };

  const resetMemberState = () => {
    setMemberExists(false);
    setHasExistingReceipt(false);
    setMemberValidationMessage("");
    setMemberAddresses([]);
    setPaidAmountsState({});
    setBookingBreakdown(null);
    setPaymentPlan("installments");
  };

  const checkMemberAndReceipts = async (membershipId) => {
    if (!membershipId) {
      resetMemberState();
      return;
    }
    setIsCheckingMember(true);
    try {
      const membersResponse = await axios.get(`${API_BASE}/members`);
      const members = membersResponse.data.data || [];
      const memberFound = members.find((m) => m.membership_id === membershipId);

      const sitebookingsResponse = await axios.get(`${API_BASE}/sitebookings`);
      const sitebookings = sitebookingsResponse.data || [];
      const siteBookingFound = sitebookings.find((s) => s.membership_id === membershipId);

      const exists = !!(memberFound && siteBookingFound);
      setMemberExists(exists);

      if (memberFound && !siteBookingFound) {
        setMemberValidationMessage("⚠️ Member found but no Site Booking exists. Please create a Site Booking first.");
        setIsCheckingMember(false);
        return;
      }

      if (exists) {
        const foundMember = memberFound || siteBookingFound;
        // Auto-fill name, phone, email, site dimension, address (permanent)
        if (foundMember?.name) formik.setFieldValue("receivedFrom", foundMember.name);
        if (foundMember?.email) formik.setFieldValue("Email", foundMember.email);
        const mobile =
          memberFound?.mobile ??
          memberFound?.mobilenumber ??
          memberFound?.mobile_number ??
          siteBookingFound?.mobilenumber ??
          "";
        if (mobile) formik.setFieldValue("phoneNumber", String(mobile));
        if (siteBookingFound?.sitedimension) formik.setFieldValue("siteDimension", siteBookingFound.sitedimension);

        // ── Detect the booking's payment plan ──
        const plan = siteBookingFound.paymentplan === "full" ? "full" : "installments";
        setPaymentPlan(plan);

        // ── Build the payment breakdown ──
        const total = siteBookingFound.totalamount || 0;
        const storedDP = siteBookingFound.downpayment || 0;
        const installmentsArr = Array.isArray(siteBookingFound.installments)
          ? siteBookingFound.installments
          : [];

        let breakdown = {};
        if (plan === "full") {
          // Full payment: a single bucket for the whole amount
          breakdown[FULL_PAYMENT_BUCKET] = total;
        } else if (installmentsArr.length > 0) {
          // Preferred: new schedule (Down Payment + Installment 1..14)
          breakdown["Down Payment"] = storedDP;
          installmentsArr.forEach((it, idx) => {
            const label = it.label || `Installment ${idx + 1}`;
            breakdown[label] = it.amount || 0;
          });
        } else {
          // Legacy fallback: old records with installment1/2/3 or percentages
          const storedI1 = siteBookingFound.installment1;
          const storedI2 = siteBookingFound.installment2;
          const storedI3 = siteBookingFound.installment3;
          const hasStored = storedDP || storedI1 || storedI2 || storedI3;
          if (hasStored) {
            breakdown = {
              "Down Payment": storedDP || 0,
              "Installment 1": storedI1 || 0,
              "Installment 2": storedI2 || 0,
              "Installment 3": storedI3 || 0,
            };
          } else {
            breakdown = {
              "Down Payment": Math.round(total * 0.12),
              "Installment 1": Math.round(total * 0.05),
              "Installment 2": Math.round(total * 0.05),
              "Installment 3": Math.round(total * 0.05),
            };
          }
        }
        setBookingBreakdown(breakdown);

        const addresses = [];
        if (memberFound?.permanentaddress)
          addresses.push({ label: "Permanent Address", value: memberFound.permanentaddress });
        if (memberFound?.correspondenceaddress)
          addresses.push({ label: "Correspondence Address", value: memberFound.correspondenceaddress });
        setMemberAddresses(addresses);
        // Prefer permanent address
        if (addresses.length > 0) formik.setFieldValue("flatNumber", addresses[0].value);

        const receiptsResponse = await axios.get(`${API_BASE}/receipts`);
        const receipts = receiptsResponse.data.data || [];
        const memberReceipts = receipts.filter(
          (r) => r.membership_id === membershipId && !r.cancelled,
        );
        const existingReceipt = memberReceipts.length > 0 ? memberReceipts[0] : null;
        setHasExistingReceipt(!!existingReceipt);

        // ── Sum already-paid per bucket from previous receipts ──
        // Preferred: each receipt's `allocations` array (exact per-bucket split).
        // Legacy fallback: parse the paymenttype string + split amountpaid evenly.
        const bucketNames = plan === "full" ? [FULL_PAYMENT_BUCKET] : INSTALLMENT_PAYMENT_NAMES;
        const paidAmountsMap = {};
        bucketNames.forEach((n) => { paidAmountsMap[n] = 0; });

        const bucketForLabel = (label) => {
          if (!label) return null;
          const t = label.trim();
          if (plan === "full") {
            // In full mode everything collapses onto the single Full Payment bucket
            if (t === FULL_PAYMENT_BUCKET || t.startsWith("Booking Advance")) return FULL_PAYMENT_BUCKET;
            return null;
          }
          // "Booking Advance" / "Booking Advance N" was a partial down payment
          if (t === "Down Payment" || t.startsWith("Booking Advance")) return "Down Payment";
          if (INSTALLMENT_PAYMENT_NAMES.includes(t)) return t;
          return null;
        };

        memberReceipts.forEach((r) => {
          if (Array.isArray(r.allocations) && r.allocations.length > 0) {
            r.allocations.forEach((a) => {
              const bucket = a.bucket || bucketForLabel(a.label);
              if (bucket && paidAmountsMap[bucket] !== undefined) {
                paidAmountsMap[bucket] += Number(a.amount) || 0;
              }
            });
          } else if (r.paymenttype) {
            const buckets = r.paymenttype
              .split(",")
              .map((t) => bucketForLabel(t))
              .filter((b) => b && paidAmountsMap[b] !== undefined);
            if (buckets.length === 0) return;
            const perBucket = (r.amountpaid || 0) / buckets.length;
            buckets.forEach((b) => { paidAmountsMap[b] += perBucket; });
          }
        });

        setPaidAmountsState({ ...paidAmountsMap });

        if (existingReceipt) {
          setMemberValidationMessage("✅ Member found. Previous receipts found — schedule updated below.");
        } else {
          setMemberValidationMessage("✅ Member found. No previous receipts — this is the first payment.");
        }
      } else {
        setMemberValidationMessage("❌ Member not found. Please add member first in Members or Site Booking.");
        setBookingBreakdown(null);
        setPaidAmountsState({});
        setMemberAddresses([]);
      }
    } catch (error) {
      console.error("Error checking member:", error);
      setMemberValidationMessage("⚠️ Error checking member details. Please check your connection.");
      setMemberExists(false);
    } finally {
      setIsCheckingMember(false);
    }
  };

  const validationSchema = Yup.object().shape({
    receiptNo: Yup.string().required("Receipt number is required").matches(/^[0-9]+$/, "Only numbers allowed"),
    receiptDate: Yup.date().required("Date is required").typeError("Please select a valid date"),
    receivedFrom: Yup.string()
      .required("Received from name is required")
      .min(2, "Minimum 2 characters required")
      .matches(/^[a-zA-Z\s.]+$/, "Only letters, spaces, and periods allowed"),
    phoneNumber: Yup.string()
      .matches(/^(\+?[1-9]\d{0,3}|0)?[6-9]\d{9}$/, "Enter a valid contact number")
      .required("Phone number is required"),
    Email: Yup.string().required("Email is required").email("Enter valid email"),
    flatNumber: Yup.string().required("Address is required").min(10, "Please provide complete address (minimum 10 characters)"),
    projectType: Yup.string().required("Project is required"),
    year: Yup.string().required("Year is required"),
    // Same format as SiteBookingForm: CODE + 4-digit year + 3-4 digit number e.g. GK2026005
    seniorityNumber: Yup.string()
      .required("Membership Id is required")
      .matches(/^[A-Z]{2,5}\d{4}\d{3,4}$/, "Invalid format (e.g., GK2026005)"),
    paymentMode: Yup.string().required("Payment mode is required"),
    bankName: Yup.string().when("paymentMode", {
      is: (val) => val !== "Cash",
      then: (schema) => schema.required("Bank name required for non-cash payments"),
      otherwise: (schema) => schema.notRequired(),
    }),
    branch: Yup.string().when("paymentMode", {
      is: (val) => val !== "Cash",
      then: (schema) => schema.required("Branch name required for non-cash payments"),
      otherwise: (schema) => schema.notRequired(),
    }),
    chequeNo: Yup.string().when("paymentMode", {
      is: (val) => val !== "Cash",
      then: (schema) => schema.required("Transaction ID is required"),
      otherwise: (schema) => schema.notRequired(),
    }),
  });

  const formik = useFormik({
    initialValues: { ...defaultFormData, ...initialData },
    validationSchema,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: (values) => {
      if (validatePaymentItems()) setShowReceipt(true);
    },
  });

  // Address dropdown options
  const addressOptions = memberAddresses.map((addr) => ({
    label: `${addr.label}: ${addr.value}`,
    value: addr.value,
  }));

  // Currently-selected project code (for the ID prefix)
  const selectedProjectCode =
    PROJECTS.find((p) => p.name === formik.values.projectType)?.code || "";

  // ── Keep projectName + projectType in sync (template/payload use projectType) ──
  useEffect(() => {
    formik.setFieldValue("projectName", formik.values.projectType);
  }, [formik.values.projectType]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Build full membership ID whenever number, project, or year changes ──
  useEffect(() => {
    const project = PROJECTS.find((p) => p.name === formik.values.projectType);
    formik.setFieldValue(
      "seniorityNumber",
      buildMembershipId(project?.code, formik.values.year, membershipInput),
    );
  }, [membershipInput, formik.values.projectType, formik.values.year]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced member + receipt lookup once a complete number is entered ──
  useEffect(() => {
    if (membershipInput && membershipInput.length >= 3) {
      const timer = setTimeout(() => {
        checkMemberAndReceipts(formik.values.seniorityNumber);
      }, 500); // debounce: wait 500ms after the user stops typing
      return () => clearTimeout(timer);
    } else {
      // Still typing / cleared — reset lookup state but keep manually-entered fields
      resetMemberState();
    }
  }, [formik.values.seniorityNumber, membershipInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMembershipInputChange = (e) => {
    // Only digits, max 4 (parity with SiteBookingForm)
    setMembershipInput(e.target.value.replace(/\D/g, "").slice(0, 4));
  };

  // ── Ordered buckets with due + already-paid (from previous receipts) ──
  const orderedBucketNames =
    paymentPlan === "full" ? [FULL_PAYMENT_BUCKET] : INSTALLMENT_PAYMENT_NAMES;
  const scheduleBuckets = orderedBucketNames.map((name) => {
    const due = bookingBreakdown ? bookingBreakdown[name] || 0 : 0;
    const paid = Math.round(paidAmountsState[name] || 0);
    return {
      name,
      due,
      paid,
      remaining: Math.max(0, due - paid),
      bookingAdvance: ADVANCE_BUCKETS.includes(name),
    };
  });

  // ── Live waterfall preview for the amount currently entered ──
  const enteredNum = Math.max(0, Math.round(parseFloat(enteredAmount) || 0));
  const { allocations: previewAllocations, leftover: previewLeftover } =
    allocateWaterfall(scheduleBuckets, enteredNum);

  // Optional fees that are checked with a valid amount
  const activeFees = optionalFees.filter(
    (f) => f.checked && parseFloat(f.amount || 0) > 0,
  );
  const feesTotal = activeFees.reduce((s, f) => s + (parseFloat(f.amount) || 0), 0);

  // Grand total on this receipt = waterfall-allocated amount + optional fees
  const allocatedTotal = previewAllocations.reduce((s, a) => s + a.amount, 0);
  const total = allocatedTotal + feesTotal;

  const validatePaymentItems = () => {
    if (enteredNum <= 0 && feesTotal <= 0) {
      setPaymentItemsError("Enter an amount (or select at least one fee) greater than zero");
      return false;
    }
    if (enteredNum > 0 && allocatedTotal === 0) {
      setPaymentItemsError("All installments are already fully paid — nothing left to allocate");
      return false;
    }
    if (previewLeftover > 0) {
      setPaymentItemsError(
        `Amount exceeds the remaining schedule by ₹${previewLeftover.toLocaleString("en-IN")}. Reduce the amount.`,
      );
      return false;
    }
    setPaymentItemsError("");
    return true;
  };

  const numberToWords = (num) => {
    const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine"];
    const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
    const teens = ["Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
    if (num === 0) return "Zero";
    const convertLessThanThousand = (n) => {
      if (n === 0) return "";
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
      return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " " + convertLessThanThousand(n % 100) : "");
    };
    if (num < 1000) return convertLessThanThousand(num);
    const crore = Math.floor(num / 10000000);
    const lakh = Math.floor((num % 10000000) / 100000);
    const thousand = Math.floor((num % 100000) / 1000);
    const remainder = num % 1000;
    let result = "";
    if (crore > 0) result += convertLessThanThousand(crore) + " Crore ";
    if (lakh > 0) result += convertLessThanThousand(lakh) + " Lakh ";
    if (thousand > 0) result += convertLessThanThousand(thousand) + " Thousand ";
    if (remainder > 0) result += convertLessThanThousand(remainder);
    return result.trim();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    return `${day}-${month}-${date.getFullYear()}`;
  };

  const handleDownloadPDF = async () => {
    if (!memberExists) {
      toast.error("❌ Member not found! Please add the member in Members or Site Booking first.");
      return;
    }
    const errors = await formik.validateForm();
    formik.setTouched({
      receiptNo: true, receiptDate: true, receivedFrom: true, phoneNumber: true,
      Email: true, flatNumber: true, seniorityNumber: true, bankName: true, branch: true, chequeNo: true,
    });
    if (Object.keys(errors).length === 0 && validatePaymentItems()) {
      try {
        setIsGeneratingPDF(true);
        const html2canvas = (await import("html2canvas")).default;
        const { default: jsPDF } = await import("jspdf");
        const container = document.createElement("div");
        container.style.cssText = "position:fixed;left:-9999px;top:0;width:786px;background:#fff;padding:4px;margin:4px;box-sizing:border-box;";
        const { createRoot } = await import("react-dom/client");
        const root = createRoot(container);
        document.body.appendChild(container);
        await new Promise((resolve) => { root.render(<ReceiptContent />); setTimeout(resolve, 800); });
        const canvas = await html2canvas(container, {
          scale: 6, useCORS: true, allowTaint: true, logging: false, backgroundColor: "#ffffff", width: 794, x: -4, y: -4,
        });
        root.unmount();
        document.body.removeChild(container);
        const imgData = canvas.toDataURL("image/jpeg", 0.85);
        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        pdf.addImage(imgData, "PNG", 1, 1, 208, 295);
        const projectPart = (formik.values.projectType || "").replace(/[^a-zA-Z0-9]/g, "_");
        const seniorityPart = (formik.values.seniorityNumber || "").replace(/[^a-zA-Z0-9]/g, "_");
        const filename = `${projectPart}_${seniorityPart}.pdf`;
        const pdfBase64 = pdf.output("datauristring").split(",")[1];

        // This receipt's rows: waterfall allocations + any optional fees
        const feeAllocations = activeFees.map((f) => ({
          bucket: f.name,
          label: f.name,
          amount: Math.round(parseFloat(f.amount) || 0),
        }));
        const allAllocations = [...previewAllocations, ...feeAllocations];
        const paymentTypeStr = allAllocations.map((a) => a.label).join(", ");

        try {
          const receiptPayload = {
            receiptNo: formik.values.receiptNo,
            membershipid: formik.values.seniorityNumber,
            name: formik.values.receivedFrom,
            projectname: formik.values.projectType,
            date: formik.values.receiptDate,
            amountpaid: total,
            mobilenumber: formik.values.phoneNumber,
            email: formik.values.Email,
            paymentmode: formik.values.paymentMode,
            paymenttype: paymentTypeStr,
            allocations: allAllocations,
            transactionid: transactionIds.filter(Boolean).join(", "),
            dimension: formik.values.siteDimension || "N/A",
            bank: selectedBanks.map((b) => b.bank).filter(Boolean).join(", "),
            created_by: createdBy,
            pdfBase64,
            pdfFilename: filename,
          };
          const response = await axios.post(`${API_BASE}/receipt`, receiptPayload);
          if (response.data.success) {
            pdf.save(filename);
            toast.success("✅ Receipt generated, downloaded and emailed successfully!");
          }
        } catch (backendError) {
          console.error("⚠️ Backend error:", backendError);
          pdf.save(filename);
          toast.warning("Receipt downloaded locally but cloud storage/email failed.");
        }
        setIsGeneratingPDF(false);
      } catch (error) {
        console.error("Error generating receipt:", error);
        toast.error(`Failed to generate receipt: ${error.message}`);
        setIsGeneratingPDF(false);
      }
    } else {
      setIsGeneratingPDF(false);
    }
  };

  const amountInWords = numberToWords(total);

  // Rows shown on the printed receipt = this payment's waterfall split + fees
  const receiptRows = [
    ...previewAllocations.map((a) => ({ name: a.label, amount: a.amount })),
    ...activeFees.map((f) => ({ name: f.name, amount: Math.round(parseFloat(f.amount) || 0) })),
  ];

  const ReceiptContent = () => (
    <div style={{ border: "2px solid #000000", backgroundColor: "#ffffff", padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", height: "150px", borderBottom: "2px solid #000000", paddingBottom: "15px", marginTop: "0px", marginBottom: "16px", marginLeft: "-20px", marginRight: "-20px", paddingLeft: "10px", gap: "10px" }}>
        <div style={{ flexShrink: 0 }}>
          <img src={"/images/logoblack.webp"} alt="Logo" style={{ width: "150px", height: "140px", marginBottom: "15px", objectFit: "contain" }} />
        </div>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "4px" }}>{formik.values.societyNameKannada}</div>
          <div style={{ fontSize: "15px", fontWeight: "bold", marginBottom: "4px" }}>{formik.values.societyName}</div>
          <div style={{ fontSize: "11px", marginBottom: "2px" }}>{formik.values.societyAddress}</div>
          <div style={{ fontSize: "11px", marginBottom: "2px" }}>{formik.values.regNo}</div>
          <div style={{ fontSize: "11px" }}>
            <a href={`https://${formik.values.website}`} target="_blank" rel="noopener noreferrer" style={{ color: "#000000", textDecoration: "none" }}>{formik.values.website}</a>
            {" / "}
            <a href={`mailto:${formik.values.email}`} style={{ color: "#000000", textDecoration: "none" }}>{formik.values.email}</a>
          </div>
        </div>
        <div style={{ width: "80px", flexShrink: 0 }}></div>
      </div>
      <div style={{ textAlign: "center", paddingBottom: "6px" }}>
        <span style={{ border: "2px solid #000000", fontWeight: "bold", fontSize: "14px", padding: "5px 10px 18px" }}>RECEIPT</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px", fontSize: "13px", fontWeight: "bold" }}>
        <div>RECEIPT No. {formik.values.receiptNo}</div>
        <div>Date: {formatDate(formik.values.receiptDate)}</div>
      </div>
      <div style={{ fontSize: "13px", marginBottom: "16px" }}>
        {[
          { label: `Received From Smt./Shree: ${formik.values.receivedFrom}` },
          { label: `Address: ${formik.values.flatNumber}` },
          { label: `Rupees: ${amountInWords} Only.` },
          { label: `Membership Id: ${formik.values.projectType} (${formik.values.seniorityNumber})` },
        ].map((row, i, arr) => (
          <div key={i} style={{ marginBottom: i < arr.length - 1 ? "6px" : 0, paddingBottom: "6px", borderBottom: "1.5px solid #000" }}>
            <strong>{row.label}</strong>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: "16px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000000", fontSize: "12px" }}>
          <thead>
            <tr>
              {["S.No","Dimension","Payment Type","Payment Mode","Cheque/Transaction ID","Amount"].map((h, i) => (
                <th key={i} style={{ border: "1px solid #000000", padding: "6px", textAlign: "center", fontWeight: "bold", fontSize: "12px", backgroundColor: "#f0f0f0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {receiptRows.map((item, index) => (
              <tr key={index}>
                <td style={{ border: "1px solid #000000", padding: "6px", textAlign: "center", fontSize: "11px" }}>{index + 1}</td>
                <td style={{ border: "1px solid #000000", padding: "6px", textAlign: "center", fontSize: "11px" }}>{formik.values.siteDimension}</td>
                <td style={{ border: "1px solid #000000", padding: "6px", textAlign: "center", fontSize: "11px" }}>{item.name}</td>
                <td style={{ border: "1px solid #000000", padding: "6px", textAlign: "center", fontSize: "11px" }}>{formik.values.paymentMode}</td>
                <td style={{ border: "1px solid #000000", padding: "6px", textAlign: "center", fontSize: "11px" }}>{formik.values.paymentMode === "Cash" ? "" : transactionIds[index] || transactionIds[0] || ""}</td>
                <td style={{ border: "1px solid #000000", padding: "6px", textAlign: "right", fontSize: "11px" }}>{item.amount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginBottom: "16px" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000000", fontSize: "12px" }}>
          <thead>
            <tr>
              <th colSpan="2" style={{ border: "1px solid #000000", padding: "8px", textAlign: "center", fontWeight: "bold", width: "70%", backgroundColor: "#f0f0f0" }}>Particulars</th>
              <th style={{ border: "1px solid #000000", padding: "8px", textAlign: "center", fontWeight: "bold", width: "5%", backgroundColor: "#f0f0f0" }}>L.F</th>
              <th style={{ border: "1px solid #000000", padding: "8px", textAlign: "center", fontWeight: "bold", width: "20%", backgroundColor: "#f0f0f0" }}>Rs.</th>
              <th style={{ border: "1px solid #000000", padding: "8px", textAlign: "center", fontWeight: "bold", width: "5%", backgroundColor: "#f0f0f0" }}>P</th>
            </tr>
          </thead>
          <tbody>
            {receiptRows.map((item, index) => (
              <tr key={index}>
                <td style={{ border: "1px solid #000", padding: "8px", textAlign: "center", width: "5%" }}>{index + 1}.</td>
                <td style={{ border: "1px solid #000", padding: "8px" }}>{item.name}</td>
                <td style={{ border: "1px solid #000", padding: "8px" }}></td>
                <td style={{ border: "1px solid #000", padding: "8px", textAlign: "center" }}>{item.amount > 0 ? item.amount : "-"}</td>
                <td style={{ border: "1px solid #000", padding: "8px" }}></td>
              </tr>
            ))}
            <tr style={{ fontWeight: "bold" }}>
              <td colSpan="2" style={{ border: "1px solid #000000", padding: "8px" }}><strong>Total</strong></td>
              <td style={{ border: "1px solid #000000", padding: "8px" }}></td>
              <td style={{ border: "1px solid #000000", padding: "8px", textAlign: "center" }}><strong>{total}</strong></td>
              <td style={{ border: "1px solid #000000", padding: "8px" }}></td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: "11px", fontStyle: "italic", marginBottom: "32px" }}>
        *If 30% of the booking amount is not paid within 20 days from the date of booking, 10% penalty apply.
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginTop: "40px" }}>
        <div>Party's Signature</div>
        <div>President/Secretary</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white">
      <style>{`
@media print {
  body { background: white !important; margin: 0 !important; padding: 0 !important; }
  html, body { height: 100%; overflow: visible; }
  .no-print { display: none !important; }
  .a4-receipt { box-shadow: none !important; margin: 0 !important; width: 210mm !important; min-height: 297mm !important; padding: 6px 6px !important; page-break-after: avoid !important; display: block !important; visibility: visible !important; }
  @page { size: A4 portrait; margin: 0; }
}
body { background: white !important; }
.a4-receipt { width: 206mm; min-height: 297mm; padding: 6px 6px; background: white; margin: 2mm auto; box-sizing: border-box; }
.receipt-panel { font-family: Arial, sans-serif; }
`}</style>

      <Header/>
      <div className="max-w-4xl px-[50px] p-6">
        <h2 className="text-[24px] font-semibold text-gray-800 mb-4 mt-2">Receipt Form</h2>
        <form onSubmit={formik.handleSubmit}>
          <div className="no-print bg-[#EF742C]/10 rounded-lg shadow-sm p-5">
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                {/* Receipt Number */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Receipt Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="receiptNo"
                    value={formik.values.receiptNo}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    placeholder="e.g., RCP/2024/001"
                    className={`w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 ${
                      formik.touched.receiptNo && formik.errors.receiptNo
                        ? "border-orange-500 focus:ring-orange-500"
                        : "border-gray-300 focus:ring-orange-500"
                    }`}
                  />
                  {formik.touched.receiptNo && formik.errors.receiptNo && (
                    <p className="text-red-500 text-xs mt-0.5">{formik.errors.receiptNo}</p>
                  )}
                </div>

                {/* Project Name — selectable */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Project Name <span className="text-red-500">*</span>
                  </label>
                  <CustomSelect
                    options={projectOptions}
                    value={formik.values.projectType}
                    onChange={(val) => formik.setFieldValue("projectType", val)}
                    onBlur={() => formik.setFieldTouched("projectType", true)}
                    placeholder="Select Project"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Code: <span className="font-semibold text-gray-500">{selectedProjectCode || "--"}</span>
                  </p>
                  {formik.touched.projectType && formik.errors.projectType && (
                    <p className="text-red-500 text-xs mt-0.5">{formik.errors.projectType}</p>
                  )}
                </div>

                {/* Year — selectable */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Year <span className="text-red-500">*</span>
                  </label>
                  <CustomSelect
                    options={yearOptions}
                    value={formik.values.year}
                    onChange={(val) => formik.setFieldValue("year", val)}
                    onBlur={() => formik.setFieldTouched("year", true)}
                    placeholder="Select Year"
                  />
                  {formik.touched.year && formik.errors.year && (
                    <p className="text-red-500 text-xs mt-0.5">{formik.errors.year}</p>
                  )}
                </div>

                {/* Membership Id — prefix (CODE + year) + numeric input */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Membership Id <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-stretch rounded-md border border-gray-300 overflow-hidden focus-within:ring-1 focus-within:ring-orange-500 bg-white">
                    <span className="flex items-center px-2.5 bg-orange-50 border-r border-gray-300 text-sm font-semibold text-[#EF742C] select-none whitespace-nowrap">
                      {selectedProjectCode || "--"}{formik.values.year || "----"}
                    </span>
                    <input
                      type="text"
                      value={membershipInput}
                      onChange={handleMembershipInputChange}
                      placeholder="001"
                      maxLength="4"
                      className="flex-1 px-3 py-1.5 text-sm focus:outline-none bg-white"
                    />
                    {isCheckingMember && (
                      <span className="flex items-center px-2.5 text-xs text-gray-400 animate-pulse whitespace-nowrap">
                        Checking…
                      </span>
                    )}
                  </div>
                  {formik.values.seniorityNumber && (
                    <p className="text-xs text-blue-600 font-semibold mt-1">Generated: {formik.values.seniorityNumber}</p>
                  )}
                  {memberValidationMessage && !isCheckingMember && (
                    <div className={`mt-1 p-2 border rounded-md ${
                      memberExists
                        ? hasExistingReceipt ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200"
                        : "bg-red-50 border-red-200"
                    }`}>
                      <p className={`text-xs font-semibold ${
                        memberExists
                          ? hasExistingReceipt ? "text-green-800" : "text-yellow-800"
                          : "text-red-800"
                      }`}>{memberValidationMessage}</p>
                    </div>
                  )}
                  {formik.touched.seniorityNumber && formik.errors.seniorityNumber && (
                    <p className="text-red-500 text-xs mt-0.5">{formik.errors.seniorityNumber}</p>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="receivedFrom"
                    value={formik.values.receivedFrom}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    placeholder="Auto-filled from database"
                    className={`w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 ${
                      formik.touched.receivedFrom && formik.errors.receivedFrom
                        ? "border-red-500 focus:ring-orange-500"
                        : "border-gray-300 focus:ring-orange-500"
                    }`}
                  />
                  {formik.touched.receivedFrom && formik.errors.receivedFrom && (
                    <p className="text-red-500 text-xs mt-0.5">{formik.errors.receivedFrom}</p>
                  )}
                </div>

                {/* Payment Mode — CustomSelect */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Payment Mode <span className="text-red-500">*</span>
                  </label>
                  <CustomSelect
                    options={paymentModeOptions}
                    value={formik.values.paymentMode}
                    onChange={(val) => formik.setFieldValue("paymentMode", val)}
                    onBlur={() => formik.setFieldTouched("paymentMode", true)}
                    placeholder="Select Payment Mode"
                  />
                </div>

                {/* Transaction IDs */}
                {formik.values.paymentMode !== "Cash" && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Transaction ID <span className="text-red-500">*</span>
                      <span className="text-gray-400 ml-1">(max 3)</span>
                    </label>
                    {transactionIds.map((tid, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={tid}
                          onChange={(e) => updateTransactionId(index, e.target.value)}
                          placeholder={`Transaction ID ${index + 1}`}
                          className="w-[340px] px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                        {transactionIds.length > 1 && (
                          <button type="button" onClick={() => removeTransactionId(index)} className="px-3 py-1.5 text-sm bg-red-100 text-red-600 rounded-md hover:bg-red-200">✕</button>
                        )}
                      </div>
                    ))}
                    {transactionIds.length < 3 && (
                      <button type="button" onClick={addTransactionId} className="text-xs text-[#EF742C] hover:text-orange-700 font-medium">
                        + Add Transaction ID
                      </button>
                    )}
                  </div>
                )}

                {/* Paid Amount */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Paid Amount <span className="text-red-500">*</span>
                  </label>
                  <input type="text" value={`₹${total.toLocaleString()}`} readOnly className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-gray-50 focus:outline-none" />
                </div>

                {/* Site Dimension */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Site Dimension</label>
                  <input
                    type="text"
                    name="siteDimension"
                    value={formik.values.siteDimension}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    placeholder="e.g., 30x40"
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-filled from Site Booking if available</p>
                </div>

                {/* Bank & Branch — CustomSelect */}
                {formik.values.paymentMode !== "Cash" && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Bank & Branch <span className="text-red-500">*</span>
                      <span className="text-gray-400 ml-1">(max 3)</span>
                    </label>
                    {selectedBanks.map((bankEntry, index) => (
                      <div key={index} className="flex gap-2 mb-2 items-start">
                        <div className="flex-1">
                          <CustomSelect
                            options={bankOptions}
                            value={bankEntry.bank}
                            onChange={(val) => updateBankField(index, "bank", val)}
                            placeholder="Select Bank"
                          />
                        </div>
                        <div className="flex-1">
                          <input
                            type="text"
                            value={bankEntry.branch}
                            onChange={(e) => updateBankField(index, "branch", e.target.value)}
                            placeholder="Enter branch name"
                            className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500"
                          />
                        </div>
                        {selectedBanks.length > 1 && (
                          <button type="button" onClick={() => removeBank(index)} className="px-3 py-1.5 text-sm bg-red-100 text-red-600 rounded-md hover:bg-red-200">
                            <CircleX size={18} />
                          </button>
                        )}
                      </div>
                    ))}
                    {selectedBanks.length < 3 && (
                      <button type="button" onClick={addBank} className="text-xs text-[#EF742C] hover:text-orange-700 font-medium">+ Add Bank</button>
                    )}
                  </div>
                )}

                {/* Phone Number */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="phoneNumber"
                    value={formik.values.phoneNumber}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    placeholder="Auto-filled from database"
                    className={`w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 ${
                      formik.touched.phoneNumber && formik.errors.phoneNumber ? "border-red-500 focus:ring-orange-500" : "border-gray-300 focus:ring-orange-500"
                    }`}
                  />
                  {formik.touched.phoneNumber && formik.errors.phoneNumber && (
                    <p className="text-red-500 text-xs mt-0.5">{formik.errors.phoneNumber}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="Email"
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    value={formik.values.Email}
                    placeholder="Auto-filled from database"
                    className={`w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 ${
                      formik.touched.Email && formik.errors.Email ? "border-red-500 focus:ring-orange-500" : "border-gray-300 focus:ring-orange-500"
                    }`}
                  />
                  {formik.touched.Email && formik.errors.Email && (
                    <div className="text-red-500 text-xs mt-1">{formik.errors.Email}</div>
                  )}
                </div>

                {/* Receipt Date — CustomDatePicker */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Receipt Date <span className="text-red-500">*</span>
                  </label>
                  <CustomDatePicker
                    value={formik.values.receiptDate}
                    onChange={(val) => formik.setFieldValue("receiptDate", val)}
                    onBlur={() => formik.setFieldTouched("receiptDate", true)}
                    placeholder="Select Receipt Date"
                    maxDate={new Date().toISOString().split("T")[0]}
                  />
                  {formik.touched.receiptDate && formik.errors.receiptDate && (
                    <p className="text-red-500 text-xs mt-0.5">{formik.errors.receiptDate}</p>
                  )}
                </div>

                {/* Address — CustomSelect + textarea */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Address <span className="text-red-500">*</span>
                  </label>
                  {memberAddresses.length > 0 && (
                    <div className="mb-2">
                      <CustomSelect
                        options={addressOptions}
                        value={formik.values.flatNumber}
                        onChange={(val) => formik.setFieldValue("flatNumber", val)}
                        placeholder="— Select a saved address —"
                      />
                    </div>
                  )}
                  <textarea
                    name="flatNumber"
                    value={formik.values.flatNumber}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    rows="2"
                    placeholder="Complete address with pincode"
                    className={`w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none focus:ring-1 ${
                      formik.touched.flatNumber && formik.errors.flatNumber ? "border-red-500 focus:ring-orange-500" : "border-gray-300 focus:ring-orange-500"
                    }`}
                  />
                  {memberAddresses.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">Select from dropdown or type a custom address above</p>
                  )}
                  {formik.touched.flatNumber && formik.errors.flatNumber && (
                    <p className="text-red-500 text-xs mt-0.5">{formik.errors.flatNumber}</p>
                  )}
                </div>
              </div>

              {/* Enter Amount — waterfall into Down Payment + Installments */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">
                  Enter Amount <span className="text-red-500">*</span>
                </h3>
                {paymentItemsError && (
                  <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-red-600 text-xs font-semibold">{paymentItemsError}</p>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-semibold text-gray-500">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={enteredAmount}
                    onChange={(e) => { setEnteredAmount(e.target.value); setPaymentItemsError(""); }}
                    disabled={!bookingBreakdown}
                    placeholder={bookingBreakdown ? "Amount received from client" : "Enter Membership Id first"}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:bg-gray-100"
                  />
                </div>

                {/* How this amount is being allocated (live preview) */}
                {bookingBreakdown && previewAllocations.length > 0 && (
                  <div className="mb-3 p-3 rounded-md bg-orange-50 border border-orange-200">
                    <p className="text-[10px] text-[#EF742C] mb-2 font-semibold uppercase tracking-wide">
                      This payment will be recorded as
                    </p>
                    <div className="flex flex-col gap-1">
                      {previewAllocations.map((a, i) => (
                        <div key={i} className="flex justify-between text-xs">
                          <span className="font-semibold text-gray-700">{a.label}</span>
                          <span className="font-semibold text-[#EF742C]">₹{a.amount.toLocaleString("en-IN")}</span>
                        </div>
                      ))}
                    </div>
                    {previewLeftover > 0 && (
                      <p className="text-[11px] text-red-600 mt-2 font-semibold">
                        ₹{previewLeftover.toLocaleString("en-IN")} exceeds the remaining schedule.
                      </p>
                    )}
                  </div>
                )}

                {/* Full schedule: every bucket with due / paid / remaining */}
                {bookingBreakdown && (
                  <div className="border border-gray-200 rounded-md p-2 mb-3">
                    <p className="text-[10px] text-gray-400 mb-2 font-medium uppercase tracking-wide">{paymentPlan === "full" ? "Full Payment" : "Payment Schedule"}</p>
                    <div className="flex flex-col gap-1.5">
                      {scheduleBuckets.map((b) => {
                        const alloc = previewAllocations.find((a) => a.bucket === b.name);
                        const applyingNow = alloc ? alloc.amount : 0;
                        const isFull = b.remaining <= 0 && b.due > 0;
                        const afterRemaining = Math.max(0, b.remaining - applyingNow);

                        let rowBg, labelColor, badge;
                        if (isFull) {
                          rowBg = "bg-green-50 border border-green-200";
                          labelColor = "text-green-700";
                          badge = <span className="ml-1 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-bold">✓ PAID</span>;
                        } else if (applyingNow > 0) {
                          rowBg = "bg-orange-100/70 border border-orange-300";
                          labelColor = "text-[#EF742C]";
                          badge = (
                            <span className="ml-1 text-[10px] bg-orange-200 text-[#EF742C] px-1.5 py-0.5 rounded-full font-semibold">
                              +₹{applyingNow.toLocaleString("en-IN")} now · ₹{afterRemaining.toLocaleString("en-IN")} left
                            </span>
                          );
                        } else if (b.paid > 0) {
                          rowBg = "bg-orange-50 border border-orange-200";
                          labelColor = "text-orange-700";
                          badge = (
                            <span className="ml-1 text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-semibold">
                              ₹{b.paid.toLocaleString("en-IN")} paid · ₹{b.remaining.toLocaleString("en-IN")} pending
                            </span>
                          );
                        } else {
                          rowBg = "bg-gray-50 border border-gray-200";
                          labelColor = "text-gray-600";
                          badge = <span className="ml-1 text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full font-semibold">₹{b.due.toLocaleString("en-IN")} due</span>;
                        }

                        return (
                          <div key={b.name} className={`flex items-center gap-2 p-2 rounded-md ${rowBg}`}>
                            <div className="flex-1 min-w-0">
                              <span className={`text-xs font-semibold ${labelColor}`}>{b.name}</span>
                              {badge}
                            </div>
                            <span className="text-xs text-gray-500 flex-shrink-0">
                              ₹{b.due.toLocaleString("en-IN")}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Optional extra fees (Share / Penalty / Miscellaneous …) */}
                <div className="border border-gray-200 rounded-md p-2">
                  <p className="text-[10px] text-gray-400 mb-2 font-medium uppercase tracking-wide">
                    Optional Fees <span className="normal-case">(added on top of the amount above)</span>
                  </p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                    {optionalFees.map((fee, index) => (
                      <div key={fee.name} className="flex items-center gap-2 p-1.5 bg-gray-50 rounded hover:bg-gray-100 transition">
                        <input type="checkbox" checked={fee.checked}
                          onChange={(e) => updateOptionalFee(index, "checked", e.target.checked)}
                          className="w-3.5 h-3.5 flex-shrink-0 cursor-pointer" />
                        <label className="flex-1 text-xs font-medium text-gray-700 min-w-0 truncate">{fee.name}</label>
                        <input type="number" value={fee.amount || ""} min="0" placeholder="₹"
                          onChange={(e) => updateOptionalFee(index, "amount", e.target.value)}
                          disabled={!fee.checked}
                          className="w-20 px-2 py-1 text-xs border border-gray-300 rounded focus:border-orange-500 focus:outline-none disabled:bg-gray-100 flex-shrink-0"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Total */}
              <div className={`border rounded-md p-3 ${total > 0 ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                <div className={`text-sm font-semibold ${total > 0 ? "text-green-800" : "text-gray-600"}`}>
                  Total Amount: ₹{total.toLocaleString("en-IN")}
                </div>
                <div className={`text-xs mt-0.5 ${total > 0 ? "text-green-600" : "text-gray-500"}`}>
                  {total > 0 ? `${amountInWords} Rupees Only` : "No amount selected"}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(true)}
                  className="px-4 flex gap-2 py-2 border-2 border-orange-500 text-orange-600 text-sm font-semibold rounded-full hover:bg-orange-200/40 transition-all duration-200"
                >
                  <Eye /> Preview
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  disabled={isGeneratingPDF || !memberExists}
                  className={`px-10 py-2 bg-gradient-to-r from-orange-200 via-orange-500 to-orange-600 text-white text-sm font-semibold rounded-full shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 ${
                    isGeneratingPDF || !memberExists ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {isGeneratingPDF ? "Generating..." : "GENERATE RECEIPT"}
                </button>
              </div>
            </div>
          </div>
        </form>

        <div style={{ display: "none" }}><div ref={receiptRef} /></div>

        {/* Preview Modal */}
        {showPreviewModal && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4" onClick={() => setShowPreviewModal(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[950px] max-h-[95vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold text-gray-800">Receipt Preview</span>
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">Preview Only</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { setShowPreviewModal(false); handleDownloadPDF(); }}
                    disabled={isGeneratingPDF || !memberExists}
                    className={`px-6 py-2 bg-gradient-to-r from-orange-200 via-orange-500 to-orange-600 text-white text-sm font-semibold rounded-full hover:opacity-90 transition ${
                      isGeneratingPDF || !memberExists ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    {isGeneratingPDF ? "Generating..." : "Generate PDF"}
                  </button>
                  <button type="button" onClick={() => setShowPreviewModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-lg font-bold">✕</button>
                </div>
              </div>
              <div className="overflow-y-auto flex-1 p-6 bg-gray-100">
                <div style={{ width: "210mm", minHeight: "297mm", margin: "0 auto", backgroundColor: "#ffffff", padding: "6px 6px", boxSizing: "border-box", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
                  <ReceiptContent />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReceiptForm;