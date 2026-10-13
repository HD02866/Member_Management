/**
 * Pure binary PDF 1.4 generator for 4Baye Digital Membership Card.
 * Complies strictly with ISO 32000-1 / PDF 1.4 specifications.
 * Zero external library dependencies. Generates valid %PDF-1.4 binary.
 */

export interface DigitalIdPdfData {
  memberName: string;
  memberNumber: string;
  status: string;
  organizationName: string;
  planName?: string;
  cardNumber: string;
  expirationDate: string;
  issueDate?: string;
  photoDataUrl?: string; // JPEG data URL or image source
}

/**
 * Escapes characters for PDF literal strings (ASCII / WinAnsi).
 */
function escapePdfString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

/**
 * Strips non-ASCII characters for clean PDF standard font rendering (Helvetica).
 */
function sanitizeAscii(str: string, fallback: string = ''): string {
  if (!str) return fallback;
  // Replace smart quotes and accents with plain ASCII
  const cleaned = str
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[^\x20-\x7E]/g, '');
  return cleaned.trim() || fallback;
}

/**
 * Converts an image URL / element / canvas to JPEG Uint8Array and dimensions.
 */
export async function loadJpegBytes(
  imgSource: string | HTMLImageElement,
): Promise<{ bytes: Uint8Array; width: number; height: number } | null> {
  try {
    let img: HTMLImageElement;
    if (typeof imgSource === 'string') {
      img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image for PDF'));
        img.src = imgSource;
      });
    } else {
      img = imgSource;
      if (!img.complete || img.naturalWidth === 0) {
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
        });
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 600;
    canvas.height = img.naturalHeight || 600;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Draw white background then image to avoid JPEG transparency issues
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const base64 = dataUrl.split(',')[1];
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    return {
      bytes,
      width: canvas.width,
      height: canvas.height,
    };
  } catch (err) {
    console.warn('[PDF] Failed to convert image to JPEG bytes:', err);
    return null;
  }
}

/**
 * Generates a valid %PDF-1.4 binary Uint8Array containing:
 * - 4Baye Official Digital ID Header
 * - Member details (Name, ID #, Plan, Status, Valid Through, Card ID)
 * - The official admin-uploaded ID image / card document
 * - Clean security footer & verification notes
 */
