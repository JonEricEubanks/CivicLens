/**
 * CivicLens Email Notification Service
 *
 * Sends beautiful HTML status emails with a step-progress bar.
 * Uses nodemailer when SMTP env vars are set, otherwise logs emails
 * to console + saves HTML previews to public/email-preview/.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PREVIEW_DIR = join(__dirname, '..', 'public', 'email-preview');

// ─── HTML Escape for email templates ────────────────────────────────
function esc(str) {
  if (typeof str !== 'string') return str || '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;');
}

// ─── Power Automate helper ──────────────────────────────────────────
async function sendViaPowerAutomate(to, subject, html) {
  const url = process.env.POWER_AUTOMATE_URL;
  if (!url) return false;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, body: html }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Power Automate responded ${res.status}: ${text}`);
  }
  console.log(`[Email] Sent via Power Automate → ${to}`);
  return true;
}

// ─── Transport: Power Automate → SMTP → local preview ──────────────
let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  // If Power Automate URL is set, use that as primary transport
  if (process.env.POWER_AUTOMATE_URL) {
    console.log('[Email] Power Automate transport configured');
    transporter = {
      sendMail: async (opts) => {
        await sendViaPowerAutomate(opts.to, opts.subject, opts.html);
        return { messageId: `pa-${Date.now()}` };
      },
    };
    return transporter;
  }

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    try {
      const nodemailer = await import('nodemailer');
      transporter = nodemailer.default.createTransport({
        host,
        port: Number(port) || 587,
        secure: (Number(port) || 587) === 465,
        auth: { user, pass },
      });
      console.log('[Email] SMTP transport configured →', host);
      return transporter;
    } catch {
      console.log('[Email] nodemailer not installed — falling back to preview mode');
    }
  } else {
    console.warn('[Email] No email transport configured (set POWER_AUTOMATE_URL or SMTP_HOST/SMTP_USER/SMTP_PASS). Emails will be saved as local previews only.');
  }
  // Fallback: save HTML previews locally
  transporter = {
    sendMail: async (opts) => {
      await mkdir(PREVIEW_DIR, { recursive: true });
      const filename = `${Date.now()}-${opts.to.replace(/[^a-z0-9]/gi, '_')}.html`;
      await writeFile(join(PREVIEW_DIR, filename), opts.html);
      console.log(`[Email Preview] → ${filename}  To: ${opts.to}  Subject: ${opts.subject}`);
      return { messageId: `preview-${filename}` };
    },
  };
  return transporter;
}

// ─── Status definitions with step info ──────────────────────────────
const STATUS_STEPS = [
  { key: 'submitted', label: 'Submitted', icon: '📋', color: '#ef4444', desc: 'Your request has been submitted and logged into our system.' },
  { key: 'received',  label: 'Received',  icon: '✅', color: '#f59e0b', desc: 'Our team has received and acknowledged your request.' },
  { key: 'in_progress', label: 'In Progress', icon: '🔧', color: '#3b82f6', desc: 'A crew has been assigned and work is underway.' },
  { key: 'completed', label: 'Completed', icon: '🎉', color: '#10b981', desc: 'Your request has been resolved. Thank you!' },
];

function getStepIndex(status) {
  const map = { open: 0, submitted: 0, received: 1, in_progress: 2, completed: 3 };
  return map[status] ?? 0;
}

// ─── HTML Email Template ────────────────────────────────────────────
function buildEmailHTML({ trackingNumber, category, address, description, status, statusNote, updates }) {
  const currentIdx = getStepIndex(status);
  const currentStep = STATUS_STEPS[currentIdx];
  const siteUrl = process.env.SITE_URL || 'https://civiclens-app.azurewebsites.net';
  const trackUrl = `${siteUrl}/#track=${encodeURIComponent(trackingNumber)}`;

  const categoryInfo = {
    pothole: { label: 'Pothole Repair', icon: '🕳️' },
    sidewalk: { label: 'Sidewalk Issue', icon: '🚶' },
    streetlight: { label: 'Streetlight', icon: '💡' },
    water: { label: 'Water / Sewer', icon: '💧' },
    tree: { label: 'Tree Service', icon: '🌳' },
    graffiti: { label: 'Graffiti Removal', icon: '🎨' },
    noise: { label: 'Noise Complaint', icon: '🔊' },
    parking: { label: 'Parking Issue', icon: '🅿️' },
  };
  const catDisplay = categoryInfo[category] || { label: category || 'General', icon: '📋' };

  // Status-specific solid backgrounds (no transparency)
  const statusBg = { '#ef4444': '#fef2f2', '#f59e0b': '#fffbeb', '#3b82f6': '#eff6ff', '#10b981': '#f0fdf4' };
  const statusBorder = { '#ef4444': '#fecaca', '#f59e0b': '#fde68a', '#3b82f6': '#bfdbfe', '#10b981': '#bbf7d0' };
  const sBg = statusBg[currentStep.color] || '#eff6ff';
  const sBord = statusBorder[currentStep.color] || '#bfdbfe';

  // Progress steps
  let progressHTML = '';
  for (let i = 0; i < STATUS_STEPS.length; i++) {
    const step = STATUS_STEPS[i];
    const isDone = i < currentIdx;
    const isCurrent = i === currentIdx;
    const circBg = isDone ? '#10b981' : isCurrent ? '#3b82f6' : '#d1d5db';
    const circText = isDone || isCurrent ? '#ffffff' : '#6b7280';
    const circContent = isDone ? '&#10003;' : (i + 1);
    const labelColor = isCurrent ? '#1e293b' : isDone ? '#10b981' : '#6b7280';
    const labelWeight = isCurrent ? 'bold' : 'normal';

    if (i > 0) {
      const barColor = isDone ? '#10b981' : '#d1d5db';
      progressHTML += `<td style="padding:0"><div style="height:3px;background-color:${barColor};border-radius:2px"></div></td>`;
    }
    progressHTML += `
      <td style="padding:0;text-align:center;vertical-align:top;width:72px">
        <div style="width:32px;height:32px;border-radius:50%;background-color:${circBg};margin:0 auto 6px;line-height:32px;text-align:center;font-size:${isDone ? '14px' : '12px'};font-weight:700;color:${circText}">${circContent}</div>
        <div style="font-size:10px;font-weight:${labelWeight};color:${labelColor};letter-spacing:0.2px">${step.label}</div>
      </td>`;
  }

  // Activity log
  let updatesHTML = '';
  if (updates && updates.length > 0) {
    const recent = updates.slice(-3).reverse();
    updatesHTML = `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td class="card-bg" bgcolor="#ffffff" style="background-color:#ffffff;padding:24px 32px 0">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="section-bg section-border" bgcolor="#f3f4f6" style="background-color:#f3f4f6;border-radius:12px;border:1px solid #d1d5db">
          <tr><td style="padding:20px 20px 6px">
            <span class="card-text-muted" style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px">Activity Log</span>
          </td></tr>
          <tr><td style="padding:8px 20px 16px">
            ${recent.map(u => `
              <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:10px"><tr>
                <td width="12" valign="top" style="padding-top:7px"><div style="width:8px;height:8px;border-radius:50%;background-color:#3b82f6"></div></td>
                <td style="padding-left:12px">
                  <div class="card-text-muted" style="font-size:11px;color:#6b7280;margin-bottom:2px">${esc(u.date || '')} &middot; ${esc(u.by || 'System')}</div>
                  <div class="card-text" style="font-size:13px;color:#111827;line-height:1.5">${esc(u.note || '')}</div>
                </td>
              </tr></table>
            `).join('')}
          </td></tr>
        </table>
      </td></tr></table>`;
  }

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>CivicLens — ${trackingNumber}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    /* Light mode defaults */
    body, .body-bg { background-color: #1e3a5f !important; }
    .card-bg { background-color: #ffffff !important; }
    .card-text { color: #111827 !important; }
    .card-text-secondary { color: #374151 !important; }
    .card-text-muted { color: #6b7280 !important; }
    .section-bg { background-color: #f3f4f6 !important; }
    .footer-bg { background-color: #f9fafb !important; }
    .btn-primary { background-color: #2563eb !important; }
    .btn-primary a { color: #ffffff !important; }
    .btn-secondary { border: 2px solid #d1d5db !important; }
    .btn-secondary a { color: #374151 !important; }

    /* Dark mode overrides */
    @media (prefers-color-scheme: dark) {
      body, .body-bg { background-color: #1e3a5f !important; }
      .card-bg { background-color: #111827 !important; }
      .card-text { color: #f9fafb !important; }
      .card-text-secondary { color: #d1d5db !important; }
      .card-text-muted { color: #9ca3af !important; }
      .section-bg { background-color: #1f2937 !important; }
      .section-border { border-color: #374151 !important; }
      .footer-bg { background-color: #111827 !important; }
      .footer-text { color: #9ca3af !important; }
      .footer-link { color: #60a5fa !important; }
      .btn-secondary { border-color: #4b5563 !important; }
      .btn-secondary a { color: #d1d5db !important; }
      .divider { border-color: #374151 !important; }
      .next-box { background-color: #064e3b !important; border-color: #065f46 !important; }
      .next-title { color: #6ee7b7 !important; }
      .next-text { color: #a7f3d0 !important; }
      .status-box { background-color: #1e293b !important; }
      .tracking-pill { background-color: #1e3a5f !important; border-color: #2563eb !important; }
      .tracking-label { color: #60a5fa !important; }
      .tracking-number { color: #93c5fd !important; }
      .detail-label { color: #9ca3af !important; }
      .detail-value { color: #f3f4f6 !important; }
      .detail-border { border-color: #374151 !important; }
      .progress-label { color: #d1d5db !important; }
      .activity-text { color: #e5e7eb !important; }
      .activity-date { color: #9ca3af !important; }
      .or-text { color: #6b7280 !important; }
    }

    /* Outlook dark mode (data-ogsc = text, data-ogsb = background) */
    [data-ogsc] .card-text { color: #f9fafb !important; }
    [data-ogsc] .card-text-secondary { color: #d1d5db !important; }
    [data-ogsc] .card-text-muted { color: #9ca3af !important; }
    [data-ogsc] .footer-text { color: #9ca3af !important; }
    [data-ogsc] .footer-link { color: #60a5fa !important; }
    [data-ogsc] .btn-secondary a { color: #d1d5db !important; }
    [data-ogsc] .detail-label { color: #9ca3af !important; }
    [data-ogsc] .detail-value { color: #f3f4f6 !important; }
    [data-ogsc] .tracking-label { color: #60a5fa !important; }
    [data-ogsc] .tracking-number { color: #93c5fd !important; }
    [data-ogsc] .next-title { color: #6ee7b7 !important; }
    [data-ogsc] .next-text { color: #a7f3d0 !important; }
    [data-ogsc] .activity-text { color: #e5e7eb !important; }
    [data-ogsc] .activity-date { color: #9ca3af !important; }
    [data-ogsc] .progress-label { color: #d1d5db !important; }
    [data-ogsc] .or-text { color: #6b7280 !important; }
  </style>
</head>
<body class="body-bg" style="margin:0;padding:0;background-color:#1e3a5f;font-family:'Segoe UI',-apple-system,BlinkMacSystemFont,Roboto,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">

  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="body-bg" bgcolor="#1e3a5f" style="background-color:#1e3a5f">
  <tr><td align="center" style="padding:32px 16px">

    <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;border-radius:16px;overflow:hidden">

      <!-- HEADER (always blue) -->
      <tr>
        <td bgcolor="#1e3a5f" style="background-color:#1e3a5f;padding:40px 32px 32px;text-align:center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center">
            <div style="display:inline-block;background-color:rgba(255,255,255,0.15);border-radius:12px;padding:10px 20px;margin-bottom:20px">
              <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px">&#127963; CivicLens</span>
            </div>
          </td></tr><tr><td align="center">
            <h1 style="margin:0 0 6px;font-size:26px;font-weight:800;color:#ffffff;letter-spacing:-0.3px">Service Request Confirmation</h1>
            <p style="margin:0;font-size:14px;color:#bfdbfe">City of Lake Forest, Illinois</p>
          </td></tr></table>
        </td>
      </tr>

      <!-- BODY -->
      <tr>
        <td class="card-bg" bgcolor="#ffffff" style="background-color:#ffffff;padding:0">

          <!-- Tracking Number -->
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" class="card-bg" bgcolor="#ffffff" style="background-color:#ffffff;padding:28px 32px 0">
            <div class="tracking-pill" style="display:inline-block;background-color:#eff6ff;border:2px solid #bfdbfe;border-radius:12px;padding:12px 28px">
              <span class="tracking-label" style="font-size:11px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:1.2px;display:block;margin-bottom:2px">Tracking Number</span>
              <span class="tracking-number" style="font-family:'Courier New',monospace;font-size:22px;font-weight:800;color:#1e40af;letter-spacing:3px">${trackingNumber}</span>
            </div>
          </td></tr></table>

          <!-- Status Banner -->
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td class="card-bg" bgcolor="#ffffff" style="background-color:#ffffff;padding:24px 32px 0">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="status-box" bgcolor="${sBg}" style="background-color:${sBg};border-radius:12px;border-left:4px solid ${currentStep.color};border:1.5px solid ${sBord};border-left:4px solid ${currentStep.color}">
              <tr>
                <td width="48" style="padding:18px 20px;vertical-align:middle;text-align:center">
                  <span style="font-size:36px;line-height:1">${currentStep.icon}</span>
                </td>
                <td style="padding:18px 20px 18px 0;vertical-align:middle">
                  <div class="card-text" style="font-size:20px;font-weight:800;color:#111827;margin-bottom:4px">${currentStep.label}</div>
                  <div class="card-text-secondary" style="font-size:14px;color:#374151;line-height:1.5">${statusNote || currentStep.desc}</div>
                </td>
              </tr>
            </table>
          </td></tr></table>

          <!-- Progress Steps -->
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td class="card-bg" bgcolor="#ffffff" style="background-color:#ffffff;padding:24px 32px 0">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="section-bg section-border" bgcolor="#f3f4f6" style="background-color:#f3f4f6;border-radius:12px;border:1px solid #d1d5db">
              <tr><td style="padding:20px 16px 6px;text-align:center">
                <span class="card-text-muted" style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px">Request Progress</span>
              </td></tr>
              <tr><td style="padding:12px 16px 20px">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="table-layout:auto">
                  <tr>${progressHTML}</tr>
                </table>
              </td></tr>
            </table>
          </td></tr></table>

          <!-- Request Details -->
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td class="card-bg" bgcolor="#ffffff" style="background-color:#ffffff;padding:24px 32px 0">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="section-bg section-border" bgcolor="#f3f4f6" style="background-color:#f3f4f6;border-radius:12px;border:1px solid #d1d5db">
              <tr><td style="padding:20px 20px 6px">
                <span class="card-text-muted" style="font-size:10px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:1px">Request Details</span>
              </td></tr>
              <tr><td style="padding:8px 20px">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td class="detail-label detail-border" style="padding:10px 0;font-size:12px;color:#6b7280;font-weight:600;width:100px;vertical-align:top;border-bottom:1px solid #d1d5db">Category</td>
                    <td class="detail-value detail-border" style="padding:10px 0;font-size:14px;color:#111827;font-weight:600;border-bottom:1px solid #d1d5db">${catDisplay.icon} ${catDisplay.label}</td>
                  </tr>
                  <tr>
                    <td class="detail-label detail-border" style="padding:10px 0;font-size:12px;color:#6b7280;font-weight:600;vertical-align:top;border-bottom:1px solid #d1d5db">Location</td>
                    <td class="detail-value detail-border" style="padding:10px 0;font-size:14px;color:#111827;font-weight:600;border-bottom:1px solid #d1d5db">📍 ${esc(address) || 'Not specified'}</td>
                  </tr>
                  <tr>
                    <td class="detail-label" style="padding:10px 0;font-size:12px;color:#6b7280;font-weight:600;vertical-align:top">Description</td>
                    <td class="detail-value" style="padding:10px 0;font-size:13px;color:#374151;line-height:1.6">${esc((description || 'No description provided.').substring(0, 300))}${(description || '').length > 300 ? '...' : ''}</td>
                  </tr>
                </table>
              </td></tr>
              <tr><td style="padding:0 20px 16px"></td></tr>
            </table>
          </td></tr></table>

          ${updatesHTML}

          <!-- CTA Buttons -->
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td class="card-bg" bgcolor="#ffffff" style="background-color:#ffffff;padding:28px 32px 8px;text-align:center">

            <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
              <td class="btn-primary" bgcolor="#2563eb" style="border-radius:10px;background-color:#2563eb;text-align:center">
                <a href="${trackUrl}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:0.3px">
                  &#128270; Track This Request
                </a>
              </td>
            </tr></table>

            <div class="or-text" style="margin:16px 0;font-size:12px;color:#6b7280">or</div>

            <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
              <td class="btn-secondary" style="border-radius:10px;border:2px solid #d1d5db;text-align:center">
                <a href="${siteUrl}" target="_blank" class="btn-secondary-link" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#374151;text-decoration:none">
                  &#127963; Visit CivicLens Portal
                </a>
              </td>
            </tr></table>

          </td></tr></table>

          <!-- What's Next -->
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td class="card-bg" bgcolor="#ffffff" style="background-color:#ffffff;padding:20px 32px 32px">
            <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="next-box" bgcolor="#f0fdf4" style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px">
              <tr><td style="padding:16px 20px">
                <div class="next-title" style="font-size:13px;font-weight:700;color:#166534;margin-bottom:6px">&#9989; What happens next?</div>
                <div class="next-text" style="font-size:13px;color:#15803d;line-height:1.6">Our team will review your request and assign it to the appropriate department. You'll receive email updates as your request progresses. Average response time is 2–3 business days.</div>
              </td></tr>
            </table>
          </td></tr></table>

        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td class="footer-bg" bgcolor="#f9fafb" style="background-color:#f9fafb;border-top:1px solid #d1d5db;padding:24px 32px;text-align:center">
          <p class="footer-text" style="margin:0 0 8px;font-size:12px;color:#374151;font-weight:600">City of Lake Forest &middot; Powered by CivicLens</p>
          <p class="footer-text" style="margin:0 0 12px;font-size:11px;color:#6b7280;line-height:1.6">
            You're receiving this because you opted in to updates for <strong>${trackingNumber}</strong>.<br/>
            Need help? Visit our portal or call (847) 234-2600.
          </p>
          <table role="presentation" cellpadding="0" cellspacing="0" align="center"><tr>
            <td style="padding:0 8px"><a href="${siteUrl}" class="footer-link" style="font-size:11px;color:#2563eb;text-decoration:none;font-weight:600">Service Portal</a></td>
            <td class="footer-text" style="color:#9ca3af;font-size:11px">|</td>
            <td style="padding:0 8px"><a href="${siteUrl}/#submit" class="footer-link" style="font-size:11px;color:#2563eb;text-decoration:none;font-weight:600">Submit New Request</a></td>
            <td class="footer-text" style="color:#9ca3af;font-size:11px">|</td>
            <td style="padding:0 8px"><a href="${siteUrl}/#track" class="footer-link" style="font-size:11px;color:#2563eb;text-decoration:none;font-weight:600">Track a Request</a></td>
          </tr></table>
        </td>
      </tr>

    </table>
  </td></tr>
  </table>
</body>
</html>`;
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Send a confirmation email after a new service request is submitted.
 */
export async function sendConfirmationEmail(serviceRequest) {
  if (!serviceRequest.contact_email || !serviceRequest.notify_by_email) return;

  const html = buildEmailHTML({
    trackingNumber: serviceRequest.id,
    category: serviceRequest.category,
    address: serviceRequest.location?.address,
    description: serviceRequest.description,
    status: 'submitted',
    statusNote: 'Your request has been submitted and logged. We\'ll keep you updated as it progresses through our system.',
    updates: serviceRequest.updates,
  });

  const transport = await getTransporter();
  try {
    await transport.sendMail({
      from: process.env.EMAIL_FROM || '"CivicLens" <jeubanks@mgpinc.com>',
      to: serviceRequest.contact_email,
      subject: `Request ${serviceRequest.id} Confirmed — CivicLens`,
      html,
    });
  } catch (err) {
    console.error('[Email] Failed to send confirmation:', err.message);
  }
}

/**
 * Send an update email when a service request status changes.
 */
export async function sendStatusUpdateEmail(serviceRequest, newStatus, note) {
  if (!serviceRequest.contact_email || !serviceRequest.notify_by_email) return;

  const statusLabels = { open: 'Submitted', received: 'Received', in_progress: 'In Progress', completed: 'Completed' };

  const html = buildEmailHTML({
    trackingNumber: serviceRequest.id,
    category: serviceRequest.category,
    address: serviceRequest.location?.address,
    description: serviceRequest.description,
    status: newStatus,
    statusNote: note || null,
    updates: serviceRequest.updates,
  });

  const transport = await getTransporter();
  try {
    await transport.sendMail({
      from: process.env.EMAIL_FROM || '"CivicLens" <jeubanks@mgpinc.com>',
      to: serviceRequest.contact_email,
      subject: `Request ${serviceRequest.id} — ${statusLabels[newStatus] || newStatus} — CivicLens`,
      html,
    });
  } catch (err) {
    console.error('[Email] Failed to send status update:', err.message);
  }
}
