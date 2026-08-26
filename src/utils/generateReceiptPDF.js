/**
 * generateReceiptPDF
 *
 * Strategy:
 *   1. NEW receipts — calls backend /receipts/:id/download which returns
 *      the Cloudinary URL → downloads the exact PDF that was generated & emailed
 *   2. OLD receipts (no pdfUrl in DB) — re-generates on the fly using the
 *      Gruhakalpa template (same layout as ReceiptForm's ReceiptContent)
 */

const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:3001";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const numberToWords = (num) => {
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  const teens = ["Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  if (!num || num === 0) return "Zero";
  const c = (n) => {
    if (n === 0) return "";
    if (n < 10) return ones[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? " " + ones[n % 10] : "");
    return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + c(n % 100) : "");
  };
  if (num < 1000) return c(num);
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const rem = num % 1000;
  let r = "";
  if (crore) r += c(crore) + " Crore ";
  if (lakh) r += c(lakh) + " Lakh ";
  if (thousand) r += c(thousand) + " Thousand ";
  if (rem) r += c(rem);
  return r.trim();
};

const formatDate = (d) => {
  if (!d) return "-";
  const date = new Date(d);
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
};

// ─── Gruhakalpa receipt template (matches ReceiptForm's ReceiptContent) ───────
const buildReceiptHTML = (receipt) => {
  const amountpaid = parseFloat(receipt.amountpaid) || 0;
  const amountInWords = numberToWords(Math.floor(amountpaid));
  const paymentLabel = receipt.paymenttype || "Booking Advance";
  const isCash = (receipt.paymentmode || "").toLowerCase() === "cash";
  const membershipId = receipt.membershipid || receipt.seniority_no || "-";
  const projectname = receipt.projectname || "Gruhakalpa";

  // Build particulars from allocations if available, else single row
  const allocations = Array.isArray(receipt.allocations) && receipt.allocations.length > 0
    ? receipt.allocations
    : [{ label: paymentLabel, amount: amountpaid }];

  const tableRows = allocations.map((a, idx) => `
    <tr>
      <td style="border:1px solid #000;padding:6px;text-align:center;font-size:11px;">${idx + 1}</td>
      <td style="border:1px solid #000;padding:6px;text-align:center;font-size:11px;">${receipt.sitedimension || ""}</td>
      <td style="border:1px solid #000;padding:6px;text-align:center;font-size:11px;">${a.label || a.bucket || paymentLabel}</td>
      <td style="border:1px solid #000;padding:6px;text-align:center;font-size:11px;">${receipt.paymentmode || "-"}</td>
      <td style="border:1px solid #000;padding:6px;text-align:center;font-size:11px;">${isCash ? "" : receipt.transactionid || "-"}</td>
      <td style="border:1px solid #000;padding:6px;text-align:right;font-size:11px;">${Number(a.amount || 0).toLocaleString("en-IN")}</td>
    </tr>`).join("");

  const particularRows = allocations.map((a, idx) => `
    <tr>
      <td style="border:1px solid #000;padding:8px;width:5%;text-align:center;">${idx + 1}.</td>
      <td style="border:1px solid #000;padding:8px;">${a.label || a.bucket || paymentLabel}</td>
      <td style="border:1px solid #000;padding:8px;"></td>
      <td style="border:1px solid #000;padding:8px;text-align:center;">${Number(a.amount || 0).toLocaleString("en-IN")}</td>
      <td style="border:1px solid #000;padding:8px;"></td>
    </tr>`).join("");

  return `
  <div style="border:2px solid #000;background:#fff;padding:20px;font-family:Arial,sans-serif;width:794px;min-height:1123px;box-sizing:border-box;">

    <!-- Header -->
    <div style="display:flex;align-items:center;border-bottom:2px solid #000;padding-bottom:15px;margin-bottom:16px;margin-left:-20px;margin-right:-20px;padding-left:10px;padding-right:10px;gap:10px;height:150px;">
      <div style="flex-shrink:0;">
        <img src="/images/bg-removed-logo.webp" alt="Logo" crossorigin="anonymous"
          style="width:160px;height:140px;object-fit:contain;margin-bottom:15px;" />
      </div>
      <div style="flex:1;text-align:center;">
        <div style="font-size:18px;font-weight:bold;margin-bottom:4px;">ದಿ ಗೃಹಕಲ್ಪ ಹೌಸಿಂಗ್ ಕೋ-ಆಪರೇಟಿವ್ ಸೊಸೈಟಿ ಲಿ.</div>
        <div style="font-size:15px;font-weight:bold;margin-bottom:4px;">THE GRUHAKALPA HOUSING CO-OPERATIVE SOCIETY LTD.</div>
        <div style="font-size:11px;margin-bottom:2px;">Parinidhi #23, E Block, 14th A Main Road, 2nd Floor, Sahakaranagar, Bangalore - 560092</div>
        <div style="font-size:11px;margin-bottom:2px;">Reg. No.: JRB/RGN/CR-04/51586/2023-2024 Date: 21/11/23</div>
        <div style="font-size:11px;">www.gruhakalpahousingsociety.in / Email: contact@gruhakalpahousingsociety.in</div>
      </div>
      <div style="width:80px;flex-shrink:0;"></div>
    </div>

    <!-- RECEIPT title -->
    <div style="text-align:center;padding-bottom:6px;">
      <span style="border:2px solid #000;font-weight:bold;font-size:14px;padding:5px 10px 18px;">RECEIPT</span>
    </div>

    <!-- Receipt No + Date -->
    <div style="display:flex;justify-content:space-between;margin-bottom:16px;font-size:13px;font-weight:bold;">
      <div>RECEIPT No. ${receipt.receipt_no || "-"}</div>
      <div>Date: ${formatDate(receipt.date)}</div>
    </div>

    <!-- Member info rows -->
    <div style="font-size:13px;margin-bottom:16px;">
      ${[
        `Received From Smt./Shree: ${receipt.name || "-"}`,
        `Address: ${receipt.sitedimension || "-"}`,
        `Rupees: ${amountInWords} Only.`,
        `Membership Id: ${projectname} (${membershipId})`,
      ].map((line, i, arr) => `
        <div style="margin-bottom:${i < arr.length - 1 ? "6px" : "0"};padding-bottom:6px;border-bottom:1.5px solid #000;">
          <strong>${line}</strong>
        </div>`).join("")}
    </div>

    <!-- Payment details table -->
    <div style="margin-bottom:16px;">
      <table style="width:100%;border-collapse:collapse;border:1px solid #000;font-size:12px;">
        <thead><tr>
          ${["S.No","Dimension","Payment Type","Payment Mode","Cheque/Transaction ID","Amount"]
            .map(h => `<th style="border:1px solid #000;padding:6px;text-align:center;font-weight:bold;font-size:12px;background:#f0f0f0;">${h}</th>`)
            .join("")}
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>

    <!-- Particulars table -->
    <div style="margin-bottom:16px;">
      <table style="width:100%;border-collapse:collapse;border:1px solid #000;font-size:12px;">
        <thead><tr>
          <th colspan="2" style="border:1px solid #000;padding:8px;text-align:center;font-weight:bold;width:70%;background:#f0f0f0;">Particulars</th>
          <th style="border:1px solid #000;padding:8px;text-align:center;font-weight:bold;width:5%;background:#f0f0f0;">L.F</th>
          <th style="border:1px solid #000;padding:8px;text-align:center;font-weight:bold;width:20%;background:#f0f0f0;">Rs.</th>
          <th style="border:1px solid #000;padding:8px;text-align:center;font-weight:bold;width:5%;background:#f0f0f0;">P</th>
        </tr></thead>
        <tbody>
          ${particularRows}
          <tr style="font-weight:bold;">
            <td colspan="2" style="border:1px solid #000;padding:8px;"><strong>Total</strong></td>
            <td style="border:1px solid #000;padding:8px;"></td>
            <td style="border:1px solid #000;padding:8px;text-align:center;"><strong>${amountpaid.toLocaleString("en-IN")}</strong></td>
            <td style="border:1px solid #000;padding:8px;"></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Footer note -->
    <div style="font-size:11px;font-style:italic;margin-bottom:32px;">
      *If 30% of the booking amount is not paid within 20 days from the date of booking, 10% penalty apply.
    </div>

    <!-- Signatures -->
    <div style="display:flex;justify-content:space-between;align-items:flex-end;font-size:13px;margin-top:40px;">
      <div>Party's Signature</div>
      <div style="text-align:center;">
        <img src="/images/president-signature.webp" alt="Signature" crossorigin="anonymous"
          style="height:55px;object-fit:contain;margin-bottom:4px;display:block;margin-left:auto;margin-right:auto;" />
        <div>President/Secretary</div>
      </div>
    </div>

  </div>`;
};

