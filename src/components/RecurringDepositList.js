/* eslint-disable */
import axios from "axios";
import { useEffect, useState } from "react";
import { Header } from "./Header";
import { toast } from "react-toastify";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3001";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function RecurringDepositList() {
  const isSuperAdmin = !!localStorage.getItem("superAdminToken");
  const isAdmin = !!localStorage.getItem("adminToken");
  const canCancel = isSuperAdmin || isAdmin;

  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | cancelled
  const [selected, setSelected] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/recurring-deposits`);
      setList(res.data.data || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load recurring deposits");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const cancel = async (id) => {
    if (!window.confirm("Cancel this Recurring Deposit? This cannot be undone.")) return;
    try {
      await axios.put(`${API_BASE}/recurring-deposits/${id}/cancel`);
      toast.success("Recurring Deposit cancelled");
      setSelected(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to cancel");
    }
  };

  const filtered = list.filter((rd) => {
    if (statusFilter === "active" && rd.cancelled) return false;
    if (statusFilter === "cancelled" && !rd.cancelled) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (rd.rdNo || "").toLowerCase().includes(q) ||
      (rd.membershipId || "").toLowerCase().includes(q) ||
      (rd.name || "").toLowerCase().includes(q)
    );
  });

  const totalPaid = filtered.filter((r) => !r.cancelled).reduce((s, r) => s + (Number(r.totalPaid) || 0), 0);

  return (
    <div>
      <Header />
      <div className="px-[60px] pt-[40px] pb-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Recurring Deposit List</h1>
          <div className="text-sm text-gray-500">
            Active total paid: <span className="font-semibold text-[#EF742C]">{inr(totalPaid)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            className="border border-gray-300 rounded px-4 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="Search RD No / Membership Id / Name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="border border-gray-300 rounded px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button onClick={load} className="text-sm text-[#EF742C] font-semibold underline">Refresh</button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <table className="w-full text-sm">
            <thead className="bg-[#EF742C]/10 text-left">
              <tr>
                {["RD No", "Membership Id", "Name", "Monthly", "Months Paid", "Total Paid", "Maturity", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No recurring deposits found.</td></tr>
              ) : (
                filtered.map((rd) => (
                  <tr key={rd._id} className={`border-t border-gray-100 ${rd.cancelled ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">{rd.rdNo}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{rd.membershipId}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{rd.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{inr(rd.monthlyAmount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{rd.monthsPaid || 0}/{rd.tenureMonths}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{inr(rd.totalPaid)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(rd.maturityDate)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {rd.cancelled ? (
                        <span className="text-red-600 font-medium">Cancelled</span>
                      ) : (
                        <span className="text-green-600 font-medium">{rd.status === "closed" ? "Closed" : "Active"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button onClick={() => setSelected(rd)} className="text-[#EF742C] font-semibold">View</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">{selected.rdNo}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Membership Id" value={selected.membershipId} />
              <Info label="Name" value={selected.name} />
              <Info label="Mobile" value={selected.mobilenumber || "—"} />
              <Info label="Issued Date" value={fmtDate(selected.date)} />
              <Info label="Start Date" value={fmtDate(selected.amountPaidDate)} />
              <Info label="Tenure" value={`${selected.tenureMonths} months`} />
              <Info label="Maturity Date" value={fmtDate(selected.maturityDate)} />
              <Info label="Monthly Amount" value={inr(selected.monthlyAmount)} />
              <Info label="Interest Rate" value={`${selected.interestRate}% p.a. (monthly comp.)`} />
              <Info label="Months Paid" value={`${selected.monthsPaid || 0}/${selected.tenureMonths}`} />
              <Info label="Total Paid (so far)" value={inr(selected.totalPaid)} />
              <Info label="Value so far" value={inr(selected.accruedValue)} />
              <Info label="Interest so far" value={inr(selected.accruedInterest)} />
              <Info label="Total Deposit (at maturity)" value={inr(selected.totalDeposit)} />
              <Info label="Interest (at maturity)" value={inr(selected.interestAmount)} />
              <Info label="Maturity Amount" value={inr(selected.maturityAmount)} />
              <Info label="Status" value={selected.cancelled ? "Cancelled" : (selected.status || "active")} />
            </div>

            {Array.isArray(selected.schedule) && selected.schedule.length > 0 && (
              <div className="mt-4">
                <div className="text-xs text-gray-500 uppercase mb-2">Compound Schedule (full tenure)</div>
                <div className="border border-gray-100 rounded-lg overflow-hidden">
                  <div className="max-h-56 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-[#EF742C]/10 text-left sticky top-0">
                        <tr>
                          {["Month", "Payment", "Interest", "Balance"].map((h) => (
                            <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selected.schedule.map((row) => (
                          <tr key={row.month} className="border-t border-gray-100">
                            <td className="px-3 py-1.5 whitespace-nowrap">{row.month}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap">{inr(row.deposit)}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap text-green-600">{inr(row.interest)}</td>
                            <td className="px-3 py-1.5 whitespace-nowrap font-medium">{inr(row.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {Array.isArray(selected.installments) && selected.installments.length > 0 && (
              <div className="mt-4">
                <div className="text-xs text-gray-500 uppercase mb-2">Installments</div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {selected.installments.map((p, i) => (
                    <div key={i} className="flex justify-between text-sm border border-gray-100 rounded px-3 py-1.5">
                      <span>#{i + 1}</span>
                      <span>{fmtDate(p.date)}</span>
                      <span>{inr(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {canCancel && !selected.cancelled && (
              <div className="mt-6 flex justify-end">
                <button onClick={() => cancel(selected._id)} className="bg-red-500 text-white px-5 py-2 rounded-full text-sm font-semibold">
                  Cancel Deposit
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs text-gray-500 uppercase">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

export default RecurringDepositList;