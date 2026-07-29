import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { Header } from "./Header";
import { toast } from "react-toastify";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3001";

// Handles both real Date objects / ISO strings (membership_date)
// and dd-mm-yyyy strings (date, dob) without misparsing.
const formatDate = (val) => {
  if (!val) return "-";
  // Real Date object or ISO string (e.g. 2023-08-03T00:00:00.000Z)
  if (val instanceof Date || /^\d{4}-\d{2}-\d{2}/.test(val)) {
    const d = new Date(val);
    return isNaN(d) ? "-" : d.toLocaleDateString();
  }
  // dd-mm-yyyy string
  const m = String(val).match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    return `${dd}/${mm}/${yyyy}`;
  }
  return String(val);
};

// A membership ID packs four things together: a series prefix, the year it was
// issued, the membership type letter, and the member's sequence number —
// "GK2024P1176". The sequence number is what everyone means by "membership
// order", and it runs UNBROKEN across years and types: GK2024P1338 is followed
// immediately by GK2025A1339.
//
// So the sequence number must be the PRIMARY sort key. Comparing the ID chunk
// by chunk from the left instead makes the year the first tiebreaker and the
// type letter the second, which splits one continuous run into separate blocks
// (GK2024A, GK2024P, GK2025A, GK2025P) with the numbering restarting in each —
// that is why everything from 1176 onwards looked out of order.
//
// The prefix still groups first, so GK / NCS / NCG stay in their own runs;
// those are independent numbering series and interleaving them would be wrong.

// Leading letters of the ID. "GK2024P1176" -> "GK"
const idPrefix = (val) =>
  (String(val ?? "")
    .trim()
    .toUpperCase()
    .match(/^[A-Z]+/) || [""])[0];

// LAST run of digits in the ID = the sequence number. Taking the last group
// rather than the first is what skips over the year.
//   "GK2024P1176" -> 1176      "GK2025A1339" -> 1339
const idSequence = (val) => {
  const groups = String(val ?? "").match(/\d+/g);
  return groups ? Number(groups[groups.length - 1]) : null;
};

// Split an ID into alternating text / number chunks, used only as a tiebreaker
// now. Numeric segments still compare as NUMBERS, not as text, so an unpadded
// legacy "GK2023P9" never sorts after "GK2023P1000".
//   "GK2023P001" -> ["GK", "2023", "P", "001"]
const idChunks = (val) =>
  String(val ?? "")
    .trim()
    .toUpperCase()
    .split(/(\d+)/)
    .filter((part) => part !== "");

const compareChunks = (A, B) => {
  const len = Math.max(A.length, B.length);
  for (let i = 0; i < len; i++) {
    const x = A[i];
    const y = B[i];
    // Shorter ID that matched so far is the smaller one ("GK2023P1" < "GK2023P1A")
    if (x === undefined) return -1;
    if (y === undefined) return 1;

    const xIsNum = /^\d+$/.test(x);
    const yIsNum = /^\d+$/.test(y);

    if (xIsNum && yIsNum) {
      const diff = Number(x) - Number(y);
      if (diff !== 0) return diff;
    } else if (x !== y) {
      // Numeric chunks sort before text chunks at the same position.
      if (xIsNum !== yIsNum) return xIsNum ? -1 : 1;
      return x < y ? -1 : 1;
    }
  }
  return 0;
};

const compareMembershipId = (a, b) => {
  const aId = String(a ?? "").trim();
  const bId = String(b ?? "").trim();

  // Members with no ID sort to the bottom rather than crowding the top.
  if (!aId || !bId) return aId ? -1 : bId ? 1 : 0;

  // 1. Series prefix (GK / NCS / NCG) — separate numbering series stay grouped.
  const prefixDiff = idPrefix(aId).localeCompare(idPrefix(bId));
  if (prefixDiff !== 0) return prefixDiff;

  // 2. Sequence number — the actual membership order.
  const aSeq = idSequence(aId);
  const bSeq = idSequence(bId);
  if (aSeq === null && bSeq !== null) return 1;
  if (bSeq === null && aSeq !== null) return -1;
  if (aSeq !== null && bSeq !== null && aSeq !== bSeq) return aSeq - bSeq;

  // 3. Same sequence number (a re-issue, or a "-A" style suffix): fall back to
  //    the full chunk-wise compare so the ordering is still deterministic.
  return compareChunks(idChunks(aId), idChunks(bId));
};

