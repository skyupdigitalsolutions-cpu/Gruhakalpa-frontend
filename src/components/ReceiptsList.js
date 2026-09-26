import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { Header } from "./Header";
import { generateReceiptPDF } from "../utils/generateReceiptPDF";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3001";

const MEMBERSHIP_DIGITS = 4;

const getRawMembershipId = (receipt) =>
  receipt?.membershipid ||
  receipt?.membership_id ||
  receipt?.seniority_no ||
  "";

const formatMembershipId = (raw) => {
  const value = String(raw || "").trim().toUpperCase();
  if (!value) return "";
  const parts = value.match(/^([A-Z]{2,5})(\d{4})([A-Z]?)(\d+)$/);
  if (!parts) return value;
  const [, code, year, letter, digits] = parts;
  return `${code}${year}${letter}${digits.padStart(MEMBERSHIP_DIGITS, "0")}`;
};

const getMembershipId = (receipt) =>
  formatMembershipId(getRawMembershipId(receipt));

const getCreatedAt = (receipt) => {
  if (receipt?.createdAt) return new Date(receipt.createdAt).getTime();
  const id = receipt?._id;
  if (typeof id === "string" && /^[0-9a-f]{24}$/i.test(id)) {
    return parseInt(id.substring(0, 8), 16) * 1000;
  }
  if (receipt?.date) return new Date(receipt.date).getTime();
  return 0;
};

// Local YYYY-MM-DD key for a date value (avoids UTC off-by-one when
// comparing against <input type="date"> values)
const toDateKey = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const getRecordDate = (row) => {
  const t = row?.date ? new Date(row.date).getTime() : NaN;
  return isNaN(t) ? 0 : t;
};

const unwrapReceipts = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.receipts)) return payload.receipts;
  return [];
};

