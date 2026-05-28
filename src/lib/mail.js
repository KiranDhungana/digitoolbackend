const nodemailer = require("nodemailer");

let transporter = null;
const SITE_URL = process.env.SITE_URL || "https://digitoolera.com";

function isMailConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!isMailConfigured()) return null;
  if (transporter) return transporter;

  const pass = String(process.env.SMTP_PASS).replace(/\s/g, "");

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass,
    },
  });

  return transporter;
}

async function sendEmail({ to, subject, text, html }) {
  const transport = getTransporter();
  if (!transport) {
    console.warn("[mail] SMTP not configured — skip send");
    return false;
  }

  const from =
    process.env.MAIL_FROM ||
    `"Digitoolera" <${process.env.SMTP_USER}>`;

  await transport.sendMail({
    from,
    to,
    subject,
    text,
    html: html || text.replace(/\n/g, "<br>"),
  });

  return true;
}

function sendWelcomeEmail(user) {
  return sendEmail({
    to: user.email,
    subject: "Welcome to Digitoolera",
    text: `Hi ${user.name},\n\nYour Digitoolera account was created successfully.\n\nYou can sign in anytime with your email and password.\n\nWebsite: ${SITE_URL}\n\nThank you for joining us!`,
    html: `<p>Hi <strong>${escapeHtml(user.name)}</strong>,</p>
<p>Your Digitoolera account was created successfully.</p>
<p>You can sign in anytime with your email and password.</p>
<p>Website: <a href="${escapeHtml(SITE_URL)}">${escapeHtml(SITE_URL)}</a></p>
<p>Thank you for joining us!</p>`,
  });
}

function sendSignupOtpEmail(email, code) {
  const minutes = 10;
  return sendEmail({
    to: email,
    subject: "Verify your Digitoolera account",
    text: `Your verification code is: ${code}\n\nEnter this code to complete signup. It expires in ${minutes} minutes.\n\nWebsite: ${SITE_URL}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Your verification code is:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0;">${escapeHtml(code)}</p>
<p>Enter this code to complete signup. It expires in <strong>${minutes} minutes</strong>.</p>
<p>Website: <a href="${escapeHtml(SITE_URL)}">${escapeHtml(SITE_URL)}</a></p>
<p>If you did not request this, you can ignore this email.</p>`,
  });
}

function sendPasswordResetOtpEmail(email, code) {
  const minutes = 10;
  return sendEmail({
    to: email,
    subject: "Reset your Digitoolera password",
    text: `Your password reset code is: ${code}\n\nEnter this code to set a new password. It expires in ${minutes} minutes.\n\nWebsite: ${SITE_URL}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Your password reset code is:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0;">${escapeHtml(code)}</p>
<p>Enter this code to set a new password. It expires in <strong>${minutes} minutes</strong>.</p>
<p>Website: <a href="${escapeHtml(SITE_URL)}">${escapeHtml(SITE_URL)}</a></p>
<p>If you did not request this, you can ignore this email.</p>`,
  });
}

function sendLoginEmail(user) {
  const when = new Date().toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return sendEmail({
    to: user.email,
    subject: "Sign-in to your Digitoolera account",
    text: `Hi ${user.name},\n\nYou signed in to Digitoolera on ${when}.\n\nWebsite: ${SITE_URL}\n\nIf this wasn't you, please reset your password and contact support.`,
    html: `<p>Hi <strong>${escapeHtml(user.name)}</strong>,</p>
<p>You signed in to <strong>Digitoolera</strong> on ${escapeHtml(when)}.</p>
<p>Website: <a href="${escapeHtml(SITE_URL)}">${escapeHtml(SITE_URL)}</a></p>
<p>If this wasn't you, please contact support right away.</p>`,
  });
}

function formatMoney(amount, currency = "NPR") {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${currency} —`;
  return `${currency} ${value.toLocaleString("en-NP", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatOrderItemsText(items, currency) {
  if (!Array.isArray(items) || items.length === 0) return "—";
  return items
    .map((line) => {
      const name = line.productName || "Item";
      const qty = line.quantity ?? 1;
      const total =
        line.lineTotal != null
          ? line.lineTotal
          : Number(line.unitPrice) * Number(qty);
      return `  • ${name} × ${qty} — ${formatMoney(total, currency)}`;
    })
    .join("\n");
}

function formatOrderItemsHtml(items, currency) {
  if (!Array.isArray(items) || items.length === 0) {
    return "<p><em>No items listed</em></p>";
  }
  const rows = items
    .map((line) => {
      const name = escapeHtml(line.productName || "Item");
      const qty = line.quantity ?? 1;
      const total =
        line.lineTotal != null
          ? line.lineTotal
          : Number(line.unitPrice) * Number(qty);
      return `<tr>
  <td style="padding:6px 0;">${name} × ${qty}</td>
  <td style="padding:6px 0;text-align:right;">${escapeHtml(formatMoney(total, currency))}</td>
</tr>`;
    })
    .join("");
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;">
<tbody>${rows}</tbody>
</table>`;
}

function sendOrderVerifiedEmail(user, order) {
  const currency = order.currency || "NPR";
  const subtotal = formatMoney(order.subtotal, currency);
  const orderRef = order.id.slice(0, 8).toUpperCase();
  const accountUrl = `${SITE_URL}/account`;
  const itemsText = formatOrderItemsText(order.items, currency);
  const itemsHtml = formatOrderItemsHtml(order.items, currency);
  const note = order.adminNote?.trim();
  const noteText = note ? `\n\nNote from our team:\n${note}\n` : "";
  const noteHtml = note
    ? `<p><strong>Note from our team:</strong><br>${escapeHtml(note).replace(/\n/g, "<br>")}</p>`
    : "";

  return sendEmail({
    to: user.email,
    subject: `Your Digitoolera order #${orderRef} is confirmed`,
    text: `Hi ${user.name},

Your payment has been verified and your order is confirmed.

Order #${orderRef}
Total: ${subtotal}

Items:
${itemsText}
${noteText}
View your orders: ${accountUrl}

Thank you for shopping with Digitoolera!`,
    html: `<p>Hi <strong>${escapeHtml(user.name)}</strong>,</p>
<p>Your payment has been <strong>verified</strong> and your order is <strong>confirmed</strong>.</p>
<p><strong>Order #${escapeHtml(orderRef)}</strong><br>Total: <strong>${escapeHtml(subtotal)}</strong></p>
${itemsHtml}
${noteHtml}
<p><a href="${escapeHtml(accountUrl)}">View your orders</a></p>
<p>Thank you for shopping with Digitoolera!</p>`,
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function queueEmail(promise) {
  promise.catch((err) => {
    console.error("[mail] Send failed:", err.message);
  });
}

module.exports = {
  isMailConfigured,
  sendEmail,
  sendWelcomeEmail,
  sendSignupOtpEmail,
  sendPasswordResetOtpEmail,
  sendLoginEmail,
  sendOrderVerifiedEmail,
  queueEmail,
  formatMoney,
  formatOrderItemsText,
};
