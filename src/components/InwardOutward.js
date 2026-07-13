import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Header } from "./Header";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3001";

const DOCUMENT_TYPES = [
  "Letter",
  "Invoice",
  "Notice",
  "Application",
  "Agreement",
  "Cheque/DD",
  "Legal Document",
  "Other",
];

const MODES = [
  "Courier",
  "By Hand",
  "Post Office",
  "Registered Post/RPAD",
  "Email",
  "Other",
];

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  subject: "",
  document_type: "Letter",
  mode: "By Hand",
  party_name: "",
  party_address: "",
  mobile_no: "",
  tracking_no: "",
  handled_by: "",
  remarks: "",
};

const getToken = () =>
  localStorage.getItem("superAdminToken") || localStorage.getItem("adminToken");

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
});

export function InwardOutward() {
  const [activeTab, setActiveTab] = useState("inward");
  const [entries, setEntries] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  // Documents already uploaded (edit mode) that the admin wants to keep
  const [existingAttachments, setExistingAttachments] = useState([]);
  // Newly selected files, not yet uploaded
  const [newFiles, setNewFiles] = useState([]);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/inwardoutward`, {
        headers: authHeaders(),
      });
      setEntries(res.data?.data || []);
    } catch (err) {
      console.error("Error fetching register:", err);
      toast.error("Failed to load inward/outward register");
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const tabEntries = entries.filter((e) => e.type === activeTab);

  const filteredEntries = tabEntries.filter((e) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (e.ref_no || "").toLowerCase().includes(q) ||
      (e.subject || "").toLowerCase().includes(q) ||
      (e.party_name || "").toLowerCase().includes(q) ||
      (e.document_type || "").toLowerCase().includes(q) ||
      (e.mode || "").toLowerCase().includes(q) ||
      (e.mobile_no || "").toLowerCase().includes(q) ||
      (e.tracking_no || "").toLowerCase().includes(q)
    );
  });

  const openAddForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setExistingAttachments([]);
    setNewFiles([]);
    setIsFormOpen(true);
  };

  const openEditForm = (entry) => {
    setForm({
      date: entry.date
        ? new Date(entry.date).toISOString().slice(0, 10)
        : emptyForm.date,
      subject: entry.subject || "",
      document_type: entry.document_type || "Letter",
      mode: entry.mode || "By Hand",
      party_name: entry.party_name || "",
      party_address: entry.party_address || "",
      mobile_no: entry.mobile_no || "",
      tracking_no: entry.tracking_no || "",
      handled_by: entry.handled_by || "",
      remarks: entry.remarks || "",
    });
    setEditingId(entry._id);
    setExistingAttachments(entry.attachments || []);
    setNewFiles([]);
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setExistingAttachments([]);
    setNewFiles([]);
  };

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const MAX_FILE_MB = 10;

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    const valid = [];
    for (const f of files) {
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`${f.name} is larger than ${MAX_FILE_MB}MB`);
        continue;
      }
      valid.push(f);
    }
    setNewFiles((prev) => [...prev, ...valid]);
    e.target.value = ""; // allow re-selecting the same file
  };

  const removeNewFile = (index) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeExistingAttachment = (index) => {
    setExistingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  // Convert a File to { name, type, data(base64) } for the backend
  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({
          name: file.name,
          type: file.type,
          data: String(reader.result).split(",")[1],
        });
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsDataURL(file);
    });

  const handleSubmit = async () => {
    if (!form.subject.trim()) {
      toast.error("Subject is required");
      return;
    }
    if (!form.party_name.trim()) {
      toast.error(
        activeTab === "inward"
          ? "Received From is required"
          : "Sent To is required",
      );
      return;
    }

    setIsSaving(true);
    try {
      const new_attachments = await Promise.all(newFiles.map(fileToBase64));

      if (editingId) {
        await axios.put(
          `${API_BASE}/inwardoutward/${editingId}`,
          { ...form, attachments: existingAttachments, new_attachments },
          { headers: authHeaders() },
        );
        toast.success("Entry updated");
      } else {
        await axios.post(
          `${API_BASE}/inwardoutward`,
          { ...form, type: activeTab, new_attachments },
          { headers: authHeaders() },
        );
        toast.success(
          `${activeTab === "inward" ? "Inward" : "Outward"} entry added`,
        );
      }
      closeForm();
      fetchEntries();
    } catch (err) {
      console.error("Error saving entry:", err);
      toast.error(err.response?.data?.message || "Failed to save entry");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (entry) => {
    if (
      !window.confirm(
        `Delete ${entry.ref_no}? This cannot be undone.`,
      )
    )
      return;
    try {
      await axios.delete(`${API_BASE}/inwardoutward/${entry._id}`, {
        headers: authHeaders(),
      });
      toast.success("Entry deleted");
      fetchEntries();
    } catch (err) {
      console.error("Error deleting entry:", err);
      toast.error("Failed to delete entry");
    }
  };

  const partyLabel = activeTab === "inward" ? "Received From" : "Sent To";

  const tableHeaders = [
    "Ref No.",
    "Date",
    "Subject",
    "Type",
    partyLabel,
    "Mobile No.",
    "Mode",
    "Tracking No.",
    "Documents",
    "",
  ];

  const inputBase =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#EF742C] focus:ring-1 focus:ring-[#EF742C] transition";

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="px-[50px] pt-[30px] pb-10">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-semibold text-[24px]">
            Inward / Outward Register
          </h2>
          <button
            onClick={openAddForm}
            className="px-6 py-2 rounded-lg bg-[#EF742C] text-white font-semibold hover:brightness-105 active:scale-[0.99] transition"
          >
            + Add {activeTab === "inward" ? "Inward" : "Outward"} Entry
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            ["inward", "Inward (Received)"],
            ["outward", "Outward (Sent)"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => {
                setActiveTab(key);
                setSearchQuery("");
              }}
              className={`px-6 py-2 rounded-full font-semibold text-[15px] transition-colors duration-200 ${
                activeTab === key
                  ? "bg-[#EF742C] text-white"
                  : "bg-white text-[#EF742C] border border-[#EF742C] hover:bg-orange-50"
              }`}
            >
              {label}
              <span
                className={`ml-2 text-xs font-bold px-2 py-[2px] rounded-full ${
                  activeTab === key
                    ? "bg-white text-[#EF742C]"
                    : "bg-orange-100 text-[#EF742C]"
                }`}
              >
                {entries.filter((e) => e.type === key).length}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search by ref no, subject, ${partyLabel.toLowerCase()}, mobile, tracking no...`}
            className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-[#EF742C] focus:ring-1 focus:ring-[#EF742C] transition"
          />
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-[#EF742C]">
                  {tableHeaders.map((header, index) => (
                    <th
                      key={index}
                      className="px-4 py-4 text-start text-white font-semibold text-[15px] tracking-wide whitespace-nowrap"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white">
                {filteredEntries.map((entry) => (
                  <tr
                    key={entry._id}
                    className="border-b border-gray-200 text-[14px] hover:bg-orange-50/40 transition-colors duration-200"
                  >
                    <td className="px-4 py-4 font-semibold text-[#EF742C] whitespace-nowrap">
                      {entry.ref_no}
                    </td>
                    <td className="px-4 py-4 text-gray-700 whitespace-nowrap">
                      {entry.date
                        ? new Date(entry.date).toLocaleDateString("en-IN")
                        : "-"}
                    </td>
                    <td className="px-4 py-4 text-gray-700 font-medium max-w-[260px]">
                      <div className="truncate" title={entry.subject}>
                        {entry.subject}
                      </div>
                      {entry.remarks && (
                        <div
                          className="text-xs text-gray-400 truncate"
                          title={entry.remarks}
                        >
                          {entry.remarks}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="bg-orange-50 text-[#EF742C] border border-orange-200 text-xs font-medium px-2 py-1 rounded-full">
                        {entry.document_type}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-700">
                      <div className="font-medium">{entry.party_name}</div>
                      {entry.party_address && (
                        <div
                          className="text-xs text-gray-400 truncate max-w-[180px]"
                          title={entry.party_address}
                        >
                          {entry.party_address}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-700 whitespace-nowrap">
                      {entry.mobile_no ? (
                        <a
                          href={`tel:${entry.mobile_no}`}
                          className="hover:text-[#EF742C] hover:underline"
                        >
                          {entry.mobile_no}
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-700 whitespace-nowrap">
                      {entry.mode}
                    </td>
                    <td className="px-4 py-4 text-gray-700 whitespace-nowrap">
                      {entry.tracking_no || "-"}
                    </td>
                    <td className="px-4 py-4">
                      {entry.attachments && entry.attachments.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {entry.attachments.map((a, i) => (
                            <a
                              key={a.public_id || i}
                              href={a.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#EF742C] text-[13px] font-medium hover:underline truncate max-w-[140px]"
                              title={a.filename}
                            >
                              📎 {a.filename || `Document ${i + 1}`}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditForm(entry)}
                          className="font-medium border py-[5px] px-3 border-[#EF742C] rounded text-[13px] text-[#EF742C] hover:bg-[#EF742C] hover:text-white transition-colors duration-200"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(entry)}
                          className="font-medium border py-[5px] px-3 border-red-500 rounded text-[13px] text-red-500 hover:bg-red-500 hover:text-white transition-colors duration-200"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredEntries.length === 0 && (
              <div className="p-8 text-center text-gray-500">
                No {activeTab} entries found.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isFormOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={closeForm}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-[640px] max-h-[90vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-semibold mb-5">
              {editingId ? "Edit Entry" : `New ${activeTab === "inward" ? "Inward" : "Outward"} Entry`}
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  className={inputBase}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Document Type
                </label>
                <select
                  name="document_type"
                  value={form.document_type}
                  onChange={handleChange}
                  className={inputBase}
                >
                  {DOCUMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="subject"
                  value={form.subject}
                  onChange={handleChange}
                  placeholder="e.g. Electricity bill invoice for June 2026"
                  className={inputBase}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  {partyLabel} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="party_name"
                  value={form.party_name}
                  onChange={handleChange}
                  placeholder={
                    activeTab === "inward"
                      ? "Sender name / organisation"
                      : "Recipient name / organisation"
                  }
                  className={inputBase}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  name="mobile_no"
                  value={form.mobile_no}
                  onChange={handleChange}
                  placeholder="Contact number (optional)"
                  className={inputBase}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  {partyLabel} Address
                </label>
                <input
                  type="text"
                  name="party_address"
                  value={form.party_address}
                  onChange={handleChange}
                  placeholder="Address (optional)"
                  className={inputBase}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Mode
                </label>
                <select
                  name="mode"
                  value={form.mode}
                  onChange={handleChange}
                  className={inputBase}
                >
                  {MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Tracking / Consignment No.
                </label>
                <input
                  type="text"
                  name="tracking_no"
                  value={form.tracking_no}
                  onChange={handleChange}
                  placeholder="Courier / RPAD / cheque no. (optional)"
                  className={inputBase}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Handled By
                </label>
                <input
                  type="text"
                  name="handled_by"
                  value={form.handled_by}
                  onChange={handleChange}
                  placeholder="Staff name (optional)"
                  className={inputBase}
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Documents (scans, invoices, letters — multiple allowed)
                </label>
                <label className="flex items-center justify-center gap-2 border-2 border-dashed border-orange-300 rounded-lg px-4 py-3 text-sm text-[#EF742C] cursor-pointer hover:bg-orange-50 transition">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <path d="M17 8l-5-5-5 5" />
                    <path d="M12 3v12" />
                  </svg>
                  Click to upload (images or PDF, max 10MB each)
                  <input
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>

                {(existingAttachments.length > 0 || newFiles.length > 0) && (
                  <div className="mt-2 space-y-1">
                    {existingAttachments.map((a, i) => (
                      <div
                        key={a.public_id || i}
                        className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm"
                      >
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#EF742C] hover:underline truncate max-w-[420px]"
                          title={a.filename}
                        >
                          📎 {a.filename || `Document ${i + 1}`}
                        </a>
                        <button
                          type="button"
                          onClick={() => removeExistingAttachment(i)}
                          className="text-red-500 text-xs font-semibold hover:text-red-700 ml-3"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {newFiles.map((f, i) => (
                      <div
                        key={`${f.name}-${i}`}
                        className="flex items-center justify-between bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm"
                      >
                        <span className="truncate max-w-[420px]" title={f.name}>
                          🆕 {f.name}{" "}
                          <span className="text-gray-400 text-xs">
                            ({(f.size / 1024 / 1024).toFixed(1)} MB)
                          </span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeNewFile(i)}
                          className="text-red-500 text-xs font-semibold hover:text-red-700 ml-3"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Remarks
                </label>
                <textarea
                  name="remarks"
                  value={form.remarks}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Any notes (optional)"
                  className={inputBase}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={closeForm}
                disabled={isSaving}
                className="px-5 py-2 rounded-lg border border-gray-300 text-gray-600 font-medium hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSaving}
                className="px-6 py-2 rounded-lg bg-[#EF742C] text-white font-semibold hover:brightness-105 active:scale-[0.99] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving
                  ? newFiles.length > 0
                    ? "Uploading documents..."
                    : "Saving..."
                  : editingId
                    ? "Update Entry"
                    : "Save Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}