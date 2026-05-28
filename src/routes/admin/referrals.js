const express = require("express");
const { prisma } = require("../../lib/prisma");

const router = express.Router();

function toNumber(value) {
  if (value == null) return 0;
  return Number(value);
}

router.get("/withdrawals", async (req, res, next) => {
  try {
    const { status, limit = "50", offset = "0" } = req.query;
    const take = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const skip = Math.max(parseInt(offset, 10) || 0, 0);
    const where = status ? { status: String(status) } : {};

    const [items, total] = await Promise.all([
      prisma.referralWithdrawal.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
        orderBy: { createdAt: "desc" },
        take,
        skip,
      }),
      prisma.referralWithdrawal.count({ where }),
    ]);

    res.json({
      items: items.map((w) => ({
        id: w.id,
        amount: toNumber(w.amount),
        status: w.status,
        payoutNote: w.payoutNote ?? undefined,
        adminNote: w.adminNote ?? undefined,
        createdAt: w.createdAt,
        processedAt: w.processedAt ?? undefined,
        user: w.user,
      })),
      total,
      limit: take,
      offset: skip,
    });
  } catch (err) {
    next(err);
  }
});

router.patch("/withdrawals/:id", async (req, res, next) => {
  try {
    const { status, adminNote } = req.body;
    if (!["completed", "rejected"].includes(status)) {
      return res.status(400).json({
        error: "status must be completed or rejected",
      });
    }

    const existing = await prisma.referralWithdrawal.findUnique({
      where: { id: req.params.id },
    });
    if (!existing) {
      return res.status(404).json({ error: "Withdrawal not found" });
    }
    if (existing.status !== "pending") {
      return res.status(400).json({ error: "Withdrawal has already been processed" });
    }

    const withdrawal = await prisma.$transaction(async (tx) => {
      const updated = await tx.referralWithdrawal.update({
        where: { id: req.params.id },
        data: {
          status,
          adminNote: adminNote?.trim() || null,
          processedAt: new Date(),
        },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true } },
        },
      });

      if (status === "rejected") {
        await tx.user.update({
          where: { id: existing.userId },
          data: {
            referralBalance: { increment: existing.amount },
          },
        });
      }

      return updated;
    });

    res.json({
      id: withdrawal.id,
      amount: toNumber(withdrawal.amount),
      status: withdrawal.status,
      payoutNote: withdrawal.payoutNote ?? undefined,
      adminNote: withdrawal.adminNote ?? undefined,
      createdAt: withdrawal.createdAt,
      processedAt: withdrawal.processedAt ?? undefined,
      user: withdrawal.user,
    });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Withdrawal not found" });
    }
    next(err);
  }
});

module.exports = router;
