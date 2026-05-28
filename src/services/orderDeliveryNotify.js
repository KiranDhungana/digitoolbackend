const chatService = require("./chatService");
const { sendOrderVerifiedEmail, queueEmail } = require("../lib/mail");
const {
  buildOrderPendingMessage,
  buildOrderDeliveryMessage,
} = require("../lib/orderDeliveryMessage");
const { tryExternalDelivery } = require("../lib/externalMessenger");
const { CHANNEL_LABELS } = require("../lib/deliveryChannels");

function emitChatMessage(io, userId, message) {
  if (!io) return;
  const room = `user:${userId}`;
  io.to(room).emit("chat:message", message);
  io.to("admin").emit("chat:message", { ...message, userId });
  io.to("admin").emit("chat:conversations_changed");
}

async function sendPlatformChat(order, user, io) {
  const body = buildOrderDeliveryMessage(order, user);
  const message = await chatService.sendAdminMessage(user.id, body, null);
  emitChatMessage(io, user.id, message);
  return { channel: "chat", ok: true };
}

async function notifyOrderPlaced(order, user, io) {
  try {
    chatService.assertChatReady();
    const body = buildOrderPendingMessage(order, user);
    const message = await chatService.sendAdminMessage(user.id, body, null);
    emitChatMessage(io, user.id, message);
  } catch (err) {
    console.warn("[order] Pending chat notification failed:", err.message);
  }
}

async function deliverOrderConfirmation(order, user, io) {
  const channel = order.deliveryChannel || "chat";
  const results = [];

  if (channel === "email") {
    const to = order.deliveryContact || user.email;
    queueEmail(
      sendOrderVerifiedEmail(
        { ...user, email: to },
        order
      )
    );
    results.push({ channel: "email", ok: true });
    return results;
  }

  if (channel === "chat") {
    try {
      const r = await sendPlatformChat(order, user, io);
      results.push(r);
    } catch (err) {
      console.error("[delivery] Chat failed:", err.message);
      queueEmail(sendOrderVerifiedEmail(user, order));
      results.push({ channel: "chat", ok: false, fallback: "email" });
    }
    return results;
  }

  const text = buildOrderDeliveryMessage(order, user);
  const external = await tryExternalDelivery(
    channel,
    order.deliveryContact,
    text
  );

  if (external.ok) {
    results.push({ channel, ok: true, method: external.method });
    return results;
  }

  console.warn(
    `[delivery] ${CHANNEL_LABELS[channel]} auto-send unavailable (${external.reason}). Using platform chat.`
  );

  try {
    const prefix = `We could not auto-deliver to your ${CHANNEL_LABELS[channel]} (${order.deliveryContact}). Here are your order details:\n\n`;
    const message = await chatService.sendAdminMessage(
      user.id,
      prefix + text,
      null
    );
    emitChatMessage(io, user.id, message);
    results.push({
      channel,
      ok: false,
      fallback: "chat",
      manualUrl: external.manualUrl ?? undefined,
    });
  } catch (err) {
    console.error("[delivery] Chat fallback failed:", err.message);
    queueEmail(sendOrderVerifiedEmail(user, order));
    results.push({ channel, ok: false, fallback: "email" });
  }

  return results;
}

module.exports = {
  notifyOrderPlaced,
  deliverOrderConfirmation,
  buildOrderDeliveryMessage,
};
