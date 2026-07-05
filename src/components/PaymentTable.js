import axios from "axios";
import React, { useEffect, useRef, useState, useMemo } from "react";
import { ChevronDown, Check } from "lucide-react";

const API_BASE = process.env.REACT_APP_API_BASE || "https://gruhakalpa-api.skyupdigitalsolutions.workers.dev";

// ── Reusable Animated Dropdown ──
function AnimatedDropdown({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
  };

  const selectedLabel =
    value === "All" ? placeholder : value;

  return (
    <div className="relative w-[180px]" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-4 py-2 rounded-xl border bg-white transition-all duration-300 text-sm
          ${
            open
              ? "border-[#EF742C]"
              : "border-gray-300 hover:border-[#EF742C]"
          }`}
      >
        <span className={`font-medium truncate ${value === "All" ? "text-gray-400" : "text-gray-700"}`}>
          {selectedLabel}
        </span>
        <ChevronDown
          size={16}
          className={`ml-2 shrink-0 text-gray-500 transition-all duration-300 ${
            open ? "rotate-180 text-[#EF742C]" : ""
          }`}
        />
      </button>

      {/* Dropdown panel */}
      <div
        className={`absolute top-full left-0 mt-2 w-full origin-top rounded-2xl border border-gray-200 bg-white overflow-hidden z-50 transition-all duration-300 ease-out
          ${
            open
              ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
              : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
          }`}
      >
        <div className="max-h-56 overflow-y-auto">
          {options.map((opt, index) => (
            <button
              key={opt}
              onClick={() => handleSelect(opt)}
              style={{ animationDelay: `${index * 40}ms` }}
              className={`w-full flex items-center justify-between px-4 py-2 text-left text-sm transition-all duration-200
                ${
                  value === opt
                    ? " text-[#EF742C]"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
            >
              <span className="font-medium">{opt === "All" ? placeholder : opt}</span>
              {value === opt && <Check size={15} className="text-[#EF742C] shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PaymentTable() {
  const [tableData, setTableData]     = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode]   = useState("All");
  const [filterType, setFilterType]   = useState("All");

  const headers = [
    "Date",
    "Seniority No",
    "Name",
    "Project",
    "Payment Mode",
    "Payment Type",
    "Amount",
  ];

  useEffect(() => {
    axios
      .get(`${API_BASE}/receipts`)
      .then((response) => setTableData(response.data.data || []))
      .catch((err) => console.error("Unable to fetch the data!..", err));
  }, []);

  const paymentModes = useMemo(() => {
    const modes = [...new Set(tableData.map((r) => r.paymentmode).filter(Boolean))];
    return ["All", ...modes];
  }, [tableData]);

  const paymentTypes = useMemo(() => {
    const types = [...new Set(tableData.map((r) => r.paymenttype).filter(Boolean))];
    return ["All", ...types];
  }, [tableData]);

  const filteredData = useMemo(() => {
    return tableData.filter((receipt) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        (receipt.seniority_no || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMode =
        filterMode === "All" || receipt.paymentmode === filterMode;
      const matchesType =
        filterType === "All" || receipt.paymenttype === filterType;
      return matchesSearch && matchesMode && matchesType;
    });
  }, [tableData, searchQuery, filterMode, filterType]);

  const totalAmount = useMemo(
    () =>
      filteredData.reduce(
        (sum, r) => sum + Number(r.totalreceived ?? r.amountpaid ?? 0),
        0
      ),
    [filteredData]
  );

  const resetFilters = () => {
    setSearchQuery("");
    setFilterMode("All");
    setFilterType("All");
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" || filterMode !== "All" || filterType !== "All";

  return (
    <div className="w-full max-w-[1070px] mx-auto p-6">

      {/* ── Controls bar ── */}
      <div className="flex flex-wrap gap-2 mb-4 items-center">

        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <input
            type="text"
            placeholder="Search by Seniority No..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EF742C] focus:border-transparent"
          />
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* ── Animated Dropdown: Payment Mode ── */}
        <AnimatedDropdown
          value={filterMode}
          onChange={setFilterMode}
          options={paymentModes}
          placeholder="All Modes"
        />

        {/* ── Animated Dropdown: Payment Type ── */}
        <AnimatedDropdown
          value={filterType}
          onChange={setFilterType}
          options={paymentTypes}
          placeholder="All Types"
        />

        {/* Reset */}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="px-3 py-2 text-sm text-[#EF742C] border border-gray-100 rounded-lg bg-white transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {/* ── Summary bar ── */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-2 bg-orange-50 border border-purple-200 rounded-lg px-4 py-2">
          <span className="text-xs text-gray-500 font-medium">Records</span>
          <span className="text-sm font-bold text-[#EF742C]">{filteredData.length}</span>
        </div>
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2">
          <span className="text-xs text-gray-500 font-medium">Total Amount</span>
          <span className="text-sm font-bold text-green-700">₹{totalAmount.toLocaleString("en-IN")}</span>
        </div>
        {filterMode !== "All" && (
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2">
            <span className="text-xs text-gray-500 font-medium">Mode</span>
            <span className="text-sm font-bold text-blue-700">{filterMode}</span>
          </div>
        )}
        {filterType !== "All" && (
          <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2">
            <span className="text-xs text-gray-500 font-medium">Type</span>
            <span className="text-sm font-bold text-orange-700">{filterType}</span>
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-2xl shadow-[0_-2px_4px_-1px_rgba(0,0,0,0.1),0_4px_5px_-1px_rgba(0,0,0,0.1)]">
        <table className="w-full">
          <thead>
            <tr className="bg-[#EF742C]/90">
              {headers.map((header, index) => (
                <th key={index} className="px-6 py-4 text-center text-white font-semibold text-base tracking-wide">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white">
            {filteredData.map((receipt, rowIndex) => (
              <tr key={rowIndex} className="border-b border-gray-200 text-center transition-colors duration-200">
                <td className="px-6 py-4 text-gray-700 font-medium">
                  {receipt.date ? new Date(receipt.date).toLocaleDateString() : "-"}
                </td>
                <td className="px-6 py-4 text-gray-700 font-medium">{receipt.seniority_no || "-"}</td>
                <td className="px-6 py-4 text-gray-700 font-medium">{receipt.name || "-"}</td>
                <td className="px-6 py-4 text-gray-700 font-medium">{receipt.projectname || "-"}</td>
                <td className="px-6 py-4 text-gray-700 font-medium">{receipt.paymentmode || "-"}</td>
                <td className="px-6 py-4 text-gray-700 font-medium">{receipt.paymenttype || "-"}</td>
                <td className="px-6 py-4 text-gray-700 font-medium">
                  ₹{Number(receipt.totalreceived ?? receipt.amountpaid ?? 0).toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
          </tbody>

          {filteredData.length > 0 && (
            <tfoot>
              <tr className="bg-orange-50 border-t-2 border-[#EF742C]">
                <td colSpan={6} className="px-6 py-3 text-right font-bold text-[#EF742C] text-sm">
                  Total ({filteredData.length} {filteredData.length === 1 ? "record" : "records"})
                </td>
                <td className="px-6 py-3 text-center font-bold text-green-700 text-sm">
                  ₹{totalAmount.toLocaleString("en-IN")}
                </td>
              </tr>
            </tfoot>
          )}
        </table>

        {filteredData.length === 0 && (
          <div className="p-6 text-center text-gray-500">
            {hasActiveFilters ? "No receipts match the current filters." : "No receipts found."}
          </div>
        )}
      </div>
    </div>
  );
}