export function MemberList() {
  const isSuperAdmin = !!localStorage.getItem("superAdminToken");
  const isAdmin = !!localStorage.getItem("adminToken");
  const canCancel = isSuperAdmin || isAdmin;

  const headers = [
    "Sl. No.",
    "Date",
    "Member Name",
    "Membership Id",
    "Membership Type",
    "",
  ];
  const [Memberdetails, SetMemberDetails] = useState([]);
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | cancelled
  const [search, setSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [showCancelPopup, setShowCancelPopup] = useState(false);
  const [cancelPdf, setCancelPdf] = useState(null);
  const [cancelPenalty, setCancelPenalty] = useState("");
  const [cancellingMember, setCancellingMember] = useState(null);

  useEffect(() => {
    axios
      .get(`${API_BASE}/members`)
      .then((response) => {
        SetMemberDetails(response.data.data || []);
      })
      .catch((err) => console.error("Unable to fetch the data", err));
  }, []);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (
      Memberdetails.filter((m) => {
        const matchesType =
          typeFilter === "All" || m.membershiptype === typeFilter;
        const matchesSearch =
          !q ||
          (m.name || "").toLowerCase().includes(q) ||
          (m.membership_id || "").toLowerCase().includes(q);
        const matchesStatus =
          statusFilter === "all"
            ? true
            : statusFilter === "cancelled"
              ? !!m.cancelled
              : !m.cancelled;
        return matchesType && matchesSearch && matchesStatus;
      })
        // .filter() already returned a fresh array, so sorting in place is safe
        // and never mutates Memberdetails.
        .sort((a, b) => compareMembershipId(a.membership_id, b.membership_id))
    );
  }, [Memberdetails, typeFilter, search, statusFilter]);

  const cancelledCount = Memberdetails.filter((m) => m.cancelled).length;

  const handleViewDetails = (member) => {
    setSelectedMember(member);
    setEditData(member);
    setIsModalOpen(true);
    setIsEditing(false);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedMember(null);
    setIsEditing(false);
  };

  const handleEditChange = (e) => {
    setEditData({ ...editData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    try {
      await axios.put(`${API_BASE}/members/${selectedMember._id}`, editData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("superAdminToken")}`,
        },
      });
      SetMemberDetails(
        Memberdetails.map((m) => (m._id === selectedMember._id ? editData : m)),
      );
      setSelectedMember(editData);
      setIsEditing(false);
      alert("Member updated successfully!");
    } catch (err) {
      console.error("Error updating member", err);
      alert("Failed to update member.");
    }
  };

  const handleCancelClick = (member) => {
    setCancellingMember(member);
    setCancelPenalty("");
    setShowCancelPopup(true);
  };

  const handleCancelPdfChange = (e) => {
    setCancelPdf(e.target.files[0]);
  };

  const handleCancelOk = async () => {
    if (!cancelPdf) {
      toast.error("Please upload a cancellation PDF!");
      return;
    }
    const formData = new FormData();
    formData.append("cancellationPdf", cancelPdf);
    formData.append("memberId", cancellingMember._id);
    const penaltyValue = Number(cancelPenalty) || 0;
    formData.append("penaltyAmount", penaltyValue);

    const token =
      localStorage.getItem("superAdminToken") ||
      localStorage.getItem("adminToken");

    try {
      await axios.post(`${API_BASE}/member/cancel`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });
      const updateCancelled = (list) =>
        list.map((m) =>
          m._id === cancellingMember._id
            ? { ...m, cancelled: true, cancellationPenalty: penaltyValue }
            : m,
        );
      SetMemberDetails((prev) => updateCancelled(prev));
      if (selectedMember?._id === cancellingMember._id) {
        setSelectedMember((prev) => ({
          ...prev,
          cancelled: true,
          cancellationPenalty: penaltyValue,
        }));
      }
      toast.success("Membership cancelled successfully!");
      setShowCancelPopup(false);
      setCancelPdf(null);
      setCancelPenalty("");
      setCancellingMember(null);
    } catch (err) {
      console.error("Cancellation error", err);
      toast.error("Failed to submit cancellation.");
    }
  };

  const handleCancelPopupClose = () => {
    setShowCancelPopup(false);
    setCancelPdf(null);
    setCancelPenalty("");
    setCancellingMember(null);
  };

  const field = (label, name, value) => (
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
      <div className="px-[50px] pt-[50px] font-semibold text-[24px]">
        All Member List
      </div>
      <div className="w-full max-w-[1120px] mx-auto px-6 pt-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or membership ID"
          className="flex-1 min-w-[220px] border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EF742C]"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#EF742C]"
        >
          <option value="All">All Membership Types</option>
          <option value="Permanent Member">Permanent Member</option>
          <option value="Associate Member">Associate Member</option>
        </select>
        <span className="text-sm text-gray-500">
          {filteredMembers.length} member
          {filteredMembers.length === 1 ? "" : "s"}
        </span>
        <div className="flex bg-gray-100 rounded-lg p-1">
          {[
            ["all", "All"],
            ["active", "Active"],
            ["cancelled", "Cancelled"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                statusFilter === key
                  ? "bg-[#EF742C] text-white shadow"
                  : "text-gray-600 hover:text-[#EF742C]"
              }`}
            >
              {label}
              {key === "cancelled" && cancelledCount > 0 && (
                <span
                  className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                    statusFilter === key
                      ? "bg-white/25 text-white"
                      : "bg-red-100 text-red-600"
                  }`}
                >
                  {cancelledCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="w-full max-w-[1120px] mx-auto p-6">
        <div className="overflow-hidden rounded-2xl shadow-lg">
          <table className="w-full">
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
              {filteredMembers.map((member, rowIndex) => (
                <tr
                  key={rowIndex}
                  className={`border-b border-gray-200 text-start text-[14px] transition-colors duration-200 ${
                    member.cancelled ? "bg-red-50" : "hover:bg-orange-50"
                  }`}
                >
                  <td className="px-6 py-4 text-gray-700 font-medium">
                    {rowIndex + 1}
                  </td>
                  <td className="px-6 py-4 text-gray-700 font-medium">
                    {formatDate(member.date)}
                  </td>
                  <td className="px-6 py-4 text-gray-700 font-medium">
                    {member.name || "-"}
                  </td>
                  <td className="px-6 py-4 text-gray-700 font-medium">
                    {member.membership_id || "-"}
                  </td>
                  <td className="px-6 py-4 text-gray-700 font-medium">
                    {member.membershiptype || "-"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center items-center gap-2">
                      <button
                        onClick={() => handleViewDetails(member)}
                        className="w-[170px] font-medium border-1 py-[6px] px-[10px] border-[#08A25C] rounded text-[14px] text-[#08A25C] hover:bg-[#08A25C] hover:text-white transition-colors duration-200"
                      >
                        View Details
                      </button>
                      {member.cancelled && (
                        <span className="bg-red-100 text-red-600 text-center text-xs font-semibold px-2 py-1 rounded-full">
                          Cancelled
                        </span>
                      )}
                      {canCancel && !member.cancelled && (
                        <button
                          onClick={() => handleCancelClick(member)}
                          className="w-[100px] font-medium border-1 py-[6px] px-[10px] border-red-500 rounded text-[14px] text-red-500 hover:bg-red-500 hover:text-white transition-colors duration-200"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredMembers.length === 0 && (
            <div className="p-6 text-center text-red-600">Not found.</div>
          )}
        </div>
      </div>

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
                className="flex items-center gap-2 text-[#EF742C] border border-[#EF742C] px-4 py-2 rounded-full hover:bg-orange-50 transition-colors"
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
                <span className="font-medium">Back to Member List</span>
              </button>

              <div className="flex items-center gap-3">
                {selectedMember.cancelled && (
                  <span className="bg-red-100 text-red-600 text-sm font-semibold px-4 py-2 rounded-full border border-red-300">
                    ✕ Cancelled
                  </span>
                )}

                {/* Edit/Save buttons - only for superadmin, and not once cancelled */}
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
                <div className="flex justify-between items-start">
                  <h2 className="text-2xl font-semibold">Member Details</h2>
                  <div className="w-16 h-16 bg-gray-200 rounded-full overflow-hidden flex items-center justify-center">
                    {selectedMember.image ? (
                      <img
                        src={selectedMember.image}
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
                  <div className="flex items-center gap-1">
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
                  <div className="flex items-center gap-1">
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
                        {selectedMember.membership_id || "-"}
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
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
                        {selectedMember.mobile || "-"}
                      </dd>
                    </div>
                  </div>
                </dl>

                <dl className="grid grid-cols-2 gap-x-12 gap-y-6">
                  {field(
                    "Application Number",
                    "applicationno",
                    selectedMember.applicationno,
                  )}
                  {field(
                    "Membership Type",
                    "membershiptype",
                    selectedMember.membershiptype,
                  )}
                  {field(
                    "Membership Date",
                    "date",
                    formatDate(selectedMember.date),
                  )}
                  {field(
                    "Membership Fees",
                    "membershipfees",
                    selectedMember.membershipfees,
                  )}
                  {field("Email", "email", selectedMember.email)}
                  {field("DOB", "dob", formatDate(selectedMember.dob))}
                  {field(
                    "Adhar Number",
                    "aadharnumber",
                    selectedMember.aadharnumber,
                  )}
                  {field(
                    "Birth Place",
                    "birthplace",
                    selectedMember.birthplace,
                  )}
                  {field(
                    "Alternate Mobile Number",
                    "alternatemobile",
                    selectedMember.alternatemobile,
                  )}
                  {field(
                    "Alternate Email",
                    "alternateemail",
                    selectedMember.alternateemail,
                  )}
                  {field(
                    "Permanent Address",
                    "permanentaddress",
                    selectedMember.permanentaddress,
                  )}
                  {field(
                    "Correspondence Address",
                    "correspondenceaddress",
                    selectedMember.correspondenceaddress,
                  )}
                  {field(
                    "Nominee Name",
                    "nomineename",
                    selectedMember.nomineename,
                  )}
                  {field(
                    "Nominee Mobile Number",
                    "nomineenumber",
                    selectedMember.nomineenumber,
                  )}
                  {field(
                    "Nominee Age",
                    "nomineeage",
                    selectedMember.nomineeage,
                  )}
                  {field(
                    "Nominee Relationship",
                    "nomineerelationship",
                    selectedMember.nomineerelationship,
                  )}
                  <div className="border-b border-gray-200 pb-4 col-span-2">
                    <dt className="inline font-semibold">Nominee Address: </dt>
                    {isEditing ? (
                      <input
                        name="nomineeaddress"
                        value={editData.nomineeaddress || ""}
                        onChange={handleEditChange}
                        className="border border-gray-300 rounded px-2 py-1 text-sm ml-1 w-full mt-1"
                      />
                    ) : (
                      <dd className="inline font-normal">
                        {selectedMember.nomineeaddress || "-"}
                      </dd>
                    )}
                  </div>
                </dl>

                {/* Cancellation details */}
                {selectedMember.cancelled && (
                  <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-4">
                    <h3 className="font-semibold text-[15px] mb-3 text-red-600">
                      Cancellation Details
                    </h3>
                    <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm">
                      <div>
                        <span className="font-semibold text-gray-600">
                          Penalty Amount:{" "}
                        </span>
                        <span className="text-red-600 font-semibold">
                          ₹
                          {Number(
                            selectedMember.cancellationPenalty || 0,
                          ).toLocaleString("en-IN")}
                        </span>
                      </div>
                      {selectedMember.cancelledAt && (
                        <div>
                          <span className="font-semibold text-gray-600">
                            Cancelled On:{" "}
                          </span>
                          <span>
                            {new Date(
                              selectedMember.cancelledAt,
                            ).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {selectedMember.cancellationPdfUrl && (
                        <div className="col-span-2">
                          <a
                            href={selectedMember.cancellationPdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#EF742C] font-medium hover:underline"
                          >
                            📎 View Cancellation Document
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Documents Section */}
                {(selectedMember.aadharcard ||
                  selectedMember.pancard ||
                  selectedMember.applicationdoc) && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-[16px] font-semibold text-gray-800 mb-4">
                      📄 Uploaded Documents
                    </h3>
                    <div className="grid grid-cols-3 gap-4">
                      {/* Aadhar Card */}
                      {selectedMember.aadharcard ? (
                        <a
                          href={selectedMember.aadharcard}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-[#8356D6] rounded-xl hover:bg-purple-50 transition-colors group"
                        >
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                            <svg
                              className="w-5 h-5 text-[#EF742C]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                              />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-[#EF742C] text-center">
                            Aadhar Card
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <svg
                              className="w-3 h-3"
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
                          </span>
                        </a>
                      ) : (
                        <div className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-xl opacity-50">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                              />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-gray-400 text-center">
                            Aadhar Card
                          </span>
                          <span className="text-xs text-gray-300">
                            Not uploaded
                          </span>
                        </div>
                      )}

                      {/* PAN Card */}
                      {selectedMember.pancard ? (
                        <a
                          href={selectedMember.pancard}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-[#EF742C] rounded-xl hover:bg-orange-50 transition-colors group"
                        >
                          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                            <svg
                              className="w-5 h-5 text-[#EF742C]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                              />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-[#EF742C] text-center">
                            PAN Card
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <svg
                              className="w-3 h-3"
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
                          </span>
                        </a>
                      ) : (
                        <div className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-xl opacity-50">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                              />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-gray-400 text-center">
                            PAN Card
                          </span>
                          <span className="text-xs text-gray-300">
                            Not uploaded
                          </span>
                        </div>
                      )}

                      {/* Application PDF */}
                      {selectedMember.applicationdoc ? (
                        <a
                          href={selectedMember.applicationdoc}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-[#EF742C] rounded-xl hover:bg-orange-50 transition-colors group"
                        >
                          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                            <svg
                              className="w-5 h-5 text-[#orange]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-[#EF742C] text-center">
                            Application PDF
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <svg
                              className="w-3 h-3"
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
                          </span>
                        </a>
                      ) : (
                        <div className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-xl opacity-50">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <svg
                              className="w-5 h-5 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-gray-400 text-center">
                            Application PDF
                          </span>
                          <span className="text-xs text-gray-300">
                            Not uploaded
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Popup */}
      {showCancelPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[500px] p-6">
            <h2 className="text-xl font-semibold mb-2">Cancel Membership</h2>
            <p className="text-gray-600 mb-4">
              Are you sure you want to cancel the membership for{" "}
              <span className="font-semibold text-[#EF742C]">
                {cancellingMember?.name}
              </span>
              ? Please upload a cancellation PDF to proceed.
            </p>
            <div className="border-2 border-dashed border-[#EF742C] rounded-xl p-6 text-center mb-4">
              <input
                type="file"
                accept="application/pdf"
                onChange={handleCancelPdfChange}
                className="hidden"
                id="cancelPdfInput"
              />
              <label htmlFor="cancelPdfInput" className="cursor-pointer">
                <div className="flex flex-col items-center gap-2">
                  <svg
                    className="w-10 h-10 text-[#EF742C]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  <span className="text-[#EF742C] font-medium">
                    {cancelPdf
                      ? cancelPdf.name
                      : "Click to upload cancellation PDF"}
                  </span>
                </div>
              </label>
            </div>

            {/* Optional penalty amount */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Penalty Amount{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  ₹
                </span>
                <input
                  type="number"
                  min="0"
                  value={cancelPenalty}
                  onChange={(e) => setCancelPenalty(e.target.value)}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#EF742C] focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Leave blank or 0 if no penalty is being charged.
              </p>
            </div>

            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelPopupClose}
                className="px-6 py-2 border border-gray-400 text-gray-600 rounded-full font-semibold hover:bg-gray-100"
              >
                Close
              </button>
              <button
                onClick={handleCancelOk}
                className="px-6 py-2 bg-red-500 text-white rounded-full font-semibold hover:bg-red-600"
              >
                OK - Submit Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}