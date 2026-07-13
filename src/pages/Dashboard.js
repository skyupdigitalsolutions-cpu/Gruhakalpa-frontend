/* eslint-disable */
import { useEffect, useRef, useState } from "react";
import axiosInstance from "../api/axios";
import { Header } from "../components/Header";
import BookingOverview from "../components/BookingOverview";
import PaymentTable from "../components/PaymentTable";
import { UpcomingPaymentsWidget } from "../components/UpcomingPaymentsWidget";
import { ChevronDown, Check } from "lucide-react";

export function Dashboard() {
  const [totalMembers, SetTotalMembers] = useState(0);
  const [totalsitebookings, SetTotalSiteBookings] = useState(0);
  const [totalreceipts, SetTotalReceipts] = useState(0);
  const [totalamount, SetTotalAmout] = useState(0);

  const [totalmonthlymembers, SetTotalMonthlyMembers] = useState([]);
  const [totalmonthlysitebookings, SetTotalMonthlySiteBookings] = useState([]);
  const [totalmonthlyreceipts, SetTotalMonthlyReceipts] = useState([]);
  const [totalmonthlyamount, SetTotalMonthlyAmount] = useState([]);

  const [selectedMonth, setSelectedMonth] = useState("all");
  const [availableMonths, setAvailableMonths] = useState([]);
  const [totalBookedAmount, setTotalBookedAmount] = useState(0);
  const [totalPaidAmount, setTotalPaidAmount] = useState(0);
  const [totalPenalty, setTotalPenalty] = useState(0);
  const [cancelledCount, setCancelledCount] = useState(0);

  // ── Animated dropdown state ──
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleSelect = (value) => {
    setSelectedMonth(value);
    setOpen(false);
  };

  // ── Existing helpers ──
  const groupByMonthly = (data, amountField = null) => {
    const monthlyData = {};

    data.forEach((item) => {
      const dateValue =
        item.createdAt ||
        item.date ||
        item.created_at ||
        item.bookingDate ||
        item.receiptDate;

      if (!dateValue) {
        console.warn("No date field found for item:", item);
        return;
      }

      const date = new Date(dateValue);

      if (isNaN(date.getTime())) {
        console.warn("Invalid date:", dateValue, "for item:", item);
        return;
      }

      const monthYear = `${date.getFullYear()}-${String(
        date.getMonth() + 1,
      ).padStart(2, "0")}`;

      if (!monthlyData[monthYear]) {
        monthlyData[monthYear] = { month: monthYear, count: 0, amount: 0 };
      }

      monthlyData[monthYear].count++;

      if (amountField) {
        monthlyData[monthYear].amount += Number(item[amountField] || 0);
      }
    });

    return Object.values(monthlyData).sort((a, b) =>
      a.month.localeCompare(b.month),
    );
  };

  const getAllUniqueMonths = () => {
    const months = new Set();
    totalmonthlymembers.forEach(
      (item) => item?.month && months.add(item.month),
    );
    totalmonthlysitebookings.forEach(
      (item) => item?.month && months.add(item.month),
    );
    totalmonthlyamount.forEach((item) => item?.month && months.add(item.month));
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  };

  const getFilteredData = () => {
    if (selectedMonth === "all") {
      return {
        members: totalMembers,
        bookings: totalsitebookings,
        receipts: totalreceipts,
        amount: totalamount,
      };
    }

    const memberData = totalmonthlymembers.find(
      (item) => item.month === selectedMonth,
    );
    const bookingData = totalmonthlysitebookings.find(
      (item) => item.month === selectedMonth,
    );
    const receiptData = totalmonthlyamount.find(
      (item) => item.month === selectedMonth,
    );

    return {
      members: memberData?.count || 0,
      bookings: bookingData?.count || 0,
      receipts: receiptData?.count || 0,
      amount: receiptData?.amount || 0,
    };
  };

  const getInvoiceStats = () => {
    if (selectedMonth === "all") {
      const overdue = Math.max(totalBookedAmount - totalPaidAmount, 0);
      return { total: totalBookedAmount, paid: totalPaidAmount, overdue };
    }

    const bookingMonth = totalmonthlysitebookings.find(
      (x) => x.month === selectedMonth,
    );
    const receiptMonth = totalmonthlyreceipts.find(
      (x) => x.month === selectedMonth,
    );

    const total = Number(bookingMonth?.amount || 0);
    const paid = Number(receiptMonth?.amount || 0);
    const overdue = Math.max(total - paid, 0);

    return { total, paid, overdue };
  };

  const formatMonthDisplay = (monthString) => {
    if (monthString === "all") return "All Time";
    if (!monthString || !monthString.match(/^\d{4}-\d{2}$/))
      return "Invalid Date";

    const [year, month] = monthString.split("-");
    const date = new Date(year, month - 1);

    if (isNaN(date.getTime())) return "Invalid Date";

    return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  // ── Data fetching ──
  useEffect(() => {
    axiosInstance
      .get("/members")
      .then((response) => {
        const members = response.data.data || [];
        SetTotalMembers(members.length);
        SetTotalMonthlyMembers(groupByMonthly(members));
        console.log("✅ Members fetched:", members.length);
      })
      .catch((error) => console.error("❌ Error fetching Members:", error));
  }, []);

  useEffect(() => {
    axiosInstance
      .get("/sitebookings")
      .then((response) => {
        const bookings = response.data || [];
        SetTotalSiteBookings(bookings.length);
        SetTotalMonthlySiteBookings(groupByMonthly(bookings, "totalamount"));
        setTotalBookedAmount(
          bookings.reduce((sum, b) => sum + Number(b.totalamount || 0), 0),
        );
        const cancelled = bookings.filter((b) => b.cancelled);
        setCancelledCount(cancelled.length);
        setTotalPenalty(
          cancelled.reduce(
            (sum, b) => sum + Number(b.cancellationPenalty || 0),
            0,
          ),
        );
        console.log("✅ Site Bookings fetched:", bookings.length);
      })
      .catch((error) =>
        console.error("❌ Error fetching Site Bookings:", error),
      );
  }, []);



  useEffect(() => {
    axiosInstance
      .get("/receipts")
      .then((response) => {
        const receipts = response.data.data || [];
        SetTotalReceipts(receipts.length);

        const normalizeReceipts = receipts.map((r) => {
          const amountpaid = Number(r.amountpaid || 0);
          const bookingamount = Number(r.bookingamount || 0);
          const totalreceived =
            r.totalreceived != null
              ? Number(r.totalreceived)
              : amountpaid + bookingamount;
          return { ...r, totalreceived };
        });

        const monthlyData = groupByMonthly(normalizeReceipts, "totalreceived");
        SetTotalMonthlyReceipts(monthlyData);
        SetTotalMonthlyAmount(monthlyData);

        const paidTotal = normalizeReceipts.reduce(
          (sum, r) => sum + Number(r.totalreceived || 0),
          0,
        );
        setTotalPaidAmount(paidTotal);
        SetTotalAmout(paidTotal);
        console.log("✅ Receipts fetched:", receipts.length);
      })
      .catch((error) => console.error("❌ Error fetching Receipts:", error));
  }, []);

  useEffect(() => {
    setAvailableMonths(getAllUniqueMonths());
  }, [totalmonthlymembers, totalmonthlysitebookings, totalmonthlyamount]);

  const filteredData = getFilteredData();
  const invoiceStats = getInvoiceStats();

  return (
    <div>
      <Header />
      <div className="px-[70px] py-10">
        <div className="flex justify-between items-center mb-6">
          <div className="text-[24px] font-semibold">Overview</div>

          {/* ── Animated Dropdown ── */}
          <div className="flex items-center gap-2">
            <label className="text-[16px] font-medium text-gray-700">
              Select Period:
            </label>

            <div className="relative w-[167px]" ref={dropdownRef}>
              {/* Trigger button */}
              <button
                onClick={() => setOpen(!open)}
                className={`w-full flex items-center justify-between px-4 py-2 rounded-xl border bg-white transition-all duration-300
                  ${
                    open
                      ? "border-[#EF742C]"
                      : "border-gray-300 hover:border-[#EF742C]"
                  }`}
              >
                <span className="text-gray-700 font-medium">
                  {formatMonthDisplay(selectedMonth)}
                </span>
                <ChevronDown
                  size={20}
                  className={`text-gray-500 transition-all duration-300 ${
                    open ? "rotate-180 text-[#EF742C]" : ""
                  }`}
                />
              </button>

              {/* Dropdown panel */}
              <div
                className={`absolute top-full left-0 mt-2 w-full origin-top rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden z-50 transition-all duration-300 ease-out
                  ${
                    open
                      ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                      : "opacity-0 scale-95 -translate-y-2 pointer-events-none"
                  }`}
              >
                <div className="max-h-64 overflow-y-auto">
                  {/* All Time */}
                  <button
                    onClick={() => handleSelect("all")}
                    className={`w-full flex items-center justify-between px-4 py-2 text-left transition-all duration-200
                      ${
                        selectedMonth === "all"
                          ? " text-[#EF742C]"
                          : "text-gray-700 "
                      }`}
                  >
                    <span className="font-medium">All Time</span>
                    {selectedMonth === "all" && (
                      <Check size={18} className="text-[#EF742C]" />
                    )}
                  </button>

                  {/* Dynamic months from API data */}
                  {availableMonths.map((month, index) => (
                    <button
                      key={month}
                      onClick={() => handleSelect(month)}
                      style={{ animationDelay: `${index * 40}ms` }}
                      className={`w-full flex items-center justify-between px-4 py-3 text-left transition-all duration-200
                        ${
                          selectedMonth === month
                            ? "bg-orange-50 text-[#EF742C]"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                    >
                      <span className="font-medium">
                        {formatMonthDisplay(month)}
                      </span>
                      {selectedMonth === month && (
                        <Check size={18} className="text-[#EF742C]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div className="flex flex-col lg:flex-row lg:flex-wrap gap-[20px] pt-[24px]">
          <div className="flex-1 min-w-[210px] min-h-[119px] bg-[#FFFF] shadow-[0_-2px_4px_-1px_rgba(0,0,0,0.1),0_4px_5px_-1px_rgba(0,0,0,0.1)] rounded-xl">
            <div className="px-[20px] flex py-[16px]">
              <div className="h-[57px] w-[4px] shrink-0 bg-[#08A25C] rounded-lg"></div>
              <div className="px-[20px] min-w-0">
                <div className="text-[16px] text-[#EF742C] font-semibold">
                  Total Member
                </div>
                <div className="font-bold text-[30px] leading-tight break-words">
                  {filteredData.members}
                </div>
                <p className="text-[14px] text-[#9B9A9A]">
                  {selectedMonth === "all"
                    ? "All Time"
                    : formatMonthDisplay(selectedMonth)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-[210px] min-h-[119px] bg-[#FFFF] shadow-[0_-2px_4px_-1px_rgba(0,0,0,0.1),0_4px_5px_-1px_rgba(0,0,0,0.1)] rounded-xl">
            <div className="px-[20px] flex py-[16px]">
              <div className="h-[57px] w-[4px] shrink-0 bg-[#08A25C] rounded-lg"></div>
              <div className="px-[20px] min-w-0">
                <div className="text-[16px] font-semibold text-[#EF742C]">
                  Site Booking
                </div>
                <div className="font-bold text-[30px] leading-tight break-words">
                  {filteredData.bookings}
                </div>
                <p className="text-[14px] text-[#9B9A9A]">
                  {selectedMonth === "all"
                    ? "All Time"
                    : formatMonthDisplay(selectedMonth)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-[210px] min-h-[119px] bg-[#FFFF] shadow-[0_-2px_4px_-1px_rgba(0,0,0,0.1),0_4px_5px_-1px_rgba(0,0,0,0.1)] rounded-xl">
            <div className="px-[20px] flex py-[16px]">
              <div className="h-[57px] w-[4px] shrink-0 bg-[#08A25C] rounded-lg"></div>
              <div className="px-[20px] min-w-0">
                <div className="text-[16px] font-semibold text-[#EF742C]">
                  Total Receipt
                </div>
                <div className="font-bold text-[30px] leading-tight break-words">
                  {filteredData.receipts}
                </div>
                <p className="text-[14px] text-[#9B9A9A]">
                  {selectedMonth === "all"
                    ? "All Time"
                    : formatMonthDisplay(selectedMonth)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 min-w-[210px] min-h-[119px] bg-[#FFFF] shadow-[0_-2px_4px_-1px_rgba(0,0,0,0.1),0_4px_5px_-1px_rgba(0,0,0,0.1)] rounded-xl">
            <div className="px-[20px] flex py-[16px]">
              <div className="h-[57px] w-[4px] shrink-0 bg-[#08A25C] rounded-lg"></div>
              <div className="px-[20px] min-w-0">
                <div className="text-[16px] font-semibold text-[#EF742C]">
                  Transaction
                </div>
                <div className="font-bold text-[24px] leading-tight break-words">
                  ₹{filteredData.amount.toLocaleString("en-IN")}
                </div>
                <p className="text-[14px] text-[#9B9A9A]">
                  {selectedMonth === "all"
                    ? "All Time"
                    : formatMonthDisplay(selectedMonth)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 max-w-[300px] min-h-[119px] bg-[#FFFF] shadow-[0_-2px_4px_-1px_rgba(0,0,0,0.1),0_4px_5px_-1px_rgba(0,0,0,0.1)] rounded-xl">
            <div className="px-[20px] flex py-[16px]">
              <div className="h-[57px] w-[4px] shrink-0 bg-red-500 rounded-lg"></div>
              <div className="px-[20px] min-w-0">
                <div className="text-[16px] font-semibold text-red-500">
                  Penalty Amount
                </div>
                <div className="font-bold text-[24px] leading-tight break-words">
                  ₹{totalPenalty.toLocaleString("en-IN")}
                </div>
                <p className="text-[14px] text-[#9B9A9A]">
                  {cancelledCount} cancelled
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex">
        <UpcomingPaymentsWidget prefix="" />
      </div>

      <div className="flex">
        <BookingOverview />
      </div>
      <div>
        <PaymentTable />
      </div>
    </div>
  );
}