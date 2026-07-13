import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axiosInstance from "../api/axios";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN") : "-");

const statusBadge = (status) => {
  const map = {
    overdue: "bg-red-100 text-red-600 border-red-200",
    due_soon: "bg-amber-100 text-amber-700 border-amber-200",
    upcoming: "bg-blue-50 text-blue-600 border-blue-200",
    paid: "bg-green-50 text-green-600 border-green-200",
  };
  const label = {
    overdue: "Overdue",
    due_soon: "Due soon",
    upcoming: "Upcoming",
    paid: "Paid",
  };
  return (
    <span
      className={`text-[11px] font-semibold px-2 py-[2px] rounded-full border ${
        map[status] || map.upcoming
      }`}
    >
      {label[status] || status}
    </span>
  );
};

// Compact "upcoming payments" panel for the admin / superadmin dashboards.
// `prefix` is "" for admin and "/superadmin" for superadmin (for the link).
export function UpcomingPaymentsWidget({ prefix = "" }) {
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosInstance
      .get("/payment-schedule?filter=all")
      .then((res) => {
        setSummary(res.data?.summary || null);
        setRows((res.data?.data || []).slice(0, 6));
      })
      .catch((err) =>
        console.error("❌ Error fetching payment schedule:", err),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-[70px] pb-10 w-full">
      <div className="bg-white rounded-2xl shadow-[0_-2px_4px_-1px_rgba(0,0,0,0.1),0_4px_5px_-1px_rgba(0,0,0,0.1)] p-6">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-[20px] font-semibold text-[#EF742C]">
            Upcoming Payments
          </h3>
          <Link
            to={`${prefix}/payments-due`}
            className="text-[14px] font-semibold text-[#EF742C] hover:underline"
          >
            View all →
          </Link>
        </div>

        {/* Summary chips */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
              <div className="text-[12px] text-gray-500">Clients due</div>
              <div className="text-[22px] font-bold">{summary.clientsDue}</div>
            </div>
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
              <div className="text-[12px] text-red-500">Overdue clients</div>
              <div className="text-[22px] font-bold text-red-600">
                {summary.clientsOverdue}
              </div>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
              <div className="text-[12px] text-amber-600">Outstanding</div>
              <div className="text-[18px] font-bold text-amber-700">
                {inr(summary.totalOutstanding)}
              </div>
            </div>
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3">
              <div className="text-[12px] text-red-500">Overdue amount</div>
              <div className="text-[18px] font-bold text-red-600">
                {inr(summary.totalOverdue)}
              </div>
            </div>
          </div>
        )}

        {/* Nearest-due list */}
        {loading ? (
          <div className="text-gray-400 text-sm py-6 text-center">
            Loading payment schedule...
          </div>
        ) : rows.length === 0 ? (
          <div className="text-gray-400 text-sm py-6 text-center">
            No outstanding payments. 🎉
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-4 font-medium">Client</th>
                  <th className="py-2 pr-4 font-medium">Next due</th>
                  <th className="py-2 pr-4 font-medium">Due date</th>
                  <th className="py-2 pr-4 font-medium">Amount</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.membership_id}
                    className="border-b border-gray-50 hover:bg-orange-50/40"
                  >
                    <td className="py-2 pr-4">
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-gray-400">
                        {r.membership_id}
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-gray-700">
                      {r.nextDue?.label || "-"}
                    </td>
                    <td className="py-2 pr-4 text-gray-700 whitespace-nowrap">
                      {fmtDate(r.nextDue?.dueDate)}
                    </td>
                    <td className="py-2 pr-4 font-semibold whitespace-nowrap">
                      {inr(r.nextDue?.outstanding)}
                    </td>
                    <td className="py-2 pr-4">
                      {statusBadge(r.nextDue?.status || r.overallStatus)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default UpcomingPaymentsWidget;