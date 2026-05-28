const express = require("express");
const { prisma } = require("../../lib/prisma");
const { serializeOrder } = require("../../lib/serializeOrder");
const { deliverOrderConfirmation } = require("../../services/orderDeliveryNotify");
const { CHANNEL_LABELS } = require("../../lib/deliveryChannels");
const { buildWhatsAppUrl } = require("../../lib/externalMessenger");
const { buildOrderDeliveryMessage } = require("../../lib/orderDeliveryMessage");
const { creditReferralCommission } = require("../../lib/referral");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const { status, limit = "50", offset = "0" } = req.query;
    const take = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const skip = Math.max(parseInt(offset, 10) || 0, 0);

    const where = status ? { status: String(status) } : {};

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { user: true },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      items: orders.map((o) => serializeOrder(o, o.user)),
      total,
      limit: take,
      offset: skip,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }
    res.json(serializeOrder(order, order.user));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;

    if (!["verified", "rejected"].includes(status)) {
      return res.status(400).json({
        error: "status must be verified or rejected",
      });
    }

    const existing = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });
    if (!existing) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        status,
        adminNote: adminNote?.trim() || null,
        verifiedAt: status === "verified" ? new Date() : null,
      },
      include: { user: true },
    });

    let deliveryResults;
    if (
      status === "verified" &&
      existing.status !== "verified" &&
      order.user
    ) {
      const io = req.app.get("io");
      deliveryResults = await deliverOrderConfirmation(order, order.user, io);
      try {
        await creditReferralCommission(order);
      } catch (commissionErr) {
        console.error("Referral commission failed:", commissionErr);
      }
    }

    const payload = serializeOrder(order, order.user);
    if (deliveryResults) {
      payload.deliveryResults = deliveryResults;
      const channel = order.deliveryChannel;
      if (
        ["whatsapp", "telegram", "viber"].includes(channel) &&
        order.deliveryContact
      ) {
        const text = buildOrderDeliveryMessage(order, order.user);
        const digits = String(order.deliveryContact).replace(/\D/g, "");
        if (channel === "whatsapp" && digits) {
          payload.manualDeliveryUrl = buildWhatsAppUrl(digits, text);
        }
      }
      payload.deliveryChannelLabel = CHANNEL_LABELS[channel] || channel;
    }

    res.json(payload);
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Order not found" });
    }
    next(err);
  }
});

module.exports = router;
