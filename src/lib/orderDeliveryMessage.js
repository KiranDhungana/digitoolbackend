const { formatMoney, formatOrderItemsText } = require("./mail");

function buildOrderPendingMessage(order, user) {
  const currency = order.currency || "NPR";
  const orderRef = order.id.slice(0, 8).toUpperCase();
  const subtotal = formatMoney(order.subtotal, currency);
  const itemsText = formatOrderItemsText(order.items, currency);

  return `Hi ${user.name},

Thank you for your order!

Order #${orderRef}
Total: ${subtotal}

Items:
${itemsText}

Status: Pending payment verification

We have received your payment screenshot and will verify it shortly. You will receive your product details once your payment is confirmed.

Thank you for shopping with Digitoolera!`;
}

function buildOrderDeliveryMessage(order, user) {
  const currency = order.currency || "NPR";
  const orderRef = order.id.slice(0, 8).toUpperCase();
  const subtotal = formatMoney(order.subtotal, currency);
  const itemsText = formatOrderItemsText(order.items, currency);
  const note = order.adminNote?.trim();
  const noteBlock = note ? `\n\nNote from our team:\n${note}` : "";

  return `Hi ${user.name},

Your Digitoolera order #${orderRef} is confirmed.

Total: ${subtotal}

Items:
${itemsText}${noteBlock}

Thank you for shopping with Digitoolera!`;
}

module.exports = { buildOrderPendingMessage, buildOrderDeliveryMessage };
