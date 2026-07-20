import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import axiosInstance from "../api/axios";
import { Header } from "./Header";

const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN") : "-");

const STATUS_STYLES = {
  overdue: "bg-red-100 text-red-600 border-red-200",
  due_soon: "bg-amber-100 text-amber-700 border-amber-200",
  upcoming: "bg-blue-50 text-blue-600 border-blue-200",
  paid: "bg-green-50 text-green-600 border-green-200",
};
const STATUS_LABEL = {
  overdue: "Overdue",
  due_soon: "Due soon",
  upcoming: "Upcoming",
  paid: "Paid",
};

const StatusBadge = ({ status }) => (
  <span
    className={`text-[11px] font-semibold px-2 py-[2px] rounded-full border ${
      STATUS_STYLES[status] || STATUS_STYLES.upcoming
    }`}
  >
    {STATUS_LABEL[status] || status}
  </span>
);

const ChannelBadge = ({ channel }) => (
  <span
    className={`text-[11px] font-semibold px-2 py-[2px] rounded-full border ${
      channel === "whatsapp"
        ? "bg-green-50 text-green-600 border-green-200"
        : "bg-blue-50 text-blue-600 border-blue-200"
    }`}
  >
    {channel === "whatsapp" ? "WhatsApp" : "Email"}
  </span>
);