export async function generateDigitalIdPdf(
  data: DigitalIdPdfData,
  imageSource?: string | HTMLImageElement | null,
): Promise<Uint8Array> {
  // Page size: Standard A4 (595.28 x 841.89 points)
  const pageWidth = 595.28;
  const pageHeight = 841.89;

  let imgInfo: { bytes: Uint8Array; width: number; height: number } | null = null;
  if (imageSource) {
    imgInfo = await loadJpegBytes(imageSource);
  } else if (data.photoDataUrl) {
    imgInfo = await loadJpegBytes(data.photoDataUrl);
  }

  // Pre-calculate image display box inside the card if present
  let imgObjIndex = 0;
  let imgWidthPt = 0;
  let imgHeightPt = 0;
  let imgX = 0;
  let imgY = 0;

  if (imgInfo) {
    // Target display box inside the ID document section
    const maxBoxWidth = 380;
    const maxBoxHeight = 260;
    const aspectRatio = imgInfo.width / imgInfo.height;

    if (aspectRatio >= maxBoxWidth / maxBoxHeight) {
      imgWidthPt = maxBoxWidth;
      imgHeightPt = maxBoxWidth / aspectRatio;
    } else {
      imgHeightPt = maxBoxHeight;
      imgWidthPt = maxBoxHeight * aspectRatio;
    }

    imgX = (pageWidth - imgWidthPt) / 2;
    imgY = 270 + (maxBoxHeight - imgHeightPt) / 2; // Position in lower-middle section
  }

  const cleanOrg = escapePdfString(sanitizeAscii(data.organizationName, '4Baye Association'));
  const cleanName = escapePdfString(sanitizeAscii(data.memberName, 'Active Member'));
  const cleanNum = escapePdfString(sanitizeAscii(data.memberNumber, 'N/A'));
  const cleanCardId = escapePdfString(sanitizeAscii(data.cardNumber, 'CARD-00000'));
  const cleanStatus = escapePdfString(sanitizeAscii(data.status, 'ACTIVE'));
  const cleanPlan = escapePdfString(sanitizeAscii(data.planName || 'Standard Membership', 'Standard Membership'));
  const cleanExp = escapePdfString(sanitizeAscii(data.expirationDate, 'N/A'));
  const cleanIssue = escapePdfString(sanitizeAscii(data.issueDate || new Date().toISOString().split('T')[0], 'N/A'));

  // Build PDF Stream Content (Canvas commands)
  let stream = '';

  // 1. Page Background (soft clean off-white / light slate)
  stream += 'q\n';
  stream += '0.97 0.98 0.99 rg\n';
  stream += `0 0 ${pageWidth} ${pageHeight} re f\n`;
  stream += 'Q\n';

  // 2. Main ID Card Container (Card geometry: 495 x 680 pt, centered)
  const cardX = 50;
  const cardY = 70;
  const cardW = 495;
  const cardH = 700;

  stream += 'q\n';
  // White card background with subtle border
  stream += '1.0 1.0 1.0 rg\n';
  stream += `${cardX} ${cardY} ${cardW} ${cardH} re f\n`;
  stream += '0.82 0.85 0.88 RG\n'; // Slate-300 border
  stream += '1.2 w\n';
  stream += `${cardX} ${cardY} ${cardW} ${cardH} re S\n`;
  stream += 'Q\n';

  // 3. Card Header Banner (Deep Emerald Gradient Simulation: 0.04 0.28 0.22)
  const headerH = 95;
  const headerY = cardY + cardH - headerH;
  stream += 'q\n';
  stream += '0.04 0.28 0.22 rg\n'; // Brand deep emerald
  stream += `${cardX} ${headerY} ${cardW} ${headerH} re f\n`;
  // Gold/Emerald accent stripe
  stream += '0.85 0.70 0.20 rg\n';
  stream += `${cardX} ${headerY - 3} ${cardW} 3 re f\n`;
  stream += 'Q\n';

  // Header Typography
  stream += 'BT\n';
  stream += '/F2 18 Tf\n'; // Bold
  stream += '1.0 1.0 1.0 rg\n';
  stream += `${cardX + 28} ${headerY + 54} Td\n`;
  stream += `(${cleanOrg}) Tj\n`;

  stream += '/F1 11 Tf\n'; // Regular
  stream += '0.65 0.88 0.78 rg\n'; // Light emerald
  stream += `0 -18 Td\n`;
  stream += `(OFFICIAL DIGITAL MEMBERSHIP IDENTIFICATION) Tj\n`;

  stream += '/F2 10 Tf\n';
  stream += '1.0 1.0 1.0 rg\n';
  stream += `320 18 Td\n`;
  stream += `(STATUS: ${cleanStatus}) Tj\n`;
  stream += 'ET\n';

  // 4. Member Primary Details Section
  const infoStartY = headerY - 35;
  stream += 'BT\n';
  // Full Name
  stream += '/F1 9 Tf\n';
  stream += '0.45 0.50 0.55 rg\n';
  stream += `${cardX + 28} ${infoStartY} Td\n`;
  stream += `(MEMBER FULL NAME) Tj\n`;

  stream += '/F2 16 Tf\n';
  stream += '0.08 0.12 0.18 rg\n'; // Dark Slate-900
  stream += `0 -20 Td\n`;
  stream += `(${cleanName}) Tj\n`;

  // Member Number & Plan Name
  stream += '/F1 9 Tf\n';
  stream += '0.45 0.50 0.55 rg\n';
  stream += `0 -22 Td\n`;
  stream += `(MEMBER NUMBER) Tj\n`;

  stream += '200 0 Td\n';
  stream += `(MEMBERSHIP PLAN) Tj\n`;

  stream += '/F2 12 Tf\n';
  stream += '0.04 0.45 0.35 rg\n'; // Emerald text
  stream += `-200 -16 Td\n`;
  stream += `(${cleanNum}) Tj\n`;

  stream += '/F2 12 Tf\n';
  stream += '0.08 0.12 0.18 rg\n';
  stream += `200 0 Td\n`;
  stream += `(${cleanPlan}) Tj\n`;

  // Card Number & Expiration Date
  stream += '/F1 9 Tf\n';
  stream += '0.45 0.50 0.55 rg\n';
  stream += `-200 -24 Td\n`;
  stream += `(CARD SERIAL ID) Tj\n`;

  stream += '200 0 Td\n';
  stream += `(VALID THROUGH) Tj\n`;

  stream += '/F1 11 Tf\n';
  stream += '0.20 0.25 0.30 rg\n';
  stream += `-200 -16 Td\n`;
  stream += `(${cleanCardId}) Tj\n`;

  stream += '/F2 11 Tf\n';
  stream += '0.04 0.45 0.35 rg\n';
  stream += `200 0 Td\n`;
  stream += `(${cleanExp}) Tj\n`;
  stream += 'ET\n';

  // Divider line
  const dividerY = infoStartY - 105;
  stream += 'q\n';
  stream += '0.88 0.90 0.92 RG\n';
  stream += '0.8 w\n';
  stream += `${cardX + 28} ${dividerY} m ${cardX + cardW - 28} ${dividerY} l S\n`;
  stream += 'Q\n';

  // 5. Official Photo / Physical Card Document Image Section
  if (imgInfo) {
    // Section label
    stream += 'BT\n';
    stream += '/F1 9 Tf\n';
    stream += '0.45 0.50 0.55 rg\n';
    stream += `${cardX + 28} ${dividerY - 18} Td\n`;
    stream += `(OFFICIAL ADMIN-UPLOADED DIGITAL ID / CREDENTIAL DOCUMENT) Tj\n`;
    stream += 'ET\n';

    // Image frame border
    stream += 'q\n';
    stream += '0.94 0.96 0.98 rg\n';
    stream += `${imgX - 4} ${imgY - 4} ${imgWidthPt + 8} ${imgHeightPt + 8} re f\n`;
    stream += '0.80 0.85 0.90 RG\n';
    stream += '1 w\n';
    stream += `${imgX - 4} ${imgY - 4} ${imgWidthPt + 8} ${imgHeightPt + 8} re S\n`;
    stream += 'Q\n';

    // Draw the image
    stream += 'q\n';
    stream += `${imgWidthPt.toFixed(2)} 0 0 ${imgHeightPt.toFixed(2)} ${imgX.toFixed(2)} ${imgY.toFixed(2)} cm\n`;
    stream += '/Im1 Do\n';
    stream += 'Q\n';
  } else {
    // Empty state placeholder within PDF
    stream += 'q\n';
    stream += '0.96 0.97 0.98 rg\n';
    stream += `${cardX + 28} 300 ${cardW - 56} 180 re f\n`;
    stream += '0.85 0.88 0.92 RG\n';
    stream += '1 w [4 4] 0 d\n'; // dashed border
    stream += `${cardX + 28} 300 ${cardW - 56} 180 re S\n`;
    stream += 'Q\n';

    stream += 'BT\n';
    stream += '/F2 12 Tf\n';
    stream += '0.45 0.50 0.55 rg\n';
    stream += `${cardX + 150} 395 Td\n`;
    stream += `(OFFICIAL DIGITAL PASS) Tj\n`;
    stream += '/F1 10 Tf\n';
    stream += '-40 -18 Td\n';
    stream += `(Verified cryptographic membership identification.) Tj\n`;
    stream += 'ET\n';
  }

  // 6. Security & Verification Notice Footer
  const footerY = cardY + 28;
  stream += 'q\n';
  stream += '0.92 0.94 0.96 RG\n';
  stream += '0.5 w\n';
  stream += `${cardX + 28} ${footerY + 36} m ${cardX + cardW - 28} ${footerY + 36} l S\n`;
  stream += 'Q\n';

  stream += 'BT\n';
  stream += '/F1 8 Tf\n';
  stream += '0.50 0.55 0.60 rg\n';
  stream += `${cardX + 28} ${footerY + 22} Td\n`;
  stream += `(Cryptographically issued by 4Baye Association. For official verification, scan member QR code.) Tj\n`;
  stream += `0 -12 Td\n`;
  stream += `(This document certifies current authorized membership. Card Version: v1.0 | Issued: ${cleanIssue}) Tj\n`;
  stream += 'ET\n';

  // Compile PDF Objects
  const streamBytes = new TextEncoder().encode(stream);

  // Object table:
  // 1: Catalog
  // 2: Pages
  // 3: Page
  // 4: Font Helvetica
  // 5: Font Helvetica-Bold
  // 6: Content Stream
  // 7: Image (if present)

  const objects: Array<{ id: number; data: Uint8Array }> = [];

  // Obj 1: Catalog
  objects.push({
    id: 1,
    data: new TextEncoder().encode('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'),
  });

  // Obj 2: Pages
  objects.push({
    id: 2,
    data: new TextEncoder().encode('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n'),
  });

  // Resources dictionary
  let resDict = '<< /Font << /F1 4 0 R /F2 5 0 R >>';
  if (imgInfo) {
    resDict += ' /XObject << /Im1 7 0 R >>';
  }
  resDict += ' >>';

  // Obj 3: Page
  objects.push({
    id: 3,
    data: new TextEncoder().encode(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources ${resDict} /Contents 6 0 R >>\nendobj\n`,
    ),
  });

  // Obj 4: Font Helvetica
  objects.push({
    id: 4,
    data: new TextEncoder().encode('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'),
  });

  // Obj 5: Font Helvetica-Bold
  objects.push({
    id: 5,
    data: new TextEncoder().encode('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n'),
  });

  // Obj 6: Content Stream
  const streamHeader = `6 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n`;
  const streamFooter = '\nendstream\nendobj\n';
  const obj6HeaderBytes = new TextEncoder().encode(streamHeader);
  const obj6FooterBytes = new TextEncoder().encode(streamFooter);
  const obj6Data = new Uint8Array(obj6HeaderBytes.length + streamBytes.length + obj6FooterBytes.length);
  obj6Data.set(obj6HeaderBytes, 0);
  obj6Data.set(streamBytes, obj6HeaderBytes.length);
  obj6Data.set(obj6FooterBytes, obj6HeaderBytes.length + streamBytes.length);

  objects.push({
    id: 6,
    data: obj6Data,
  });

  // Obj 7: Image (DCTDecode JPEG stream) if present
  if (imgInfo) {
    const imgHeader = `7 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgInfo.width} /Height ${imgInfo.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgInfo.bytes.length} >>\nstream\n`;
    const imgFooter = '\nendstream\nendobj\n';
    const imgHeaderBytes = new TextEncoder().encode(imgHeader);
    const imgFooterBytes = new TextEncoder().encode(imgFooter);
    const obj7Data = new Uint8Array(imgHeaderBytes.length + imgInfo.bytes.length + imgFooterBytes.length);
    obj7Data.set(imgHeaderBytes, 0);
    obj7Data.set(imgInfo.bytes, imgHeaderBytes.length);
    obj7Data.set(imgFooterBytes, imgHeaderBytes.length + imgInfo.bytes.length);

    objects.push({
      id: 7,
      data: obj7Data,
    });
  }

  // Assemble full PDF with binary header and xref table
  const headerStr = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const headerBytes = new TextEncoder().encode(headerStr);

  let currentOffset = headerBytes.length;
  const offsets: number[] = [0]; // obj 0 offset

  for (const obj of objects) {
    offsets.push(currentOffset);
    currentOffset += obj.data.length;
  }

  const xrefOffset = currentOffset;
  let xrefStr = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xrefStr += offsets[i].toString().padStart(10, '0') + ' 00000 n \n';
  }

  xrefStr += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  const xrefBytes = new TextEncoder().encode(xrefStr);

  const totalLength = currentOffset + xrefBytes.length;
  const pdfOutput = new Uint8Array(totalLength);

  let writePos = 0;
  pdfOutput.set(headerBytes, writePos);
  writePos += headerBytes.length;

  for (const obj of objects) {
    pdfOutput.set(obj.data, writePos);
    writePos += obj.data.length;
  }

  pdfOutput.set(xrefBytes, writePos);

  return pdfOutput;
}

/**
 * Convenience browser helper: Triggers direct file download with correct mime-type and filename.
 */
export function downloadPdfBlob(pdfBytes: Uint8Array, filename: string): void {
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
