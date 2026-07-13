/* eslint-disable */
import axios from "axios";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Header } from "./Header";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3001";

const BANKS = ["Apex", "HDFC", "Cash", "BDCC"];

const MODES_OF_PAYMENT = [
  "Cash",
  "UPI",
  "Cheque",
  "Netbanking",
  "DD",
  "NEFT/RTGS",
];

// Head of account dropdown options. Edit this list to add / rename heads.
const HEAD_OF_ACCOUNTS = [
  "Cash Withdrawal",
  "Staff Salary",
  "Office Rent",
  "Water Bill",
  "Electricity Bill",
  "Assets",
  "Telephone & Communications",
  "Pantry Expenses",
  "Travel Allowance",
  "Site Advance",
  "Site Advance Refund",
  "Membership Fee",
  "Membership Fee Refund",
  "Fixed Deposit Booking",
  "Fixed Deposit Interest",
  "Bank Charges",
  "Office Cleaning Charges",
  "TDS Payments",
  "Developer Payments",
  "Software Expenses",
  "Cash Deposits",
  "FD From Member",
  "RD From Member",
  "Postal Charges",
  "Old Office Advance Returned",
  "Test Payment",
  "Pooja Items Expenses",
  "Stationery",
  "Internal Transfer",
  "Fixed Deposit Returned/Renewed",
  "Printing Charges",
  "Miscellaneous Exp",
  "Meeting Expenses",
  "Audit Fees",
  "IT Filing Fees",
  "GBM Expenditure",
  "Repair Charges",
  "Insurance",
  "Cheque Bouncing",
  "DTDC Charges",
  "RD Refund",
  "Members RD Interest Paid",
  "FD Refund",
  "Members FD Interest Paid",
  "Members RD Principal Amount Refund",
  "Members Loan",
  "FD Refund With Interest",
  "Courier Charges",
  "Members FD Principal Amount Refund",
  "Co-operative Department Charges",
];

const getToken = () =>
  localStorage.getItem("superAdminToken") || localStorage.getItem("adminToken");

