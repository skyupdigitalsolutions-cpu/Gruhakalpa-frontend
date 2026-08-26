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
  const [selectedMember, setSelectedMember] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [downloadingId, setDownloadingId] = useState(null);
  const [memberImage, setMemberImage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

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
    const query = searchQuery.trim();
    if (query === "") {
      setFilteredMembers(Memberdetails);
      return;
    }
    const q = query.toLowerCase();
    const normalizedQuery = formatMembershipId(query).toLowerCase();
    const filtered = Memberdetails.filter((member) => {
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
    setFilteredMembers(filtered);
  }, [searchQuery, Memberdetails]);

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
    try {
      await axios.put(
        `${API_BASE}/receipts/${selectedMember._id}`,
        editData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("superAdminToken")}`,
          },
        }
      );
      SetMemberDetails(
        Memberdetails.map((m) =>
          m._id === selectedMember._id ? editData : m
        )
      );
      setSelectedMember(editData);
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
                className="w-full px-4 py-2 pl-10 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EF742C] focus:border-transparent"
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
          <table className="w-full min-w-[800px]">
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
                      ? new Date(member.date).toLocaleDateString()
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
                      ? new Date(selectedMember.date).toLocaleDateString()
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