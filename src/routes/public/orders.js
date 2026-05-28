const express = require("express");
const multer = require("multer");
const { prisma } = require("../../lib/prisma");
const { uploadBuffer } = require("../../lib/cloudinary");
const { serializeOrder, serializeOrderSummary } = require("../../lib/serializeOrder");
const { validateDelivery } = require("../../lib/deliveryChannels");
const { authUser } = require("../../middleware/authUser");
const { notifyOrderPlaced } = require("../../services/orderDeliveryNotify");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed for payment screenshot"));
    }
    cb(null, true);
  },
});

router.get("/me", authUser, async (req, res, next) => {
  try {
    const take = Math.min(Math.max(parseInt(String(req.query.limit ?? "50"), 10) || 50, 1), 100);
    const skip = Math.max(parseInt(String(req.query.offset ?? "0"), 10) || 0, 0);

    const orders = await prisma.order.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: "desc" },
      take,
      skip,
      select: {
        id: true,
        userId: true,
        items: true,
        subtotal: true,
        currency: true,
        paymentMethod: true,
        paymentReference: true,
        deliveryChannel: true,
        deliveryContact: true,
        status: true,
        adminNote: true,
        createdAt: true,
        updatedAt: true,
        verifiedAt: true,
      },
    });
    res.json(orders.map((o) => serializeOrderSummary(o)));
  } catch (err) {
    next(err);
  }
});

router.post("/", authUser, upload.single("screenshot"), async (req, res, next) => {
  try {
    const {
      items,
      paymentMethod,
      paymentReference,
      deliveryChannel,
      deliveryContact,
    } = req.body;

    if (paymentMethod !== "fonepay") {
      return res.status(400).json({
        error: "Only Fonepay is available. Khalti is coming soon.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        error: "Payment screenshot is required for Fonepay",
      });
    }

    let parsedItems;
    try {
      parsedItems = typeof items === "string" ? JSON.parse(items) : items;
    } catch {
      return res.status(400).json({ error: "Invalid order items" });
    }

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      return res.status(400).json({ error: "Order must include at least one item" });
    }

    for (const line of parsedItems) {
      if (
        !line.productId ||
        line.denomination == null ||
        !line.quantity ||
        line.unitPrice == null
      ) {
        return res.status(400).json({ error: "Invalid line item in order" });
      }
    }

    const subtotal = parsedItems.reduce(
      (sum, line) => sum + Number(line.unitPrice) * Number(line.quantity),
      0
    );

    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const delivery = validateDelivery(
      deliveryChannel || user.defaultDeliveryChannel || "chat",
      deliveryContact,
      user.email
    );
    if (delivery.error) {
      return res.status(400).json({ error: delivery.error });
    }

    const uploadResult = await uploadBuffer(req.file.buffer, {
      folder: "payment-screenshots",
    });

    const order = await prisma.order.create({
      data: {
        userId: req.user.sub,
        items: parsedItems,
        subtotal,
        paymentMethod: "fonepay",
        paymentScreenshotUrl: uploadResult.secure_url,
        paymentReference: paymentReference?.trim() || null,
        deliveryChannel: delivery.deliveryChannel,
        deliveryContact: delivery.deliveryContact,
        status: "pending_verification",
      },
    });

    const profileUpdate = {};
    if (delivery.deliveryChannel === "whatsapp" && delivery.deliveryContact) {
      profileUpdate.deliveryWhatsapp = delivery.deliveryContact;
    }
    if (delivery.deliveryChannel === "telegram" && delivery.deliveryContact) {
      profileUpdate.deliveryTelegram = delivery.deliveryContact;
    }
    if (delivery.deliveryChannel === "viber" && delivery.deliveryContact) {
      profileUpdate.deliveryViber = delivery.deliveryContact;
    }
    if (Object.keys(profileUpdate).length > 0) {
      profileUpdate.defaultDeliveryChannel = delivery.deliveryChannel;
      await prisma.user.update({
        where: { id: user.id },
        data: profileUpdate,
      });
    }

    const io = req.app.get("io");
    void notifyOrderPlaced(order, user, io);

    res.status(201).json(serializeOrder(order));
  } catch (err) {
    next(err);
  }
});

router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "Screenshot too large (max 10MB)" });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err.message?.includes("Only image files")) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

module.exports = router;
