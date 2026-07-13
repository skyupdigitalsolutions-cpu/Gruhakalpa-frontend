/* eslint-disable */
import axios from "axios";
import { useEffect, useState } from "react";
import { Header } from "./Header";
import { toast } from "react-toastify";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3001";

// Add N calendar months to a date, clamping the day (Jan 31 + 1mo -> Feb 28/29)
const addMonths = (base, months) => {
  const d = new Date(base);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
};

// Pretty-print a date, or an em-dash when missing
const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export function SiteBookingList() {
  const isSuperAdmin = !!localStorage.getItem("superAdminToken");
  const isAdmin = !!localStorage.getItem("adminToken");
  const canCancel = isSuperAdmin || isAdmin;

  const headers = ["Date", "Member Name", "Membership Id", "Project Name", ""];
  const [Memberdetails, SetMemberDetails] = useState([]);
  const [filteredMembers, setFilteredMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // all | active | cancelled
  const [cancelPenalty, setCancelPenalty] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showMemberDetails, setShowMemberDetails] = useState(false);
  const [memberDetailsData, setMemberDetailsData] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [showCancelPopup, setShowCancelPopup] = useState(false);
  const [cancelPdf, setCancelPdf] = useState(null);
  const [cancellingMember, setCancellingMember] = useState(null);

  // Receipt-based payment tracking
  const [memberReceipts, setMemberReceipts] = useState([]);
  const [isFetchingReceipts, setIsFetchingReceipts] = useState(false);

  // Profile image fetched by membership_id
  const [memberImage, setMemberImage] = useState(null);

  // Resolve the membership id off a receipt (canonical field is `membershipid`,
  // older receipts may only carry the legacy `seniority_no`)
  const getReceiptMembershipId = (receipt) =>
    receipt?.membershipid || receipt?.seniority_no || "";

  // Project → Membership Id prefix map (legacy projects)
  const projectPrefixMap = {
    "New City 1": "NCS",
    "New City": "NCG",
  };

  useEffect(() => {
    axios
      .get(`${API_BASE}/sitebookings`)
      .then((response) => {
        SetMemberDetails(response.data || []);
        setFilteredMembers(response.data || []);
      })
      .catch((err) => console.error("Unable to fetch the data", err));
  }, []);

  useEffect(() => {
    let list = Memberdetails;

    if (statusFilter === "active") {
      list = list.filter((m) => !m.cancelled);
    } else if (statusFilter === "cancelled") {
      list = list.filter((m) => m.cancelled);
    }

    if (searchQuery.trim() !== "") {
      const q = searchQuery.toLowerCase();
      list = list.filter((m) => m.membership_id?.toLowerCase().includes(q));
    }

    setFilteredMembers(list);
  }, [searchQuery, Memberdetails, statusFilter]);

  const handleSearchChange = (e) => setSearchQuery(e.target.value);
  const clearSearch = () => setSearchQuery("");

  const handleViewDetails = async (member) => {
    setSelectedMember(member);
    setEditData(member);
    setIsModalOpen(true);
    setShowMemberDetails(false);
    setMemberDetailsData(null);
    setIsEditing(false);
    setMemberReceipts([]);
    setMemberImage(null);

    // Fetch member profile image by membership_id
    axios
      .get(`${API_BASE}/members`)
      .then((res) => {
        const members = res.data.data || [];
        const found = members.find(
          (m) => m.membership_id === member.membership_id,
        );
        if (found?.image) setMemberImage(found.image);
      })
      .catch((err) => console.error("Error fetching member image:", err));

    // Fetch receipts for this member's membership_id
    setIsFetchingReceipts(true);
    try {
      const token =
        localStorage.getItem("superAdminToken") ||
        localStorage.getItem("adminToken");
      const res = await axios.get(`${API_BASE}/receipts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const allReceipts = res.data?.data || [];
      const filtered = allReceipts.filter(
        (r) =>
          getReceiptMembershipId(r) === member.membership_id && !r.cancelled,
      );
      setMemberReceipts(filtered);
    } catch (err) {
      console.error("Error fetching receipts:", err);
    } finally {
      setIsFetchingReceipts(false);
    }
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedMember(null);
    setShowMemberDetails(false);
    setMemberDetailsData(null);
    setIsEditing(false);
    setMemberReceipts([]);
    setMemberImage(null);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditData((prev) => ({ ...prev, [name]: value }));
  };

  // Project dropdown change — auto-update membership id prefix
  const handleProjectChange = (e) => {
    const newProject = e.target.value;

    setEditData((prev) => {
      const oldPrefix = Object.values(projectPrefixMap).find((p) =>
        prev.membership_id?.startsWith(p),
      );
      const newPrefix = projectPrefixMap[newProject];

      let updatedMembershipId = prev.membership_id || "";
      if (oldPrefix && newPrefix && oldPrefix !== newPrefix) {
        updatedMembershipId = updatedMembershipId.replace(oldPrefix, newPrefix);
      }

      return {
        ...prev,
        projectname: newProject,
        membership_id: updatedMembershipId,
      };
    });
  };

  const handleSave = async () => {
    const token =
      localStorage.getItem("superAdminToken") ||
      localStorage.getItem("adminToken");

    const payload = {
      membership_id: editData.membership_id,
      name: editData.name,
      projectname: editData.projectname,
      sitedimension: editData.sitedimension,
      totalamount: editData.totalamount,
      date: editData.date,
      designation: editData.designation,
      nominees: editData.nominees,
    };

    try {
      const response = await axios.put(
        `${API_BASE}/sitebookings/${selectedMember._id}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.data?.success) {
        const updatedMember = { ...selectedMember, ...payload };
        SetMemberDetails((prev) =>
          prev.map((m) => (m._id === selectedMember._id ? updatedMember : m)),
        );
        setFilteredMembers((prev) =>
          prev.map((m) => (m._id === selectedMember._id ? updatedMember : m)),
        );
        setSelectedMember(updatedMember);
        setEditData(updatedMember);
        setIsEditing(false);
        toast.success("Site booking updated successfully!");
      } else {
        toast.error(response.data?.message || "Failed to update site booking.");
      }
    } catch (err) {
      console.error("Error updating:", err.response?.data || err.message);
      toast.error(
        err.response?.data?.message || "Failed to update site booking.",
      );
    }
  };

  const handleViewMemberDetails = async () => {
    try {
      const response = await axios.get(`${API_BASE}/members`);
      const members = response.data.data || [];
      const memberData = members.find(
        (member) => member.membership_id === selectedMember.membership_id,
      );
      if (memberData) {
        setMemberDetailsData(memberData);
        setShowMemberDetails(true);
      } else {
        toast.error("Member details not found!");
      }
    } catch (err) {
      toast.error("Error fetching member details!");
    }
  };

  const handleBackToSiteBooking = () => {
    setShowMemberDetails(false);
    setMemberDetailsData(null);
  };

  const MEMBERSHIP_FEE = 2500;

  const calculatePaymentSummary = (member) => {
    const totalAmount = parseFloat(member.totalamount) || 0;
    const totalPaid = memberReceipts.reduce(
      (sum, r) => sum + (parseFloat(r.amountpaid) || 0),
      0,
    );
    // New user = their FIRST receipt has is_new_user === true (set by backend at creation)
    const isNewUser = memberReceipts.some((r) => r.is_new_user === true);
    // Membership fee is separate — only the site payment counts toward totalAmount
    const membershipFee = isNewUser ? MEMBERSHIP_FEE : 0;
    const paidAmount = totalPaid - membershipFee;   // site payment only e.g. 102500 - 2500 = 100000
    const remainingAmount = totalAmount - paidAmount; // 500000 - 100000 = 400000
    return { totalAmount, paidAmount, remainingAmount, isNewUser };
  };

  // Status pill colours for the schedule table
  const statusStyle = {
    Paid: "bg-green-100 text-green-700",
    Partial: "bg-amber-100 text-amber-700",
    Overdue: "bg-red-100 text-red-600",
    Pending: "bg-gray-100 text-gray-500",
  };

  // ── Build the ordered installment schedule for a booking, and attribute how
  //    much has been paid toward each bucket (and WHEN) from the member's
  //    receipts. Payments waterfall across buckets in date order — Down Payment
  //    first, then Installment 1, 2, ... — so partial payments fill earlier
  //    buckets first. The membership fee (₹2500 for new users) is excluded so
  //    it doesn't inflate the first bucket.
  const buildSchedule = (member, receipts, isNewUser) => {
    const bookingDate = member.date ? new Date(member.date) : new Date();
    const rows = [];
    const dp = Number(member.downpayment) || 0;
    const isFull = member.paymentplan === "full";
    const installments = Array.isArray(member.installments)
      ? member.installments
      : [];

    if (isFull && installments.length === 0) {
      rows.push({
        label: "Full Payment",
        amount: Number(member.totalamount) || 0,
        dueDate: member.downPaymentDate || bookingDate,
      });
    } else {
      if (dp > 0) {
        rows.push({
          label: "Down Payment",
          amount: dp,
          dueDate: member.downPaymentDate || bookingDate,
        });
      }
      installments.forEach((it, i) => {
        const amt = Number(it.amount) || 0;
        if (amt <= 0) return;
        rows.push({
          label: it.label || `Installment ${i + 1}`,
          amount: amt,
          // Stored due date wins; legacy bookings fall back to monthly schedule.
          dueDate: it.dueDate || addMonths(bookingDate, i + 1),
        });
      });
    }

    // Date-ordered payment chunks, with the membership fee peeled off the front.
    const active = (receipts || [])
      .filter((r) => !r.cancelled)
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const chunks = active.map((r) => ({
      amount: Number(r.amountpaid) || 0,
      date: r.date,
    }));
    let feeToRemove = isNewUser ? MEMBERSHIP_FEE : 0;
    for (const c of chunks) {
      if (feeToRemove <= 0) break;
      const cut = Math.min(feeToRemove, c.amount);
      c.amount -= cut;
      feeToRemove -= cut;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let ci = 0;
    for (const row of rows) {
      let need = row.amount;
      row.paid = 0;
      row.paidDate = null;
      while (need > 0 && ci < chunks.length) {
        if (chunks[ci].amount <= 0) {
          ci++;
          continue;
        }
        const take = Math.min(need, chunks[ci].amount);
        chunks[ci].amount -= take;
        need -= take;
        row.paid += take;
        row.paidDate = chunks[ci].date; // last receipt that touched this bucket
        if (chunks[ci].amount <= 0) ci++;
      }
      row.outstanding = Math.max(row.amount - row.paid, 0);
      if (row.amount > 0 && row.outstanding === 0) {
        row.status = "Paid";
      } else if (row.paid > 0) {
        row.status = "Partial";
      } else {
        const due = row.dueDate ? new Date(row.dueDate) : null;
        if (due) due.setHours(0, 0, 0, 0);
        row.status = due && due < today ? "Overdue" : "Pending";
      }
    }

    return rows;
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
    formData.append("bookingId", cancellingMember._id);
    const penaltyValue = Number(cancelPenalty) || 0;
    formData.append("penaltyAmount", penaltyValue);

    const token =
      localStorage.getItem("superAdminToken") ||
      localStorage.getItem("adminToken");

    try {
      await axios.post(`${API_BASE}/sitebooking/cancel`, formData, {
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
      setFilteredMembers((prev) => updateCancelled(prev));
      toast.success("Site booking cancelled successfully!");
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

  // Generic editable field
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

  const cancelledCount = Memberdetails.filter((m) => m.cancelled).length;

  return (
    <div>
      <Header />
      <div className="px-[50px] pt-[50px]">
        <div className="flex justify-between items-center mb-6">
          <h1 className="font-semibold text-[24px]">All Sitebookings List</h1>

          <div className="flex items-center gap-3">
            {/* Status filter */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              {[
                ["all", "All"],
                ["active", "Active"],
                ["cancelled", "Cancelled"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    statusFilter === key
                      ? "bg-[#EF742C] text-white shadow"
                      : "text-gray-600 hover:text-[#EF742C]"
                  }`}
                >
                  {label}
                  {key === "cancelled" && cancelledCount > 0 && (
                    <span
                      className={`ml-1.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${
                        statusFilter === key
                          ? "bg-white text-[#EF742C]"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {cancelledCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Search bar */}
            <div className="relative w-[300px]">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by Membership Id..."
                value={searchQuery}
                onChange={handleSearchChange}
                className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EF742C] focus:border-transparent"
              />
              {searchQuery ? (
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
              ) : (
                <svg
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
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
        </div>
      </div>

      {/* Table */}
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
                    {member.date
                      ? new Date(member.date).toLocaleDateString()
                      : "-"}
                  </td>
                  <td className="px-6 py-4 text-gray-700 font-medium">
                    <div className="flex items-center gap-2">
                      {member.name || "-"}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-700 font-medium">
                    {member.membership_id || "-"}
                  </td>
                  <td className="px-6 py-4 text-gray-700 font-medium">
                    {member.projectname || "-"}
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
            <div className="p-6 text-center text-red-600">
              {searchQuery
                ? `No bookings found for "${searchQuery}"`
                : "Not found."}
            </div>
          )}
        </div>
      </div>

      {/* View Details Modal */}
      {isModalOpen && selectedMember && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-[900px] max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 pb-4 flex justify-between items-center">
              <button
                onClick={
                  showMemberDetails ? handleBackToSiteBooking : closeModal
                }
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
                <span className="font-medium">Back to Site Booking</span>
              </button>

              <div className="flex items-center gap-3">
                {selectedMember.cancelled && (
                  <span className="bg-red-100 text-red-600 text-sm font-semibold px-4 py-2 rounded-full border border-red-300">
                    ✕ Cancelled
                  </span>
                )}

                {isSuperAdmin &&
                  !showMemberDetails &&
                  !selectedMember.cancelled && (
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

            {/* Site Booking Details */}
            {!showMemberDetails && (
              <div className="px-6 pb-6">
                <div
                  className={`bg-white border rounded-2xl p-6 ${
                    selectedMember.cancelled
                      ? "border-red-300"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex justify-between items-start mb-6">
                    <h2 className="text-2xl font-semibold">
                      Site Booking Details
                    </h2>
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

                  {/* Top info row */}
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
                          {isEditing
                            ? editData.membership_id || "-"
                            : selectedMember.membership_id || "-"}
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

                  {/* Editable fields grid */}
                  <dl className="grid grid-cols-2 gap-x-12 gap-y-6">
                    {/* Project Name — dropdown when editing */}
                    <div className="border-b border-gray-200 pb-4">
                      <dt className="inline font-semibold">Project Name: </dt>
                      {isEditing && !selectedMember?.cancelled ? (
                        <select
                          name="projectname"
                          value={editData.projectname || ""}
                          onChange={handleProjectChange}
                          className="border border-gray-300 rounded px-2 py-1 text-sm ml-1"
                        >
                          <option value="">Select Project</option>
                          {Object.keys(projectPrefixMap).map((project) => (
                            <option key={project} value={project}>
                              {project}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <dd className="inline font-normal">
                          {selectedMember.projectname || "-"}
                        </dd>
                      )}
                    </div>

                    {/* Membership Id */}
                    <div className="border-b border-gray-200 pb-4">
                      <dt className="inline font-semibold">Membership Id: </dt>
                      {isEditing && !selectedMember?.cancelled ? (
                        <input
                          name="membership_id"
                          value={editData.membership_id || ""}
                          onChange={handleEditChange}
                          className="border border-gray-300 rounded px-2 py-1 text-sm ml-1"
                        />
                      ) : (
                        <dd className="inline font-normal">
                          {selectedMember.membership_id || "-"}
                        </dd>
                      )}
                    </div>

                    {editField(
                      "Site Dimension",
                      "sitedimension",
                      selectedMember.sitedimension,
                    )}
                    {editField(
                      "Total Amount",
                      "totalamount",
                      selectedMember.totalamount,
                    )}
                    {(selectedMember.designation || isEditing) &&
                      editField(
                        "Designation",
                        "designation",
                        selectedMember.designation,
                      )}

                    {/* Payment Summary */}
                    {(() => {
                      const { totalAmount, paidAmount, remainingAmount, isNewUser } =
                        calculatePaymentSummary(selectedMember);
                      return (
                        <>
                          <div className="border-b border-gray-200 pb-4">
                            <dt className="inline font-semibold">
                              Paid Amount:{" "}
                            </dt>
                            <dd className="inline text-green-600 font-semibold">
                              {isFetchingReceipts
                                ? "Loading..."
                                : `₹${paidAmount.toLocaleString("en-IN")}`}
                            </dd>
                          </div>
                          {!isFetchingReceipts && isNewUser && (
                            <div className="border-b border-gray-200 pb-4">
                              <dt className="inline font-semibold">
                                Membership Fee:{" "}
                              </dt>
                              <dd className="inline font-semibold text-blue-600">
                                ₹{MEMBERSHIP_FEE.toLocaleString("en-IN")}
                              </dd>
                              <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                New Member
                              </span>
                            </div>
                          )}
                          <div className="border-b border-gray-200 pb-4">
                            <dt className="inline font-semibold">
                              Remaining Amount:{" "}
                            </dt>
                            <dd
                              className={`inline font-semibold ${
                                remainingAmount > 0
                                  ? "text-red-500"
                                  : "text-green-600"
                              }`}
                            >
                              {isFetchingReceipts
                                ? "Loading..."
                                : `₹${remainingAmount.toLocaleString("en-IN")}`}
                            </dd>
                          </div>
                        </>
                      );
                    })()}
                  </dl>

                  {/* Installment Schedule & Payment Dates */}
                  {!selectedMember.cancelled &&
                    (() => {
                      const isNewUser = memberReceipts.some(
                        (r) => r.is_new_user === true,
                      );
                      const schedule = buildSchedule(
                        selectedMember,
                        memberReceipts,
                        isNewUser,
                      );
                      if (!schedule.length) return null;
                      const totalPaid = schedule.reduce(
                        (s, r) => s + (r.paid || 0),
                        0,
                      );
                      const totalDue = schedule.reduce(
                        (s, r) => s + (r.amount || 0),
                        0,
                      );
                      return (
                        <div className="mt-8">
                          <h3 className="font-semibold text-[15px] mb-3 text-[#EF742C]">
                            Installment Schedule &amp; Payment Dates
                          </h3>
                          <div className="overflow-x-auto border border-gray-200 rounded-xl">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-orange-50 text-left text-[#EF742C]">
                                  <th className="px-4 py-2.5 font-semibold">
                                    Installment
                                  </th>
                                  <th className="px-4 py-2.5 font-semibold">
                                    Amount
                                  </th>
                                  <th className="px-4 py-2.5 font-semibold">
                                    Due Date
                                  </th>
                                  <th className="px-4 py-2.5 font-semibold">
                                    Paid
                                  </th>
                                  <th className="px-4 py-2.5 font-semibold">
                                    Payment Date
                                  </th>
                                  <th className="px-4 py-2.5 font-semibold">
                                    Status
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {schedule.map((row, i) => (
                                  <tr
                                    key={i}
                                    className="border-t border-gray-100"
                                  >
                                    <td className="px-4 py-2.5 font-medium text-gray-700 whitespace-nowrap">
                                      {row.label}
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-700 whitespace-nowrap">
                                      ₹
                                      {Number(row.amount).toLocaleString(
                                        "en-IN",
                                      )}
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                                      {fmtDate(row.dueDate)}
                                    </td>
                                    <td className="px-4 py-2.5 text-green-600 font-medium whitespace-nowrap">
                                      {row.paid > 0
                                        ? `₹${Number(row.paid).toLocaleString("en-IN")}`
                                        : "—"}
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                                      {row.paidDate ? fmtDate(row.paidDate) : "—"}
                                    </td>
                                    <td className="px-4 py-2.5">
                                      <span
                                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                          statusStyle[row.status] ||
                                          statusStyle.Pending
                                        }`}
                                      >
                                        {row.status}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t border-gray-200 bg-gray-50 font-semibold text-gray-700">
                                  <td className="px-4 py-2.5">Total</td>
                                  <td className="px-4 py-2.5 whitespace-nowrap">
                                    ₹{totalDue.toLocaleString("en-IN")}
                                  </td>
                                  <td className="px-4 py-2.5" />
                                  <td className="px-4 py-2.5 text-green-600 whitespace-nowrap">
                                    ₹{totalPaid.toLocaleString("en-IN")}
                                  </td>
                                  <td className="px-4 py-2.5" colSpan={2} />
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                          {isFetchingReceipts && (
                            <div className="text-xs text-gray-400 mt-2">
                              Loading payments…
                            </div>
                          )}
                          <div className="mt-2 text-[11px] text-gray-400">
                            Paid amounts and payment dates are derived from this
                            member's receipts (membership fee excluded). Bookings
                            saved without due dates fall back to a monthly
                            schedule from the booking date.
                          </div>
                        </div>
                      );
                    })()}

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

                  {/* Family Particulars Section */}
                  {selectedMember.nominees &&
                    selectedMember.nominees.length > 0 && (
                      <div className="mt-6">
                        <h3 className="font-semibold text-[15px] mb-3 text-[#EF742C]">
                          Family Particulars
                        </h3>
                        <div className="flex flex-col gap-3">
                          {selectedMember.nominees.map((member, idx) => (
                            <div
                              key={idx}
                              className="bg-gray-50 border border-gray-200 rounded-xl p-4"
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-semibold text-[#EF742C] bg-orange-100 px-2 py-0.5 rounded-full">
                                  Member {idx + 1}
                                </span>
                              </div>
                              <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                  <span className="font-semibold text-gray-600">
                                    Name:{" "}
                                  </span>
                                  <span>{member.name || "-"}</span>
                                </div>
                                <div>
                                  <span className="font-semibold text-gray-600">
                                    Age:{" "}
                                  </span>
                                  <span>{member.age || "-"}</span>
                                </div>
                                <div>
                                  <span className="font-semibold text-gray-600">
                                    Relationship:{" "}
                                  </span>
                                  <span>{member.relationship || "-"}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  <div className="text-center mt-6">
                    <button
                      onClick={handleViewMemberDetails}
                      className="bg-gradient-to-r from-orange-200 via-orange-500 to-orange-600 px-6 py-2 rounded-full text-white font-semibold text-[16px] hover:opacity-90 transition-opacity"
                    >
                      View Member Details
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Full Member Details */}
            {showMemberDetails && memberDetailsData && (
              <div className="px-6 pb-6">
                <div className="bg-white border border-gray-200 rounded-2xl p-6">
                  <div className="flex justify-between items-start mb-6">
                    <h2 className="text-2xl font-semibold">Member Details</h2>
                    <div className="w-16 h-16 bg-gray-200 rounded-full overflow-hidden flex items-center justify-center">
                      {memberDetailsData.image ? (
                        <img
                          src={memberDetailsData.image}
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
                        src="/images/person_1.svg"
                        alt="Person icon"
                        className="pb-1"
                      />
                      <div className="flex">
                        <dt className="text-[#8356D6] font-medium text-[16px]">
                          Name:
                        </dt>
                        &nbsp;
                        <dd className="font-semibold text-[16px] text-[#595757]">
                          {memberDetailsData.name || "-"}
                        </dd>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <img
                        src="/images/assignment_ind.png"
                        alt="ID icon"
                        className="pb-1"
                      />
                      <div className="flex">
                        <dt className="text-[#8356D6] font-medium text-[16px]">
                          Membership Id:
                        </dt>
                        &nbsp;
                        <dd className="font-semibold text-[16px] text-[#595757]">
                          {memberDetailsData.membership_id || "-"}
                        </dd>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <img
                        src="/images/call.svg"
                        alt="Phone icon"
                        className="pb-1"
                      />
                      <div className="flex">
                        <dt className="text-[#8356D6] font-medium text-[16px]">
                          Mobile:
                        </dt>
                        &nbsp;
                        <dd className="font-semibold text-[16px] text-[#595757]">
                          {memberDetailsData.mobile || "-"}
                        </dd>
                      </div>
                    </div>
                  </dl>

                  <dl className="grid grid-cols-2 gap-x-12 gap-y-6">
                    <div className="border-b border-gray-200 pb-4">
                      <dt className="inline font-semibold">
                        Application Number:{" "}
                      </dt>
                      <dd className="inline font-normal">
                        {memberDetailsData.applicationno || "-"}
                      </dd>
                    </div>
                    <div className="border-b border-gray-200 pb-4">
                      <dt className="inline font-semibold">
                        Membership Type:{" "}
                      </dt>
                      <dd className="inline font-normal">
                        {memberDetailsData.membershiptype || "-"}
                      </dd>
                    </div>
                    <div className="border-b border-gray-200 pb-4">
                      <dt className="inline font-semibold">
                        Membership Date:{" "}
                      </dt>
                      <dd className="inline font-normal">
                        {memberDetailsData.membershipday || "-"}
                      </dd>
                    </div>
                    <div className="border-b border-gray-200 pb-4">
                      <dt className="inline font-semibold">
                        Membership Fees:{" "}
                      </dt>
                      <dd className="inline font-normal">
                        {memberDetailsData.membershipfees || "-"}
                      </dd>
                    </div>
                    <div className="border-b border-gray-200 pb-4">
                      <dt className="inline font-semibold">Email: </dt>
                      <dd className="inline font-normal">
                        {memberDetailsData.email || "-"}
                      </dd>
                    </div>
                    <div className="border-b border-gray-200 pb-4">
                      <dt className="inline font-semibold">DOB: </dt>
                      <dd className="inline font-normal">
                        {memberDetailsData.dob
                          ? new Date(memberDetailsData.dob).toLocaleDateString()
                          : "-"}
                      </dd>
                    </div>
                    <div className="border-b border-gray-200 pb-4">
                      <dt className="inline font-semibold">Aadhar Number: </dt>
                      <dd className="inline font-normal">
                        {memberDetailsData.aadharnumber || "-"}
                      </dd>
                    </div>
                    <div className="border-b border-gray-200 pb-4">
                      <dt className="inline font-semibold">Birth Place: </dt>
                      <dd className="inline font-normal">
                        {memberDetailsData.birthplace || "-"}
                      </dd>
                    </div>
                    <div className="border-b border-gray-200 pb-4">
                      <dt className="inline font-semibold">
                        Alternate Mobile:{" "}
                      </dt>
                      <dd className="inline font-normal">
                        {memberDetailsData.alternatemobile || "-"}
                      </dd>
                    </div>
                    <div className="border-b border-gray-200 pb-4">
                      <dt className="inline font-semibold">
                        Alternate Email:{" "}
                      </dt>
                      <dd className="inline font-normal">
                        {memberDetailsData.alternateemail || "-"}
                      </dd>
                    </div>
                    <div className="border-b border-gray-200 pb-4">
                      <dt className="inline font-semibold">
                        Permanent Address:{" "}
                      </dt>
                      <dd className="inline font-normal">
                        {memberDetailsData.permanentaddress || "-"}
                      </dd>
                    </div>
                    <div className="border-b border-gray-200 pb-4">
                      <dt className="inline font-semibold">
                        Correspondence Address:{" "}
                      </dt>
                      <dd className="inline font-normal">
                        {memberDetailsData.correspondenceaddress || "-"}
                      </dd>
                    </div>
                    <div className="border-b border-gray-200 pb-4">
                      <dt className="inline font-semibold">Nominee Name: </dt>
                      <dd className="inline font-normal">
                        {memberDetailsData.nomineename || "-"}
                      </dd>
                    </div>
                    <div className="border-b border-gray-200 pb-4">
                      <dt className="inline font-semibold">Nominee Mobile: </dt>
                      <dd className="inline font-normal">
                        {memberDetailsData.nomineenumber || "-"}
                      </dd>
                    </div>
                    <div className="border-b border-gray-200 pb-4">
                      <dt className="inline font-semibold">Nominee Age: </dt>
                      <dd className="inline font-normal">
                        {memberDetailsData.nomineeage || "-"}
                      </dd>
                    </div>
                    <div className="border-b border-gray-200 pb-4">
                      <dt className="inline font-semibold">
                        Nominee Relationship:{" "}
                      </dt>
                      <dd className="inline font-normal">
                        {memberDetailsData.nomineerelationship || "-"}
                      </dd>
                    </div>
                    <div className="border-b border-gray-200 pb-4 col-span-2">
                      <dt className="inline font-semibold">
                        Nominee Address:{" "}
                      </dt>
                      <dd className="inline font-normal">
                        {memberDetailsData.nomineeaddress || "-"}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cancel Popup */}
      {showCancelPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[500px] p-6">
            <h2 className="text-xl font-semibold mb-2">Cancel Site Booking</h2>
            <p className="text-gray-600 mb-4">
              Are you sure you want to cancel the booking for{" "}
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