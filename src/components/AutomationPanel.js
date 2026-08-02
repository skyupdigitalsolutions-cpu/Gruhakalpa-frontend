import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3001";
const TOKEN_KEY = "automation_token";
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function AutomationPanel() {
  const [token, setToken] = useState(localStorage.getItem(TOKEN_KEY) || "");
  return token
    ? <Panel token={token} onLogout={() => { localStorage.removeItem(TOKEN_KEY); setToken(""); }} />
    : <Login onLogin={(t) => { localStorage.setItem(TOKEN_KEY, t); setToken(t); }} />;
}

// ── Separate login form ──
function Login({ onLogin }) {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!u || !p) { toast.error("Enter username and password"); return; }
    setBusy(true);
    try {
      const res = await axios.post(`${API_BASE}/automation/login`, { username: u, password: p });
      if (res.data.success) { toast.success("Welcome"); onLogin(res.data.token); }
      else toast.error(res.data.message || "Login failed");
    } catch (e) {
      toast.error(e.response?.data?.message || "Login failed");
    } finally { setBusy(false); }
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f6f2ee", fontFamily: "system-ui" }}>
      <div style={{ width: 360, background: "#fff", borderRadius: 16, padding: 28, boxShadow: "0 12px 40px rgba(0,0,0,.1)" }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#2b2b2b" }}>Festival Automation</div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>The Gruhakalpa Housing Co-Operative Society</div>
        </div>
        <input value={u} onChange={(e) => setU(e.target.value)} placeholder="Username"
          onKeyDown={(e) => e.key === "Enter" && submit()}
          style={inp} />
        <input value={p} onChange={(e) => setP(e.target.value)} placeholder="Password" type="password"
          onKeyDown={(e) => e.key === "Enter" && submit()}
          style={inp} />
        <button onClick={submit} disabled={busy}
          style={{ ...btn, width: "100%", marginTop: 6, opacity: busy ? .6 : 1 }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </div>
    </div>
  );
}

