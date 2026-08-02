import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Header } from "./Header";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3001";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function Festivals() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [uploadingKey, setUploadingKey] = useState("");
  const [testKey, setTestKey] = useState("");
  const [testMobile, setTestMobile] = useState("");
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/festivals`);
      setItems(res.data.data || []);
    } catch (e) {
      toast.error("Failed to load festivals");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const patch = (key, changes) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...changes } : it)));

  const saveField = async (key, body) => {
    setSavingKey(key);
    try {
      const res = await axios.put(`${API_BASE}/festivals/${key}`, body);
      patch(key, res.data.data);
      toast.success("Saved");
    } catch (e) {
      toast.error("Save failed");
    } finally {
      setSavingKey("");
    }
  };

  const onImage = async (key, file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please choose an image file"); return; }
    setUploadingKey(key);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      const res = await axios.post(`${API_BASE}/festivals/${key}/image`, { imageBase64: base64 });
      patch(key, res.data.data);
      toast.success("Image uploaded for this year");
    } catch (e) {
      toast.error("Image upload failed");
    } finally {
      setUploadingKey("");
    }
  };

  const sendTest = async (key) => {
    if (!testMobile) { toast.error("Enter a mobile number to test"); return; }
    setTestKey(key);
    try {
      const res = await axios.post(`${API_BASE}/festivals/${key}/test`, { mobile: testMobile, name: "Member" });
      res.data.success ? toast.success("Test sent") : toast.error("Test failed — check number/template");
    } catch (e) {
      toast.error("Test failed");
    } finally {
      setTestKey("");
    }
  };

  const year = new Date().getFullYear();
  const filtered = items.filter((it) => it.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div className="px-[50px] p-6 max-w-6xl">
        <h2 className="text-[24px] font-semibold text-gray-800 mb-1 mt-2">Festival Greetings</h2>
        <p className="text-sm text-gray-500 mb-4">
          Each festival auto-sends its WhatsApp template to all members on its date.
          Upload this year's image before the date. Sends once per year.
        </p>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search a festival…"
          className="w-full max-w-md mb-5 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500"
        />

        <div className="mb-4 flex items-center gap-2">
          <input
            value={testMobile}
            onChange={(e) => setTestMobile(e.target.value)}
            placeholder="Test number (e.g. 9538281101)"
            className="w-56 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
          <span className="text-xs text-gray-400">Used by the "Test" button on each festival</span>
        </div>

        {loading ? (
          <div className="text-gray-400 text-sm py-10">Loading festivals…</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((it) => {
              const sentThisYear = it.lastSentYear === year;
              return (
                <div key={it.key} className="border border-gray-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4">
                  {/* image thumb / upload */}
                  <div className="flex-shrink-0">
                    {it.imageUrl ? (
                      <img src={it.imageUrl} alt={it.name} className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                    ) : (
                      <div className="w-20 h-20 rounded-lg border border-dashed border-gray-300 flex items-center justify-center text-[10px] text-gray-400 text-center px-1">
                        No image
                      </div>
                    )}
                  </div>

                  {/* name + template + date */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-800">{it.name}</div>
                    <div className="text-xs text-gray-500 font-mono mt-0.5">{it.templateName || "— no template —"}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <select
                        value={it.month}
                        onChange={(e) => patch(it.key, { month: Number(e.target.value) })}
                        onBlur={() => saveField(it.key, { month: it.month })}
                        className="text-xs border border-gray-300 rounded px-2 py-1"
                      >
                        {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                      </select>
                      <input
                        type="number" min="1" max="31" value={it.day}
                        onChange={(e) => patch(it.key, { day: Number(e.target.value) })}
                        onBlur={() => saveField(it.key, { day: it.day })}
                        className="w-16 text-xs border border-gray-300 rounded px-2 py-1"
                      />
                      <span className="text-xs text-gray-400">{savingKey === it.key ? "saving…" : "date"}</span>
                    </div>
                  </div>

                  {/* status */}
                  <div className="flex-shrink-0 text-xs">
                    {sentThisYear ? (
                      <span className="px-2 py-1 rounded-full bg-green-50 text-green-700 font-semibold">
                        ✓ Sent {year} ({it.lastSentCount})
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full bg-gray-100 text-gray-500">Not sent {year}</span>
                    )}
                  </div>

                  {/* actions */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    <label className={`text-xs px-3 py-1.5 rounded-full border cursor-pointer ${uploadingKey === it.key ? "opacity-50" : "border-orange-500 text-orange-600 hover:bg-orange-50"}`}>
                      {uploadingKey === it.key ? "Uploading…" : (it.imageUrl ? "Replace image" : "Upload image")}
                      <input type="file" accept="image/*" className="hidden"
                        onChange={(e) => onImage(it.key, e.target.files[0])} disabled={uploadingKey === it.key} />
                    </label>

                    <button
                      onClick={() => sendTest(it.key)}
                      disabled={testKey === it.key}
                      className="text-xs px-3 py-1.5 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {testKey === it.key ? "Sending…" : "Test"}
                    </button>

                    <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={it.enabled}
                        onChange={(e) => saveField(it.key, { enabled: e.target.checked })}
                        className="w-4 h-4 accent-orange-500"
                      />
                      On
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}