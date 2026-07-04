import { useFormik } from "formik";
import * as yup from "yup";
import { Header } from "./Header";
import axios from "axios";
import { useState, useEffect, useRef } from "react";
import { toast } from "react-toastify";
import { ChevronDown, Check } from "lucide-react";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3001";

const extractMessage = (data) => {
  if (!data) return "";
  if (typeof data === "string") return data;
  if (typeof data === "object")
    return data.message || data.error || data.msg || JSON.stringify(data);
  return String(data);
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
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded border bg-white text-sm transition-all duration-300
          ${disabled ? "bg-gray-100 cursor-not-allowed text-gray-400" : "cursor-pointer"}
          ${open ? "border-[#EF742C] ring-2 ring-[#EF742C]/20" : "border-gray-300 hover:border-[#EF742C]"}`}
      >
        <span
          className={
            selectedOption ? "text-gray-800 font-medium" : "text-gray-400"
          }
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={18}
          className={`transition-all duration-300 flex-shrink-0 ${open ? "rotate-180 text-[#EF742C]" : "text-gray-400"}`}
        />
      </button>

      <div
        className={`absolute top-full left-0 mt-1.5 w-full origin-top rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden z-50 transition-all duration-300 ease-out
          ${open ? "opacity-100 scale-100 translate-y-0 pointer-events-auto" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"}`}
      >
        <div className="py-1">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-left text-sm transition-all duration-150
                ${
                  value === option.value
                    ? "bg-orange-50 text-[#EF742C] font-medium"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
            >
              <span>{option.label}</span>
              {value === option.value && (
                <Check size={16} className="text-[#EF742C]" />
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

  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
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
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getDaysInMonth = (year, month) =>
    new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

  const handleDayClick = (day) => {
    const month = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    const dateStr = `${viewYear}-${month}-${d}`;
    const result = onChange(dateStr);
    if (result && typeof result.then === "function") {
      result.then(() => onBlur && onBlur());
    } else if (onBlur) {
      onBlur();
    }
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
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const currentYear = new Date().getFullYear();
  const yearRange = Array.from(
    { length: 101 },
    (_, i) => currentYear - 100 + i,
  ).reverse();

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
        className={`w-full flex items-center justify-between px-4 py-2.5 rounded border bg-white text-sm transition-all duration-300
          ${disabled ? "bg-gray-100 cursor-not-allowed text-gray-400" : "cursor-pointer"}
          ${open ? "border-[#EF742C] ring-2 ring-[#EF742C]/20" : "border-gray-300 hover:border-[#EF742C]"}`}
      >
        <span className={value ? "text-gray-800 font-medium" : "text-gray-400"}>
          {value ? formatDisplay(value) : placeholder}
        </span>
        <ChevronDown
          size={18}
          className={`transition-all duration-300 flex-shrink-0 ${open ? "rotate-180 text-[#EF742C]" : "text-gray-400"}`}
        />
      </button>

      <div
        className={`absolute top-full left-0 mt-1.5 w-72 origin-top rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden z-50 transition-all duration-300 ease-out
          ${open ? "opacity-100 scale-100 translate-y-0 pointer-events-auto" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"}`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <button
            type="button"
            onClick={prevMonth}
            className="p-1 rounded-full hover:bg-orange-50 text-gray-500 hover:text-[#EF742C] transition-colors"
          >
            <ChevronDown size={16} className="rotate-90" />
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode(mode === "month" ? "day" : "month")}
              className="text-sm font-semibold text-gray-800 hover:text-[#EF742C] transition-colors px-1 py-0.5 rounded hover:bg-orange-50"
            >
              {MONTHS[viewMonth]}
            </button>
            <button
              type="button"
              onClick={() => setMode(mode === "year" ? "day" : "year")}
              className="text-sm font-semibold text-gray-800 hover:text-[#EF742C] transition-colors px-1 py-0.5 rounded hover:bg-orange-50"
            >
              {viewYear}
            </button>
          </div>
          <button
            type="button"
            onClick={nextMonth}
            className="p-1 rounded-full hover:bg-orange-50 text-gray-500 hover:text-[#EF742C] transition-colors"
          >
            <ChevronDown size={16} className="-rotate-90" />
          </button>
        </div>

        {mode === "month" && (
          <div className="grid grid-cols-3 gap-2 p-3">
            {MONTHS.map((m, i) => (
              <button
                key={m}
                type="button"
                onClick={() => { setViewMonth(i); setMode("day"); }}
                className={`py-2 rounded-lg text-xs font-medium transition-all duration-150 ${viewMonth === i ? "bg-[#EF742C] text-white" : "text-gray-700 hover:bg-orange-50 hover:text-[#EF742C]"}`}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {mode === "year" && (
          <div className="max-h-48 overflow-y-auto p-2">
            <div className="grid grid-cols-3 gap-1">
              {yearRange.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => { setViewYear(y); setMode("day"); }}
                  className={`py-2 rounded-lg text-xs font-medium transition-all duration-150 ${viewYear === y ? "bg-[#EF742C] text-white" : "text-gray-700 hover:bg-orange-50 hover:text-[#EF742C]"}`}
                >
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
                <div
                  key={d}
                  className="w-8 h-6 flex items-center justify-center text-xs font-semibold text-[#EF742C]"
                >
                  {d}
                </div>
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
                if (
                  (!maxDate || today <= maxDate) &&
                  (!minDate || today >= minDate)
                ) {
                  const result = onChange(today);
                  if (result && typeof result.then === "function") {
                    result.then(() => onBlur && onBlur());
                  } else if (onBlur) {
                    onBlur();
                  }
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

// ── Projects Config ──
// Add / edit your real projects and codes here
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

// Site dimensions per project — edit to match your real projects
const dimensions = {
  Gruhakalpa: ["30x40", "30x50", "40x60", "50x80"],
  "New City": ["30x40", "40x60", "50x80"],
  "Sri Sai Nagar": ["30x40", "30x50"],
};

// Parse "WxL" → total sqft
const parseDimension = (dim) => {
  const [w, l] = dim.split("x").map(Number);
  return w * l;
};

// Build full membership ID: CODE + year + zero-padded number e.g. GK2026005
const buildMembershipId = (projectCode, year, number) => {
  if (!projectCode || !year || !number) return "";
  const padded = String(number).padStart(3, "0");
  return `${projectCode}${year}${padded}`;
};

export function SiteBookingForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");
  const [membershipInput, setMembershipInput] = useState("");
  const [fullMembershipId, setFullMembershipId] = useState("");
  const [isFetchingMember, setIsFetchingMember] = useState(false);
  // "idle" | "found" | "not_found"
  const [memberStatus, setMemberStatus] = useState("idle");
  const [familyParticulars, setFamilyParticulars] = useState([
    { name: "", age: "", relationship: "" },
  ]);
  const [paymentBreakdown, setPaymentBreakdown] = useState(null);
  const [pricePerSqft, setPricePerSqft] = useState("");

  // ── Exact pricing lookup (matches the official Excel sheet) ──
  // Keyed by [pricePerSqft][dimension]. Tier amounts are PER installment:
  //   dp = down payment, t1 = installments 1-6, t2 = installments 7-9, t3 = installments 10-14.
  // These expand to exactly: dp + t1*6 + t2*3 + t3*5 = total.
  const PRICE_TABLE = {
    "2500": {
      "30x40": { dp: 450000, t1: 150000, t2: 200000, t3: 210000 },
      "30x50": { dp: 450000, t1: 187500, t2: 250000, t3: 285000 },
      "40x60": { dp: 600000, t1: 300000, t2: 400000, t3: 480000 },
    },
    "2700": {
      "30x40": { dp: 450000, t1: 150000, t2: 200000, t3: 258000 },
      "30x50": { dp: 450000, t1: 187500, t2: 250000, t3: 345000 },
      "40x60": { dp: 600000, t1: 300000, t2: 400000, t3: 576000 },
    },
  };

  // Look up the exact 14-installment schedule for a (price, dimension) combo.
  // Returns null if the combo is not in the official pricing table.
  const calculateBreakdown = (price, dimension) => {
    const row = PRICE_TABLE?.[String(price)]?.[dimension];
    if (!row) return null;

    const installments = [];
    for (let n = 1; n <= 6; n++) installments.push({ label: `Installment ${n}`, amount: row.t1 });
    for (let n = 7; n <= 9; n++) installments.push({ label: `Installment ${n}`, amount: row.t2 });
    for (let n = 10; n <= 14; n++) installments.push({ label: `Installment ${n}`, amount: row.t3 });

    return { downPayment: row.dp, installments };
  };

  const formik = useFormik({
    initialValues: {
      Name: "",
      Date: "",
      MobileNumber: "",
      ProjectName: "", // user-selected now
      Year: String(CURRENT_YEAR), // user-selected, defaults to current year
      PaymentPlan: "installments", // "installments" | "full"
      SiteDimension: "",
      TotalAmount: "",
      DownPayment: "",
      Designation: "",
      MembershipId: "",
    },
    validationSchema: yup.object({
      Name: yup
        .string()
        .required("Name is required")
        .min(3, "Minimum 3 characters required")
        .max(50, "Maximum 50 characters required")
        .matches(/^[A-Za-z\s]+$/, "Only letters and spaces allowed"),
      MobileNumber: yup
        .string()
        .required("Mobile number is required")
        .matches(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"),
      Date: yup
        .date()
        .required("Date is required")
        .typeError("Please select a valid date"),
      ProjectName: yup.string().required("Project Name is required"),
      Year: yup.string().required("Year is required"),
      SiteDimension: yup.string().required("Site Dimension is required"),
      TotalAmount: yup
        .number()
        .required("Total amount is required")
        .positive("Amount must be greater than 0"),
      Designation: yup.string().optional(),
      // Validate format: 2-5 letter code + 4-digit year + 3-4 digit number e.g. GK2026005
      MembershipId: yup
        .string()
        .required("Membership number required")
        .matches(
          /^[A-Z]{2,5}\d{4}\d{3,4}$/,
          "Invalid format (e.g., GK2026005)",
        ),
    }),
    validateOnChange: false,
    validateOnBlur: false,
    onSubmit: async (values, { resetForm }) => {
      for (let i = 0; i < familyParticulars.length; i++) {
        const fp = familyParticulars[i];
        const anyFilled =
          fp.name.trim() || fp.age.toString().trim() || fp.relationship.trim();
        if (
          anyFilled &&
          (!fp.name.trim() ||
            !fp.age.toString().trim() ||
            !fp.relationship.trim())
        ) {
          toast.error(
            `Please fill all fields for Family Member ${i + 1} or leave the row empty`,
          );
          return;
        }
      }

      setIsSubmitting(true);
      setSubmitMessage("");
      try {
        const filteredFamilyParticulars = familyParticulars.filter(
          (fp) =>
            fp.name.trim() ||
            fp.age.toString().trim() ||
            fp.relationship.trim(),
        );

        const isFull = values.PaymentPlan === "full";
        const payload = {
          name: values.Name,
          date: values.Date,
          mobilenumber: Number(values.MobileNumber),
          projectname: values.ProjectName,
          year: values.Year,
          paymentplan: values.PaymentPlan,
          sitedimension: values.SiteDimension,
          totalamount: Number(values.TotalAmount),
          // Full payment = single lump (no down payment / installment schedule)
          downpayment: isFull ? 0 : Number(values.DownPayment),
          installments: isFull
            ? []
            : paymentBreakdown && !paymentBreakdown.full
              ? paymentBreakdown.installments
              : [],
          designation: values.Designation,
          membership_id: values.MembershipId,
          nominees: filteredFamilyParticulars,
        };

        const response = await axios.post(`${API_BASE}/site-booking`, payload);
        setSubmitMessage(
          extractMessage(response.data) || "Site booking created successfully!",
        );
        toast.success("Site booking created successfully!");
        resetForm();
        setMembershipInput("");
        setFullMembershipId("");
        setMemberStatus("idle");
        setFamilyParticulars([{ name: "", age: "", relationship: "" }]);
        setPaymentBreakdown(null);
        setPricePerSqft("");
      } catch (error) {
        console.error("Error submitting form:", error);
        if (error.response) {
          const errMsg =
            extractMessage(error.response.data) || "An error occurred.";
          setSubmitMessage(errMsg);
          toast.error(`Error: ${errMsg}`);
        } else if (error.request) {
          setSubmitMessage("No response from server.");
          toast.error("No response from server.");
        } else {
          setSubmitMessage("An error occurred while submitting the form.");
          toast.error("An error occurred while submitting the form.");
        }
      } finally {
        setIsSubmitting(false);
      }
    },
  });

  // ── Recalculate total whenever dimension, price, OR payment plan changes ──
  useEffect(() => {
    if (formik.values.SiteDimension && pricePerSqft && Number(pricePerSqft) > 0) {
      const sqft = parseDimension(formik.values.SiteDimension);
      const total = sqft * Number(pricePerSqft);
      formik.setFieldValue("TotalAmount", total);

      if (formik.values.PaymentPlan === "full") {
        // Full payment: one lump = the whole total, no installment table needed
        formik.setFieldValue("DownPayment", 0);
        setPaymentBreakdown({ full: true, total });
      } else {
        const breakdown = calculateBreakdown(pricePerSqft, formik.values.SiteDimension);
        if (breakdown) {
          formik.setFieldValue("DownPayment", breakdown.downPayment);
          setPaymentBreakdown(breakdown);
        } else {
          // No official pricing for this price + dimension combination.
          formik.setFieldValue("DownPayment", "");
          setPaymentBreakdown(null);
        }
      }
    } else {
      formik.setFieldValue("TotalAmount", "");
      formik.setFieldValue("DownPayment", "");
      setPaymentBreakdown(null);
    }
  }, [formik.values.SiteDimension, pricePerSqft, formik.values.PaymentPlan]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Clear dimension/price/breakdown whenever project changes (dimensions differ per project) ──
  useEffect(() => {
    formik.setFieldValue("SiteDimension", "");
    setPricePerSqft("");
    setPaymentBreakdown(null);
  }, [formik.values.ProjectName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Build full membership ID whenever number, project, or year changes ──
  useEffect(() => {
    const project = PROJECTS.find((p) => p.name === formik.values.ProjectName);
    if (membershipInput && project && formik.values.Year) {
      const fullId = buildMembershipId(
        project.code,
        formik.values.Year,
        membershipInput,
      );
      setFullMembershipId(fullId);
      formik.setFieldValue("MembershipId", fullId);

      // Only fetch when the user has typed a complete number (3–4 digits)
      if (membershipInput.length >= 3) {
        const timer = setTimeout(() => {
          fetchMemberDetails(fullId);
        }, 500); // debounce: wait 500ms after user stops typing
        return () => clearTimeout(timer);
      } else {
        // Reset status while still typing but don't clear manually-entered fields
        setMemberStatus("idle");
      }
    } else {
      setFullMembershipId("");
      formik.setFieldValue("MembershipId", "");
      setMemberStatus("idle");
      // Only clear fields that were auto-filled (i.e., when member was found)
      if (memberStatus === "found") {
        formik.setFieldValue("Name", "");
        formik.setFieldValue("MobileNumber", "");
        formik.setFieldValue("Designation", "");
      }
    }
  }, [membershipInput, formik.values.ProjectName, formik.values.Year]); // eslint-disable-line react-hooks/exhaustive-deps

const fetchMemberDetails = async (membershipId) => {
  setIsFetchingMember(true);
  setMemberStatus("idle");
  try {
    const response = await axios.get(`${API_BASE}/members`);
    const members = response.data.data || [];
    const member = members.find((m) => m.membership_id === membershipId);
    if (member) {
      const mobile =
        member.mobile ??
        member.mobile_number ??
        member.mobileNumber ??
        member.MobileNumber ??
        "";
      formik.setFieldValue("Name", member.name || "");
      formik.setFieldValue("MobileNumber", mobile ? String(mobile) : "");
      formik.setFieldValue("Designation", member.designation || "");
      setMemberStatus("found");
      toast.success(`Membership exists — lead data auto-filled!`);
    } else {
      setMemberStatus("not_found");
    }
  } catch (error) {
    console.error("Error fetching member details:", error);
    setMemberStatus("not_found");
    toast.error("Error fetching member details.");
  } finally {
    setIsFetchingMember(false);
  }
};

  const handleMembershipInputChange = (e) => {
    // Only allow digits, max 4 digits
    const value = e.target.value.replace(/\D/g, "").slice(0, 4);
    setMembershipInput(value);
  };

  const handleFamilyChange = (index, field, value) => {
    setFamilyParticulars((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addFamilyMember = () => {
    if (familyParticulars.length < 5)
      setFamilyParticulars((prev) => [
        ...prev,
        { name: "", age: "", relationship: "" },
      ]);
  };

  const removeFamilyMember = (index) => {
    if (familyParticulars.length > 1)
      setFamilyParticulars((prev) => prev.filter((_, i) => i !== index));
  };

  const dimensionOptions = (dimensions[formik.values.ProjectName] || []).map(
    (d) => ({
      label: d,
      value: d,
    }),
  );

  const selectedProjectCode =
    PROJECTS.find((p) => p.name === formik.values.ProjectName)?.code || "";

  const selectedSqft = formik.values.SiteDimension
    ? parseDimension(formik.values.SiteDimension)
    : null;

  const isErrorMessage =
    typeof submitMessage === "string" &&
    (submitMessage.includes("Error") ||
      submitMessage.includes("error") ||
      submitMessage.includes("not found"));

  // Membership status badge config
  const membershipBadge = {
    found: {
      className: "text-green-700 bg-green-50 border border-green-200",
      icon: "✓",
      text: `Membership exists — lead auto-filled`,
    },
    not_found: {
      className: "text-amber-700 bg-amber-50 border border-amber-200",
      icon: "○",
      text: `${fullMembershipId} — not found in records`,
    },
    idle: null,
  };

  return (
    <div>
      <Header />
      <div className="w-[791px] px-10 ml-10">
        <h1 className="font-semibold text-2xl mt-[50px] mb-[40px]">
          Site Booking
        </h1>

        {submitMessage && (
          <div
            className={`p-4 mb-4 rounded ${isErrorMessage ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}
          >
            {submitMessage}
          </div>
        )}

        <form
          className="bg-[#EF742C]/10 mb-10 p-[30px] rounded-xl"
          onSubmit={formik.handleSubmit}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Project Name — now selectable */}
            <div>
              <label className="font-semibold text-[14px] pb-1 block">
                Project Name <span className="text-red-500">*</span>
              </label>
              <CustomSelect
                options={PROJECTS.map((p) => ({ label: p.name, value: p.name }))}
                value={formik.values.ProjectName}
                onChange={(val) => formik.setFieldValue("ProjectName", val)}
                onBlur={() => formik.setFieldTouched("ProjectName", true)}
                placeholder="Select Project"
              />
              {selectedProjectCode && (
                <div className="text-xs text-gray-400 mt-1">
                  Code: <span className="font-semibold text-gray-500">{selectedProjectCode}</span>
                </div>
              )}
              {formik.touched.ProjectName && formik.errors.ProjectName && (
                <div className="text-red-500 text-sm mt-1">
                  {formik.errors.ProjectName}
                </div>
              )}
            </div>

            {/* Year — now selectable */}
            <div>
              <label className="font-semibold text-[14px] pb-1 block">
                Year <span className="text-red-500">*</span>
              </label>
              <CustomSelect
                options={yearOptions}
                value={formik.values.Year}
                onChange={(val) => formik.setFieldValue("Year", val)}
                onBlur={() => formik.setFieldTouched("Year", true)}
                placeholder="Select Year"
              />
              {formik.touched.Year && formik.errors.Year && (
                <div className="text-red-500 text-sm mt-1">
                  {formik.errors.Year}
                </div>
              )}
            </div>

            {/* Payment Plan — Installments or Full Payment */}
            <div>
              <label className="font-semibold text-[14px] pb-1 block">
                Payment Plan <span className="text-red-500">*</span>
              </label>
              <CustomSelect
                options={[
                  { label: "Installments (Down Payment + 14)", value: "installments" },
                  { label: "Full Payment", value: "full" },
                ]}
                value={formik.values.PaymentPlan}
                onChange={(val) => formik.setFieldValue("PaymentPlan", val)}
                onBlur={() => formik.setFieldTouched("PaymentPlan", true)}
                placeholder="Select Payment Plan"
              />
              <div className="text-xs text-gray-400 mt-1">
                {formik.values.PaymentPlan === "full"
                  ? "Client pays the full amount — receipts show a single \u201CFull Payment\u201D line."
                  : "Client pays via down payment + 14 installments."}
              </div>
            </div>

            {/* Membership Id — user enters only the number */}
            <div>
              <label className="font-semibold text-[14px] pb-1 block">
                Membership Id <span className="text-red-500">*</span>
              </label>

              {/* Composite display: prefix (e.g. GK2026) + user input */}
              <div className="flex items-stretch rounded border border-gray-300 overflow-hidden focus-within:ring-2 focus-within:ring-orange-400 focus-within:border-transparent bg-white">
                <span className="flex items-center px-3 bg-orange-50 border-r border-gray-300 text-sm font-semibold text-[#EF742C] select-none whitespace-nowrap">
                  {selectedProjectCode || "--"}{formik.values.Year || "----"}
                </span>
                <input
                  type="text"
                  placeholder="001"
                  value={membershipInput}
                  onChange={handleMembershipInputChange}
                  maxLength="4"
                  disabled={!formik.values.ProjectName || !formik.values.Year}
                  className="flex-1 px-3 py-2.5 text-sm focus:outline-none bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
                />
                {isFetchingMember && (
                  <span className="flex items-center px-3 text-xs text-gray-400 animate-pulse">
                    Checking…
                  </span>
                )}
              </div>

              {!formik.values.ProjectName || !formik.values.Year ? (
                <p className="text-gray-400 text-xs mt-1">
                  Select project and year first
                </p>
              ) : null}

              {/* Status badge */}
              {!isFetchingMember && fullMembershipId && membershipBadge[memberStatus] && (
                <div className={`text-xs mt-1.5 px-2.5 py-1.5 rounded-md font-medium flex items-center gap-1.5 ${membershipBadge[memberStatus].className}`}>
                  <span>{membershipBadge[memberStatus].icon}</span>
                  <span>{membershipBadge[memberStatus].text}</span>
                </div>
              )}

              {formik.touched.MembershipId && formik.errors.MembershipId && (
                <div className="text-red-500 text-sm mt-1">
                  {formik.errors.MembershipId}
                </div>
              )}
            </div>

            {/* Name — auto-filled if membership found, editable if not */}
            <div>
              <label className="font-semibold text-[14px] pb-1 block">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="Name"
                value={formik.values.Name}
                onChange={formik.handleChange}
                placeholder="Enter Your Name"
                disabled={memberStatus === "found"}
                className="border border-gray-300 px-4 py-2.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              {formik.touched.Name && formik.errors.Name && (
                <div className="text-red-500 text-sm mt-1">
                  {formik.errors.Name}
                </div>
              )}
            </div>

            {/* Mobile Number — auto-filled if membership found */}
            <div>
              <label className="font-semibold text-[14px] pb-1 block">
                Mobile Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="MobileNumber"
                placeholder="Enter Mobile Number"
                value={formik.values.MobileNumber}
                onChange={formik.handleChange}
                maxLength={10}
                className="border border-gray-300 px-4 py-2.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              {formik.touched.MobileNumber && formik.errors.MobileNumber && (
                <div className="text-red-500 text-sm mt-1">
                  {formik.errors.MobileNumber}
                </div>
              )}
            </div>

            {/* Date */}
            <div>
              <label className="font-semibold text-[14px] pb-1 block">
                Date <span className="text-red-500">*</span>
              </label>
              <CustomDatePicker
                value={formik.values.Date}
                onChange={(val) => formik.setFieldValue("Date", val)}
                onBlur={() => formik.setFieldTouched("Date", true)}
                placeholder="Select Booking Date"
              />
              {formik.touched.Date && formik.errors.Date && (
                <div className="text-red-500 text-sm mt-1">
                  {formik.errors.Date}
                </div>
              )}
            </div>

            {/* Site Dimension */}
            <div>
              <label className="font-semibold text-[14px] pb-1 block">
                Site Dimension <span className="text-red-500">*</span>
              </label>
              <CustomSelect
                options={dimensionOptions}
                value={formik.values.SiteDimension}
                onChange={(val) => formik.setFieldValue("SiteDimension", val)}
                onBlur={() => formik.setFieldTouched("SiteDimension", true)}
                placeholder={
                  formik.values.ProjectName
                    ? "Select Dimension"
                    : "Select a project first"
                }
                disabled={!formik.values.ProjectName}
              />
              {selectedSqft && (
                <div className="text-xs text-gray-500 mt-1">
                  {formik.values.SiteDimension} ={" "}
                  <span className="font-semibold text-gray-700">
                    {selectedSqft.toLocaleString("en-IN")} sq.ft
                  </span>
                </div>
              )}
              {formik.touched.SiteDimension && formik.errors.SiteDimension && (
                <div className="text-red-500 text-sm mt-1">
                  {formik.errors.SiteDimension}
                </div>
              )}
            </div>

            {/* Price per Sq.ft */}
            <div>
              <label className="font-semibold text-[14px] pb-1 block">
                Price per Sq.ft (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                placeholder="e.g. 2000"
                value={pricePerSqft}
                onChange={(e) => setPricePerSqft(e.target.value)}
                disabled={!formik.values.SiteDimension}
                min="1"
                className="border border-gray-300 px-4 py-2.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              {selectedSqft && pricePerSqft && Number(pricePerSqft) > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  {selectedSqft.toLocaleString("en-IN")} sq.ft × ₹
                  {Number(pricePerSqft).toLocaleString("en-IN")} ={" "}
                  <span className="font-semibold text-[#EF742C]">
                    ₹{(selectedSqft * Number(pricePerSqft)).toLocaleString("en-IN")}
                  </span>
                </div>
              )}
            </div>

            {/* Total Amount — read-only */}
            <div>
              <label className="font-semibold text-[14px] pb-1 block">
                Total Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                name="TotalAmount"
                placeholder="Auto-filled from dimension × price"
                value={formik.values.TotalAmount}
                readOnly
                className="border border-gray-300 px-4 py-2.5 w-full bg-gray-50 focus:outline-none rounded text-sm cursor-not-allowed text-gray-700 font-semibold"
              />
              {formik.touched.TotalAmount && formik.errors.TotalAmount && (
                <div className="text-red-500 text-sm mt-1">
                  {formik.errors.TotalAmount}
                </div>
              )}
            </div>

            {/* Designation — auto-filled if membership found */}
            <div>
              <label className="font-semibold text-[14px] pb-1 block">
                Designation
              </label>
              <input
                type="text"
                name="Designation"
                placeholder="Enter Designation"
                value={formik.values.Designation}
                onChange={formik.handleChange}
                className="border border-gray-300 px-4 py-2.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              {formik.touched.Designation && formik.errors.Designation && (
                <div className="text-red-500 text-sm mt-1">
                  {formik.errors.Designation}
                </div>
              )}
            </div>
          </div>

          {/* Full Payment summary */}
          {paymentBreakdown && paymentBreakdown.full && (
            <div className="mt-6">
              <h3 className="font-semibold text-[14px] mb-3 text-[#EF742C]">
                Full Payment
                <span className="text-gray-400 font-normal text-xs ml-2">
                  (client pays the entire amount — no installment schedule)
                </span>
              </h3>
              <div className="bg-white border border-[#EF742C]/20 rounded-xl p-5">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Full Payment Amount
                  </label>
                  <div className="border border-[#EF742C]/30 bg-orange-50 rounded-md px-3 py-2 text-sm font-bold text-[#EF742C]">
                    ₹ {Number(paymentBreakdown.total || 0).toLocaleString("en-IN")}
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-green-600 font-semibold">
                  ✓ Receipts will show a single "Full Payment" line (partial payments show as "Booking Advance" until complete).
                </div>
              </div>
            </div>
          )}

          {/* Payment Breakdown (installments) */}
          {paymentBreakdown && !paymentBreakdown.full && (
            <div className="mt-6">
              <h3 className="font-semibold text-[14px] mb-3 text-[#EF742C]">
                Payment Breakdown
                <span className="text-gray-400 font-normal text-xs ml-2">
                  (auto-calculated from dimension × price per sq.ft)
                </span>
              </h3>
              <div className="bg-white border border-[#EF742C]/20 rounded-xl p-5">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Down payment */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Down Payment
                      <span className="ml-1 text-[10px] text-[#EF742C] font-normal normal-case">(12%)</span>
                    </label>
                    <div className="border border-[#EF742C]/30 bg-orange-50 rounded-md px-3 py-2 text-sm font-bold text-[#EF742C]">
                      ₹ {paymentBreakdown.downPayment.toLocaleString("en-IN")}
                    </div>
                  </div>

                  {/* 14 installments */}
                  {paymentBreakdown.installments.map((inst, idx) => {
                    // per-installment percent label by tier
                    const n = idx + 1;
                    const pctLabel = n <= 6 ? "5%" : n <= 9 ? "6.5%" : "7.7%";
                    return (
                      <div key={inst.label} className="flex flex-col gap-1">
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          {inst.label}
                          <span className="ml-1 text-[10px] text-gray-400 font-normal normal-case">({pctLabel})</span>
                        </label>
                        <div className="border border-gray-200 bg-gray-50 rounded-md px-3 py-2 text-sm font-semibold text-gray-700">
                          ₹ {inst.amount.toLocaleString("en-IN")}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    Total:{" "}
                    <span className="font-bold text-gray-700">
                      ₹ {Number(formik.values.TotalAmount).toLocaleString("en-IN")}
                    </span>
                  </span>
                  <span className="text-green-600 font-semibold">
                    ✓ Breakdown = Down Payment + 14 Installments
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* No preset pricing for this price + dimension combination */}
          {!paymentBreakdown &&
            formik.values.PaymentPlan === "installments" &&
            formik.values.SiteDimension &&
            pricePerSqft &&
            Number(pricePerSqft) > 0 && (
              <div className="mt-6">
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
                  No preset installment pricing is available for{" "}
                  <span className="font-semibold">
                    {formik.values.SiteDimension}
                  </span>{" "}
                  at{" "}
                  <span className="font-semibold">
                    ₹{Number(pricePerSqft).toLocaleString("en-IN")}/sq.ft
                  </span>
                  . Only the official rate combinations are supported. Please
                  select a valid dimension and price.
                </div>
              </div>
            )}

          {/* Family Particulars */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[14px]">
                Family Particulars
                <span className="text-gray-400 font-normal text-xs ml-2">
                  (optional, max 5)
                </span>
              </h3>
              {familyParticulars.length < 5 && (
                <button
                  type="button"
                  onClick={addFamilyMember}
                  className="text-[#EF742C] text-sm font-semibold hover:underline flex items-center gap-1"
                >
                  <span className="text-lg leading-none">+</span> Add Member
                </button>
              )}
            </div>

            <div className="flex flex-col gap-4">
              {familyParticulars.map((fp, index) => (
                <div
                  key={index}
                  className="bg-white border border-gray-200 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-[#EF742C]">
                      Member {index + 1}
                    </span>
                    {familyParticulars.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFamilyMember(index)}
                        className="text-red-400 hover:text-red-600 text-sm font-medium"
                      >
                        ✕ Remove
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Name</label>
                      <input
                        type="text"
                        placeholder="Member name"
                        value={fp.name}
                        onChange={(e) => handleFamilyChange(index, "name", e.target.value)}
                        className="border border-gray-300 px-3 py-2 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Age</label>
                      <input
                        type="number"
                        placeholder="Age"
                        value={fp.age}
                        min="1"
                        max="120"
                        onChange={(e) => handleFamilyChange(index, "age", e.target.value)}
                        className="border border-gray-300 px-3 py-2 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Relationship</label>
                      <input
                        type="text"
                        placeholder="e.g. Son, Wife"
                        value={fp.relationship}
                        onChange={(e) => handleFamilyChange(index, "relationship", e.target.value)}
                        className="border border-gray-300 px-3 py-2 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-full h-[2.5px] text-gray-400 mt-8">
            <hr />
          </div>
          <div className="flex justify-end mt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className={`bg-gradient-to-r from-orange-200 via-orange-500 to-orange-600 text-white font-bold px-8 py-2.5 rounded-full shadow-lg w-[150px] ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isSubmitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}