const crypto = require("crypto");
const { prisma } = require("./prisma");

const REFERRAL_RATE = 0.02;
const MIN_PURCHASED_ITEMS_TO_WITHDRAW = 3;
const REFERRAL_CODE_LENGTH = 8;
const REFERRAL_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateReferralCode() {
  const bytes = crypto.randomBytes(REFERRAL_CODE_LENGTH);
  let code = "";
  for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
    code += REFERRAL_CODE_CHARS[bytes[i] % REFERRAL_CODE_CHARS.length];
  }
  return code;
}

async function createUniqueReferralCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const referralCode = generateReferralCode();
    const existing = await prisma.user.findUnique({
      where: { referralCode },
      select: { id: true },
    });
    if (!existing) return referralCode;
  }
  throw new Error("Could not generate a unique referral code");
}

function normalizeReferralCode(code) {
  return String(code).trim().toUpperCase();
}

function countItemsInOrderItems(items) {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, line) => sum + Math.max(Number(line.quantity) || 0, 0), 0);
}

async function countVerifiedItemsPurchased(userId) {
  const orders = await prisma.order.findMany({
    where: { userId, status: "verified" },
    select: { items: true },
  });
  return orders.reduce((sum, order) => sum + countItemsInOrderItems(order.items), 0);
}

function commissionAmount(subtotal) {
  const amount = Number(subtotal) * REFERRAL_RATE;
  return Math.round(amount * 100) / 100;
}

async function resolveReferrerByCode(referralCode) {
  if (!referralCode) return null;
  const normalized = normalizeReferralCode(referralCode);
  if (!normalized) return null;
  return prisma.user.findUnique({
    where: { referralCode: normalized },
    select: { id: true, referralCode: true, name: true },
  });
}

async function creditReferralCommission(order) {
  const buyer = await prisma.user.findUnique({
    where: { id: order.userId },
    select: { id: true, referredById: true },
  });
  if (!buyer?.referredById || buyer.referredById === buyer.id) {
    return null;
  }

  const existing = await prisma.referralCommission.findUnique({
    where: { orderId: order.id },
    select: { id: true },
  });
  if (existing) return existing;

  const amount = commissionAmount(order.subtotal);
  if (amount <= 0) return null;

  return prisma.$transaction(async (tx) => {
    const commission = await tx.referralCommission.create({
      data: {
        orderId: order.id,
        referrerId: buyer.referredById,
        referredUserId: buyer.id,
        amount,
        rate: REFERRAL_RATE,
      },
    });

    await tx.user.update({
      where: { id: buyer.referredById },
      data: {
        referralBalance: { increment: amount },
      },
    });

    return commission;
  });
}

async function getReferralSummary(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      referralCode: true,
      referralBalance: true,
      _count: { select: { referrals: true } },
    },
  });
  if (!user) return null;

  const [purchasedItemsCount, commissionsAgg, pendingWithdrawals] = await Promise.all([
    countVerifiedItemsPurchased(userId),
    prisma.referralCommission.aggregate({
      where: { referrerId: userId },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.referralWithdrawal.aggregate({
      where: { userId, status: "pending" },
      _sum: { amount: true },
    }),
  ]);

  const balance = Number(user.referralBalance);
  const pendingWithdrawal = Number(pendingWithdrawals._sum.amount ?? 0);
  const canWithdraw =
    purchasedItemsCount >= MIN_PURCHASED_ITEMS_TO_WITHDRAW && balance > 0;

  return {
    referralCode: user.referralCode,
    balance,
    availableBalance: Math.max(balance - pendingWithdrawal, 0),
    pendingWithdrawal,
    referralCount: user._count.referrals,
    totalEarned: Number(commissionsAgg._sum.amount ?? 0),
    commissionCount: commissionsAgg._count,
    purchasedItemsCount,
    minPurchasedItemsToWithdraw: MIN_PURCHASED_ITEMS_TO_WITHDRAW,
    canWithdraw,
    withdrawBlockedReason:
      purchasedItemsCount < MIN_PURCHASED_ITEMS_TO_WITHDRAW
        ? `Purchase at least ${MIN_PURCHASED_ITEMS_TO_WITHDRAW} items (confirmed orders) before you can withdraw referral earnings.`
        : balance <= 0
          ? "No referral balance available to withdraw."
          : undefined,
    commissionRatePercent: REFERRAL_RATE * 100,
  };
}

module.exports = {
  REFERRAL_RATE,
  MIN_PURCHASED_ITEMS_TO_WITHDRAW,
  generateReferralCode,
  createUniqueReferralCode,
  normalizeReferralCode,
  countVerifiedItemsPurchased,
  countItemsInOrderItems,
  commissionAmount,
  resolveReferrerByCode,
  creditReferralCommission,
  getReferralSummary,
};
