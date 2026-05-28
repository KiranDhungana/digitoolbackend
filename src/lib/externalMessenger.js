const SITE_URL = process.env.SITE_URL || "https://digitoolera.com";

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeTelegramTarget(contact) {
  const raw = String(contact || "").trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return raw;
  const username = raw.startsWith("@") ? raw.slice(1) : raw;
  return username ? `@${username}` : null;
}

function buildWhatsAppUrl(phoneDigits, text) {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`;
}

function buildTelegramUrl(target, text) {
  const encoded = encodeURIComponent(text);
  if (target.startsWith("@")) {
    return `${SITE_URL}/support`;
  }
  if (/^\d+$/.test(target)) {
    return `https://t.me/+${target}`;
  }
  return `https://t.me/${target.replace(/^@/, "")}`;
}

function buildViberUrl(phoneDigits, text) {
  return `viber://chat?number=%2B${phoneDigits}&text=${encodeURIComponent(text)}`;
}

async function trySendTelegram(contact, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, reason: "not_configured" };

  const raw = String(contact || "").trim();
  let chatId = null;
  if (/^\d+$/.test(raw)) {
    chatId = raw;
  } else if (process.env.TELEGRAM_DEFAULT_CHAT_ID) {
    chatId = process.env.TELEGRAM_DEFAULT_CHAT_ID;
  } else {
    return { ok: false, reason: "telegram_needs_chat_id" };
  }

  const res = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: `${text}\n\n(Sent for contact: ${raw})`,
      }),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    return { ok: false, reason: data.description || "telegram_failed" };
  }
  return { ok: true, method: "telegram_api" };
}

async function trySendWhatsApp(contact, text) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return { ok: false, reason: "not_configured" };

  const to = onlyDigits(contact);
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${phoneId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { ok: false, reason: err.error?.message || "whatsapp_failed" };
  }
  return { ok: true, method: "whatsapp_api" };
}

async function trySendViber(contact, text) {
  const token = process.env.VIBER_AUTH_TOKEN;
  if (!token) return { ok: false, reason: "not_configured" };

  const receiver = onlyDigits(contact);
  const res = await fetch("https://chatapi.viber.com/pa/send_message", {
    method: "POST",
    headers: {
      "X-Viber-Auth-Token": token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      receiver,
      type: "text",
      text,
      min_api_version: 1,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (data.status !== 0) {
    return { ok: false, reason: data.status_message || "viber_failed" };
  }
  return { ok: true, method: "viber_api" };
}

async function tryExternalDelivery(channel, contact, text) {
  if (channel === "telegram") {
    const api = await trySendTelegram(contact, text);
    if (api.ok) return api;
    const target = normalizeTelegramTarget(contact);
    return {
      ok: false,
      reason: api.reason,
      manualUrl: target ? buildTelegramUrl(target, text) : null,
    };
  }

  if (channel === "whatsapp") {
    const api = await trySendWhatsApp(contact, text);
    if (api.ok) return api;
    const digits = onlyDigits(contact);
    return {
      ok: false,
      reason: api.reason,
      manualUrl: digits ? buildWhatsAppUrl(digits, text) : null,
    };
  }

  if (channel === "viber") {
    const api = await trySendViber(contact, text);
    if (api.ok) return api;
    const digits = onlyDigits(contact);
    return {
      ok: false,
      reason: api.reason,
      manualUrl: digits ? buildViberUrl(digits, text) : null,
    };
  }

  return { ok: false, reason: "unsupported" };
}

module.exports = {
  tryExternalDelivery,
  buildWhatsAppUrl,
  buildTelegramUrl,
  buildViberUrl,
};