// ── The panel ──
function Panel({ token, onLogout }) {
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [testMobile, setTestMobile] = useState("");
  const [busyKey, setBusyKey] = useState("");
  const [staff, setStaff] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [master, setMaster] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/automation/templates`, auth);
      setRows(res.data.data || []);
      setNote(res.data.note || "");
      if (!res.data.success) toast.warn(res.data.note || "Could not fetch from MSG91");
      // Load the staff-reminder template info (its own section).
      try {
        const s = await axios.get(`${API_BASE}/automation/staff`, auth);
        setStaff(s.data.data || null);
      } catch (_) { /* staff section optional */ }
      // Load the next upcoming festivals from today.
      try {
        const u = await axios.get(`${API_BASE}/automation/upcoming?limit=2`, auth);
        setUpcoming(u.data.data || []);
      } catch (_) { /* optional */ }
      // Load the master switch state.
      try {
        const mm = await axios.get(`${API_BASE}/automation/master`, auth);
        setMaster(mm.data.festivalAutomationEnabled === true);
      } catch (_) { /* optional */ }
    } catch (e) {
      if (e.response?.status === 401) { onLogout(); return; }
      toast.error("Failed to load templates");
    } finally { setLoading(false); }
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = (tpl, ch) => setRows((prev) => prev.map((r) => r.templateName === tpl ? { ...r, ...ch } : r));

  const onImage = async (tpl, file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Choose an image"); return; }
    setBusyKey(tpl + "_img");
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file);
      });
      const res = await axios.post(`${API_BASE}/automation/templates/${tpl}/image`, { imageBase64: base64 }, auth);
      patch(tpl, { imageUrl: res.data.imageUrl });
      toast.success("Image uploaded");
    } catch (e) { toast.error("Upload failed"); }
    finally { setBusyKey(""); }
  };

  const toggle = async (tpl, enabled) => {
    patch(tpl, { enabled });
    try { await axios.put(`${API_BASE}/automation/templates/${tpl}`, { enabled }, auth); }
    catch (e) { toast.error("Save failed"); }
  };

  // Master switch — the top-level kill switch. Nothing sends to members unless
  // this is ON. Confirms before enabling.
  const setMasterSwitch = async (enabled) => {
    if (enabled) {
      const ok = window.confirm(
        "Turn ON the master festival automation?\n\nWhile this is ON, any festival you have switched on will auto-send to ALL members on its date. Keep this OFF until you're ready. Continue?"
      );
      if (!ok) return;
    }
    setBusyKey("master");
    try {
      await axios.put(`${API_BASE}/automation/master`, { enabled }, auth);
      setMaster(enabled);
      toast.success(enabled ? "Master automation ON" : "Master automation OFF — nothing will send");
    } catch (e) {
      toast.error("Could not update master switch");
    } finally { setBusyKey(""); }
  };

  // Master select-all: turn every festival on or off at once. Confirms before
  // enabling all, since that means every festival will auto-send to all members.
  const toggleAll = async (enabled) => {
    if (enabled) {
      const ok = window.confirm(
        "Turn ON ALL festivals?\n\nEvery festival will then auto-send its greeting to ALL members on its date (9:30 AM). Make sure images are uploaded. Continue?"
      );
      if (!ok) return;
    }
    setBusyKey("toggle_all");
    try {
      await axios.put(`${API_BASE}/automation/templates-toggle-all`, { enabled }, auth);
      setRows((prev) => prev.map((r) => ({ ...r, enabled })));
      toast.success(enabled ? "All festivals turned ON" : "All festivals turned OFF");
    } catch (e) {
      toast.error("Bulk update failed");
    } finally { setBusyKey(""); }
  };

  const test = async (tpl) => {
    if (!testMobile) { toast.error("Enter a test number at the top"); return; }
    setBusyKey(tpl + "_test");
    try {
      const res = await axios.post(`${API_BASE}/automation/templates/${tpl}/test`, { mobile: testMobile, name: "Member" }, auth);
      res.data.success ? toast.success("Test sent") : toast.error("Test failed");
    } catch (e) { toast.error("Test failed"); }
    finally { setBusyKey(""); }
  };

  // Test the STAFF reminder — sends the staff template for the ACTUAL upcoming
  // festivals (based on today's date) to the configured staff numbers.
  const testStaff = async () => {
    setBusyKey("staff_test");
    try {
      const res = await axios.post(`${API_BASE}/automation/test-staff`, {}, auth);
      if (res.data.success) {
        // Show the honest result — includes any per-number failures.
        toast.success(res.data.message || `Staff reminder sent for: ${(res.data.festivals || []).join(", ")}`);
      } else {
        toast.error(res.data.message || "Staff test failed");
      }
    } catch (e) {
      toast.error(e.response?.data?.message || "Staff test failed");
    } finally { setBusyKey(""); }
  };

  const year = new Date().getFullYear();
  const filtered = rows.filter((r) => (r.name + r.templateName).toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div style={{ minHeight: "100vh", background: "#f6f2ee", fontFamily: "system-ui", padding: "24px 20px 60px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#2b2b2b" }}>Festival Automation</div>
            <div style={{ fontSize: 12, color: "#888" }}>Templates fetched live from MSG91. Dates auto-mapped. Just upload each image.</div>
          </div>
          <button onClick={onLogout} style={{ ...btn, background: "#eee", color: "#333" }}>Sign out</button>
        </div>

        {/* ── MASTER kill-switch (top-level safety) ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          background: master ? "#eef7ee" : "#fff6f6",
          border: `2px solid ${master ? "#2e7d32" : "#e0a0a0"}`,
          borderRadius: 12, padding: "14px 18px", margin: "14px 0 6px",
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: master ? "#2e7d32" : "#c0392b" }}>
              Master Festival Automation: {master ? "ON" : "OFF"}
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
              {master
                ? "Enabled festivals will auto-send to all members on their date. Turn OFF to stop everything."
                : "OFF — no festival will send to members, even if individually toggled on. This is the safe state."}
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: busyKey === "master" ? "wait" : "pointer", flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: "#666" }}>{busyKey === "master" ? "…" : (master ? "Turn OFF" : "Turn ON")}</span>
            <input
              type="checkbox"
              disabled={busyKey === "master"}
              checked={master}
              onChange={(e) => setMasterSwitch(e.target.checked)}
              style={{ width: 22, height: 22, accentColor: "#2e7d32" }}
            />
          </label>
        </div>

        {note && <div style={{ fontSize: 12, color: "#a06a2c", background: "#fbf0e2", border: "1px solid #f0d9be", borderRadius: 8, padding: "8px 12px", margin: "10px 0" }}>{note}</div>}

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "12px 0 18px" }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search a festival / template…" style={{ ...inp, margin: 0, width: 280 }} />
          <input value={testMobile} onChange={(e) => setTestMobile(e.target.value)} placeholder="Test number (your own)" style={{ ...inp, margin: 0, width: 200 }} />
          <button onClick={load} style={{ ...btn, background: "#fff", color: "#EF742C", border: "1.5px solid #EF742C" }}>↻ Refresh from MSG91</button>
        </div>

        {/* ── Staff Reminder section (separate from festival templates) ── */}
        {staff && (
          <div style={{ marginBottom: 26 }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#EF742C", marginBottom: 8, borderBottom: "2px solid #eadfd5", paddingBottom: 6 }}>
              Staff Reminder Template
            </div>
            <div style={{ background: "#fff", border: "1px solid #eadfd5", borderRadius: 12, padding: 16, display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontWeight: 700, color: "#2b2b2b" }}>{staff.name}</div>
                <div style={{ fontSize: 11, color: "#888", fontFamily: "monospace" }}>{staff.templateName}</div>
                <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                  {staff.category} · {staff.language} · {staff.variables}
                </div>
                <div style={{ fontSize: 11.5, color: "#666", background: "#f7f4f1", borderRadius: 8, padding: "8px 10px", marginTop: 8 }}>
                  <b>Schedule:</b> {staff.schedule}
                </div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>
                  <b>Staff numbers:</b> {staff.staffNumbers && staff.staffNumbers.length ? staff.staffNumbers.join(", ") : "— not set in .env —"}
                </div>
                {upcoming.length > 0 && (
                  <div style={{ fontSize: 11.5, color: "#2e7d32", background: "#eef7ee", borderRadius: 8, padding: "8px 10px", marginTop: 8 }}>
                    <b>Next upcoming:</b> {upcoming.map((u) => `${u.name} (${u.date}, in ${u.daysAway}d${u.hasImage ? ", image ✓" : ", no image"})`).join("  •  ")}
                  </div>
                )}
              </div>
              <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: staff.configured ? "#e8f3e8" : "#fdeaea", color: staff.configured ? "#2e7d32" : "#c0392b", fontWeight: 600 }}>
                  {staff.configured ? "✓ Configured" : "⚠ No staff numbers"}
                </span>
                <button
                  onClick={testStaff}
                  disabled={busyKey === "staff_test" || !staff.configured}
                  style={{ ...smallBtn, opacity: (busyKey === "staff_test" || !staff.configured) ? 0.5 : 1 }}
                  title={staff.configured ? "Send the staff reminder to the configured staff numbers now" : "Set AUTOMATION_STAFF_NUMBERS in .env first"}
                >
                  {busyKey === "staff_test" ? "Sending…" : "Test staff reminder"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Festival templates section ── */}
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#EF742C", marginBottom: 8, borderBottom: "2px solid #eadfd5", paddingBottom: 6 }}>
          Festival Greeting Templates
        </div>
        <div style={{ fontSize: 12, color: "#c0392b", background: "#fdeaea", border: "1px solid #f5c6c6", borderRadius: 8, padding: "8px 12px", marginBottom: 14 }}>
          ⚠ Festivals are <b>OFF by default</b>. A festival only auto-sends to all members when you switch its <b>On</b> toggle. Turn one on only after uploading its image.
        </div>

        {!loading && filtered.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, padding: "8px 12px", background: "#fff", border: "1px solid #eadfd5", borderRadius: 10 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#2b2b2b", cursor: busyKey === "toggle_all" ? "wait" : "pointer" }}>
              <input
                type="checkbox"
                disabled={busyKey === "toggle_all"}
                checked={rows.length > 0 && rows.every((r) => r.enabled)}
                onChange={(e) => toggleAll(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "#EF742C" }}
              />
              {busyKey === "toggle_all" ? "Updating all…" : "Select all (turn every festival on / off)"}
            </label>
            <span style={{ fontSize: 11, color: "#888", marginLeft: "auto" }}>
              {rows.filter((r) => r.enabled).length} of {rows.length} on
            </span>
          </div>
        )}

        {loading ? (
          <div style={{ color: "#999", padding: 30 }}>Loading templates from MSG91…</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: "#999", padding: 30 }}>No templates found. Check MSG91 or your auth key.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map((r) => (
              <div key={r.templateName} style={{ background: "#fff", border: "1px solid #eadfd5", borderRadius: 12, padding: 14, display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                {/* image */}
                <div style={{ flexShrink: 0 }}>
                  {r.imageUrl
                    ? <img src={r.imageUrl} alt="" style={{ width: 76, height: 76, objectFit: "cover", borderRadius: 10, border: "1px solid #eee" }} />
                    : <div style={{ width: 76, height: 76, borderRadius: 10, border: "1px dashed #ccc", display: "grid", placeItems: "center", fontSize: 10, color: "#aaa" }}>No image</div>}
                </div>

                {/* info */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 700, color: "#2b2b2b" }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: "#888", fontFamily: "monospace" }}>{r.templateName}</div>
                  <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                    {r.category || "—"} · {r.status || "—"} · {r.hasDate ? `${MONTHS[(r.month || 1) - 1]} ${r.day}` : "no date mapped"}
                  </div>
                  {r.body
                    ? <div style={{ fontSize: 11.5, color: "#555", background: "#f7f4f1", borderRadius: 8, padding: "8px 10px", marginTop: 8, whiteSpace: "pre-wrap", maxHeight: 120, overflow: "auto" }}>{r.body}</div>
                    : <div style={{ fontSize: 11, color: "#bbb", marginTop: 6, fontStyle: "italic" }}>content not returned by MSG91</div>}
                </div>

                {/* status + actions */}
                <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-end" }}>
                  <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 999, background: r.sentThisYear ? "#e8f3e8" : "#f0f0f0", color: r.sentThisYear ? "#2e7d32" : "#888", fontWeight: 600 }}>
                    {r.sentThisYear ? `✓ Sent ${year}` : `Not sent ${year}`}
                  </span>
                  <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <label style={{ ...smallBtn, cursor: "pointer", opacity: busyKey === r.templateName + "_img" ? .5 : 1 }}>
                      {busyKey === r.templateName + "_img" ? "Uploading…" : (r.imageUrl ? "Replace image" : "Upload image")}
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => onImage(r.templateName, e.target.files[0])} />
                    </label>
                    <button onClick={() => test(r.templateName)} disabled={busyKey === r.templateName + "_test"} style={smallBtn}>
                      {busyKey === r.templateName + "_test" ? "…" : "Test"}
                    </button>
                    <label style={{ fontSize: 12, display: "flex", gap: 4, alignItems: "center", color: "#555" }}>
                      <input type="checkbox" checked={r.enabled} onChange={(e) => toggle(r.templateName, e.target.checked)} style={{ accentColor: "#EF742C" }} /> On
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const inp = { width: "100%", padding: "10px 12px", margin: "6px 0", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, outline: "none", boxSizing: "border-box" };
const btn = { padding: "9px 16px", borderRadius: 999, border: "none", background: "#EF742C", color: "#fff", fontWeight: 600, fontSize: 13, cursor: "pointer" };
const smallBtn = { fontSize: 11.5, padding: "5px 11px", borderRadius: 999, border: "1px solid #ddd", background: "#fff", color: "#444", cursor: "pointer" };