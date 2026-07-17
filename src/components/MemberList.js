import axios from "axios";
import { useEffect, useState } from "react";
import { Header } from "./Header";

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

export function MemberList() {
  const isSuperAdmin = !!localStorage.getItem("superAdminToken");

  const headers = [
    "Date",
    "Member Name",
    "Membership Id",
    "Membership Type",
    "",
  ];
  const [Memberdetails, SetMemberDetails] = useState([]);
  const [selectedMember, setSelectedMember] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    axios
      .get(`${API_BASE}/members`)
      .then((response) => {
        SetMemberDetails(response.data.data || []);
      })
      .catch((err) => console.error("Unable to fetch the data", err));
  }, []);

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
      await axios.put(
        `${API_BASE}/members/${selectedMember._id}`,
        editData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("superAdminToken")}`,
          },
        },
      );
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

  const field = (label, name, value) => (
    <div className="border-b border-gray-200 pb-4">
      <dt className="inline font-semibold">{label}: </dt>
      {isEditing ? (
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
              {Memberdetails.map((member, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b border-gray-200 text-start text-[14px] hover:bg-orange-50 transition-colors duration-200"
                >
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
                  <td>
                    <button
                      onClick={() => handleViewDetails(member)}
                      className="w-[170px] font-medium border-1 py-[6px] px-[10px] border-[#08A25C] rounded text-[14px] text-[#08A25C] hover:bg-[#08A25C] hover:text-white transition-colors duration-200"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {Memberdetails.length === 0 && (
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

              {/* Edit/Save buttons - only for superadmin */}
              {isSuperAdmin && (
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

            <div className="px-6 pb-6">
              <div className="bg-white border border-gray-200 rounded-2xl p-6">
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
                    "membership_date",
                    formatDate(selectedMember.membership_date),
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

                {/* Documents Section */}
                {(selectedMember.aadharcard || selectedMember.pancard || selectedMember.applicationdoc) && (
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
                            <svg className="w-5 h-5 text-[#EF742C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-[#EF742C] text-center">Aadhar Card</span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                          </span>
                        </a>
                      ) : (
                        <div className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-xl opacity-50">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-gray-400 text-center">Aadhar Card</span>
                          <span className="text-xs text-gray-300">Not uploaded</span>
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
                            <svg className="w-5 h-5 text-[#EF742C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-[#EF742C] text-center">PAN Card</span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                          </span>
                        </a>
                      ) : (
                        <div className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-xl opacity-50">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-gray-400 text-center">PAN Card</span>
                          <span className="text-xs text-gray-300">Not uploaded</span>
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
                            <svg className="w-5 h-5 text-[#orange]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-[#EF742C] text-center">Application PDF</span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download
                          </span>
                        </a>
                      ) : (
                        <div className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-gray-200 rounded-xl opacity-50">
                          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <span className="text-sm font-semibold text-gray-400 text-center">Application PDF</span>
                          <span className="text-xs text-gray-300">Not uploaded</span>
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
    </div>
  );
}
