const express = require("express");
const { prisma } = require("../../lib/prisma");
const { serializeContactMessage } = require("../../lib/serializeContact");

const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const { status, limit = "50", offset = "0" } = req.query;
    const take = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const skip = Math.max(parseInt(offset, 10) || 0, 0);

    const where = status ? { status: String(status) } : {};

    const [items, total] = await Promise.all([
      prisma.contactMessage.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.contactMessage.count({ where }),
    ]);

    res.json({
      items: items.map(serializeContactMessage),
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
    const row = await prisma.contactMessage.findUnique({
      where: { id: req.params.id },
    });
    if (!row) {
      return res.status(404).json({ error: "Message not found" });
    }
    res.json(serializeContactMessage(row));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const { status } = req.body;
    const allowed = ["new", "read", "archived"];

    if (!allowed.includes(status)) {
      return res.status(400).json({
        error: "status must be new, read, or archived",
      });
    }

    const data = { status };
    if (status === "read") data.readAt = new Date();
    if (status === "new") data.readAt = null;

    const row = await prisma.contactMessage.update({
      where: { id: req.params.id },
      data,
    });

    res.json(serializeContactMessage(row));
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Message not found" });
    }
    next(err);
  }
});

module.exports = router;