// ─── Main export ──────────────────────────────────────────────────────────────

export const generateReceiptPDF = async (receipt) => {
  const projectPart = (receipt.projectname || "").replace(/[^a-zA-Z0-9]/g, "_");
  const idPart = (receipt.membershipid || receipt.seniority_no || "").replace(/[^a-zA-Z0-9]/g, "_");
  const receiptPart = (receipt.receipt_no || "draft").replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `${projectPart}_${idPart}_${receiptPart}.pdf`;

  // ── Strategy 1: Backend proxy-streams the stored Cloudinary PDF ──────────────
  try {
    const token =
      localStorage.getItem("memberToken") ||
      localStorage.getItem("adminToken") ||
      localStorage.getItem("superAdminToken");

    const res = await fetch(`${API_BASE}/receipts/${receipt._id}/download`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (res.ok) {
      const contentType = res.headers.get("Content-Type") || "";

      if (contentType.includes("application/pdf")) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        return;
      }

      // Old backend behaviour: returned JSON with pdfUrl
      const data = await res.json();
      if (data.success && data.pdfUrl) {
        // Only use the stored PDF if it's from Cloudinary (Gruhakalpa system).
        // Old Google Storage URLs (storage.googleapis.com) are the Navanagara
        // PDFs — skip them and fall through to re-generate with the correct template.
        if (!data.pdfUrl.includes("storage.googleapis.com")) {
          const a = document.createElement("a");
          a.href = data.pdfUrl;
          a.download = filename;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          document.body.appendChild(a);
          a.click();
          a.remove();
          return;
        }
        console.info("Skipping old Navanagara PDF URL — regenerating with Gruhakalpa template.");
      }
    }
    // 404 = no pdfUrl stored (imported receipt) → fall through to regenerate
  } catch (err) {
    console.warn("Backend PDF fetch failed, falling back to re-generate:", err.message);
  }

  // ── Strategy 2: Re-generate on the fly with the Gruhakalpa template ──────────
  const html2canvas = (await import("html2canvas")).default;
  const jsPDF = (await import("jspdf")).default;

  const container = document.createElement("div");
  container.style.cssText = "position:fixed;left:-9999px;top:0;width:794px;background:#fff;";
  container.innerHTML = buildReceiptHTML(receipt);
  document.body.appendChild(container);

  await new Promise((resolve) => setTimeout(resolve, 600));

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: "#ffffff",
      width: 794,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.85);
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    pdf.addImage(imgData, "JPEG", 1, 1, 208, 295);
    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
};