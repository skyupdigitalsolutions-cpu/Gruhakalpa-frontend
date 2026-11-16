import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import axiosInstance from "../api/axios";
import { formatPhone } from "../utils/phone";
import { buildReceiptPDFBase64 } from "../utils/generateReceiptPDF";

// ─────────────────────────────────────────────────────────────────────────
// SendNotificationModal
//
// Send ONE particular notification to ONE lead over WhatsApp and/or email:
//   • Receipt (PDF attached)   • Payment confirmation
//   • Welcome / membership     • Site booking confirmation
//
// Used from the Receipts list (preselects that receipt) and from Payments Due
// (row button + client detail modal).
//
// Props:
//   membershipId      required — the lead
//   initialReceiptId  optional — preselect this receipt
//   initialType       optional — preselect a notification type
//   onClose()         close the modal
//   onSent()          optional — called after any send (e.g. refresh history)
// ─────────────────────────────────────────────────────────────────────────

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB") : "-");

const TYPE_META = {
  receipt: {
    label: "Payment Receipt",
    hint: "Sends the selected receipt with its PDF attached.",
  },
  payment_confirmation: {
    label: "Payment Confirmation",
    hint: "“Payment received” message with the remaining balance.",
  },
  member_added: {
    label: "Welcome / Membership",
    hint: "Membership welcome message (membership receipt attached if available).",
  },
  site_booking: {
    label: "Site Booking Confirmation",
    hint: "Project, site dimension and total amount.",
  },
};

