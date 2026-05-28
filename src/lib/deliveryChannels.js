const DELIVERY_CHANNELS = ["email", "chat", "whatsapp", "telegram", "viber"];

const CHANNEL_LABELS = {
  email: "Email",
  chat: "Platform chat",
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  viber: "Viber",
};

function normalizeChannel(value) {
  const ch = String(value || "").toLowerCase().trim();
  if (!DELIVERY_CHANNELS.includes(ch)) return null;
  return ch;
}

function normalizeContact(channel, contact, userEmail) {
  const raw = String(contact || "").trim();
  if (channel === "chat") return null;
  if (channel === "email") {
    const email = (raw || userEmail || "").toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return null;
    }
    return email;
  }
  if (channel === "telegram") {
    if (!raw) return null;
    if (raw.startsWith("@")) {
      const username = raw.slice(1).replace(/\s/g, "");
      return username.length >= 3 ? `@${username}` : null;
    }
    const digits = raw.replace(/\D/g, "");
    if (digits.length >= 8) return digits;
    return null;
  }
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return digits;
}

function validateDelivery(channel, contact, userEmail) {
  const normalizedChannel = normalizeChannel(channel);
  if (!normalizedChannel) {
    return { error: "Invalid delivery method" };
  }

  const deliveryContact = normalizeContact(
    normalizedChannel,
    contact,
    userEmail
  );

  if (normalizedChannel !== "chat" && !deliveryContact) {
    const hints = {
      email: "a valid email address",
      whatsapp: "a WhatsApp phone number",
      telegram: "a Telegram phone number (or @username)",
      viber: "a Viber phone number",
    };
    return {
      error: `Please provide ${hints[normalizedChannel] || "contact details"} for ${CHANNEL_LABELS[normalizedChannel]}.`,
    };
  }

  return {
    deliveryChannel: normalizedChannel,
    deliveryContact,
  };
}

module.exports = {
  DELIVERY_CHANNELS,
  CHANNEL_LABELS,
  normalizeChannel,
  normalizeContact,
  validateDelivery,
};
