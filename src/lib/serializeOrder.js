function toNumber(value) {
  if (value == null) return undefined;
  return Number(value);
}

function serializeOrder(order, user) {
  return {
    id: order.id,
    userId: order.userId,
    items: order.items,
    subtotal: toNumber(order.subtotal),
    currency: order.currency,
    paymentMethod: order.paymentMethod,
    paymentScreenshotUrl: order.paymentScreenshotUrl,
    paymentReference: order.paymentReference ?? undefined,
    deliveryChannel: order.deliveryChannel,
    deliveryContact: order.deliveryContact ?? undefined,
    status: order.status,
    adminNote: order.adminNote ?? undefined,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    verifiedAt: order.verifiedAt ?? undefined,
    user: user
      ? {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone ?? undefined,
        }
      : undefined,
  };
}

/** Account order list — omits heavy payment screenshot URL */
function serializeOrderSummary(order) {
  return {
    id: order.id,
    userId: order.userId,
    items: order.items,
    subtotal: toNumber(order.subtotal),
    currency: order.currency,
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference ?? undefined,
    deliveryChannel: order.deliveryChannel,
    deliveryContact: order.deliveryContact ?? undefined,
    status: order.status,
    adminNote: order.adminNote ?? undefined,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    verifiedAt: order.verifiedAt ?? undefined,
  };
}

module.exports = { serializeOrder, serializeOrderSummary };