export function SendNotificationModal({
  membershipId,
  initialReceiptId = "",
  initialType = "",
  onClose,
  onSent,
}) {
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState(initialType || "");
  const [receiptId, setReceiptId] = useState(initialReceiptId || "");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [initialContact, setInitialContact] = useState({ mobile: "", email: "" });
  const [sending, setSending] = useState(""); // whatsapp | email | both
  const [stage, setStage] = useState(""); // status line while sending
  const [results, setResults] = useState(null);

  // ── Load what can be sent to this lead ──
  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await axiosInstance.get(
          `/notifications/lead/${encodeURIComponent(membershipId)}`,
        );
        if (!alive) return;
        const data = res.data?.data || null;
        setLead(data);
        const m = formatPhone(data?.contact?.mobile) || "";
        const e = data?.contact?.email || "";
        setMobile(m);
        setEmail(e);
        setInitialContact({ mobile: m, email: e });
      } catch (err) {
        if (alive)
          toast.error(
            err.response?.data?.message || "Failed to load lead details",
          );
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [membershipId]);

  const receipts = useMemo(() => lead?.receipts || [], [lead]);
  const activeReceipts = useMemo(
    () => receipts.filter((r) => !r.cancelled),
    [receipts],
  );
  const siteReceipts = useMemo(
    () =>
      activeReceipts.filter((r) => (r.paymentcategory || "site") === "site"),
    [activeReceipts],
  );

  // Which types can be sent for this lead, and why not.
  const availability = useMemo(() => {
    if (!lead) return {};
    return {
      receipt: activeReceipts.length
        ? ""
        : "No active receipts for this member.",
      payment_confirmation: !lead.booking
        ? "No site booking for this member."
        : siteReceipts.length
          ? ""
          : "No site payment receipts yet.",
      member_added: lead.member ? "" : "Not a registered member.",
      site_booking: lead.booking ? "" : "No site booking for this member.",
    };
  }, [lead, activeReceipts, siteReceipts]);

  // Pick a sensible default type once the lead loads.
  useEffect(() => {
    if (!lead || (type && !availability[type])) return;
    const first = Object.keys(TYPE_META).find((t) => !availability[t]);
    setType(first || "");
  }, [lead, availability, type]);

  // Receipts selectable for the current type.
  const selectableReceipts = useMemo(
    () => (type === "payment_confirmation" ? siteReceipts : activeReceipts),
    [type, siteReceipts, activeReceipts],
  );

  // Keep the selected receipt valid for the current type.
  useEffect(() => {
    if (type !== "receipt" && type !== "payment_confirmation") return;
    if (selectableReceipts.some((r) => r._id === receiptId)) return;
    setReceiptId(selectableReceipts[0]?._id || "");
  }, [type, selectableReceipts, receiptId]);

  const selectedReceipt = receipts.find((r) => r._id === receiptId) || null;
  const needsReceipt = type === "receipt" || type === "payment_confirmation";
  const waTemplateMissing = lead?.templates && type && !lead.templates[type];

  const send = async (channel) => {
    if (!type) return;
    if (needsReceipt && !selectedReceipt) {
      toast.warn("Select a receipt first.");
      return;
    }
    if ((channel === "email" || channel === "both") && !email.trim()) {
      toast.warn("Enter an email address to send by email.");
      return;
    }
    if ((channel === "whatsapp" || channel === "both") && !mobile.trim()) {
      toast.warn("Enter a mobile number to send on WhatsApp.");
      return;
    }

    setSending(channel);
    setResults(null);
    try {
      const body = { type, membership_id: membershipId, channel };
      if (needsReceipt) body.receiptId = selectedReceipt._id;
      // Only send overrides the admin actually changed.
      if (mobile.trim() !== initialContact.mobile) body.mobile = mobile.trim();
      if (email.trim() !== initialContact.email) body.email = email.trim();

      // Fresh PDF of exactly this receipt (falls back to the stored PDF on
      // the server if generation fails here).
      if (type === "receipt") {
        setStage("Preparing receipt PDF…");
        try {
          const { pdfBase64, pdfFilename } =
            await buildReceiptPDFBase64(selectedReceipt);
          body.pdfBase64 = pdfBase64;
          body.pdfFilename = pdfFilename;
        } catch (pdfErr) {
          console.warn("Receipt PDF generation failed:", pdfErr);
          toast.info("Couldn't build the PDF here — using the stored copy.");
        }
      }

      setStage("Sending…");
      const res = await axiosInstance.post("/notifications/send", body, {
        timeout: 90000,
      });
      setResults(res.data?.data || []);
      if (res.data?.success) toast.success(res.data.message || "Sent");
      else toast.warn(res.data?.message || "Some messages failed");
      onSent && onSent();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send");
    } finally {
      setSending("");
      setStage("");
    }
  };

  const busy = !!sending;
  const inputCls =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#EF742C] focus:ring-1 focus:ring-[#EF742C]";

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4"
      onClick={() => !busy && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[640px] max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-semibold">Send notification</h3>
            <div className="text-sm text-gray-500">
              {lead?.contact?.name || "-"} · {membershipId}
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none disabled:opacity-40"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-gray-400">Loading...</div>
        ) : !lead ? (
          <div className="py-10 text-center text-gray-400">
            Could not load this lead.
          </div>
        ) : (
          <>
            {/* 1. What to send */}
            <div className="mb-5">
              <div className="text-[13px] font-semibold text-gray-600 mb-2">
                1. What to send
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(TYPE_META).map(([key, meta]) => {
                  const reason = availability[key];
                  const active = type === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!!reason || busy}
                      onClick={() => {
                        setType(key);
                        setResults(null);
                      }}
                      title={reason || meta.hint}
                      className={`text-left rounded-xl border px-3 py-2 transition ${
                        active
                          ? "border-[#EF742C] bg-orange-50"
                          : "border-gray-200 hover:border-[#EF742C]"
                      } disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:border-gray-200`}
                    >
                      <div
                        className={`text-[14px] font-semibold ${
                          active ? "text-[#EF742C]" : "text-gray-800"
                        }`}
                      >
                        {meta.label}
                      </div>
                      <div className="text-[12px] text-gray-500">
                        {reason || meta.hint}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Receipt picker */}
            {needsReceipt && (
              <div className="mb-5">
                <div className="text-[13px] font-semibold text-gray-600 mb-2">
                  Receipt
                </div>
                <select
                  value={receiptId}
                  onChange={(e) => {
                    setReceiptId(e.target.value);
                    setResults(null);
                  }}
                  disabled={busy}
                  className={inputCls}
                >
                  {selectableReceipts.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.receipt_no || "No receipt no."} · {fmtDate(r.date)} ·{" "}
                      {inr(r.amountpaid)}
                      {r.paymenttype ? ` · ${r.paymenttype}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 2. Recipient */}
            <div className="mb-5">
              <div className="text-[13px] font-semibold text-gray-600 mb-2">
                2. Send to
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[12px] text-gray-500 mb-1">
                    WhatsApp number
                  </label>
                  <input
                    type="text"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    disabled={busy}
                    placeholder="+91 98765 43210"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-[12px] text-gray-500 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                    placeholder="name@example.com"
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="text-[11px] text-gray-400 mt-1">
                Edits here apply to this send only — the member record is not
                changed.
              </div>
            </div>

            {waTemplateMissing && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-700">
                No WhatsApp template is set for this notification in Automation
                Setup — WhatsApp will fail. Email still works.
              </div>
            )}

            {/* 3. Send */}
            <div className="text-[13px] font-semibold text-gray-600 mb-2">
              3. Send
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => send("whatsapp")}
                disabled={busy || !type}
                className="px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50"
              >
                {sending === "whatsapp" ? "Sending…" : "Send WhatsApp"}
              </button>
              <button
                onClick={() => send("email")}
                disabled={busy || !type}
                className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50"
              >
                {sending === "email" ? "Sending…" : "Send Email"}
              </button>
              <button
                onClick={() => send("both")}
                disabled={busy || !type}
                className="px-4 py-2 rounded-lg bg-[#EF742C] text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50"
              >
                {sending === "both" ? "Sending…" : "Send both"}
              </button>
            </div>
            {stage && (
              <div className="text-[12px] text-gray-500 mt-2">{stage}</div>
            )}

            {/* Result per channel */}
            {results && results.length > 0 && (
              <div className="mt-4 rounded-xl border border-gray-100 divide-y divide-gray-100">
                {results.map((r, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 text-[13px] flex items-start gap-3"
                  >
                    <span className="font-semibold w-[80px] shrink-0">
                      {r.channel === "whatsapp" ? "WhatsApp" : "Email"}
                    </span>
                    <span className="text-gray-500 w-[170px] shrink-0 truncate">
                      {r.to || "-"}
                    </span>
                    <span
                      className={
                        r.status === "sent"
                          ? "text-green-600 font-medium"
                          : "text-red-500 font-medium"
                      }
                    >
                      {r.status === "sent" ? "Sent" : `Failed — ${r.error || "unknown error"}`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default SendNotificationModal;