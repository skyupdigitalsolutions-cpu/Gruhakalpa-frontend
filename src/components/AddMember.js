/* eslint-disable */
import React, { useState, useEffect, useRef } from "react";
import { useFormik } from "formik";
import * as yup from "yup";
import axios from "axios";
import { Header } from "./Header";
import { toast } from "react-toastify";
import { ChevronDown, Check, Eye, Download } from "lucide-react";

const MEMBERSHIP_FEES = 2500;

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3001";

const membershipTypes = [
  { label: "Associate Member", value: "Associate Member" },
  { label: "Permanent Member", value: "Permanent Member" },
];

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
}) => {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() =>
    value ? new Date(value).getFullYear() : new Date().getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState(() =>
    value ? new Date(value).getMonth() : new Date().getMonth(),
  );
  const [mode, setMode] = useState("day"); // "day" | "month" | "year"
  const ref = useRef(null);

  const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
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
    if (!maxDate) return false;
    const month = String(viewMonth + 1).padStart(2, "0");
    const d = String(day).padStart(2, "0");
    return `${viewYear}-${month}-${d}` > maxDate;
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
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
      {/* Trigger */}
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

      {/* Calendar panel */}
      <div
        className={`absolute top-full left-0 mt-1.5 w-72 origin-top rounded-xl border border-gray-200 bg-white shadow-xl overflow-hidden z-50 transition-all duration-300 ease-out
          ${open ? "opacity-100 scale-100 translate-y-0 pointer-events-auto" : "opacity-0 scale-95 -translate-y-2 pointer-events-none"}`}
      >
        {/* Header */}
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

        {/* Month picker */}
        {mode === "month" && (
          <div className="grid grid-cols-3 gap-2 p-3">
            {MONTHS.map((m, i) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setViewMonth(i);
                  setMode("day");
                }}
                className={`py-2 rounded-lg text-xs font-medium transition-all duration-150
                  ${
                    viewMonth === i
                      ? "bg-[#EF742C] text-white"
                      : "text-gray-700 hover:bg-orange-50 hover:text-[#EF742C]"
                  }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {/* Year picker */}
        {mode === "year" && (
          <div className="max-h-48 overflow-y-auto p-2">
            <div className="grid grid-cols-3 gap-1">
              {yearRange.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setViewYear(y);
                    setMode("day");
                  }}
                  className={`py-2 rounded-lg text-xs font-medium transition-all duration-150
                    ${
                      viewYear === y
                        ? "bg-[#EF742C] text-white"
                        : "text-gray-700 hover:bg-orange-50 hover:text-[#EF742C]"
                    }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Day grid */}
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

        {/* Today button */}
        {mode === "day" && (
          <div className="border-t border-gray-100 px-3 py-2 flex justify-center">
            <button
              type="button"
              onClick={() => {
                const today = new Date().toISOString().split("T")[0];
                if (!maxDate || today <= maxDate) {
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

// ── Member Receipt Fixed Breakdown ──
const MEMBER_RECEIPT_BREAKDOWN = [
  { name: "Membership Fee", amount: 200 },
  { name: "Share Fee", amount: 200 },
  { name: "Share", amount: 2000 },
  { name: "Admission Fee", amount: 100 },
];
const MEMBER_RECEIPT_TOTAL = 2500;

const numberToWords = (num) => {
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
  ];
  const tens = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];
  const teens = [
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  if (!num || num === 0) return "Zero";
  const c = (n) => {
    if (n === 0) return "";
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100)
      return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    return (
      ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + c(n % 100) : "")
    );
  };
  if (num < 1000) return c(num);
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const rem = num % 1000;
  let r = "";
  if (crore) r += c(crore) + " Crore ";
  if (lakh) r += c(lakh) + " Lakh ";
  if (thousand) r += c(thousand) + " Thousand ";
  if (rem) r += c(rem);
  return r.trim();
};

const formatReceiptDate = (d) => {
  if (!d) return "-";
  const date = new Date(d);
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
};

const AddMember = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [isFormCompleted, setIsFormCompleted] = useState(false);
  const [membershipInput, setmembershipInput] = useState("");
  const [showMemberReceiptModal, setShowMemberReceiptModal] = useState(false);
  const [memberReceiptData, setMemberReceiptData] = useState(null);
  const [isGeneratingMemberPDF, setIsGeneratingMemberPDF] = useState(false);
  // const [fullmembershipid, setFullmembershipid] = useState("");

  // const projects = [
  //   { name: "New City", code: "NCG" },
  //   { name: "New City 1", code: "NCS" },
  // ];

  // const projectOptions = projects.map((p) => ({ label: p.name, value: p.name }));
  const membershipTypeOptions = membershipTypes.map((t) => ({
    label: t.label,
    value: t.value,
  }));

  // ── Step 1 ──
  const formikStep1 = useFormik({
    initialValues: {
      Name: "",
      ProjectName: "",
      membership_id: "",
      MembershipReceiptNo: "",
      MembershipType: "",
      ApplicationNumber: "",
      MembershipDate: "",
      MembershipFees: "",
      MobileNumber: "",
      Email: "",
      Image: null,
    },
    validationSchema: yup.object({
      Name: yup
        .string()
        .required("Name is required")
        .min(3, "Minimum 3 characters required")
        .matches(/^[A-Za-z\s]+$/, "Only letters allowed"),
      // ProjectName: yup.string().required("Project Name is required"),
      membership_id: yup.string().required("Membershipid should not be null"),
      MembershipReceiptNo: yup
        .string()
        .matches(/^[0-9]*$/, "Only numbers allowed"),
      MembershipType: yup.string().required("Membership type is required"),
      ApplicationNumber: yup
        .string()
        .required("Application number is required"),
      MembershipDate: yup
        .date()
        .required("Membership date is required")
        .typeError("Please select a valid date"),
      MembershipFees: yup
        .number()
        .required("Membership fees is required")
        .positive("Must be greater than 0"),
      MobileNumber: yup
        .string()
        .required("Mobile number is required")
        .matches(/^(\+91|0)?[6-9]\d{9}$/, "Enter valid 10-digit number"),
      Email: yup
        .string()
        .required("Email is required")
        .email("Enter valid email"),
      Image: yup.mixed().nullable().notRequired(),
    }),
    onSubmit: (values) => {
      console.log("Step 1:", values);
      setCurrentStep(2);
    },
  });

  useEffect(() => {
    if (formikStep1.values.MembershipType) {
      formikStep1.setFieldValue("MembershipFees", MEMBERSHIP_FEES);
    } else {
      formikStep1.setFieldValue("MembershipFees", "");
    }
  }, [formikStep1.values.MembershipType]);

  // useEffect(() => {
  //   if (formikStep1.values.ProjectName && membershipInput) {
  //     const selectedProject = projects.find(
  //       (p) => p.name === formikStep1.values.ProjectName,
  //     );
  //     if (selectedProject) {
  //       const paddedNumber = membershipInput.padStart(3, "0");
  //       const fullNumber = `${selectedProject.code}-${paddedNumber}`;
  //       setFullmembershipid(fullNumber);
  //       formikStep1.setFieldValue("membershipid", fullNumber);
  //     }
  //   } else {
  //     setFullmembershipid("");
  //     formikStep1.setFieldValue("membershipid", "");
  //   }
  // }, [formikStep1.values.ProjectName, membershipInput]);

  const handlemembershipInputChange = (e) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    setmembershipInput(value);
    formikStep1.setFieldValue("membership_id", value);
  };

  // ── Step 2 ──
  const formikStep2 = useFormik({
    initialValues: {
      AadharNumber: "",
      DOB: "",
      FatherName: "",
      BirthPlace: "",
      AlternateMobileNumber: "",
      AlternateEmail: "",
      PermanentAddress: "",
      CorrespondenceAddress: "",
      PanCard: null,
      AadharCard: null,
      ApplicationDoc: null,
    },
    validationSchema: yup.object({
      AadharNumber: yup
        .string()
        .required("Aadhar number is required")
        .matches(
          /^\d{4}\s?\d{4}\s?\d{4}$/,
          "Enter valid 12-digit Aadhar number",
        ),
      DOB: yup
        .date()
        .required("Date of birth is required")
        .max(new Date(), "Future date not allowed")
        .test("age-18", "Member must be at least 18 years old", (value) => {
          if (!value) return true; // required already handles empty
          const dob = new Date(value);
          const today = new Date();
          let age = today.getFullYear() - dob.getFullYear();
          const m = today.getMonth() - dob.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
          return age >= 18;
        })
        .typeError("Please select valid date"),
      FatherName: yup
        .string()
        .required("Father name is required")
        .matches(/^[A-Za-z\s]+$/, "Only letters allowed"),
      BirthPlace: yup.string().matches(/^[A-Za-z\s]+$/, "Only letters allowed"),
      AlternateMobileNumber: yup
        .string()
        .required("Alternate mobile number is required")
        .matches(/^(\+91|0)?[6-9]\d{9}$/, "Enter valid 10-digit number"),
      AlternateEmail: yup
        .string()
        .required("Alternate email is required")
        .email("Enter valid email"),
      PermanentAddress: yup
        .string()
        .required("Permanent address is required")
        .min(10, "Minimum 10 characters required"),
      CorrespondenceAddress: yup
        .string()
        .required("Correspondence address is required")
        .min(10, "Minimum 10 characters required"),
      PanCard: yup.mixed().nullable().notRequired(),
      AadharCard: yup.mixed().nullable().notRequired(),
      ApplicationDoc: yup.mixed().nullable().notRequired(),
    }),
    onSubmit: (values) => {
      console.log("Step 2:", values);
      setCurrentStep(3);
    },
  });

  // ── Step 3 ──
  const formikStep3 = useFormik({
    initialValues: {
      NomineeName: "",
      NomineeMobileNumber: "",
      NomineeAge: "",
      NomineeRelationship: "",
      NomineeAddress: "",
      AgreeTermsConditions: false,
      AgreeCommunication: false,
    },
    validationSchema: yup.object({
      NomineeName: yup
        .string()
        .required("Nominee name is required")
        .matches(/^[A-Za-z\s]+$/, "Only letters allowed"),
      NomineeMobileNumber: yup
        .string()
        .required("Nominee mobile number is required")
        .matches(/^(\+91|0)?[6-9]\d{9}$/, "Enter valid 10-digit number"),
      NomineeAge: yup
        .number()
        .required("Nominee age is required")
        .positive("Must be greater than 0")
        .integer("No decimals allowed")
        .min(18, "Nominee must be at least 18 years old")
        .max(100, "Invalid age"),
      NomineeRelationship: yup
        .string()
        .required("Nominee relationship is required")
        .matches(/^[A-Za-z\s]+$/, "Only letters allowed"),
      NomineeAddress: yup
        .string()
        .required("Nominee address is required")
        .min(10, "Minimum 10 characters required"),
      AgreeTermsConditions: yup
        .boolean()
        .oneOf([true], "You must agree to terms and conditions"),
      AgreeCommunication: yup
        .boolean()
        .oneOf([true], "You must agree to communications"),
    }),
    onSubmit: async (values) => {
      const finalData = {
        name: formikStep1.values.Name,
        membership_id: formikStep1.values.membership_id,
        membership_receipt_no: formikStep1.values.MembershipReceiptNo || "",
        membershiptype: formikStep1.values.MembershipType,
        applicationno: String(formikStep1.values.ApplicationNumber),
        date: new Date(),
        MembershipDate: formikStep1.values.MembershipDate,
        membershipfees: String(formikStep1.values.MembershipFees),
        mobile: String(formikStep1.values.MobileNumber),
        email: formikStep1.values.Email,
        aadharnumber: formikStep2.values.AadharNumber.replace(/\s/g, ""),
        dob: formikStep2.values.DOB,
        father: formikStep2.values.FatherName,
        birthplace: formikStep2.values.BirthPlace,
        alternatemobile: String(formikStep2.values.AlternateMobileNumber),
        alternateemail: formikStep2.values.AlternateEmail,
        permanentaddress: formikStep2.values.PermanentAddress,
        correspondenceaddress: formikStep2.values.CorrespondenceAddress,
        nomineename: values.NomineeName,
        nomineenumber: String(values.NomineeMobileNumber),
        nomineeage: String(values.NomineeAge),
        nomineerelationship: values.NomineeRelationship,
        nomineeaddress: values.NomineeAddress,
        agreetermsconditions: values.AgreeTermsConditions,
        agreecommunication: values.AgreeCommunication,
      };

      try {
        const formData = new FormData();
        Object.entries(finalData).forEach(([key, value]) =>
          formData.append(key, value),
        );
        if (formikStep1.values.Image)
          formData.append("Image", formikStep1.values.Image);
        if (formikStep2.values.PanCard)
          formData.append("PanCard", formikStep2.values.PanCard);
        if (formikStep2.values.AadharCard)
          formData.append("AadharCard", formikStep2.values.AadharCard);
        if (formikStep2.values.ApplicationDoc)
          formData.append("ApplicationDoc", formikStep2.values.ApplicationDoc);

        const response = await axios.post(`${API_BASE}/add-members`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        console.log("Member added successfully:", response.data);
        toast.success("Member added successfully!");
        // Store member data for receipt generation
        setMemberReceiptData({
          name: formikStep1.values.Name,
          membership_id: formikStep1.values.membership_id,
          membershiptype: formikStep1.values.MembershipType,
          applicationno: formikStep1.values.ApplicationNumber,
          MembershipDate: formikStep1.values.MembershipDate,
          mobile: formikStep1.values.MobileNumber,
          email: formikStep1.values.Email,
          receiptNo: response.data?.data?.membership_receipt_no || "",
          date: new Date().toISOString().split("T")[0],
        });
        setIsFormCompleted(true);
        formikStep1.resetForm();
        formikStep2.resetForm();
        formikStep3.resetForm();
        setmembershipInput("");
        setCurrentStep(4); // Step 4 = success/receipt step
      } catch (error) {
        console.error("Error saving member:", error);
        if (error.response?.data?.message) {
          toast.error(`Error: ${error.response.data.message}`);
        } else {
          toast.error("Error adding member. Please try again.");
        }
      }
    },
  });

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) formikStep1.setFieldValue("Image", file);
  };

  const handleFileChange = (fieldName) => (e) => {
    const file = e.target.files[0];
    if (file) formikStep2.setFieldValue(fieldName, file);
  };

  const FileUploadField = ({
    label,
    fieldName,
    accept = "image/*,.pdf",
    formik,
  }) => (
    <div>
      <label className="block text-sm font-semibold text-gray-900 mb-2">
        {label}
      </label>
      <input
        type="file"
        id={fieldName}
        accept={accept}
        onChange={handleFileChange(fieldName)}
        className="hidden"
      />
      <label
        htmlFor={fieldName}
        className="flex items-center justify-between gap-3 border border-gray-300 px-4 py-2.5 w-full bg-white rounded text-sm cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-colors"
      >
        <span
          className={
            formik.values[fieldName]
              ? "text-gray-700 truncate"
              : "text-gray-400"
          }
        >
          {formik.values[fieldName]
            ? formik.values[fieldName].name
            : `Upload ${label}`}
        </span>
        <img
          src="/images/upload.svg"
          alt="upload"
          className="w-5 h-5 flex-shrink-0"
        />
      </label>
      {formik.values[fieldName] && (
        <div className="flex items-center justify-between mt-1">
          <span className="text-green-600 text-xs">✓ File selected</span>
          <button
            type="button"
            onClick={() => formik.setFieldValue(fieldName, null)}
            className="text-red-400 text-xs hover:text-red-600"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );

  const goToPreviousStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleNewMember = () => {
    setCurrentStep(1);
    setIsFormCompleted(false);
    setMemberReceiptData(null);
  };

  const handleGenerateMemberPDF = async () => {
    if (!memberReceiptData) return;
    setIsGeneratingMemberPDF(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { default: jsPDF } = await import("jspdf");
      const { createRoot } = await import("react-dom/client");

      // Render the same React receipt used in the preview into an off-screen
      // A4-width container, then place it with a small margin so the borders
      // never bleed off the page (mirrors the ReceiptForm PDF pipeline).
      const container = document.createElement("div");
      container.style.cssText =
        "position:fixed;left:-9999px;top:0;width:786px;background:#fff;padding:4px;margin:4px;box-sizing:border-box;";
      document.body.appendChild(container);
      const root = createRoot(container);
      await new Promise((resolve) => {
        root.render(<MemberReceiptContent data={memberReceiptData} />);
        setTimeout(resolve, 800);
      });

      const canvas = await html2canvas(container, {
        scale: 4,
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: "#ffffff",
        width: 794,
        x: -4,
        y: -4,
      });
      root.unmount();
      document.body.removeChild(container);

      const imgData = canvas.toDataURL("image/jpeg", 0.9);
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });
      // 1mm margin all round keeps the outer border inside the printable area.
      pdf.addImage(imgData, "JPEG", 1, 1, 208, 295);
      const filename = `Member_Receipt_${(memberReceiptData.membership_id || "").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Failed to generate PDF. Please try again.");
    }
    setIsGeneratingMemberPDF(false);
  };

  const MemberReceiptContent = ({ data }) => {
    if (!data) return null;
    const amountInWords = numberToWords(MEMBER_RECEIPT_TOTAL);
    return (
      <div
        style={{
          border: "2px solid #000000",
          backgroundColor: "#ffffff",
          padding: "20px",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            height: "150px",
            borderBottom: "2px solid #000000",
            paddingBottom: "15px",
            marginBottom: "16px",
            marginLeft: "-20px",
            marginRight: "-20px",
            paddingLeft: "10px",
            gap: "10px",
          }}
        >
          <div style={{ flexShrink: 0 }}>
            <img
              src="/images/bg-removed-logo.webp"
              alt="Logo"
              style={{ width: "160px", height: "140px", objectFit: "contain" }}
            />
          </div>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div
              style={{
                fontSize: "18px",
                fontWeight: "bold",
                marginBottom: "4px",
              }}
            >
              ದಿ ಗೃಹಕಲ್ಪ ಹೌಸಿಂಗ್ ಕೋ-ಆಪರೇಟಿವ್ ಸೊಸೈಟಿ ಲಿ.
            </div>
            <div
              style={{
                fontSize: "15px",
                fontWeight: "bold",
                marginBottom: "4px",
              }}
            >
              THE GRUHAKALPA HOUSING CO-OPERATIVE SOCIETY LTD.
            </div>
            <div style={{ fontSize: "11px", marginBottom: "2px" }}>
              Parinidhi #23, E Block, 14th A Main Road, 2nd Floor,Sahakaranagar,
              Bangalore - 560092
            </div>
            <div style={{ fontSize: "11px", marginBottom: "2px" }}>
              Reg. No.: JRB/RGN/CR-04/51586/2023-2024 Date: 21/11/23
            </div>
            <div style={{ fontSize: "11px" }}>
              <a
                href="https://www.gruhakalpahousingsociety.in"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "#000000", textDecoration: "none" }}
              >
                www.gruhakalpahousingsociety.in
              </a>
              {" / "}
              <a
                href="mailto:contact@gruhakalpahousingsociety.in"
                style={{ color: "#000000", textDecoration: "none" }}
              >
                Email: contact@gruhakalpahousingsociety.in
              </a>
            </div>
          </div>
          <div style={{ width: "80px", flexShrink: 0 }}></div>
        </div>
        <div style={{ textAlign: "center", paddingBottom: "8px" }}>
          <span
            style={{
              border: "2px solid #000000",
              fontWeight: "bold",
              fontSize: "14px",
              padding: "5px 10px 18px",
            }}
          >
            MEMBERSHIP RECEIPT
          </span>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "13px",
            fontWeight: "bold",
            marginTop: "8px",
            marginBottom: "6px",
          }}
        >
          <div>Receipt No.: {data.receiptNo || "-"}</div>
          <div>Date: {formatReceiptDate(data.date)}</div>
        </div>
        <div
          style={{
            fontSize: "13px",
            fontWeight: "bold",
            marginBottom: "16px",
          }}
        >
          <div>Membership ID: {data.membership_id || "-"}</div>
        </div>
        <div style={{ fontSize: "13px", marginBottom: "16px" }}>
          <div style={{ marginBottom: "4px" }}>
            <strong>Received From Smt./Shree: {data.name || "-"}</strong>
          </div>
          <div style={{ marginBottom: "4px" }}>
            <strong>Rupees: {amountInWords} Only.</strong>
          </div>
          <div style={{ marginBottom: "4px" }}>
            <strong>Membership Type: {data.membershiptype || "-"}</strong>
          </div>
          <div>
            <strong>Application No: {data.applicationno || "-"}</strong>
          </div>
        </div>
        <div style={{ marginBottom: "16px" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              border: "1px solid #000000",
              fontSize: "11px",
            }}
          >
            <thead>
              <tr>
                {[
                  "S.No",
                  "Payment Type",
                  "Payment Mode",
                  "Bank",
                  "Branch",
                  "Cheque/Transaction ID",
                  "Amount",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      border: "1px solid #000",
                      padding: "6px",
                      textAlign: "center",
                      fontWeight: "bold",
                      fontSize: "10px",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "6px",
                    textAlign: "center",
                  }}
                >
                  1
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "6px",
                    textAlign: "center",
                  }}
                >
                  Membership Fee
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "6px",
                    textAlign: "center",
                  }}
                >
                  Cash
                </td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "6px",
                    textAlign: "center",
                  }}
                ></td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "6px",
                    textAlign: "center",
                  }}
                ></td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "6px",
                    textAlign: "center",
                  }}
                ></td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "6px",
                    textAlign: "right",
                  }}
                >
                  Rs.{MEMBER_RECEIPT_TOTAL.toLocaleString("en-IN")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ marginBottom: "16px" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              border: "1px solid #000000",
              fontSize: "12px",
            }}
          >
            <thead>
              <tr>
                <th
                  colSpan="2"
                  style={{
                    border: "1px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                    width: "70%",
                    backgroundColor: "#f0f0f0",
                  }}
                >
                  Particulars
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                    width: "5%",
                    backgroundColor: "#f0f0f0",
                  }}
                >
                  L.F
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                    width: "20%",
                    backgroundColor: "#f0f0f0",
                  }}
                >
                  Rs.
                </th>
                <th
                  style={{
                    border: "1px solid #000",
                    padding: "8px",
                    textAlign: "center",
                    fontWeight: "bold",
                    width: "5%",
                    backgroundColor: "#f0f0f0",
                  }}
                >
                  P
                </th>
              </tr>
            </thead>
            <tbody>
              {MEMBER_RECEIPT_BREAKDOWN.map((item, idx) => (
                <tr key={idx}>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "8px",
                      textAlign: "center",
                      width: "5%",
                    }}
                  >
                    {idx + 1}.
                  </td>
                  <td style={{ border: "1px solid #000", padding: "8px" }}>
                    {item.name}
                  </td>
                  <td style={{ border: "1px solid #000", padding: "8px" }}></td>
                  <td
                    style={{
                      border: "1px solid #000",
                      padding: "8px",
                      textAlign: "center",
                    }}
                  >
                    Rs.{item.amount.toLocaleString("en-IN")}
                  </td>
                  <td style={{ border: "1px solid #000", padding: "8px" }}></td>
                </tr>
              ))}
              <tr style={{ fontWeight: "bold" }}>
                <td
                  colSpan="2"
                  style={{ border: "1px solid #000", padding: "8px" }}
                >
                  <strong>Total</strong>
                </td>
                <td style={{ border: "1px solid #000", padding: "8px" }}></td>
                <td
                  style={{
                    border: "1px solid #000",
                    padding: "8px",
                    textAlign: "center",
                  }}
                >
                  <strong>
                    Rs.{MEMBER_RECEIPT_TOTAL.toLocaleString("en-IN")}
                  </strong>
                </td>
                <td style={{ border: "1px solid #000", padding: "8px" }}></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div
          style={{
            fontSize: "11px",
            fontStyle: "italic",
            marginBottom: "32px",
          }}
        >
          *This is an official membership receipt. Please keep it for your
          records.
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: "13px",
            marginTop: "40px",
          }}
        >
          <div>Member's Signature</div>
          <div style={{ textAlign: "center" }}>
            <img
              src="/images/president-signature.webp"
              alt="President/Secretary Signature"
              style={{
                height: "55px",
                objectFit: "contain",
                marginBottom: "4px",
                display: "block",
                marginLeft: "auto",
                marginRight: "auto",
              }}
            />
            <div>President/Secretary</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <Header />
      <div className="w-full min-h-screen pl-20 mb-10">
        <div className="w-full max-w-4xl">
          <h1 className="font-semibold text-2xl pt-[50px] pb-[40px]">
            Add Member Form
          </h1>

          {/* ── Progress Stepper ── */}
          <div className="mb-12 relative max-w-[602px]">
            <div className="absolute w-[502px] top-6 left-12 right-0 h-[2px] bg-[#EF742C]" />
            <div
              className="absolute top-6 left-0 h-[2px] bg-[#EF742C] transition-all duration-500"
              style={{
                width:
                  currentStep === 1 ? "0%" : currentStep === 2 ? "0%" : "0%",
              }}
            />
            <div className="flex justify-between relative z-10">
              <div className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-lg transition-all duration-300 ${currentStep >= 1 ? "bg-[#EF742C] text-white" : "bg-gray-300 text-white"}`}
                >
                  {isFormCompleted || currentStep > 1 ? "✓" : "1"}
                </div>
                <span className="text-sm mt-2 font-semibold text-dark">
                  Membership Details
                </span>
              </div>
              <div className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-lg transition-all duration-300 ${currentStep >= 2 ? "bg-[#EF742C] text-white" : "bg-gray-300 text-white"}`}
                >
                  {isFormCompleted || currentStep > 2 ? "✓" : "2"}
                </div>
                <span className="text-sm mt-2 font-semibold text-dark">
                  Personal Details
                </span>
              </div>
              <div className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center font-semibold text-lg transition-all duration-300 ${currentStep >= 3 ? "bg-[#EF742C] text-white" : "bg-gray-300 text-white"}`}
                >
                  {isFormCompleted ? "✓" : "3"}
                </div>
                <span className="text-sm mt-2 font-semibold text-dark">
                  Nominee Details
                </span>
              </div>
            </div>
          </div>

          {/* ── Step 1 - Membership Details ── */}
          {currentStep === 1 && (
            <form
              onSubmit={formikStep1.handleSubmit}
              className="bg-[#EF742C]/10 rounded-xl p-[30px]"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="Name"
                    onChange={formikStep1.handleChange}
                    onBlur={formikStep1.handleBlur}
                    value={formikStep1.values.Name}
                    placeholder="Enter member name"
                    className="border border-gray-300 px-4 py-2.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm"
                  />
                  {formikStep1.touched.Name && formikStep1.errors.Name && (
                    <div className="text-red-500 text-xs mt-1">
                      {formikStep1.errors.Name}
                    </div>
                  )}
                </div>

                {/* Project Name */}
                {/* <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Project Name <span className="text-red-500">*</span>
                  </label>
                  <CustomSelect
                    options={projectOptions}
                    value={formikStep1.values.ProjectName}
                    onChange={(val) => formikStep1.setFieldValue("ProjectName", val)}
                    onBlur={() => formikStep1.setFieldTouched("ProjectName", true)}
                    placeholder="Select Project"
                  />
                  {formikStep1.touched.ProjectName && formikStep1.errors.ProjectName && (
                    <div className="text-red-500 text-xs mt-1">{formikStep1.errors.ProjectName}</div>
                  )}
                </div> */}

                {/* Seniority Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    MembershipId <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="membership_id"
                    placeholder="Enter MembershipId"
                    value={membershipInput}
                    onChange={handlemembershipInputChange}
                    // onBlur={formikStep1.handleBlur}
                    onBlur={() =>
                      formikStep1.setFieldTouched("membership_id", true)
                    }
                    className="border border-gray-300 px-4 py-2.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  {/* {fullmembershipid && (
                    <div className="text-green-600 text-sm mt-1 font-semibold">
                      Generated: {fullmembershipid}
                    </div>
                  )} */}
                  {formikStep1.touched.membership_id &&
                    formikStep1.errors.membership_id && (
                      <div className="text-red-500 text-xs mt-1">
                        {formikStep1.errors.membership_id}
                      </div>
                    )}
                </div>

                {/* Receipt Number (optional — auto-generated if left blank) */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Receipt No.
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    name="MembershipReceiptNo"
                    placeholder="Leave blank to auto-generate"
                    value={formikStep1.values.MembershipReceiptNo}
                    onChange={(e) =>
                      formikStep1.setFieldValue(
                        "MembershipReceiptNo",
                        e.target.value.replace(/\D/g, ""),
                      )
                    }
                    onBlur={() =>
                      formikStep1.setFieldTouched("MembershipReceiptNo", true)
                    }
                    className="border border-gray-300 px-4 py-2.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm"
                  />
                  {formikStep1.touched.MembershipReceiptNo &&
                    formikStep1.errors.MembershipReceiptNo && (
                      <div className="text-red-500 text-xs mt-1">
                        {formikStep1.errors.MembershipReceiptNo}
                      </div>
                    )}
                </div>

                {/* Membership Type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Membership Type <span className="text-red-500">*</span>
                  </label>
                  <CustomSelect
                    options={membershipTypeOptions}
                    value={formikStep1.values.MembershipType}
                    onChange={(val) =>
                      formikStep1.setFieldValue("MembershipType", val)
                    }
                    onBlur={() =>
                      formikStep1.setFieldTouched("MembershipType", true)
                    }
                    placeholder="Select Membership Type"
                  />
                  {formikStep1.touched.MembershipType &&
                    formikStep1.errors.MembershipType && (
                      <div className="text-red-500 text-xs mt-1">
                        {formikStep1.errors.MembershipType}
                      </div>
                    )}
                </div>

                {/* Application Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Application Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="ApplicationNumber"
                    onChange={formikStep1.handleChange}
                    onBlur={formikStep1.handleBlur}
                    value={formikStep1.values.ApplicationNumber}
                    placeholder="Enter Application No."
                    className="border border-gray-300 px-4 py-2.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm"
                  />
                  {formikStep1.touched.ApplicationNumber &&
                    formikStep1.errors.ApplicationNumber && (
                      <div className="text-red-500 text-xs mt-1">
                        {formikStep1.errors.ApplicationNumber}
                      </div>
                    )}
                </div>

                {/* Membership Date — CustomDatePicker */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Date of Membership <span className="text-red-500">*</span>
                  </label>
                  <CustomDatePicker
                    value={formikStep1.values.MembershipDate}
                    onChange={(val) =>
                      formikStep1.setFieldValue("MembershipDate", val)
                    }
                    onBlur={() =>
                      formikStep1.setFieldTouched("MembershipDate", true)
                    }
                    placeholder="Select Membership Date"
                  />
                  {formikStep1.touched.MembershipDate &&
                    formikStep1.errors.MembershipDate && (
                      <div className="text-red-500 text-xs mt-1">
                        {formikStep1.errors.MembershipDate}
                      </div>
                    )}
                </div>

                {/* Membership Fees */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Membership Fees <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      name="MembershipFees"
                      value={formikStep1.values.MembershipFees}
                      readOnly
                      placeholder="Auto-filled on type selection"
                      className="border border-gray-300 px-4 py-2.5 w-full bg-gray-50 text-gray-700 focus:outline-none rounded text-sm cursor-not-allowed"
                    />
                    {formikStep1.values.MembershipFees && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-600 text-xs font-semibold">
                        ₹
                        {Number(
                          formikStep1.values.MembershipFees,
                        ).toLocaleString("en-IN")}
                      </span>
                    )}
                  </div>
                  {!formikStep1.values.MembershipType && (
                    <p className="text-gray-400 text-xs mt-1">
                      Select a membership type to auto-fill fees
                    </p>
                  )}
                  {formikStep1.touched.MembershipFees &&
                    formikStep1.errors.MembershipFees && (
                      <div className="text-red-500 text-xs mt-1">
                        {formikStep1.errors.MembershipFees}
                      </div>
                    )}
                </div>

                {/* Mobile Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="MobileNumber"
                    onChange={formikStep1.handleChange}
                    onBlur={formikStep1.handleBlur}
                    value={formikStep1.values.MobileNumber}
                    placeholder="Enter Mobile No."
                    className="border border-gray-300 px-4 py-2.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm"
                  />
                  {formikStep1.touched.MobileNumber &&
                    formikStep1.errors.MobileNumber && (
                      <div className="text-red-500 text-xs mt-1">
                        {formikStep1.errors.MobileNumber}
                      </div>
                    )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="Email"
                    onChange={formikStep1.handleChange}
                    onBlur={formikStep1.handleBlur}
                    value={formikStep1.values.Email}
                    placeholder="Enter Member Email"
                    className="border border-gray-300 px-4 py-2.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm"
                  />
                  {formikStep1.touched.Email && formikStep1.errors.Email && (
                    <div className="text-red-500 text-xs mt-1">
                      {formikStep1.errors.Email}
                    </div>
                  )}
                </div>

                {/* Image Upload */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Image
                  </label>
                  <input
                    type="file"
                    id="imageUpload"
                    accept="image/*"
                    onChange={handleImageChange}
                    onBlur={formikStep1.handleBlur}
                    className="hidden"
                  />
                  <label
                    htmlFor="imageUpload"
                    className="flex items-center justify-between gap-3 border border-gray-300 px-4 py-2.5 w-full bg-white rounded text-sm cursor-pointer hover:bg-gray-50 hover:border-blue-400 transition-colors"
                  >
                    <span
                      className={
                        formikStep1.values.Image
                          ? "text-gray-700 truncate"
                          : "text-gray-400"
                      }
                    >
                      {formikStep1.values.Image
                        ? formikStep1.values.Image.name
                        : "Upload Image"}
                    </span>
                    <img src="/images/upload.svg" alt="upload" />
                  </label>
                  {formikStep1.values.Image && (
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-green-600 text-xs">
                        ✓ File selected
                      </span>
                      <button
                        type="button"
                        onClick={() => formikStep1.setFieldValue("Image", null)}
                        className="text-red-400 text-xs hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end mt-8">
                <button
                  type="submit"
                  className="bg-gradient-to-r from-orange-200 via-orange-500 to-orange-600 hover:opacity-90 text-white font-semibold px-12 py-2.5 rounded-full shadow-md hover:shadow-lg transition-all uppercase text-sm tracking-wide"
                >
                  Next
                </button>
              </div>
            </form>
          )}

          {/* ── Step 2 - Personal Details ── */}
          {currentStep === 2 && (
            <form
              onSubmit={formikStep2.handleSubmit}
              className="bg-[#EF742C]/10 rounded-xl p-[30px]"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {/* Aadhar Number */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Aadhar Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="AadharNumber"
                    onChange={formikStep2.handleChange}
                    onBlur={formikStep2.handleBlur}
                    value={formikStep2.values.AadharNumber}
                    placeholder="Enter Aadhar No."
                    className="border border-gray-300 px-4 py-2.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm"
                  />
                  {formikStep2.touched.AadharNumber &&
                    formikStep2.errors.AadharNumber && (
                      <div className="text-red-500 text-xs mt-1">
                        {formikStep2.errors.AadharNumber}
                      </div>
                    )}
                </div>

                {/* Date of Birth — CustomDatePicker */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Date of Birth <span className="text-red-500">*</span>
                  </label>
                  <CustomDatePicker
                    value={formikStep2.values.DOB}
                    onChange={(val) => formikStep2.setFieldValue("DOB", val)}
                    onBlur={() => formikStep2.setFieldTouched("DOB", true)}
                    placeholder="Select Date of Birth"
                    maxDate={(() => {
                      const d = new Date();
                      d.setFullYear(d.getFullYear() - 18);
                      return d.toISOString().split("T")[0];
                    })()}
                  />
                  {formikStep2.touched.DOB && formikStep2.errors.DOB && (
                    <div className="text-red-500 text-xs mt-1">
                      {formikStep2.errors.DOB}
                    </div>
                  )}
                </div>

                {/* Father Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Father / Husband Name{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="FatherName"
                    onChange={formikStep2.handleChange}
                    onBlur={formikStep2.handleBlur}
                    value={formikStep2.values.FatherName}
                    placeholder="Enter Spouse Name"
                    className="border border-gray-300 px-4 py-2.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm"
                  />
                  {formikStep2.touched.FatherName &&
                    formikStep2.errors.FatherName && (
                      <div className="text-red-500 text-xs mt-1">
                        {formikStep2.errors.FatherName}
                      </div>
                    )}
                </div>

                {/* Birth Place */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Birth Place
                  </label>
                  <input
                    type="text"
                    name="BirthPlace"
                    onChange={formikStep2.handleChange}
                    onBlur={formikStep2.handleBlur}
                    value={formikStep2.values.BirthPlace}
                    placeholder="Enter Birth Place"
                    className="border border-gray-300 px-4 py-2.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm"
                  />
                  {formikStep2.touched.BirthPlace &&
                    formikStep2.errors.BirthPlace && (
                      <div className="text-red-500 text-xs mt-1">
                        {formikStep2.errors.BirthPlace}
                      </div>
                    )}
                </div>

                {/* Alternate Mobile */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Alternate Mobile Number{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="AlternateMobileNumber"
                    onChange={formikStep2.handleChange}
                    onBlur={formikStep2.handleBlur}
                    value={formikStep2.values.AlternateMobileNumber}
                    placeholder="Enter Alternate Mobile No."
                    className="border border-gray-300 px-4 py-2.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm"
                  />
                  {formikStep2.touched.AlternateMobileNumber &&
                    formikStep2.errors.AlternateMobileNumber && (
                      <div className="text-red-500 text-xs mt-1">
                        {formikStep2.errors.AlternateMobileNumber}
                      </div>
                    )}
                </div>

                {/* Alternate Email */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Alternate Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="AlternateEmail"
                    onChange={formikStep2.handleChange}
                    onBlur={formikStep2.handleBlur}
                    value={formikStep2.values.AlternateEmail}
                    placeholder="Enter Alternate Email"
                    className="border border-gray-300 px-4 py-2.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm"
                  />
                  {formikStep2.touched.AlternateEmail &&
                    formikStep2.errors.AlternateEmail && (
                      <div className="text-red-500 text-xs mt-1">
                        {formikStep2.errors.AlternateEmail}
                      </div>
                    )}
                </div>

                {/* Permanent Address */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Permanent Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="PermanentAddress"
                    onChange={formikStep2.handleChange}
                    onBlur={formikStep2.handleBlur}
                    value={formikStep2.values.PermanentAddress}
                    placeholder="Enter Permanent Address"
                    className="border border-gray-300 px-4 py-2.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm"
                  />
                  {formikStep2.touched.PermanentAddress &&
                    formikStep2.errors.PermanentAddress && (
                      <div className="text-red-500 text-xs mt-1">
                        {formikStep2.errors.PermanentAddress}
                      </div>
                    )}
                </div>

                {/* Correspondence Address */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Correspondence Address{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="CorrespondenceAddress"
                    onChange={formikStep2.handleChange}
                    onBlur={formikStep2.handleBlur}
                    value={formikStep2.values.CorrespondenceAddress}
                    placeholder="Enter Correspondence Address"
                    className="border border-gray-300 px-4 py-2.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm"
                  />
                  {formikStep2.touched.CorrespondenceAddress &&
                    formikStep2.errors.CorrespondenceAddress && (
                      <div className="text-red-500 text-xs mt-1">
                        {formikStep2.errors.CorrespondenceAddress}
                      </div>
                    )}
                </div>

                <FileUploadField
                  label="PAN Card"
                  fieldName="PanCard"
                  accept="image/*,.pdf"
                  formik={formikStep2}
                />
                <FileUploadField
                  label="Aadhar Card"
                  fieldName="AadharCard"
                  accept="image/*,.pdf"
                  formik={formikStep2}
                />
                <div className="w-100">
                  <FileUploadField
                    label="Application Document"
                    fieldName="ApplicationDoc"
                    accept="image/*,.pdf"
                    formik={formikStep2}
                  />
                </div>
              </div>

              <div className="flex justify-end mt-8 gap-4">
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-12 py-2.5 rounded-full shadow-md hover:shadow-lg transition-all uppercase text-sm tracking-wide"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-orange-200 via-orange-500 to-orange-600 hover:opacity-90 text-white font-semibold px-12 py-2.5 rounded-full shadow-md hover:shadow-lg transition-all uppercase text-sm tracking-wide"
                >
                  Next
                </button>
              </div>
            </form>
          )}

          {/* ── Step 3 - Nominee Details ── */}
          {currentStep === 3 && (
            <form
              onSubmit={formikStep3.handleSubmit}
              className="bg-[#EF742C]/10 rounded-xl p-[30px]"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                {/* Nominee Name */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Nominee Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="NomineeName"
                    onChange={formikStep3.handleChange}
                    onBlur={formikStep3.handleBlur}
                    value={formikStep3.values.NomineeName}
                    placeholder="Enter Nominee Name"
                    className="border border-gray-300 px-4 py-2.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm"
                  />
                  {formikStep3.touched.NomineeName &&
                    formikStep3.errors.NomineeName && (
                      <div className="text-red-500 text-xs mt-1">
                        {formikStep3.errors.NomineeName}
                      </div>
                    )}
                </div>

                {/* Nominee Mobile */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Nominee Mobile Number{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="NomineeMobileNumber"
                    onChange={formikStep3.handleChange}
                    onBlur={formikStep3.handleBlur}
                    value={formikStep3.values.NomineeMobileNumber}
                    placeholder="Enter Nominee Mobile No."
                    className="border border-gray-300 px-4 py-2.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm"
                  />
                  {formikStep3.touched.NomineeMobileNumber &&
                    formikStep3.errors.NomineeMobileNumber && (
                      <div className="text-red-500 text-xs mt-1">
                        {formikStep3.errors.NomineeMobileNumber}
                      </div>
                    )}
                </div>

                {/* Nominee Age */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Nominee Age <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    name="NomineeAge"
                    onChange={formikStep3.handleChange}
                    onBlur={formikStep3.handleBlur}
                    value={formikStep3.values.NomineeAge}
                    placeholder="Enter Nominee Age"
                    className="border border-gray-300 px-4 py-2.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm"
                  />
                  {formikStep3.touched.NomineeAge &&
                    formikStep3.errors.NomineeAge && (
                      <div className="text-red-500 text-xs mt-1">
                        {formikStep3.errors.NomineeAge}
                      </div>
                    )}
                </div>

                {/* Nominee Relationship */}
                <div>
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Nominee Relationship <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="NomineeRelationship"
                    onChange={formikStep3.handleChange}
                    onBlur={formikStep3.handleBlur}
                    value={formikStep3.values.NomineeRelationship}
                    placeholder="Enter Nominee Relation"
                    className="border border-gray-300 px-4 py-2.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm"
                  />
                  {formikStep3.touched.NomineeRelationship &&
                    formikStep3.errors.NomineeRelationship && (
                      <div className="text-red-500 text-xs mt-1">
                        {formikStep3.errors.NomineeRelationship}
                      </div>
                    )}
                </div>

                {/* Nominee Address */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-gray-900 mb-2">
                    Nominee Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="NomineeAddress"
                    onChange={formikStep3.handleChange}
                    onBlur={formikStep3.handleBlur}
                    value={formikStep3.values.NomineeAddress}
                    placeholder="Enter Nominee Address"
                    className="border border-gray-300 px-4 py-2.5 w-full bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent rounded text-sm"
                  />
                  {formikStep3.touched.NomineeAddress &&
                    formikStep3.errors.NomineeAddress && (
                      <div className="text-red-500 text-xs mt-1">
                        {formikStep3.errors.NomineeAddress}
                      </div>
                    )}
                </div>

                {/* Agree Terms */}
                <div className="md:col-span-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      name="AgreeTermsConditions"
                      onChange={formikStep3.handleChange}
                      onBlur={formikStep3.handleBlur}
                      checked={formikStep3.values.AgreeTermsConditions}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">
                      I agree to the terms and conditions{" "}
                      <span className="text-red-500">*</span>
                    </span>
                  </label>
                  {formikStep3.touched.AgreeTermsConditions &&
                    formikStep3.errors.AgreeTermsConditions && (
                      <div className="text-red-500 text-xs mt-1">
                        {formikStep3.errors.AgreeTermsConditions}
                      </div>
                    )}
                </div>

                {/* Agree Communication */}
                <div className="md:col-span-2">
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      name="AgreeCommunication"
                      onChange={formikStep3.handleChange}
                      onBlur={formikStep3.handleBlur}
                      checked={formikStep3.values.AgreeCommunication}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">
                      I agree to receive communications{" "}
                      <span className="text-red-500">*</span>
                    </span>
                  </label>
                  {formikStep3.touched.AgreeCommunication &&
                    formikStep3.errors.AgreeCommunication && (
                      <div className="text-red-500 text-xs mt-1">
                        {formikStep3.errors.AgreeCommunication}
                      </div>
                    )}
                </div>
              </div>

              <div className="flex justify-end mt-8 gap-4">
                <button
                  type="button"
                  onClick={goToPreviousStep}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-12 py-2.5 rounded-full shadow-md hover:shadow-lg transition-all uppercase text-sm tracking-wide"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-orange-200 via-orange-500 to-orange-600 hover:opacity-90 text-white font-semibold px-12 py-2.5 rounded-full shadow-md hover:shadow-lg transition-all uppercase text-sm tracking-wide"
                >
                  Finish
                </button>
              </div>
            </form>
          )}

          {/* ── Step 4 - Success + Receipt ── */}
          {currentStep === 4 && (
            <div className="bg-[#EF742C]/10 rounded-xl p-[30px] text-center">
              <div className="flex flex-col items-center gap-6">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-10 h-10 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-green-700 mb-2">
                    Member Added Successfully!
                  </h2>
                  {memberReceiptData && (
                    <p className="text-gray-600 text-sm">
                      <strong>{memberReceiptData.name}</strong> — Membership ID:{" "}
                      <strong>{memberReceiptData.membership_id}</strong>
                    </p>
                  )}
                </div>
                <div className="bg-white rounded-xl border border-orange-200 p-5 w-full max-w-md shadow-sm">
                  <h3 className="font-semibold text-gray-800 mb-1 text-base">
                    Membership Receipt
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    Total:{" "}
                    <span className="font-bold text-[#EF742C]">₹2,500</span> —
                    Membership Fee (₹200) + Share Fee (₹200) + Share (₹2,000) +
                    Admission Fee (₹100)
                  </p>
                  <div className="flex justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowMemberReceiptModal(true)}
                      className="px-5 flex items-center gap-2 py-2.5 border-2 border-orange-500 text-orange-600 text-sm font-semibold rounded-full hover:bg-orange-50 transition-all duration-200"
                    >
                      <Eye size={17} /> Preview Receipt
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateMemberPDF}
                      disabled={isGeneratingMemberPDF}
                      className={`px-5 flex items-center gap-2 py-2.5 bg-gradient-to-r from-orange-200 via-orange-500 to-orange-600 text-white text-sm font-semibold rounded-full shadow-md hover:shadow-lg transition-all duration-200 ${isGeneratingMemberPDF ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      <Download size={17} />{" "}
                      {isGeneratingMemberPDF
                        ? "Generating..."
                        : "Download Receipt"}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleNewMember}
                  className="mt-2 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-10 py-2.5 rounded-full shadow-md hover:shadow-lg transition-all uppercase text-sm tracking-wide"
                >
                  Add Another Member
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Member Receipt Preview Modal ── */}
      {showMemberReceiptModal && memberReceiptData && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
          onClick={() => setShowMemberReceiptModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-[950px] max-h-[95vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-gray-800">
                  Membership Receipt Preview
                </span>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
                  Preview Only
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowMemberReceiptModal(false);
                    handleGenerateMemberPDF();
                  }}
                  disabled={isGeneratingMemberPDF}
                  className={`px-6 py-2 flex items-center gap-2 bg-gradient-to-r from-orange-200 via-orange-500 to-orange-600 text-white text-sm font-semibold rounded-full hover:opacity-90 transition ${isGeneratingMemberPDF ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <Download size={16} />{" "}
                  {isGeneratingMemberPDF ? "Generating..." : "Download PDF"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowMemberReceiptModal(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-lg font-bold"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-6 bg-gray-100">
              <div
                style={{
                  width: "210mm",
                  minHeight: "297mm",
                  margin: "0 auto",
                  backgroundColor: "#ffffff",
                  padding: "6px",
                  boxSizing: "border-box",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                }}
              >
                <MemberReceiptContent data={memberReceiptData} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export { AddMember };
export default AddMember;