export function UpcomingPayments() {
  const [tab, setTab] = useState("due"); // due | messages | setup

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="px-[50px] pt-[30px] pb-10">
        <h2 className="font-semibold text-[24px] mb-6">Payments Due</h2>

        <div className="flex gap-2 mb-6">
          {[
            ["due", "Payments Due"],
            ["messages", "Messages Sent"],
            ["setup", "Automation Setup"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-6 py-2 rounded-full font-semibold text-[15px] transition-colors duration-200 ${
                tab === key
                  ? "bg-[#EF742C] text-white"
                  : "bg-white text-[#EF742C] border border-[#EF742C] hover:bg-orange-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "due" && <DueTab />}
        {tab === "messages" && <MessagesTab />}
        {tab === "setup" && <SetupTab />}
      </div>
    </div>
  );
}

// ── Tab 1: Payments Due ────────────────────────────────────────────────────
function DueTab() {
  const [summary, setSummary] = useState(null);
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState(null);
  const [sending, setSending] = useState(""); // `${mid}:${channel}`

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(
        `/payment-schedule?filter=${filter}&search=${encodeURIComponent(search)}`,
      );
      setSummary(res.data?.summary || null);
      setRows(res.data?.data || []);
    } catch (err) {
      console.error("❌ Error loading schedule:", err);
      toast.error("Failed to load payments due");
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const sendReminder = async (row, channel) => {
    setSending(`${row.membership_id}:${channel}`);
    try {
      const res = await axiosInstance.post("/reminders/send", {
        membership_id: row.membership_id,
        channel,
      });
      if (res.data?.success) toast.success(res.data.message || "Reminder sent");
      else toast.warn(res.data?.message || "Some messages failed");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send reminder");
    } finally {
      setSending("");
    }
  };

  return (
    <div>
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <SummaryCard label="Clients due" value={summary.clientsDue} />
          <SummaryCard
            label="Overdue clients"
            value={summary.clientsOverdue}
            tone="red"
          />
          <SummaryCard
            label="Total outstanding"
            value={inr(summary.totalOutstanding)}
            tone="amber"
          />
          <SummaryCard
            label="Overdue amount"
            value={inr(summary.totalOverdue)}
            tone="red"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center mb-4">
        <div className="flex gap-2">
          {[
            ["all", "All"],
            ["overdue", "Overdue"],
            ["upcoming", "Upcoming"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-1.5 rounded-full text-[14px] font-medium border transition ${
                filter === key
                  ? "bg-[#EF742C] text-white border-[#EF742C]"
                  : "bg-white text-gray-600 border-gray-300 hover:border-[#EF742C]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, ID, mobile, project..."
          className="flex-1 max-w-md rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-[#EF742C] focus:ring-1 focus:ring-[#EF742C]"
        />
      </div>

      <div className="overflow-hidden rounded-2xl shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#EF742C]">
                {[
                  "Client",
                  "Mobile",
                  "Next Due",
                  "Due Date",
                  "Amount",
                  "Total Outstanding",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-4 text-start text-white font-semibold text-[15px] whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {rows.map((r) => (
                <tr
                  key={r.membership_id}
                  className="border-b border-gray-200 text-[14px] hover:bg-orange-50/40"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-gray-400">
                      {r.membership_id}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {r.mobile || "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {r.nextDue?.label || "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-700 whitespace-nowrap">
                    {fmtDate(r.nextDue?.dueDate)}
                  </td>
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">
                    {inr(r.nextDue?.outstanding)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {inr(r.totalOutstanding)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={r.nextDue?.status || r.overallStatus}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDetailId(r.membership_id)}
                        className="font-medium border py-[5px] px-3 border-[#EF742C] rounded text-[13px] text-[#EF742C] hover:bg-[#EF742C] hover:text-white transition"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => sendReminder(r, "whatsapp")}
                        disabled={sending === `${r.membership_id}:whatsapp`}
                        className="font-medium border py-[5px] px-3 border-green-500 rounded text-[13px] text-green-600 hover:bg-green-500 hover:text-white transition disabled:opacity-50"
                      >
                        {sending === `${r.membership_id}:whatsapp`
                          ? "..."
                          : "WhatsApp"}
                      </button>
                      <button
                        onClick={() => sendReminder(r, "email")}
                        disabled={sending === `${r.membership_id}:email`}
                        className="font-medium border py-[5px] px-3 border-blue-500 rounded text-[13px] text-blue-600 hover:bg-blue-500 hover:text-white transition disabled:opacity-50"
                      >
                        {sending === `${r.membership_id}:email`
                          ? "..."
                          : "Email"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && rows.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No clients with outstanding payments.
            </div>
          )}
          {loading && (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          )}
        </div>
      </div>

      {detailId && (
        <ClientDetailModal
          membershipId={detailId}
          onClose={() => setDetailId(null)}
          onSent={fetchRows}
        />
      )}
    </div>
  );
}

const SummaryCard = ({ label, value, tone = "gray" }) => {
  const tones = {
    gray: "border-gray-100 bg-gray-50 text-gray-800",
    red: "border-red-100 bg-red-50 text-red-600",
    amber: "border-amber-100 bg-amber-50 text-amber-700",
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${tones[tone]}`}>
      <div className="text-[12px] opacity-80">{label}</div>
      <div className="text-[20px] font-bold">{value}</div>
    </div>
  );
};

// ── Client detail modal ────────────────────────────────────────────────────
function ClientDetailModal({ membershipId, onClose, onSent }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/payment-schedule/${membershipId}`);
      setData(res.data?.data || null);
    } catch (err) {
      toast.error("Failed to load client details");
    } finally {
      setLoading(false);
    }
  }, [membershipId]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (channel, dueLabel) => {
    setSending(`${channel}:${dueLabel || ""}`);
    try {
      const res = await axiosInstance.post("/reminders/send", {
        membership_id: membershipId,
        channel,
        dueLabel,
      });
      if (res.data?.success) toast.success(res.data.message || "Reminder sent");
      else toast.warn(res.data?.message || "Some messages failed");
      await load();
      onSent && onSent();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to send");
    } finally {
      setSending("");
    }
  };

  const member = data?.member;
  const booking = data?.booking;
  const schedule = data?.schedule;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[860px] max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-semibold">Client Details</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="py-10 text-center text-gray-400">Loading...</div>
        ) : !data ? (
          <div className="py-10 text-center text-gray-400">Not found.</div>
        ) : (
          <>
            {/* Member info */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
              <Info label="Name" value={booking?.name || member?.name} />
              <Info label="Membership ID" value={membershipId} />
              <Info label="Mobile" value={member?.mobile || booking?.mobilenumber} />
              <Info label="Email" value={member?.email || "-"} />
              <Info label="Project" value={booking?.projectname || "-"} />
              <Info label="Site" value={booking?.sitedimension || "-"} />
              <Info label="Booking date" value={fmtDate(booking?.date)} />
              <Info label="Total value" value={inr(schedule?.totalDue)} />
              <Info label="Total paid" value={inr(schedule?.totalPaid)} />
              <Info
                label="Outstanding"
                value={inr(schedule?.totalOutstanding)}
              />
            </div>

            {/* Quick send */}
            <div className="flex gap-2 mb-5">
              <button
                onClick={() => send("whatsapp")}
                disabled={sending.startsWith("whatsapp:")}
                className="px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50"
              >
                Send WhatsApp reminder
              </button>
              <button
                onClick={() => send("email")}
                disabled={sending.startsWith("email:")}
                className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50"
              >
                Send Email reminder
              </button>
              <button
                onClick={() => send("both")}
                disabled={sending.startsWith("both:")}
                className="px-4 py-2 rounded-lg bg-[#EF742C] text-white text-sm font-semibold hover:brightness-105 disabled:opacity-50"
              >
                Send both
              </button>
            </div>

            {/* Schedule */}
            <h4 className="font-semibold mb-2">Payment Schedule</h4>
            <div className="overflow-x-auto mb-6 rounded-xl border border-gray-100">
              <table className="w-full text-[13px]">
                <thead className="bg-gray-50 text-gray-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Bucket</th>
                    <th className="px-3 py-2 text-left font-medium">Due date</th>
                    <th className="px-3 py-2 text-left font-medium">Amount</th>
                    <th className="px-3 py-2 text-left font-medium">Paid</th>
                    <th className="px-3 py-2 text-left font-medium">Outstanding</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {(schedule?.buckets || []).map((b, i) => (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium">{b.label}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {fmtDate(b.dueDate)}
                      </td>
                      <td className="px-3 py-2">{inr(b.amount)}</td>
                      <td className="px-3 py-2 text-green-600">{inr(b.paid)}</td>
                      <td className="px-3 py-2 font-semibold">
                        {inr(b.outstanding)}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={b.status} />
                      </td>
                      <td className="px-3 py-2">
                        {b.outstanding > 0 && (
                          <button
                            onClick={() => send("whatsapp", b.label)}
                            disabled={sending === `whatsapp:${b.label}`}
                            className="text-[12px] text-green-600 font-semibold hover:underline disabled:opacity-50"
                          >
                            Remind
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Message history */}
            <h4 className="font-semibold mb-2">Message History</h4>
            {data.messages?.length ? (
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-[13px]">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Date</th>
                      <th className="px-3 py-2 text-left font-medium">Channel</th>
                      <th className="px-3 py-2 text-left font-medium">For</th>
                      <th className="px-3 py-2 text-left font-medium">Amount</th>
                      <th className="px-3 py-2 text-left font-medium">Status</th>
                      <th className="px-3 py-2 text-left font-medium">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.messages.map((m) => (
                      <tr key={m._id} className="border-t border-gray-100">
                        <td className="px-3 py-2 whitespace-nowrap">
                          {new Date(m.createdAt).toLocaleString("en-IN")}
                        </td>
                        <td className="px-3 py-2">
                          <ChannelBadge channel={m.channel} />
                        </td>
                        <td className="px-3 py-2">{m.dueLabel || m.kind}</td>
                        <td className="px-3 py-2">{inr(m.amount)}</td>
                        <td className="px-3 py-2">
                          <span
                            className={
                              m.status === "sent"
                                ? "text-green-600 font-medium"
                                : "text-red-500 font-medium"
                            }
                            title={m.error || ""}
                          >
                            {m.status === "sent" ? "Sent" : "Failed"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-500">{m.sentBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-gray-400 text-sm">No messages sent yet.</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const Info = ({ label, value }) => (
  <div>
    <div className="text-[12px] text-gray-400">{label}</div>
    <div className="font-medium text-gray-800 break-words">{value || "-"}</div>
  </div>
);

// ── Tab 2: Messages Sent ───────────────────────────────────────────────────
function MessagesTab() {
  const [messages, setMessages] = useState([]);
  const [channel, setChannel] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(
        `/messages${channel ? `?channel=${channel}` : ""}`,
      );
      setMessages(res.data?.data || []);
    } catch (err) {
      toast.error("Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [channel]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        {[
          ["", "All"],
          ["whatsapp", "WhatsApp"],
          ["email", "Email"],
        ].map(([key, label]) => (
          <button
            key={key || "all"}
            onClick={() => setChannel(key)}
            className={`px-4 py-1.5 rounded-full text-[14px] font-medium border transition ${
              channel === key
                ? "bg-[#EF742C] text-white border-[#EF742C]"
                : "bg-white text-gray-600 border-gray-300 hover:border-[#EF742C]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#EF742C]">
                {[
                  "Date",
                  "Client",
                  "Channel",
                  "Type",
                  "For",
                  "Amount",
                  "To",
                  "Status",
                  "By",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-4 text-start text-white font-semibold text-[15px] whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white">
              {messages.map((m) => (
                <tr
                  key={m._id}
                  className="border-b border-gray-200 text-[14px] hover:bg-orange-50/40"
                >
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                    {new Date(m.createdAt).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-gray-400">
                      {m.membership_id}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ChannelBadge channel={m.channel} />
                  </td>
                  <td className="px-4 py-3 capitalize text-gray-700">
                    {m.kind}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {m.dueLabel || "-"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {inr(m.amount)}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{m.to}</td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        m.status === "sent"
                          ? "text-green-600 font-medium"
                          : "text-red-500 font-medium"
                      }
                      title={m.error || ""}
                    >
                      {m.status === "sent" ? "Sent" : "Failed"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{m.sentBy}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && messages.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No messages sent yet.
            </div>
          )}
          {loading && (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tab 3: Automation Setup ────────────────────────────────────────────────
function SetupTab() {
  const [s, setS] = useState(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    axiosInstance
      .get("/reminder-settings")
      .then((res) => setS(res.data?.data || null))
      .catch(() => toast.error("Failed to load settings"));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await axiosInstance.put("/reminder-settings", s);
      setS(res.data?.data || s);
      toast.success("Settings saved");
    } catch (err) {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const runNow = async () => {
    setRunning(true);
    try {
      const res = await axiosInstance.post("/reminders/run-due", {});
      const r = res.data?.result;
      toast.success(
        r
          ? `Run complete — sent ${r.sent}, skipped ${r.skipped}`
          : res.data?.message || "Run complete",
      );
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to run reminders");
    } finally {
      setRunning(false);
    }
  };

  if (!s) return <div className="text-gray-400">Loading settings...</div>;

  const field =
    "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#EF742C] focus:ring-1 focus:ring-[#EF742C]";
  const set = (patch) => setS((prev) => ({ ...prev, ...patch }));
  const setWa = (patch) =>
    setS((prev) => ({ ...prev, whatsapp: { ...prev.whatsapp, ...patch } }));

  return (
    <div className="max-w-[720px] bg-white rounded-2xl shadow-lg p-6 space-y-6">
      {/* Automation master */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-[16px]">Auto reminders</div>
            <div className="text-sm text-gray-500">
              When on, the server sends due & overdue reminders automatically
              (checked daily).
            </div>
          </div>
          <Toggle
            checked={s.autoEnabled}
            onChange={(v) => set({ autoEnabled: v })}
          />
        </div>

        <div className="flex items-center justify-between mt-4">
          <div>
            <div className="font-semibold text-[16px]">Event notifications</div>
            <div className="text-sm text-gray-500">
              When on, a WhatsApp + email goes out automatically when a member,
              site booking, FD, RD, receipt, or FD certificate is created.
            </div>
          </div>
          <Toggle
            checked={s.eventNotificationsEnabled !== false}
            onChange={(v) => set({ eventNotificationsEnabled: v })}
          />
        </div>
      </section>

      <hr />

      {/* Rules */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Installment interval (months)
          </label>
          <input
            type="number"
            min="1"
            value={s.intervalMonths}
            onChange={(e) => set({ intervalMonths: e.target.value })}
            className={field}
          />
          <p className="text-xs text-gray-400 mt-1">
            Due dates are booking date + N × this.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Reminder window (days before due)
          </label>
          <input
            type="number"
            min="0"
            value={s.reminderWindowDays}
            onChange={(e) => set({ reminderWindowDays: e.target.value })}
            className={field}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">
            Overdue reminder every (days)
          </label>
          <input
            type="number"
            min="1"
            value={s.overdueEveryDays}
            onChange={(e) => set({ overdueEveryDays: e.target.value })}
            className={field}
          />
          <p className="text-xs text-gray-400 mt-1">
            Repeats until the payment is received.
          </p>
        </div>
      </section>

      <div>
        <label className="block text-sm font-medium text-gray-600 mb-1">
          Reminders before due (days, comma-separated)
        </label>
        <input
          type="text"
          value={
            Array.isArray(s.preDueOffsets)
              ? s.preDueOffsets.join(", ")
              : s.preDueOffsets || ""
          }
          onChange={(e) => set({ preDueOffsets: e.target.value })}
          placeholder="30, 15, 7, 1, 0"
          className={field}
        />
        <p className="text-xs text-gray-400 mt-1">
          Sends one reminder at each point before the installment date. 0 = on
          the due date. A confirmation is sent automatically when payment is
          received.
        </p>
      </div>

      <hr />

      {/* WhatsApp / MSG91 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-[16px]">WhatsApp (MSG91)</div>
          <Toggle
            checked={s.whatsapp?.enabled}
            onChange={(v) => setWa({ enabled: v })}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Integrated (WhatsApp) number
            </label>
            <input
              type="text"
              value={s.whatsapp?.integratedNumber || ""}
              onChange={(e) => setWa({ integratedNumber: e.target.value })}
              placeholder="e.g. 919876543210"
              className={field}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Template language code
            </label>
            <input
              type="text"
              value={s.whatsapp?.languageCode || "en"}
              onChange={(e) => setWa({ languageCode: e.target.value })}
              className={field}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Upcoming-reminder template name
            </label>
            <input
              type="text"
              value={s.whatsapp?.templateUpcoming || ""}
              onChange={(e) => setWa({ templateUpcoming: e.target.value })}
              placeholder="gruhakalpa_payment_reminder"
              className={field}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Overdue-reminder template name
            </label>
            <input
              type="text"
              value={s.whatsapp?.templateOverdue || ""}
              onChange={(e) => setWa({ templateOverdue: e.target.value })}
              placeholder="gruhakalpa_payment_overdue"
              className={field}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Payment-confirmation template name
            </label>
            <input
              type="text"
              value={s.whatsapp?.templateConfirmation || ""}
              onChange={(e) => setWa({ templateConfirmation: e.target.value })}
              placeholder="sent when a payment is received"
              className={field}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Receipt template name (PDF attached)
            </label>
            <input
              type="text"
              value={s.whatsapp?.templateReceipt || ""}
              onChange={(e) => setWa({ templateReceipt: e.target.value })}
              placeholder="gruhakalpa_receipt"
              className={field}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              FD-certificate template name (PDF attached)
            </label>
            <input
              type="text"
              value={s.whatsapp?.templateFdCertificate || ""}
              onChange={(e) => setWa({ templateFdCertificate: e.target.value })}
              placeholder="gruhakalpa_fd_certificate"
              className={field}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              FD-created template name
            </label>
            <input
              type="text"
              value={s.whatsapp?.templateFdCreated || ""}
              onChange={(e) => setWa({ templateFdCreated: e.target.value })}
              placeholder="gruhakalpa_fd_created"
              className={field}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              RD-created template name
            </label>
            <input
              type="text"
              value={s.whatsapp?.templateRdCreated || ""}
              onChange={(e) => setWa({ templateRdCreated: e.target.value })}
              placeholder="gruhakalpa_rd_created"
              className={field}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Member-added template name
            </label>
            <input
              type="text"
              value={s.whatsapp?.templateMemberAdded || ""}
              onChange={(e) => setWa({ templateMemberAdded: e.target.value })}
              placeholder="gruhakalpa_member_added"
              className={field}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Site-booking template name
            </label>
            <input
              type="text"
              value={s.whatsapp?.templateSiteBooking || ""}
              onChange={(e) => setWa({ templateSiteBooking: e.target.value })}
              placeholder="gruhakalpa_site_booking"
              className={field}
            />
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Reminder templates: variables in order are 1 = name, 2 = amount, 3 =
          installment label, 4 = due date. Confirmation template: 1 = name, 2 =
          amount paid, 3 = remaining balance, 4 = date. The MSG91 auth key and
          default number live in the backend .env (MSG91_AUTHKEY,
          MSG91_WHATSAPP_NUMBER).
        </p>
      </section>

      <hr />

      {/* Email */}
      <section className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-[16px]">Email (Brevo)</div>
          <div className="text-sm text-gray-500">
            Reminder emails use your existing Brevo sender.
          </div>
        </div>
        <Toggle
          checked={s.email?.enabled}
          onChange={(v) => set({ email: { enabled: v } })}
        />
      </section>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={save}
          disabled={saving}
          className="px-6 py-2 rounded-lg bg-[#EF742C] text-white font-semibold hover:brightness-105 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save settings"}
        </button>
        <button
          onClick={runNow}
          disabled={running}
          className="px-6 py-2 rounded-lg border border-[#EF742C] text-[#EF742C] font-semibold hover:bg-orange-50 disabled:opacity-50"
        >
          {running ? "Running..." : "Run reminders now"}
        </button>
        {s.lastRunAt && (
          <span className="text-xs text-gray-400">
            Last auto run: {new Date(s.lastRunAt).toLocaleString("en-IN")}
          </span>
        )}
      </div>
    </div>
  );
}

const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
      checked ? "bg-[#EF742C]" : "bg-gray-300"
    }`}
  >
    <span
      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
        checked ? "translate-x-6" : "translate-x-1"
      }`}
    />
  </button>
);

export default UpcomingPayments;