export function ReceiptList() {
  const isSuperAdmin = !!localStorage.getItem("superAdminToken");
  const headers = [
    "Date",
    "Membership Id",
    "Transaction ID",
    "Name",
    "Amount",
    "",
  ];
  const [Memberdetails, SetMemberDetails] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortOrder, setSortOrder] = useState("recent"); // recent | oldest | dateDesc | dateAsc
  const [selectedMember, setSelectedMember] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [downloadingId, setDownloadingId] = useState(null);
  const [memberImage, setMemberImage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  // Superadmin-only hard delete. Backend re-verifies the token belongs to a
  // superadmin, so hiding the button is only a UI convenience.
  const handleDeleteReceipt = async (receipt) => {
    if (!isSuperAdmin || !receipt?._id) return;
    const label = receipt.receipt_no || getMembershipId(receipt) || "this receipt";
    const amount = receipt.amountpaid
      ? ` of Rs.${Number(receipt.amountpaid).toLocaleString("en-IN")}`
      : "";
    const confirmed = window.confirm(
      `Delete receipt ${label}${amount} for ${receipt.name || "this member"}?\n\n` +
        "This permanently removes the receipt and its amount from the member's paid total. This cannot be undone."
    );
    if (!confirmed) return;

    setDeletingId(receipt._id);
    try {
      await axios.delete(`${API_BASE}/receipts/${receipt._id}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("superAdminToken")}`,
        },
      });
      SetMemberDetails((prev) => prev.filter((m) => m._id !== receipt._id));
      if (selectedMember?._id === receipt._id) closeModal();
      alert(`Receipt ${label} deleted successfully.`);
    } catch (err) {
      console.error("Error deleting receipt", err);
      const status = err?.response?.status;
      const msg =
        err?.response?.data?.message ||
        (status === 401
          ? "Session expired. Please login again."
          : "Failed to delete receipt.");
      alert(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadReceipt = async (receipt) => {
    setDownloadingId(receipt._id);
    try {
      await generateReceiptPDF(receipt);
    } catch (err) {
      console.error("Download error:", err);
      alert("Failed to download receipt. Please try again.");
    } finally {
      setDownloadingId(null);
    }
  };

  const fetchReceipts = useCallback(async () => {
    setIsLoading(true);
    setLoadError("");
    try {
      const response = await axios.get(`${API_BASE}/receipts`);
      const rows = unwrapReceipts(response.data);
      rows.sort((a, b) => getCreatedAt(b) - getCreatedAt(a));
      SetMemberDetails(rows);
    } catch (err) {
      console.error("Unable to fetch the data", err);
      setLoadError(
        err?.response?.status
          ? `Failed to load receipts (HTTP ${err.response.status})`
          : "Failed to load receipts — check the API connection."
      );
      SetMemberDetails([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  useEffect(() => {
    const onFocus = () => fetchReceipts();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchReceipts]);

  useEffect(() => {
    let list = Memberdetails;

    // ── Search ──
    const query = searchQuery.trim();
    if (query !== "") {
      const q = query.toLowerCase();
      const normalizedQuery = formatMembershipId(query).toLowerCase();
      list = list.filter((member) => {
        const raw = getRawMembershipId(member).toLowerCase();
        const formatted = getMembershipId(member).toLowerCase();
        const name = String(member?.name || "").toLowerCase();
        return (
          raw.includes(q) ||
          formatted.includes(q) ||
          name.includes(q) ||
          (!!normalizedQuery && formatted.includes(normalizedQuery))
        );
      });
    }

    // ── Date filter (Receipt Date) ──
    if (fromDate || toDate) {
      list = list.filter((member) => {
        const key = toDateKey(member?.date);
        if (!key) return false;
        if (fromDate && key < fromDate) return false;
        if (toDate && key > toDate) return false;
        return true;
      });
    }

    // ── Sort ──
    const sorted = [...list];
    if (sortOrder === "recent") {
      sorted.sort((a, b) => getCreatedAt(b) - getCreatedAt(a));
    } else if (sortOrder === "oldest") {
      sorted.sort((a, b) => getCreatedAt(a) - getCreatedAt(b));
    } else if (sortOrder === "dateDesc") {
      sorted.sort((a, b) => getRecordDate(b) - getRecordDate(a));
    } else if (sortOrder === "dateAsc") {
      sorted.sort((a, b) => getRecordDate(a) - getRecordDate(b));
    }

    setFilteredMembers(sorted);
  }, [searchQuery, Memberdetails, fromDate, toDate, sortOrder]);

  const hasActiveFilters =
    !!searchQuery.trim() || !!fromDate || !!toDate || sortOrder !== "recent";
  const clearAllFilters = () => {
    setSearchQuery("");
    setFromDate("");
    setToDate("");
    setSortOrder("recent");
  };

  const handleSearchChange = (e) => setSearchQuery(e.target.value);
  const clearSearch = () => setSearchQuery("");

  const handleViewDetails = async (member) => {
    setSelectedMember(member);
    setEditData(member);
    setIsModalOpen(true);
    setIsEditing(false);
    setMemberImage(null);

    try {
      const res = await axios.get(`${API_BASE}/members`);
      const members = res.data.data || [];
      const target = getMembershipId(member);
      const found = members.find(
        (m) => formatMembershipId(m.membership_id) === target
      );
      if (found?.image) setMemberImage(found.image);
    } catch (err) {
      console.error("Error fetching member image:", err);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedMember(null);
    setIsEditing(false);
    setMemberImage(null);
  };

  const handleEditChange = (e) => {
    setEditData({ ...editData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    const payload = { ...editData };

    const oldAmount = Math.round(parseFloat(selectedMember.amountpaid) || 0);
    const newAmount = Math.round(parseFloat(payload.amountpaid) || 0);
    const oldType = String(selectedMember.paymenttype || "").trim();
    const newType = String(payload.paymenttype || "").trim();
    payload.amountpaid = newAmount;
    payload.paymenttype = newType;

    // Keep the per-bucket split in sync with the edited amount / payment type.
    // The PDF particulars and the ReceiptForm schedule both read `allocations`,
    // so leaving it stale shows the old amount/label even after an edit.
    const allocs = Array.isArray(selectedMember.allocations)
      ? selectedMember.allocations
      : [];
    if ((newAmount !== oldAmount || newType !== oldType) && allocs.length <= 1) {
      const label = newType || allocs[0]?.label || "";
      const bucket =
        newType === oldType && allocs[0]?.bucket
          ? allocs[0].bucket
          : /^booking advance/i.test(label)
          ? "Down Payment"
          : label;
      payload.allocations = [{ bucket, label, amount: newAmount }];
    }

    // Any change to a printed field makes the stored Cloudinary PDF stale —
    // clear it so Download regenerates the receipt from the current data.
    const printedFields = [
      "receipt_no", "name", "membershipid", "projectname", "date",
      "amountpaid", "paymenttype", "paymentmode", "transactionid",
      "bank", "sitedimension", "mobilenumber",
    ];
    const pdfChanged = printedFields.some(
      (f) => String(payload[f] ?? "") !== String(selectedMember[f] ?? "")
    );
    if (pdfChanged) payload.pdfUrl = null;

    try {
      await axios.put(
        `${API_BASE}/receipts/${selectedMember._id}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("superAdminToken")}`,
          },
        }
      );
      SetMemberDetails(
        Memberdetails.map((m) =>
          m._id === selectedMember._id ? payload : m
        )
      );
      setSelectedMember(payload);
      setIsEditing(false);
      alert("Receipt updated successfully!");
    } catch (err) {
      console.error("Error updating", err);
      alert("Failed to update receipt.");
    }
  };

  const editField = (label, name, value) => (
    <div className="border-b border-gray-200 pb-4">
      <dt className="inline font-semibold">{label}: </dt>
      {isEditing && !selectedMember?.cancelled ? (
        <input
          name={name}
          value={editData[name] || ""}
          onChange={handleEditChange}
          className="border border-gray-300 rounded px-2 py-1 text-sm ml-1"
        />
      ) : (
        <dd className="inline font-normal">{value || "-"}</dd>
      )}
    </div>
  );

  return (
    <div>
      <Header />
      <div className="px-[50px] pt-[50px]">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold text-[24px]">All Receipt List</h1>
            <span className="text-xs bg-orange-100 text-[#EF742C] px-2 py-1 rounded-full font-semibold">
              {isLoading ? "Loading…" : `${Memberdetails.length} total`}
            </span>
            <button
              onClick={fetchReceipts}
              disabled={isLoading}
              className="text-xs font-semibold text-[#EF742C] border border-[#EF742C] px-3 py-1 rounded-full hover:bg-orange-50 disabled:opacity-50"
            >
              Refresh
            </button>
          </div>

          {/* ── Search box ── */}
          <div className="relative w-[300px]">
            <div className="relative">
              {/* Search icon on the LEFT */}
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search by Membership Id or Name"
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full px-4 py-2 pl-12 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EF742C] focus:border-transparent"
              />
              {/* Clear button on the RIGHT */}
              {searchQuery && (
                <button
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
            {searchQuery && (
              <div className="absolute top-full mt-2 text-sm text-gray-600">
                Found {filteredMembers.length} result
                {filteredMembers.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>
        </div>

        {/* ── Date filter + Sort ── */}
        <div className="flex flex-wrap items-end gap-4 mb-6 mt-8">
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => setFromDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#EF742C] focus:border-transparent"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => setToDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#EF742C] focus:border-transparent"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-xs font-semibold text-gray-600 mb-1">
              Sort By
            </label>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#EF742C] focus:border-transparent"
            >
              <option value="recent">Recently Added (Newest First)</option>
              <option value="oldest">Oldest Added First</option>
              <option value="dateDesc">Receipt Date (Newest First)</option>
              <option value="dateAsc">Receipt Date (Oldest First)</option>
            </select>
          </div>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="px-4 py-2 text-sm font-semibold text-[#EF742C] border border-[#EF742C] rounded-lg hover:bg-orange-50"
            >
              Clear Filters
            </button>
          )}
          {(fromDate || toDate) && (
            <span className="text-sm text-gray-600 pb-2">
              Showing {filteredMembers.length} of {Memberdetails.length}
            </span>
          )}
        </div>

        {loadError && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 font-medium">
            {loadError}
          </div>
        )}
      </div>

      {/* ── Table ── */}
      <div className="w-full max-w-[1120px] mx-auto p-6">
        {/* FIX: overflow-x-auto enables horizontal scroll on small screens */}
        <div className="overflow-x-auto rounded-2xl shadow-lg">
          {/* FIX: min-w-[800px] prevents columns from collapsing/cutting off */}
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-[#EF742C]">
                {headers.map((header, index) => (
                  <th
                    key={index}
                    className="px-6 py-4 text-start text-white font-semibold text-base tracking-wide"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {filteredMembers.map((member) => (
                <tr
                  key={member._id || getMembershipId(member)}
                  className={`border-b border-gray-200 text-start text-[14px] transition-colors duration-200 ${
                    member.cancelled
                      ? "bg-red-50"
                      : "hover:bg-orange-50"
                  }`}
                >
                  <td className="px-6 py-4 text-gray-700 font-medium">
                    {member.date
                      ? new Date(member.date).toLocaleDateString("en-GB")
                      : "-"}
                  </td>
                  <td className="px-6 py-4 text-gray-700 font-medium">
                    {getMembershipId(member) || "-"}
                  </td>
                  <td className="px-6 py-4 text-gray-700 font-medium">
                    {member.transactionid || "-"}
                  </td>
                  <td className="px-6 py-4 text-gray-700 font-medium">
                    {member.name || "-"}
                  </td>
                  <td className="px-6 py-4 text-gray-700 font-medium">
                    {member.amountpaid
                      ? `Rs.${Number(member.amountpaid).toLocaleString("en-IN")}`
                      : "-"}
                  </td>
                  <td>
                    <div className="flex justify-center items-center gap-1">
                      <button
                        onClick={() => handleViewDetails(member)}
                        className="w-[130px] font-medium border-1 py-[6px] px-[10px] border-[#08A25C] rounded text-[14px] text-[#08A25C] hover:bg-[#08A25C] hover:text-white transition-colors duration-200"
                      >
                        View Details
                      </button>
                      <button
                        onClick={() => handleDownloadReceipt(member)}
                        disabled={downloadingId === member._id}
                        className="w-[110px] font-medium border-1 py-[6px] px-[10px] border-[#EF742C] rounded text-[14px] text-[#EF742C] hover:bg-[#EF742C] hover:text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                      >
                        {downloadingId === member._id ? (
                          "..."
                        ) : (
                          <>
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                              />
                            </svg>
                            Download
                          </>
                      )}
                      </button>
                      {isSuperAdmin && (
                        <button
                          onClick={() => handleDeleteReceipt(member)}
                          disabled={deletingId === member._id}
                          title="Delete receipt"
                          className="w-[90px] font-medium border-1 py-[6px] px-[10px] border-red-600 rounded text-[14px] text-red-600 hover:bg-red-600 hover:text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                        >
                          {deletingId === member._id ? (
                            "..."
                          ) : (
                            <>
                              <svg
                                className="w-4 h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                              Delete
                            </>
                          )}
                        </button>
                      )}
                      {member.cancelled && (
                        <div className="my-2">
                          <span className="bg-red-100 text-red-600 text-center text-xs font-semibold px-2 py-1 mt-2 rounded-full">
                            Cancelled
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMembers.length === 0 && (
            <div className="p-6 text-center text-red-600">
              {isLoading
                ? "Loading receipts…"
                : searchQuery
                ? `No receipts found for "${searchQuery}"`
                : fromDate || toDate
                ? "No receipts found in the selected date range"
                : "Not found."}
            </div>
          )}
        </div>
      </div>

      {/* ── Detail Modal ── */}
      {isModalOpen && selectedMember && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-[900px] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 pb-4 flex justify-between items-center">
              <button
                onClick={closeModal}
                className="flex items-center gap-2 text-[#EF742C] border border-[#EF742C] px-4 py-2 rounded-full hover:bg-purple-50 transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                <span className="font-medium">Back to Receipt List</span>
              </button>

              <div className="flex items-center gap-3">
                {selectedMember.cancelled && (
                  <span className="bg-red-100 text-red-600 text-sm font-semibold px-4 py-2 rounded-full border border-red-300">
                    ✕ Cancelled
                  </span>
                )}

                {isSuperAdmin && !isEditing && (
                  <button
                    onClick={() => handleDeleteReceipt(selectedMember)}
                    disabled={deletingId === selectedMember._id}
                    className="border border-red-600 text-red-600 px-4 py-2 rounded-full font-semibold hover:bg-red-600 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deletingId === selectedMember._id ? "Deleting..." : "Delete"}
                  </button>
                )}

                {isSuperAdmin && !selectedMember.cancelled && (
                  <div className="flex gap-2">
                    {isEditing ? (
                      <>
                        <button
                          onClick={handleSave}
                          className="bg-[#EF742C] text-white px-4 py-2 rounded-full font-semibold hover:opacity-90"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setIsEditing(false)}
                          className="border border-gray-400 text-gray-600 px-4 py-2 rounded-full font-semibold hover:bg-gray-100"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setIsEditing(true)}
                        className="bg-gradient-to-r from-orange-200 via-orange-500 to-orange-600 text-white px-6 py-2 rounded-full font-semibold hover:opacity-90"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 pb-6">
              <div
                className={`bg-white border rounded-2xl p-6 ${
                  selectedMember.cancelled
                    ? "border-red-300"
                    : "border-gray-200"
                }`}
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-semibold">Receipt Details</h2>
                  </div>
                  <div className="w-16 h-16 bg-gray-200 rounded-full overflow-hidden flex items-center justify-center">
                    {memberImage ? (
                      <img
                        src={memberImage}
                        alt="Member"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <svg
                        className="w-10 h-10 text-gray-400"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </div>
                </div>

                <dl className="flex gap-[70px] mb-6 pb-6 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <img
                      src="/images/person_green.svg"
                      alt="Person icon"
                      className="pb-1"
                    />
                    <div className="flex">
                      <dt className="text-[#EF742C] font-medium text-[16px]">
                        Name:
                      </dt>
                      &nbsp;
                      <dd className="font-semibold text-[16px] text-[#595757]">
                        {selectedMember.name || "-"}
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <img
                      src="/images/assignment_ind_green.svg"
                      alt="ID icon"
                      className="pb-1"
                    />
                    <div className="flex">
                      <dt className="text-[#EF742C] font-medium text-[16px]">
                        Membership Id:
                      </dt>
                      &nbsp;
                      <dd className="font-semibold text-[16px] text-[#595757]">
                        {getMembershipId(selectedMember) || "-"}
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <img
                      src="/images/call_green.svg"
                      alt="Phone icon"
                      className="pb-1"
                    />
                    <div className="flex">
                      <dt className="text-[#EF742C] font-medium text-[16px]">
                        Mobile:
                      </dt>
                      &nbsp;
                      <dd className="font-semibold text-[16px] text-[#595757]">
                        {selectedMember.mobilenumber || "-"}
                      </dd>
                    </div>
                  </div>
                </dl>

                <dl className="grid grid-cols-2 gap-x-12 gap-y-6">
                  {editField(
                    "Transaction ID",
                    "transactionid",
                    selectedMember.transactionid
                  )}
                  {editField(
                    "Receipt Date",
                    "date",
                    selectedMember.date
                      ? new Date(selectedMember.date).toLocaleDateString("en-GB")
                      : "-"
                  )}
                  {editField(
                    "Project Name",
                    "projectname",
                    selectedMember.projectname
                  )}
                  {editField(
                    "Site Dimension",
                    "sitedimension",
                    selectedMember.sitedimension || selectedMember.dimension
                  )}
                  {editField(
                    "Payment Type",
                    "paymenttype",
                    selectedMember.paymenttype
                  )}
                  <div className="border-b border-gray-200 pb-4">
                    <dt className="inline font-semibold">Paid Amount: </dt>
                    {isEditing && !selectedMember?.cancelled ? (
                      <input
                        name="amountpaid"
                        value={editData.amountpaid || ""}
                        onChange={handleEditChange}
                        className="border border-gray-300 rounded px-2 py-1 text-sm ml-1"
                      />
                    ) : (
                      <dd className="inline font-normal">
                        ₹
                        {(
                          parseFloat(selectedMember.amountpaid) || 0
                        ).toLocaleString("en-IN")}
                      </dd>
                    )}
                  </div>
                  {editField(
                    "Payment Mode",
                    "paymentmode",
                    selectedMember.paymentmode
                  )}
                  {editField("Select Bank", "bank", selectedMember.bank)}
                  {isSuperAdmin && (
                    <div className="border-b border-gray-200 pb-4">
                      <dt className="inline font-semibold">Created By: </dt>
                      <dd className="inline font-normal ml-1">
                        <span className="inline-flex items-center gap-1 bg-orange-100 text-orange-700 text-xs font-semibold px-2 py-1 rounded-full">
                          👤 {selectedMember.created_by || "-"}
                        </span>
                      </dd>
                    </div>
                  )}
                  <div className="col-span-2 flex justify-end pt-2">
                    <button
                      onClick={() => handleDownloadReceipt(selectedMember)}
                      disabled={downloadingId === selectedMember._id}
                      className="flex items-center gap-2 font-medium border py-[8px] px-[20px] border-[#EF742C] rounded text-[14px] text-[#EF742C] hover:bg-[#EF742C] hover:text-white transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                      {downloadingId === selectedMember._id
                        ? "Generating..."
                        : "Download Receipt"}
                    </button>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}