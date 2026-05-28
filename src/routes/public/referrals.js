const express = require("express");
const { prisma } = require("../../lib/prisma");
const { authUser } = require("../../middleware/authUser");
const {
  getReferralSummary,
  countVerifiedItemsPurchased,
  MIN_PURCHASED_ITEMS_TO_WITHDRAW,
  normalizeReferralCode,
  resolveReferrerByCode,
} = require("../../lib/referral");

const router = express.Router();

function toNumber(value) {
  if (value == null) return 0;
  return Number(value);
}

function serializeOrderItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((line) => {
    const quantity = Number(line.quantity) || 1;
    const unitPrice = Number(line.unitPrice) || 0;
    return {
      productName: String(line.productName || "Item"),
      quantity,
      unitPrice,
      lineTotal: unitPrice * quantity,
    };
  });
}

router.get("/validate", async (req, res, next) => {
  try {
    const code = normalizeReferralCode(req.query.code ?? "");
    if (!code) {
      return res.status(400).json({ error: "Referral code is required" });
    }
    const referrer = await resolveReferrerByCode(code);
    if (!referrer) {
      return res.status(404).json({ valid: false, error: "Invalid referral code" });
    }
    res.json({
      valid: true,
      code: referrer.referralCode,
      referrerName: referrer.name,
    });
  } catch (err) {
    next(err);
  }
});

router.get("/me", authUser, async (req, res, next) => {
  try {
    const summary = await getReferralSummary(req.user.sub);
    if (!summary) {
      return res.status(404).json({ error: "User not found" });
    }

    const [commissions, withdrawals] = await Promise.all([
      prisma.referralCommission.findMany({
        where: { referrerId: req.user.sub },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          amount: true,
          rate: true,
          createdAt: true,
          order: {
            select: { id: true, subtotal: true, currency: true, items: true },
          },
        },
      }),
      prisma.referralWithdrawal.findMany({
        where: { userId: req.user.sub },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          amount: true,
          status: true,
          payoutNote: true,
          adminNote: true,
          createdAt: true,
          processedAt: true,
        },
      }),
    ]);

    res.json({
      ...summary,
      commissions: commissions.map((c) => ({
        id: c.id,
        amount: toNumber(c.amount),
        rate: toNumber(c.rate),
        createdAt: c.createdAt,
        orderId: c.order.id,
        orderSubtotal: toNumber(c.order.subtotal),
        currency: c.order.currency,
        orderItems: serializeOrderItems(c.order.items),
      })),
      withdrawals: withdrawals.map((w) => ({
        id: w.id,
        amount: toNumber(w.amount),
        status: w.status,
        payoutNote: w.payoutNote ?? undefined,
        adminNote: w.adminNote ?? undefined,
        createdAt: w.createdAt,
        processedAt: w.processedAt ?? undefined,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post("/withdraw", authUser, async (req, res, next) => {
  try {
    const { amount, payoutNote } = req.body;
    const withdrawAmount = Number(amount);
    if (!withdrawAmount || withdrawAmount <= 0) {
      return res.status(400).json({ error: "Enter a valid withdrawal amount" });
    }
    if (!payoutNote?.trim()) {
      return res.status(400).json({
        error: "Payout details are required (e.g. Khalti/Fonepay number or bank info)",
      });
    }

    const purchasedItems = await countVerifiedItemsPurchased(req.user.sub);
    if (purchasedItems < MIN_PURCHASED_ITEMS_TO_WITHDRAW) {
      return res.status(403).json({
        error: `You must purchase at least ${MIN_PURCHASED_ITEMS_TO_WITHDRAW} items (in confirmed orders) before withdrawing referral earnings.`,
        purchasedItemsCount: purchasedItems,
        minPurchasedItemsToWithdraw: MIN_PURCHASED_ITEMS_TO_WITHDRAW,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: req.user.sub },
        select: { referralBalance: true },
      });
      if (!user) {
        const err = new Error("User not found");
        err.statusCode = 404;
        throw err;
      }

      const balance = Number(user.referralBalance);
      const pending = await tx.referralWithdrawal.aggregate({
        where: { userId: req.user.sub, status: "pending" },
        _sum: { amount: true },
      });
      const pendingTotal = Number(pending._sum.amount ?? 0);
      const available = balance - pendingTotal;

      if (withdrawAmount > available) {
        const err = new Error(
          pendingTotal > 0
            ? `Amount exceeds available balance (${available.toFixed(2)} NPR after pending withdrawals)`
            : "Insufficient referral balance"
        );
        err.statusCode = 400;
        throw err;
      }

      const withdrawal = await tx.referralWithdrawal.create({
        data: {
          userId: req.user.sub,
          amount: withdrawAmount,
          payoutNote: String(payoutNote).trim(),
          status: "pending",
        },
      });

      await tx.user.update({
        where: { id: req.user.sub },
        data: {
          referralBalance: { decrement: withdrawAmount },
        },
      });

      return withdrawal;
    });

    const summary = await getReferralSummary(req.user.sub);
    res.status(201).json({
      withdrawal: {
        id: result.id,
        amount: toNumber(result.amount),
        status: result.status,
        payoutNote: result.payoutNote,
        createdAt: result.createdAt,
      },
      summary,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

module.exports = router;
