/* eslint-disable */
import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { Header } from "./Header";
import { Eye } from "lucide-react";

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3001";

// ── Compact Indian number-to-words (same pattern used across the app) ──
const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];
const two = (n) =>
  n < 20
    ? ONES[n]
    : TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : "");
const three = (n) => {
  const h = Math.floor(n / 100),
    r = n % 100;
  return (h ? ONES[h] + " Hundred" : "") + (r ? (h ? " " : "") + two(r) : "");
};
const numberToWords = (amount) => {
  let n = Math.floor(Math.max(0, Number(amount) || 0));
  if (!n) return "";
  const parts = [];
  const cr = Math.floor(n / 10000000);
  n %= 10000000;
  const la = Math.floor(n / 100000);
  n %= 100000;
  const th = Math.floor(n / 1000);
  n %= 1000;
  if (cr) parts.push(three(cr) + " Crore");
  if (la) parts.push(two(la) + " Lakh");
  if (th) parts.push(two(th) + " Thousand");
  if (n) parts.push(three(n));
  return parts.join(" ").replace(/\s+/g, " ").trim();
};

const fmtDMY = (d) => {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt)) return "";
  const day = String(dt.getDate()).padStart(2, "0");
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${dt.getFullYear()}`;
};
const todayISO = () => new Date().toISOString().split("T")[0];
const toISO = (d) => (d ? new Date(d).toISOString().split("T")[0] : "");
const inr = (n) =>
  Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

// Term label derived from tenure (months) — matches the printed card's
// "1 Year" style wording; admin can still override the free-text field.
const termLabelFromMonths = (months) => {
  const m = Number(months) || 12;
  if (m % 12 === 0) {
    const y = m / 12;
    return `${y} Year${y > 1 ? "s" : ""}`;
  }
  return `${m} Months`;
};

// ── Hazard-tape striped border ────────────────────────────────────────────────
// Rendered as an inline SVG pattern (data URI) instead of a CSS
// repeating-linear-gradient. html2canvas (used for the PDF) renders repeating
// gradients unreliably, but an SVG background is rasterised by the browser's own
// SVG engine and captured faithfully — so the PDF's border matches the preview
// exactly. The stripes are identical to the original: 45°, 16px orange/yellow.
const STRIPE_SVG = encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'>" +
    "<defs>" +
    "<pattern id='p' width='45.254' height='45.254' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'>" +
    "<rect width='45.254' height='45.254' fill='#f9c94a'/>" +
    "<rect width='22.627' height='45.254' fill='#f0a020'/>" +
    "</pattern>" +
    "</defs>" +
    "<rect width='64' height='64' fill='url(#p)'/>" +
    "</svg>",
);
const STRIPE_STYLE = {
  backgroundImage: `url("data:image/svg+xml,${STRIPE_SVG}")`,
  backgroundRepeat: "repeat",
};

// Wait until every <img> inside a node has actually finished loading (or errored)
// so html2canvas captures the logo/watermark exactly as the preview shows them.
const waitForImages = (node) =>
  Promise.all(
    Array.from(node.querySelectorAll("img")).map((img) =>
      img.complete && img.naturalHeight !== 0
        ? Promise.resolve()
        : new Promise((res) => {
            img.addEventListener("load", res, { once: true });
            img.addEventListener("error", res, { once: true });
          }),
    ),
  );

// ── Letterhead defaults — taken from the physical FDR certificate ──
const DEFAULT_LETTERHEAD = {
  societyNameKannada: "ದಿ ಗೃಹಕಲ್ಪ ಹೌಸಿಂಗ್ ಕೋ-ಆಪರೇಟಿವ್ ಸೊಸೈಟಿ ಲಿ.",
  societyActKannada: "(ಕರ್ನಾಟಕ ಸರ್ಕಾರದ ಸಹಕಾರ ಕಾಯ್ದೆಗೆ ಒಳಪಟ್ಟಿದೆ)",
  societyName: "THE GRUHAKALPA HOUSING CO-OPERATIVE SOCIETY LTD.",
  regLine: "Reg. No.: JRB/RGN/CR-04/51586/2023-24  Date: 21/11/23",
  actLine: "(Governed by Karnataka Government Co-operative Society Act)",
  address:
    "NO.597, 19th Main Road, 16th Cross Road, A Block, Sahakara Nagara, Bengaluru-560092",
  phone: "Ph No.: 080-49546795 / 9035154110 / 9035154111",
};

const label = "font-semibold text-[13px] pb-1 block text-gray-700";
const field =
  "border border-gray-300 px-3 py-2 w-full bg-white rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent disabled:bg-gray-100";

export function FDCertificateForm() {
  const [searchParams] = useSearchParams();
  const preselectId = searchParams.get("fdId") || "";

  const [fds, setFds] = useState([]);
  const [loadingFds, setLoadingFds] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedFdId, setSelectedFdId] = useState(preselectId);

  const [letterhead, setLetterhead] = useState(DEFAULT_LETTERHEAD);
  const [showLetterhead, setShowLetterhead] = useState(false);

  const [fdrNo, setFdrNo] = useState("");
  const [certDate, setCertDate] = useState(todayISO());
  const [tac, setTac] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [amount, setAmount] = useState("");
  const [term, setTerm] = useState("1 Year");
  const [dateOfDeposit, setDateOfDeposit] = useState(todayISO());
  const [dateOfMaturity, setDateOfMaturity] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [maturityAmount, setMaturityAmount] = useState("");

  const [showPreview, setShowPreview] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoadingFds(true);
      try {
        const res = await axios.get(`${API_BASE}/fixed-deposits`);
        const list = (res.data.data || []).filter((f) => !f.cancelled);
        setFds(list);
      } catch (e) {
        console.error(e);
        toast.error("Failed to load fixed deposits");
      } finally {
        setLoadingFds(false);
      }
    };
    load();
  }, []);

  // Auto-populate the certificate fields from the chosen FD record.
  useEffect(() => {
    if (!selectedFdId) return;
    const fd = fds.find((f) => f._id === selectedFdId);
    if (!fd) return;
    setFdrNo(fd.fdrNo || "");
    setReceivedFrom(fd.name || "");
    setAmount(fd.amount != null ? String(fd.amount) : "");
    setTerm(termLabelFromMonths(fd.tenureMonths));
    setDateOfDeposit(toISO(fd.amountPaidDate || fd.date));
    setDateOfMaturity(toISO(fd.maturityDate));
    setInterestRate(fd.interestRate != null ? String(fd.interestRate) : "");
    setMaturityAmount(
      fd.maturityAmount != null ? String(fd.maturityAmount) : "",
    );
  }, [selectedFdId, fds]);

  const filteredFds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return fds;
    return fds.filter(
      (f) =>
        (f.fdrNo || "").toLowerCase().includes(q) ||
        (f.membershipId || "").toLowerCase().includes(q) ||
        (f.name || "").toLowerCase().includes(q),
    );
  }, [fds, search]);

  const amountNum = Number(amount) || 0;
  const amountWords = amountNum
    ? `${numberToWords(amountNum)} Rupees Only`
    : "";
  const maturityNum = Number(maturityAmount) || 0;

  const resetManual = () => {
    setSelectedFdId("");
    setFdrNo("");
    setReceivedFrom("");
    setAmount("");
    setTerm("1 Year");
    setDateOfDeposit(todayISO());
    setDateOfMaturity("");
    setInterestRate("");
    setMaturityAmount("");
  };

  const validate = () => {
    if (!fdrNo.trim()) return "FDR No. is required";
    if (!receivedFrom.trim()) return "Received From (name) is required";
    if (!amountNum) return "Amount is required";
    if (!dateOfDeposit) return "Date of Deposit is required";
    if (!dateOfMaturity) return "Date of Maturity is required";
    if (interestRate === "" || interestRate === null)
      return "Rate of Interest is required";
    if (!maturityNum) return "Maturity Amount is required";
    return "";
  };

  // ── Exact-layout certificate preview, matching the physical FDR card ──
  // Built with Tailwind utility classes. Arbitrary-value classes (w-[…],
  // text-[…]px) are used instead of relying on the default scale, because
  // this needs to match the physical card's precise proportions exactly.
  //
  // Outer wrapper renders the diagonal orange/yellow striped border seen on
  // the physical card (like hazard tape), with the white maroon-bordered
  // card padded inside it. The same node is used for both the on-screen
  // preview and the PDF capture, so the two are identical.
  const FDCertificateContent = () => (
    <div
      className="relative w-[559px] p-[16px] box-border"
      style={STRIPE_STYLE}
    >
      <div className="relative bg-white border-[3px] border-[#7a2e1f] rounded-2xl w-full box-border p-2 flex flex-col font-serif overflow-hidden">
        {/* Faint centered watermark, like the original card's embossed tree logo */}
        <img
          src="/images/bg-removed-logo.webp"
          alt=""
          crossOrigin="anonymous"
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 object-contain opacity-[0.07] pointer-events-none select-none"
        />

        {/* Header — logo floats top-left; text block spans the FULL card
            width and is centered, which is why the society name fits on one
            line instead of wrapping (matches the physical card). */}
        <div className="relative z-10 border-b-2 border-black pb-2 mb-2">
          <img
            src="/images/bg-removed-logo.webp"
            alt="Logo"
            crossOrigin="anonymous"
            className="absolute left-0 top-0 w-14 h-14 object-contain"
          />
          <div className="text-center px-1">
            <div className="text-[11px] font-bold text-[#1a1a6e] mb-0.5">
              {letterhead.societyNameKannada}
            </div>
            <div className="text-[7.5px] italic mb-1">
              {letterhead.societyActKannada}
            </div>
            <div className="text-[12px] font-bold mb-0.5 whitespace-nowrap">
              {letterhead.societyName}
            </div>
            <div className="text-[8px] font-bold mb-0.5">
              {letterhead.regLine}
            </div>
            <div className="text-[7.5px] font-bold italic mb-0.5">
              {letterhead.actLine}
            </div>
            <div className="text-[7.5px] mb-0.5">{letterhead.address}</div>
            <div className="text-[7.5px]">{letterhead.phone}</div>
          </div>
        </div>

        {/* FDR No. — Title — correspondence note (Date/T.A.C moved down to
            sit beside the body paragraph instead) */}
        <div className="relative z-10 flex items-start mb-3">
          <div className="flex-1 text-[10px] font-bold">
            FDR No.:{" "}
            <span className="text-[#a01818] font-sans">{fdrNo || "-"}</span>
          </div>
          <div className="flex-1 text-center text-[12.5px] font-bold tracking-wide whitespace-nowrap">
            FIXED DEPOSIT RECEIPT
          </div>
          <div className="flex-1 text-right text-[8.5px] italic mt-3">
            in all correspondence Please quote:
          </div>
        </div>

        {/* Body paragraph + Date/T.A.C/boxed amount column.
            Date lines up beside "Received from…" and T./A/C lines up
            beside "a sum of Rupees…", with the amount box stacked below. */}
        <div className="relative z-10 flex gap-3 mb-2">
          <div className="flex-1 min-w-0 text-[10px] leading-[1.8]">
            <div className="border-b border-dotted border-black pb-0.5 mb-2">
              Received from Sri/Smt{" "}
              <strong>{receivedFrom || "……………………………"}</strong>
            </div>
            <div className="border-b border-dotted border-black pb-0.5 mb-1">
              a sum of Rupees{" "}
              <strong>{amountWords || "………………………………………………"}</strong>
            </div>
            <div className=" border-black pb-0.5 mb-2">
              …………………………………………………………………………………………………&nbsp;&nbsp;as fixed deposit
            </div>
            <div className="text-[9px]">
              as per details below subject to the terms and conditions given in
              the application form
            </div>
          </div>
          <div className="flex-shrink-0 flex flex-col items-end gap-3">
            <div className="text-[10px] italic whitespace-nowrap">
              <span className="font-sans font-bold">
                Date. {fmtDMY(certDate)}
              </span>
            </div>
            <div className="text-[8.5px]  whitespace-nowrap mb-1">
              T.A/C............................. {tac}
            </div>
            {/* Amount box: capped width + shrinking font so a large ₹ figure
                (e.g. ₹60,00,000/-) can never push past the card's right border. */}
            <div
              className={`border border-black px-2 py-1.5 font-bold whitespace-nowrap w-[120px] text-center flex items-center justify-center ${
                amountNum >= 1000000 ? "text-[13px]" : "text-[15px]"
              }`}
            >
              ₹ {inr(amountNum)}/-
            </div>
          </div>
        </div>

        {/* Details table */}
        <table className="relative z-10 w-full border-collapse text-[9px] mb-3">
          <thead>
            <tr>
              {[
                "TERM",
                "DATE OF DEPOSIT",
                "DATE OF MATURITY",
                "RATE OF INTEREST",
                "MATURITY AMOUNT",
              ].map((h) => (
                <th
                  key={h}
                  className="border border-black px-1 py-1.5 italic font-bold text-center bg-gray-50"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border font-sans border-black px-1 py-2 text-center font-bold">
                {term}
              </td>
              <td className="border font-sans border-black px-1 py-2 text-center font-bold">
                {fmtDMY(dateOfDeposit)}
              </td>
              <td className="border font-sans border-black px-1 py-2 text-center font-bold">
                {fmtDMY(dateOfMaturity)}
              </td>
              <td className="border font-sans border-black px-1 py-2 text-center font-bold">
                {interestRate || 0}%
              </td>
              <td className="border font-sans border-black px-1 py-2 text-center font-bold">
                {inr(maturityNum)}/-
              </td>
            </tr>
          </tbody>
        </table>

        {/* For THE GRUHAKALPA... */}
        <div className="relative z-10 text-right text-[10px] italic font-semibold mt-3 mb-1">
          For THE GRUHAKALPA HOUSING CO-OPERATIVE SOCIETY LTD.
        </div>

        {/* Signatures + NOT TRANSFERABLE, all three side by side */}
        <div className="relative z-10 flex justify-between items-end px-7 mt-6 mb-2">
          <div className="text-[9px] italic">NOT TRANSFERABLE</div>
          <div className="text-center">
            <div className="h-7" />
            <div className="border-t border-black pt-1 text-[9.5px] italic">
              Secretary
            </div>
          </div>
          <div className="text-center">
            <div className="h-7" />
            <div className="border-t border-black pt-1 text-[9.5px] italic">
              President
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const handleDownloadPDF = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    try {
      setGenerating(true);
      const html2canvas = (await import("html2canvas")).default;
      const { default: jsPDF } = await import("jspdf");
      const { createRoot } = await import("react-dom/client");

      const container = document.createElement("div");
      container.style.cssText =
        "position:fixed;left:-9999px;top:0;background:#fff;";
      document.body.appendChild(container);
      const root = createRoot(container);
      root.render(<FDCertificateContent />);

      // Capture the certificate div itself (it already has border-box
      // sizing and a fixed 559px width) — no manual offset/width guessing.
      const target = container.firstElementChild || container;

      // Make the capture deterministic so the PDF matches the preview exactly:
      // let React commit, wait for the logo/watermark images to finish loading,
      // and let webfonts settle before rasterising.
      await new Promise((r) => setTimeout(r, 150));
      await waitForImages(container);
      if (document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch (_) {}
      }
      await new Promise((r) => setTimeout(r, 100));

      const canvas = await html2canvas(target, {
        scale: 4,
        useCORS: true,
        imageTimeout: 15000,
        logging: false,
        backgroundColor: "#ffffff",
      });
      root.unmount();
      document.body.removeChild(container);

      // Size the PDF page to the certificate itself — no leftover white space.
      const ratio = canvas.width / canvas.height; // >1 = wider than tall (landscape)
      const targetW = 210; // page width in mm (A4-landscape width; raise/lower to taste)
      const targetH = targetW / ratio; // height follows the card's real aspect
      const margin = 1; // even border all round; 0 for full-bleed

      const imgW = targetW - margin * 2;
      const imgH = targetH - margin * 2;

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: [targetW, targetH], // custom page = exactly the card's shape
      });
      pdf.addImage(imgData, "JPEG", margin, margin, imgW, imgH);

      const filenamePart = (fdrNo || "FD").replace(/[^a-zA-Z0-9]/g, "_");
      const filename = `FDCertificate_${filenamePart}.pdf`;
      const pdfBase64 = pdf.output("datauristring").split(",")[1];

      // Persist alongside the Fixed Deposit record if one is selected.
      if (selectedFdId) {
        try {
          await axios.put(
            `${API_BASE}/fixed-deposits/${selectedFdId}/certificate`,
            {
              pdfBase64,
              fdrNumber: fdrNo,
            },
          );
          toast.success(
            "Certificate generated, downloaded and saved to the Fixed Deposit record!",
          );
        } catch (backendErr) {
          console.error(backendErr);
          toast.warning(
            "Certificate downloaded, but saving it to the Fixed Deposit record failed.",
          );
        }
      } else {
        toast.success("Certificate generated and downloaded!");
      }

      pdf.save(filename);
    } catch (e) {
      console.error(e);
      toast.error(`Failed to generate certificate: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <Header />
      <div className="w-[900px] px-10 ml-10">
        <h1 className="font-semibold text-2xl mt-[50px] mb-[10px]">
          FD Certificate
        </h1>
        <p className="text-sm text-gray-500 mb-[30px]">
          Generate the printed Fixed Deposit Receipt (FDR) certificate — pick an
          existing Fixed Deposit to auto-fill the details, or fill them in
          manually.
        </p>

        <div className="bg-[#EF742C]/10 mb-10 p-[30px] rounded-xl">
          {/* FD selector */}
          <div className="mb-6 bg-white border border-[#EF742C]/20 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-[14px] text-[#EF742C]">
                Select Fixed Deposit (optional)
              </h3>
              {selectedFdId && (
                <button
                  type="button"
                  onClick={resetManual}
                  className="text-xs font-semibold text-gray-500 underline"
                >
                  Clear selection / enter manually
                </button>
              )}
            </div>
            <input
              className={`${field} mb-3`}
              placeholder="Search FDR No / Membership Id / Name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {loadingFds ? (
              <div className="text-sm text-gray-400 animate-pulse">
                Loading fixed deposits…
              </div>
            ) : (
              <div className="max-h-52 overflow-y-auto space-y-1.5">
                {filteredFds.length === 0 && (
                  <div className="text-sm text-gray-400">
                    No matching fixed deposits found.
                  </div>
                )}
                {filteredFds.map((fd) => (
                  <label
                    key={fd._id}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer text-sm ${
                      selectedFdId === fd._id
                        ? "border-[#EF742C] bg-orange-50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="fdPick"
                      checked={selectedFdId === fd._id}
                      onChange={() => setSelectedFdId(fd._id)}
                      className="accent-[#EF742C]"
                    />
                    <span className="font-semibold w-32">{fd.fdrNo}</span>
                    <span className="w-28">{fd.membershipId}</span>
                    <span className="flex-1 truncate">{fd.name}</span>
                    <span className="text-gray-500">₹{inr(fd.amount)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Certificate fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className={label}>
                FDR No. <span className="text-red-500">*</span>
              </label>
              <input
                className={field}
                value={fdrNo}
                onChange={(e) => setFdrNo(e.target.value)}
                placeholder="e.g. 0010"
              />
            </div>
            <div>
              <label className={label}>
                Certificate Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className={field}
                value={certDate}
                onChange={(e) => setCertDate(e.target.value)}
              />
            </div>
            <div>
              <label className={label}>
                Received From (Sri/Smt) <span className="text-red-500">*</span>
              </label>
              <input
                className={field}
                value={receivedFrom}
                onChange={(e) => setReceivedFrom(e.target.value)}
                placeholder="Member name"
              />
            </div>
            <div>
              <label className={label}>T./A/C (optional)</label>
              <input
                className={field}
                value={tac}
                onChange={(e) => setTac(e.target.value)}
                placeholder="Transfer / account reference"
              />
            </div>
            <div>
              <label className={label}>
                Amount (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                className={field}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="e.g. 600000"
              />
            </div>
            <div>
              <label className={label}>Sum in Words (auto)</label>
              <input
                className={`${field} bg-gray-50`}
                value={amountWords}
                readOnly
              />
            </div>
            <div>
              <label className={label}>
                Term <span className="text-red-500">*</span>
              </label>
              <input
                className={field}
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="e.g. 1 Year"
              />
            </div>
            <div>
              <label className={label}>
                Rate of Interest (% p.a.){" "}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                className={field}
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
                placeholder="e.g. 10"
              />
            </div>
            <div>
              <label className={label}>
                Date of Deposit <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className={field}
                value={dateOfDeposit}
                onChange={(e) => setDateOfDeposit(e.target.value)}
              />
            </div>
            <div>
              <label className={label}>
                Date of Maturity <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                className={field}
                value={dateOfMaturity}
                onChange={(e) => setDateOfMaturity(e.target.value)}
              />
            </div>
            <div className="md:col-span-2">
              <label className={label}>
                Maturity Amount (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                className={field}
                value={maturityAmount}
                onChange={(e) => setMaturityAmount(e.target.value)}
                placeholder="e.g. 660000"
              />
            </div>
          </div>

          {/* Letterhead — collapsed by default, editable if the office details change */}
          <div className="mt-6 bg-white border border-gray-200 rounded-xl p-5">
            <button
              type="button"
              onClick={() => setShowLetterhead((s) => !s)}
              className="text-sm font-semibold text-gray-600 flex items-center gap-2"
            >
              {showLetterhead ? "▾" : "▸"} Letterhead details (society name,
              registration, address)
            </button>
            {showLetterhead && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                {Object.entries({
                  societyNameKannada: "Society Name (Kannada)",
                  societyActKannada: "Act Note (Kannada)",
                  societyName: "Society Name (English)",
                  regLine: "Registration Line",
                  actLine: "Act Line",
                  address: "Address",
                  phone: "Phone Numbers",
                }).map(([key, lbl]) => (
                  <div
                    key={key}
                    className={key === "address" ? "md:col-span-2" : ""}
                  >
                    <label className={label}>{lbl}</label>
                    <input
                      className={field}
                      value={letterhead[key]}
                      onChange={(e) =>
                        setLetterhead((p) => ({ ...p, [key]: e.target.value }))
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className="px-4 flex gap-2 items-center py-2 border-2 border-orange-500 text-orange-600 text-sm font-semibold rounded-full hover:bg-orange-200/40 transition-all duration-200"
            >
              <Eye size={16} /> Preview
            </button>
            <button
              type="button"
              onClick={handleDownloadPDF}
              disabled={generating}
              className={`px-10 py-2 bg-gradient-to-r from-orange-200 via-orange-500 to-orange-600 text-white text-sm font-semibold rounded-full shadow-md hover:shadow-lg transform hover:scale-105 transition-all duration-200 ${
                generating ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {generating ? "Generating…" : "GENERATE CERTIFICATE"}
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-[880px] max-h-[95vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <span className="text-lg font-semibold text-gray-800">
                  Certificate Preview
                </span>
                <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
                  Preview Only
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowPreview(false);
                    handleDownloadPDF();
                  }}
                  disabled={generating}
                  className={`px-6 py-2 bg-gradient-to-r from-orange-200 via-orange-500 to-orange-600 text-white text-sm font-semibold rounded-full hover:opacity-90 transition ${
                    generating ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {generating ? "Generating…" : "Generate PDF"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPreview(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-600 text-lg font-bold"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-6 bg-gray-100">
              <div
                style={{
                  width: "148mm",
                  margin: "0 auto",
                  backgroundColor: "#ffffff",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
                }}
              >x
                <FDCertificateContent />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FDCertificateForm;
