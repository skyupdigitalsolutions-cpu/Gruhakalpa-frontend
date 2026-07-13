/* eslint-disable */
import axios from "axios";
import { useEffect, useState } from "react";
import { Header } from "./Header";
import { toast } from "react-toastify";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3001";

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function FixedDepositList() {
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
      const res = await axios.get(`${API_BASE}/fixed-deposits`);
      setList(res.data.data || []);
    } catch (e) {
      console.error(e);
      toast.error("Failed to load fixed deposits");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const cancel = async (id) => {
    if (!window.confirm("Cancel this Fixed Deposit? This cannot be undone.")) return;
    try {
      await axios.put(`${API_BASE}/fixed-deposits/${id}/cancel`);
      toast.success("Fixed Deposit cancelled");
      setSelected(null);
      load();
    } catch (e) {
      toast.error(e.response?.data?.message || "Failed to cancel");
    }
  };

  const filtered = list.filter((fd) => {
    if (statusFilter === "active" && fd.cancelled) return false;
    if (statusFilter === "cancelled" && !fd.cancelled) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (fd.fdrNo || "").toLowerCase().includes(q) ||
      (fd.membershipId || "").toLowerCase().includes(q) ||
      (fd.name || "").toLowerCase().includes(q)
    );
  });

  const totalPrincipal = filtered.filter((f) => !f.cancelled).reduce((s, f) => s + (Number(f.amount) || 0), 0);

  return (
    <div>
      <Header />
      <div className="px-[60px] pt-[40px] pb-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Fixed Deposit List</h1>
          <div className="text-sm text-gray-500">
            Active principal: <span className="font-semibold text-[#EF742C]">{inr(totalPrincipal)}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-3 mb-4">
          <input
            className="border border-gray-300 rounded px-4 py-2 text-sm w-72 focus:outline-none focus:ring-2 focus:ring-orange-400"
            placeholder="Search FDR No / Membership Id / Name"
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
                {["FDR No", "Membership Id", "Name", "Amount", "Issued", "Maturity", "Interest", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No fixed deposits found.</td></tr>
              ) : (
                filtered.map((fd) => (
                  <tr key={fd._id} className={`border-t border-gray-100 ${fd.cancelled ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">{fd.fdrNo}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fd.membershipId}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fd.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{inr(fd.amount)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(fd.date)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fmtDate(fd.maturityDate)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{fd.interestRate}%</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {fd.cancelled ? (
                        <span className="text-red-600 font-medium">Cancelled</span>
                      ) : (
                        <span className="text-green-600 font-medium">Active</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button onClick={() => setSelected(fd)} className="text-[#EF742C] font-semibold">View</button>
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
              <h2 className="text-xl font-semibold">{selected.fdrNo}</h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 text-2xl leading-none">×</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Membership Id" value={selected.membershipId} />
              <Info label="Name" value={selected.name} />
              <Info label="Mobile" value={selected.mobilenumber || "—"} />
              <Info label="Issued Date" value={fmtDate(selected.date)} />
              <Info label="Tenure" value={`${selected.tenureMonths} months`} />
              <Info label="Maturity Date" value={fmtDate(selected.maturityDate)} />
              <Info label="Amount (Principal)" value={inr(selected.amount)} />
              <Info label="Amount Paid" value={inr(selected.amountPaid)} />
              <Info label="Interest Rate" value={`${selected.interestRate}%`} />
              <Info label="Interest Amount" value={inr(selected.interestAmount)} />
              <Info label="Maturity Amount" value={inr(selected.maturityAmount)} />
              <Info label="Status" value={selected.cancelled ? "Cancelled" : "Active"} />
            </div>
            <div className="mt-3">
              <div className="text-xs text-gray-500 uppercase mb-1">Sum in words</div>
              <div className="text-sm">{selected.sumInWords || "—"}</div>
            </div>

            {Array.isArray(selected.receipts) && selected.receipts.length > 0 && (
              <div className="mt-4">
                <div className="text-xs text-gray-500 uppercase mb-2">Linked Receipts</div>
                <div className="space-y-1.5">
                  {selected.receipts.map((r, i) => (
                    <div key={i} className="flex justify-between text-sm border border-gray-100 rounded px-3 py-1.5">
                      <span>{fmtDate(r.date)}</span>
                      <span>{inr(r.amount)}</span>
                      <span className="text-gray-500">#{r.receipt_no}</span>
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

export default FixedDepositList;