const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` });

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

// Indian financial year: April 1 – March 31.
const getFinancialYear = (dateStr) => {
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1; // month 3 = April
  return `${startYear}-${startYear + 1}`;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

// A single blank line item in the multi-row entry form.
const emptyRow = () => ({
  description: "",
  modeOfPayment: "Cash",
  headOfAccount: "",
  bank: "Apex",
  credit: "",
  debit: "",
  transactionId: "",
});

export function BankStatement() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [bankFilter, setBankFilter] = useState("All");
  const [headFilter, setHeadFilter] = useState("All");
  const [financialYear, setFinancialYear] = useState("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Entry form (batch)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formDate, setFormDate] = useState(todayStr());
  const [rows, setRows] = useState([emptyRow()]);
  const [isSaving, setIsSaving] = useState(false);

  // Edit single row
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  // Opening balance (one row, one date, per-bank amounts)
  const [openingBalance, setOpeningBalance] = useState({
    date: null,
    Apex: 0,
    HDFC: 0,
    Cash: 0,
    BDCC: 0,
  });
  const [isOpeningOpen, setIsOpeningOpen] = useState(false);
  const [openingForm, setOpeningForm] = useState({
    date: todayStr(),
    Apex: "",
    HDFC: "",
    Cash: "",
    BDCC: "",
  });

  const bankDropdownRef = useRef(null);
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/bankstatement`, {
        headers: authHeaders(),
      });
      setEntries(res.data?.data || []);
    } catch (err) {
      console.error("Error fetching bank statement:", err);
      toast.error("Failed to load bank statement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const fetchOpening = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/bankstatement/opening`, {
        headers: authHeaders(),
      });
      const d = res.data?.data || {};
      setOpeningBalance({
        date: d.date || null,
        Apex: Number(d.Apex) || 0,
        HDFC: Number(d.HDFC) || 0,
        Cash: Number(d.Cash) || 0,
        BDCC: Number(d.BDCC) || 0,
      });
    } catch (err) {
      console.error("Error fetching opening balance:", err);
    }
  }, []);

  useEffect(() => {
    fetchOpening();
  }, [fetchOpening]);

  // Close bank filter dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bankDropdownRef.current && !bankDropdownRef.current.contains(e.target)) {
        setBankDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ---- Running closing balance (per bank, chronological) ----
  // Computed over the FULL dataset first, so date/FY/search filters never
  // corrupt the running balance shown in each row.
  const entriesWithBalance = useMemo(() => {
    const sorted = [...entries].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      if (da !== db) return da - db;
      return (a.serialNo || 0) - (b.serialNo || 0);
    });
    const running = {}; // per-bank running total
    // Each bank's running balance starts from its opening balance.
    BANKS.forEach((b) => (running[b] = Number(openingBalance[b]) || 0));
    return sorted.map((e) => {
      const bank = e.bank || "Apex";
      running[bank] =
        (running[bank] || 0) + (Number(e.credit) || 0) - (Number(e.debit) || 0);
      return { ...e, _closingBalance: running[bank] };
    });
  }, [entries, openingBalance]);

  // Current balance per bank + grand total (from the full dataset)
  const bankBalances = useMemo(() => {
    const totals = {};
    // Current balance per bank = opening balance + all movements.
    BANKS.forEach((b) => (totals[b] = Number(openingBalance[b]) || 0));
    entries.forEach((e) => {
      const b = e.bank || "Apex";
      totals[b] = (totals[b] || 0) + (Number(e.credit) || 0) - (Number(e.debit) || 0);
    });
    const grand = Object.values(totals).reduce((s, v) => s + v, 0);
    return { totals, grand };
  }, [entries, openingBalance]);

  const financialYears = useMemo(() => {
    const set = new Set();
    entries.forEach((e) => {
      const fy = e.date ? getFinancialYear(e.date) : null;
      if (fy) set.add(fy);
    });
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [entries]);

  const dateFilterActive = financialYear !== "All" || dateFrom || dateTo;

  // Apply all display filters, then show newest first.
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const out = entriesWithBalance.filter((e) => {
      if (bankFilter !== "All" && e.bank !== bankFilter) return false;

      if (headFilter !== "All" && e.headOfAccount !== headFilter) return false;

      if (financialYear !== "All" && getFinancialYear(e.date) !== financialYear)
        return false;

      if (dateFrom) {
        const f = new Date(dateFrom);
        f.setHours(0, 0, 0, 0);
        if (new Date(e.date) < f) return false;
      }
      if (dateTo) {
        const t = new Date(dateTo);
        t.setHours(23, 59, 59, 999);
        if (new Date(e.date) > t) return false;
      }

      if (q) {
        const haystack = [
          e.description,
          e.headOfAccount,
          e.transactionId,
          e.modeOfPayment,
          e.bank,
          String(e.serialNo || ""),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    // Newest first: sort by date desc, then serial desc
    out.sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      if (da !== db) return db - da;
      return (b.serialNo || 0) - (a.serialNo || 0);
    });
    return out;
  }, [entriesWithBalance, bankFilter, headFilter, financialYear, dateFrom, dateTo, searchQuery]);

  const filteredTotals = useMemo(() => {
    return filtered.reduce(
      (acc, e) => {
        acc.credit += Number(e.credit) || 0;
        acc.debit += Number(e.debit) || 0;
        return acc;
      },
      { credit: 0, debit: 0 },
    );
  }, [filtered]);

  // Net movement per bank across the currently filtered rows (credit − debit)
  const filteredBankTotals = useMemo(() => {
    const totals = {};
    BANKS.forEach((b) => (totals[b] = 0));
    filtered.forEach((e) => {
      const b = e.bank || "Apex";
      totals[b] = (totals[b] || 0) + (Number(e.credit) || 0) - (Number(e.debit) || 0);
    });
    return totals;
  }, [filtered]);

  const clearDateFilters = () => {
    setFinancialYear("All");
    setDateFrom("");
    setDateTo("");
  };

  // ---- Entry form handlers ----
  const openForm = () => {
    setFormDate(todayStr());
    setRows([emptyRow()]);
    setIsFormOpen(true);
  };

  const updateRow = (idx, field, value) => {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)),
    );
  };

  const addRow = () => setRows((prev) => [...prev, emptyRow()]);

  const removeRow = (idx) =>
    setRows((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));

  const handleSaveBatch = async () => {
    if (!formDate) {
      toast.error("Please choose a date");
      return;
    }
    const cleaned = rows
      .map((r) => ({
        ...r,
        credit: Number(r.credit) || 0,
        debit: Number(r.debit) || 0,
      }))
      .filter((r) => r.credit > 0 || r.debit > 0 || r.description.trim());

    if (cleaned.length === 0) {
      toast.error("Add at least one record with a credit, debit or description");
      return;
    }
    const bad = cleaned.find((r) => r.credit === 0 && r.debit === 0);
    if (bad) {
      toast.error("Each record needs a credit or a debit amount");
      return;
    }

    const records = cleaned.map((r) => ({ ...r, date: formDate }));

    setIsSaving(true);
    try {
      await axios.post(
        `${API_BASE}/bankstatement`,
        { records },
        { headers: authHeaders() },
      );
      toast.success(
        `${records.length} record${records.length > 1 ? "s" : ""} added`,
      );
      setIsFormOpen(false);
      setRows([emptyRow()]);
      fetchEntries();
    } catch (err) {
      console.error("Error saving bank statement:", err);
      toast.error(err.response?.data?.message || "Failed to save records");
    } finally {
      setIsSaving(false);
    }
  };

  // ---- Edit / delete handlers ----
  const startEdit = (e) => {
    setEditingId(e._id);
    setEditForm({
      date: e.date ? new Date(e.date).toISOString().slice(0, 10) : todayStr(),
      description: e.description || "",
      modeOfPayment: e.modeOfPayment || "Cash",
      headOfAccount: e.headOfAccount || "",
      bank: e.bank || "Apex",
      credit: e.credit || 0,
      debit: e.debit || 0,
      transactionId: e.transactionId || "",
    });
  };

  const handleUpdate = async () => {
    if (!editForm) return;
    setIsSaving(true);
    try {
      await axios.put(
        `${API_BASE}/bankstatement/${editingId}`,
        {
          ...editForm,
          credit: Number(editForm.credit) || 0,
          debit: Number(editForm.debit) || 0,
        },
        { headers: authHeaders() },
      );
      toast.success("Record updated");
      setEditingId(null);
      setEditForm(null);
      fetchEntries();
    } catch (err) {
      console.error("Error updating record:", err);
      toast.error(err.response?.data?.message || "Failed to update record");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this record? The running balance will be recalculated.")) return;
    try {
      await axios.delete(`${API_BASE}/bankstatement/${id}`, {
        headers: authHeaders(),
      });
      toast.success("Record deleted");
      fetchEntries();
    } catch (err) {
      console.error("Error deleting record:", err);
      toast.error("Failed to delete record");
    }
  };
  // Delete is intentionally not exposed in the UI — records are edit-only.
  // The handler above is retained for potential future/admin use.
  void handleDelete;

  // ---- Opening balance handlers ----
  const openOpeningModal = () => {
    setOpeningForm({
      date: openingBalance.date
        ? new Date(openingBalance.date).toISOString().slice(0, 10)
        : todayStr(),
      Apex: openingBalance.Apex || "",
      HDFC: openingBalance.HDFC || "",
      Cash: openingBalance.Cash || "",
      BDCC: openingBalance.BDCC || "",
    });
    setIsOpeningOpen(true);
  };

  const handleSaveOpening = async () => {
    if (!openingForm.date) {
      toast.error("Please choose an opening balance date");
      return;
    }
    setIsSaving(true);
    try {
      await axios.put(
        `${API_BASE}/bankstatement/opening`,
        {
          date: openingForm.date,
          Apex: Number(openingForm.Apex) || 0,
          HDFC: Number(openingForm.HDFC) || 0,
          Cash: Number(openingForm.Cash) || 0,
          BDCC: Number(openingForm.BDCC) || 0,
        },
        { headers: authHeaders() },
      );
      toast.success("Opening balance saved");
      setIsOpeningOpen(false);
      fetchOpening();
      fetchEntries();
    } catch (err) {
      console.error("Error saving opening balance:", err);
      toast.error(err.response?.data?.message || "Failed to save opening balance");
    } finally {
      setIsSaving(false);
    }
  };

  const openingTotal = BANKS.reduce(
    (s, b) => s + (Number(openingBalance[b]) || 0),
    0,
  );

  const inputCls =
    "px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#EF742C] focus:border-transparent";

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <div className="px-[50px] pt-[50px]">
        <div className="flex justify-between items-center mb-4">
          <h1 className="font-semibold text-[24px]">Bank Statement</h1>

          <div className="flex items-center gap-3">
            {/* Bank filter */}
            <div className="relative" ref={bankDropdownRef}>
              <button
                onClick={() => setBankDropdownOpen((p) => !p)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                  bankFilter !== "All"
                    ? "bg-[#EF742C] text-white border-[#EF742C]"
                    : "bg-white text-gray-700 border-gray-300 hover:border-[#EF742C] hover:text-[#EF742C]"
                }`}
              >
                Bank: {bankFilter}
                <svg
                  className={`w-4 h-4 transition-transform ${bankDropdownOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {bankDropdownOpen && (
                <div className="absolute right-0 mt-2 w-[220px] bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  {["All", ...BANKS].map((b) => (
                    <button
                      key={b}
                      onClick={() => {
                        setBankFilter(b);
                        setBankDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 text-sm border-b border-gray-100 last:border-b-0 transition-colors ${
                        bankFilter === b
                          ? "bg-orange-50 text-[#EF742C] font-semibold"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span>{b === "All" ? "All Banks" : b}</span>
                      {b !== "All" && (
                        <span className="text-xs font-bold text-gray-400">
                          {inr(bankBalances.totals[b])}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search */}
            <div className="relative w-[280px]">
              <input
                type="text"
                placeholder="Search description, head"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EF742C] focus:border-transparent"
              />
              {searchQuery ? (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              ) : (
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
            </div>

            {/* Opening balance */}
            <button
              onClick={openOpeningModal}
              className="flex items-center gap-2 px-4 py-2 border border-[#EF742C] text-[#EF742C] rounded-lg text-sm font-semibold hover:bg-orange-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Opening Balance
            </button>

            {/* Add button */}
            <button
              onClick={openForm}
              className="flex items-center gap-2 px-4 py-2 bg-[#EF742C] text-white rounded-lg text-sm font-semibold hover:bg-[#d9631f] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Entry
            </button>
          </div>
        </div>

        {/* Bank balance summary cards */}
        {/* <div className="flex flex-wrap gap-3 mb-4">
          {BANKS.map((b) => (
            <div key={b} className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{b}</p>
              <p className={`text-sm font-bold ${bankBalances.totals[b] < 0 ? "text-red-600" : "text-gray-800"}`}>
                {inr(bankBalances.totals[b])}
              </p>
            </div>
          ))}
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-4 py-2 ml-auto">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Balance</p>
            <p className="text-sm font-bold text-[#EF742C]">{inr(bankBalances.grand)}</p>
          </div>
        </div> */}

        {/* Financial year + date range */}
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Head of Account</label>
            <select
              value={headFilter}
              onChange={(e) => setHeadFilter(e.target.value)}
              className={`px-4 py-2 border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#EF742C] focus:border-transparent cursor-pointer max-w-[240px] ${
                headFilter !== "All" ? "border-[#EF742C] text-[#EF742C]" : "border-gray-300 text-gray-700"
              }`}
            >
              <option value="All">All Heads</option>
              {HEAD_OF_ACCOUNTS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Financial Year</label>
            <select
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
              className={`px-4 py-2 border rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#EF742C] focus:border-transparent cursor-pointer ${
                financialYear !== "All" ? "border-[#EF742C] text-[#EF742C]" : "border-gray-300 text-gray-700"
              }`}
            >
              <option value="All">All Years</option>
              {financialYears.map((fy) => (
                <option key={fy} value={fy}>{fy}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">From</label>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className={`px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#EF742C] focus:border-transparent ${
                dateFrom ? "border-[#EF742C] text-[#EF742C]" : "border-gray-300 text-gray-700"
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">To</label>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className={`px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#EF742C] focus:border-transparent ${
                dateTo ? "border-[#EF742C] text-[#EF742C]" : "border-gray-300 text-gray-700"
              }`}
            />
          </div>

          {dateFilterActive && (
            <button
              onClick={clearDateFilters}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-500 border border-gray-300 rounded-lg hover:border-red-400 hover:text-red-500 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear dates
            </button>
          )}

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
              <span className="text-xs text-gray-500 font-medium">Credit:</span>
              <span className="text-sm font-bold text-green-700">{inr(filteredTotals.credit)}</span>
            </div>
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
              <span className="text-xs text-gray-500 font-medium">Debit:</span>
              <span className="text-sm font-bold text-red-600">{inr(filteredTotals.debit)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="w-full max-w-[1500px] mx-auto px-6 pb-10">
        <div className="overflow-x-auto rounded-2xl shadow-lg">
          <table className="w-full min-w-[1200px] border-collapse [&_th]:border [&_th]:border-[#f3936a] [&_td]:border [&_td]:border-gray-200">
            <thead>
              <tr className="bg-[#EF742C]">
                {[
                  "S.No",
                  "Date",
                  "Description",
                  "Mode",
                  "Head of Account",
                  "Apex",
                  "HDFC",
                  "Cash",
                  "BDCC",
                  "Closing Balance",
                  "Transaction ID",
                  "Actions",
                ].map((h) => (
                  <th key={h} className="px-4 py-4 text-center text-white font-semibold text-sm tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {/* Opening balance row — pinned first. Shows each bank's opening
                  amount; combined total when viewing all banks, or the selected
                  bank's opening when a bank filter is applied. */}
              <tr className="bg-amber-50 text-center font-medium">
                <td className="px-4 py-3 text-gray-400">—</td>
                <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                  {openingBalance.date
                    ? new Date(openingBalance.date).toLocaleDateString("en-IN")
                    : "-"}
                </td>
                <td className="px-4 py-3 text-left font-semibold text-gray-800">
                  Opening Balance
                </td>
                <td className="px-4 py-3 text-gray-300">-</td>
                <td className="px-4 py-3 text-left text-gray-300">-</td>
                {BANKS.map((b) => {
                  const show = bankFilter === "All" || bankFilter === b;
                  const val = Number(openingBalance[b]) || 0;
                  return (
                    <td key={b} className="px-4 py-3 font-semibold whitespace-nowrap">
                      {show && val !== 0 ? (
                        <span className="text-gray-800">{inr(val)}</span>
                      ) : (
                        <span className="text-gray-300">-</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3 font-bold text-[#EF742C] whitespace-nowrap">
                  {bankFilter === "All"
                    ? inr(openingTotal)
                    : inr(Number(openingBalance[bankFilter]) || 0)}
                </td>
                <td className="px-4 py-3 text-gray-300">-</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <div className="flex items-center justify-center">
                    <button
                      onClick={openOpeningModal}
                      className="text-blue-600 hover:text-blue-800"
                      title="Edit opening balance"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>

              {filtered.map((e) => {
                const rowBank = e.bank || "Apex";
                const credit = Number(e.credit) || 0;
                const debit = Number(e.debit) || 0;
                return (
                  <tr key={e._id} className="border-b border-gray-200 text-center hover:bg-orange-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700 font-medium">{e.serialNo ?? "-"}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                      {e.date ? new Date(e.date).toLocaleDateString("en-IN") : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-left max-w-[220px]">{e.description || "-"}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{e.modeOfPayment || "-"}</td>
                    <td className="px-4 py-3 text-gray-700 text-left">{e.headOfAccount || "-"}</td>

                    {/* One column per bank — the amount lands under this row's bank.
                        Green = credit (money in), red with minus = debit (money out). */}
                    {BANKS.map((b) => {
                      const isThisBank = rowBank === b && (credit > 0 || debit > 0);
                      return (
                        <td key={b} className="px-4 py-3 font-medium whitespace-nowrap">
                          {isThisBank ? (
                            credit > 0 ? (
                              <span className="text-green-700">{inr(credit)}</span>
                            ) : (
                              <span className="text-red-600">-{inr(debit)}</span>
                            )
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                      );
                    })}

                    <td className={`px-4 py-3 font-semibold whitespace-nowrap ${e._closingBalance < 0 ? "text-red-600" : "text-gray-800"}`}>
                      {inr(e._closingBalance)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{e.transactionId || "-"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => startEdit(e)} className="text-blue-600 hover:text-blue-800" title="Edit">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                {/* Net movement of the filtered rows, per bank */}
                {/* <tr className="bg-orange-50 border-t-2 border-[#EF742C]">
                  <td colSpan={5} className="px-4 py-3 text-right font-bold text-[#EF742C] text-sm">
                    Filtered Net&nbsp;({filtered.length} {filtered.length === 1 ? "record" : "records"})
                  </td>
                  {BANKS.map((b) => (
                    <td key={b} className={`px-4 py-3 text-center font-bold text-sm ${filteredBankTotals[b] < 0 ? "text-red-600" : "text-gray-700"}`}>
                      {inr(filteredBankTotals[b])}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center font-bold text-[#EF742C] text-sm">
                    {inr(Object.values(filteredBankTotals).reduce((s, v) => s + v, 0))}
                  </td>
                  <td colSpan={2}></td>
                </tr> */}
                {/* Overall closing balance per bank (all records, not just filtered) */}
                <tr className="bg-white border-t border-gray-200">
                  <td colSpan={5} className="px-4 py-3 text-right font-bold text-gray-800 text-sm">
                    Closing Balance (all records)
                  </td>
                  {BANKS.map((b) => (
                    <td key={b} className={`px-4 py-3 text-center font-bold text-sm ${bankBalances.totals[b] < 0 ? "text-red-600" : "text-gray-800"}`}>
                      {inr(bankBalances.totals[b])}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-center font-bold text-green-700 text-sm">
                    {inr(bankBalances.grand)}
                  </td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            )}
          </table>

          {!loading && filtered.length === 0 && (
            <div className="p-6 text-center text-gray-500">
              {searchQuery || bankFilter !== "All" || headFilter !== "All" || dateFilterActive
                ? "No records match the current filters."
                : "No bank statement records yet. Click “Add Entry” to begin."}
            </div>
          )}
          {loading && <div className="p-6 text-center text-gray-500">Loading…</div>}
        </div>
      </div>

      {/* ---- Batch entry modal ---- */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-[100] overflow-y-auto py-10 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[1150px]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-xl font-semibold text-gray-800">Add Bank Statement Entries</h2>
              <button onClick={() => setIsFormOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <div className="mb-5">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className={inputCls}
                />
                <p className="text-xs text-gray-400 mt-1">
                  Add one or more transactions for this date.
                </p>
              </div>

              <div className="space-y-3">
                {rows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-start bg-gray-50 border border-gray-200 rounded-xl p-3">
                    <div className="col-span-12 md:col-span-3">
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">Description</label>
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) => updateRow(idx, "description", e.target.value)}
                        className={`${inputCls} w-full`}
                        placeholder="Narration"
                      />
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">Mode</label>
                      <select value={row.modeOfPayment} onChange={(e) => updateRow(idx, "modeOfPayment", e.target.value)} className={`${inputCls} w-full`}>
                        {MODES_OF_PAYMENT.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-6 md:col-span-2">
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">Head of Account</label>
                      <select value={row.headOfAccount} onChange={(e) => updateRow(idx, "headOfAccount", e.target.value)} className={`${inputCls} w-full`}>
                        <option value="">— Select —</option>
                        {HEAD_OF_ACCOUNTS.map((h) => (
                          <option key={h} value={h}>{h}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-4 md:col-span-1">
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">Bank</label>
                      <select value={row.bank} onChange={(e) => updateRow(idx, "bank", e.target.value)} className={`${inputCls} w-full`}>
                        {BANKS.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-4 md:col-span-1">
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">Credit</label>
                      <input type="number" min="0" value={row.credit} onChange={(e) => updateRow(idx, "credit", e.target.value)} className={`${inputCls} w-full`} placeholder="0" />
                    </div>
                    <div className="col-span-4 md:col-span-1">
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">Debit</label>
                      <input type="number" min="0" value={row.debit} onChange={(e) => updateRow(idx, "debit", e.target.value)} className={`${inputCls} w-full`} placeholder="0" />
                    </div>
                    <div className="col-span-10 md:col-span-1">
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">Txn ID</label>
                      <input type="text" value={row.transactionId} onChange={(e) => updateRow(idx, "transactionId", e.target.value)} className={`${inputCls} w-full`} placeholder="—" />
                    </div>
                    <div className="col-span-2 md:col-span-1 flex items-end justify-center h-full pb-1">
                      <button
                        onClick={() => removeRow(idx)}
                        disabled={rows.length === 1}
                        className={`p-2 rounded-lg ${rows.length === 1 ? "text-gray-300 cursor-not-allowed" : "text-red-500 hover:bg-red-50"}`}
                        title="Remove row"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={addRow}
                className="mt-4 flex items-center gap-2 px-4 py-2 border border-dashed border-[#EF742C] text-[#EF742C] rounded-lg text-sm font-medium hover:bg-orange-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add another record
              </button>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={() => setIsFormOpen(false)} className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={handleSaveBatch}
                disabled={isSaving}
                className="px-6 py-2 bg-[#EF742C] text-white rounded-lg text-sm font-semibold hover:bg-[#d9631f] disabled:opacity-60"
              >
                {isSaving ? "Saving…" : "Save Entries"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- Edit single record modal ---- */}
      {editingId && editForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[560px]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">Edit Record</h2>
              <button onClick={() => { setEditingId(null); setEditForm(null); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 grid grid-cols-2 gap-4">
              <div className="col-span-1">
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Date</label>
                <input type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} className={`${inputCls} w-full`} />
              </div>
              <div className="col-span-1">
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Bank</label>
                <select value={editForm.bank} onChange={(e) => setEditForm({ ...editForm, bank: e.target.value })} className={`${inputCls} w-full`}>
                  {BANKS.map((b) => (<option key={b} value={b}>{b}</option>))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Description</label>
                <input type="text" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className={`${inputCls} w-full`} />
              </div>
              <div className="col-span-1">
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Mode</label>
                <select value={editForm.modeOfPayment} onChange={(e) => setEditForm({ ...editForm, modeOfPayment: e.target.value })} className={`${inputCls} w-full`}>
                  {MODES_OF_PAYMENT.map((m) => (<option key={m} value={m}>{m}</option>))}
                </select>
              </div>
              <div className="col-span-1">
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Head of Account</label>
                <select value={editForm.headOfAccount} onChange={(e) => setEditForm({ ...editForm, headOfAccount: e.target.value })} className={`${inputCls} w-full`}>
                  <option value="">— Select —</option>
                  {HEAD_OF_ACCOUNTS.map((h) => (<option key={h} value={h}>{h}</option>))}
                </select>
              </div>
              <div className="col-span-1">
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Credit</label>
                <input type="number" min="0" value={editForm.credit} onChange={(e) => setEditForm({ ...editForm, credit: e.target.value })} className={`${inputCls} w-full`} />
              </div>
              <div className="col-span-1">
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Debit</label>
                <input type="number" min="0" value={editForm.debit} onChange={(e) => setEditForm({ ...editForm, debit: e.target.value })} className={`${inputCls} w-full`} />
              </div>
              <div className="col-span-2">
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">Transaction ID</label>
                <input type="text" value={editForm.transactionId} onChange={(e) => setEditForm({ ...editForm, transactionId: e.target.value })} className={`${inputCls} w-full`} />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={() => { setEditingId(null); setEditForm(null); }} className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleUpdate} disabled={isSaving} className="px-6 py-2 bg-[#EF742C] text-white rounded-lg text-sm font-semibold hover:bg-[#d9631f] disabled:opacity-60">
                {isSaving ? "Saving…" : "Update"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ---- Opening balance modal ---- */}
      {isOpeningOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[100] px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[520px]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-800">Opening Balance</h2>
              <button onClick={() => setIsOpeningOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="mb-4">
                <label className="block text-[11px] font-semibold text-gray-500 mb-1 uppercase tracking-wide">As of Date</label>
                <input
                  type="date"
                  value={openingForm.date}
                  onChange={(e) => setOpeningForm({ ...openingForm, date: e.target.value })}
                  className={`${inputCls} w-full`}
                />
              </div>
              <p className="text-xs text-gray-400 mb-3">
                Enter the opening balance for each bank. They combine into the total,
                and filtering by a bank shows only that bank's opening balance.
              </p>
              <div className="grid grid-cols-2 gap-4">
                {BANKS.map((b) => (
                  <div key={b} className="col-span-1">
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">{b}</label>
                    <input
                      type="number"
                      value={openingForm[b]}
                      onChange={(e) => setOpeningForm({ ...openingForm, [b]: e.target.value })}
                      className={`${inputCls} w-full`}
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-4 py-2">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Combined Total</span>
                <span className="text-sm font-bold text-[#EF742C]">
                  {inr(BANKS.reduce((s, b) => s + (Number(openingForm[b]) || 0), 0))}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={() => setIsOpeningOpen(false)} className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={handleSaveOpening} disabled={isSaving} className="px-6 py-2 bg-[#EF742C] text-white rounded-lg text-sm font-semibold hover:bg-[#d9631f] disabled:opacity-60">
                {isSaving ? "Saving…" : "Save Opening Balance"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BankStatement;