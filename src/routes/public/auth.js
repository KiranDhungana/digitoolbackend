const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { prisma } = require("../../lib/prisma");
const { authUser } = require("../../middleware/authUser");
const {
  isMailConfigured,
  sendPasswordResetOtpEmail,
  sendSignupOtpEmail,
  sendWelcomeEmail,
  queueEmail,
} = require("../../lib/mail");
const {
  OTP_LENGTH,
  generateOtpCode,
  hashOtpCode,
  verifyOtpCode,
  otpExpiresAt,
  isOtpExpired,
} = require("../../lib/otp");
const { normalizeChannel } = require("../../lib/deliveryChannels");
const {
  createUniqueReferralCode,
  normalizeReferralCode,
  resolveReferrerByCode,
} = require("../../lib/referral");

const USER_PUBLIC_SELECT = {
  id: true,
  email: true,
  name: true,
  phone: true,
  referralCode: true,
  createdAt: true,
  defaultDeliveryChannel: true,
  deliveryWhatsapp: true,
  deliveryTelegram: true,
  deliveryViber: true,
};

const router = express.Router();

function serializeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? undefined,
    createdAt: user.createdAt,
    defaultDeliveryChannel: user.defaultDeliveryChannel ?? undefined,
    deliveryWhatsapp: user.deliveryWhatsapp ?? undefined,
    deliveryTelegram: user.deliveryTelegram ?? undefined,
    deliveryViber: user.deliveryViber ?? undefined,
    referralCode: user.referralCode,
  };
}

async function resolveReferredById(referralCode, excludeUserId) {
  if (!referralCode) return null;
  const referrer = await resolveReferrerByCode(normalizeReferralCode(referralCode));
  if (!referrer) return null;
  if (excludeUserId && referrer.id === excludeUserId) return null;
  return referrer.id;
}

function signUserToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: "USER" },
    process.env.JWT_SECRET,
    { expiresIn: "30d" }
  );
}

function normalizeEmail(email) {
  return String(email).toLowerCase().trim();
}

function validatePassword(password) {
  if (!password || String(password).length < 8) {
    const err = new Error("Password must be at least 8 characters");
    err.statusCode = 400;
    throw err;
  }
}

function normalizeOtpCode(code) {
  return String(code).replace(/\D/g, "").trim();
}

/** Step 1: validate signup details and email a verification code */
router.post("/register", async (req, res, next) => {
  try {
    if (!isMailConfigured()) {
      return res.status(503).json({
        error: "Email verification is not configured. Contact support.",
      });
    }

    const { name, email, password, phone, referralCode } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        error: "Name, email, and password are required",
      });
    }

    validatePassword(password);

    const normalizedEmail = normalizeEmail(email);
    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const code = generateOtpCode();
    const codeHash = await hashOtpCode(code);
    const passwordHash = await bcrypt.hash(String(password), 12);

    let referredById = null;
    if (referralCode?.trim()) {
      referredById = await resolveReferredById(referralCode);
      if (!referredById) {
        return res.status(400).json({ error: "Invalid referral code" });
      }
    }

    await prisma.signupVerification.upsert({
      where: { email: normalizedEmail },
      create: {
        email: normalizedEmail,
        codeHash,
        name: String(name).trim(),
        passwordHash,
        phone: phone?.trim() ? String(phone).trim() : null,
        referredById,
        expiresAt: otpExpiresAt(),
      },
      update: {
        codeHash,
        name: String(name).trim(),
        passwordHash,
        phone: phone?.trim() ? String(phone).trim() : null,
        referredById,
        expiresAt: otpExpiresAt(),
      },
    });

    const sent = await sendSignupOtpEmail(normalizedEmail, code);
    if (!sent) {
      return res.status(503).json({
        error: "Could not send verification email. Try again later.",
      });
    }

    res.status(200).json({
      message: "Verification code sent to your email",
      email: normalizedEmail,
      expiresInMinutes: 10,
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/** Step 2: verify OTP and create the account */
router.post("/register/verify", async (req, res, next) => {
  try {
    const { email, code } = req.body;
    if (!email?.trim() || !code) {
      return res.status(400).json({ error: "Email and verification code are required" });
    }

    const normalizedEmail = normalizeEmail(email);
    const otp = normalizeOtpCode(code);

    if (otp.length !== OTP_LENGTH) {
      return res.status(400).json({ error: "Enter the 6-digit verification code" });
    }

    const pending = await prisma.signupVerification.findUnique({
      where: { email: normalizedEmail },
    });

    if (!pending) {
      return res.status(400).json({
        error: "No pending signup for this email. Please register again.",
      });
    }

    if (isOtpExpired(pending.expiresAt)) {
      await prisma.signupVerification.delete({ where: { email: normalizedEmail } });
      return res.status(400).json({
        error: "Verification code expired. Please sign up again.",
      });
    }

    const valid = await verifyOtpCode(otp, pending.codeHash);
    if (!valid) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existing) {
      await prisma.signupVerification.delete({ where: { email: normalizedEmail } });
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const userReferralCode = await createUniqueReferralCode();
    const user = await prisma.user.create({
      data: {
        name: pending.name,
        email: normalizedEmail,
        passwordHash: pending.passwordHash,
        phone: pending.phone,
        referralCode: userReferralCode,
        referredById: pending.referredById,
      },
    });

    await prisma.signupVerification.delete({ where: { email: normalizedEmail } });

    const token = signUserToken(user);
    queueEmail(sendWelcomeEmail(user));
    res.status(201).json({
      token,
      user: serializeUser(user),
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

/** Step 1: request forgot-password verification code */
router.post("/forgot-password", async (req, res, next) => {
  try {
    if (!isMailConfigured()) {
      return res.status(503).json({
        error: "Email verification is not configured. Contact support.",
      });
    }

    const { email } = req.body;
    if (!email?.trim()) {
      return res.status(400).json({ error: "Email is required" });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Keep response generic to avoid account enumeration.
    if (!user?.passwordHash) {
      return res.status(200).json({
        message: "If an account exists, a reset code has been sent.",
        email: normalizedEmail,
        expiresInMinutes: 10,
      });
    }

    const code = generateOtpCode();
    const codeHash = await hashOtpCode(code);

    await prisma.passwordResetVerification.upsert({
      where: { email: normalizedEmail },
      create: {
        email: normalizedEmail,
        codeHash,
        expiresAt: otpExpiresAt(),
      },
      update: {
        codeHash,
        expiresAt: otpExpiresAt(),
      },
    });

    await sendPasswordResetOtpEmail(normalizedEmail, code);

    res.status(200).json({
      message: "If an account exists, a reset code has been sent.",
      email: normalizedEmail,
      expiresInMinutes: 10,
    });
  } catch (err) {
    next(err);
  }
});

/** Step 2: verify code and set new password */
router.post("/forgot-password/verify", async (req, res, next) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email?.trim() || !code || !newPassword) {
      return res
        .status(400)
        .json({ error: "Email, verification code, and new password are required" });
    }

    validatePassword(newPassword);

    const normalizedEmail = normalizeEmail(email);
    const otp = normalizeOtpCode(code);
    if (otp.length !== OTP_LENGTH) {
      return res.status(400).json({ error: "Enter the 6-digit verification code" });
    }

    const pending = await prisma.passwordResetVerification.findUnique({
      where: { email: normalizedEmail },
    });
    if (!pending) {
      return res.status(400).json({
        error: "No pending reset for this email. Please request a new code.",
      });
    }
    if (isOtpExpired(pending.expiresAt)) {
      await prisma.passwordResetVerification.delete({
        where: { email: normalizedEmail },
      });
      return res.status(400).json({
        error: "Verification code expired. Please request a new code.",
      });
    }

    const valid = await verifyOtpCode(otp, pending.codeHash);
    if (!valid) {
      return res.status(400).json({ error: "Invalid verification code" });
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user) {
      await prisma.passwordResetVerification.delete({
        where: { email: normalizedEmail },
      });
      return res.status(404).json({ error: "User not found" });
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 12);
    const updated = await prisma.user.update({
      where: { email: normalizedEmail },
      data: { passwordHash },
    });
    await prisma.passwordResetVerification.delete({
      where: { email: normalizedEmail },
    });

    const token = signUserToken(updated);
    res.status(200).json({
      token,
      user: serializeUser(updated),
    });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { ...USER_PUBLIC_SELECT, passwordHash: true },
    });

    if (!user?.passwordHash) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(String(password), user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = signUserToken(user);
    res.json({
      token,
      user: serializeUser(user),
    });
  } catch (err) {
    next(err);
  }
});

router.get("/me", authUser, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: USER_PUBLIC_SELECT,
    });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(serializeUser(user));
  } catch (err) {
    next(err);
  }
});

router.put("/me", authUser, async (req, res, next) => {
  try {
    const {
      name,
      phone,
      defaultDeliveryChannel,
      deliveryWhatsapp,
      deliveryTelegram,
      deliveryViber,
    } = req.body;
    if (!name?.trim()) {
      return res.status(400).json({ error: "Name is required" });
    }

    const data = {
      name: String(name).trim(),
      phone: phone?.trim() ? String(phone).trim() : null,
    };

    if (defaultDeliveryChannel !== undefined) {
      const ch = defaultDeliveryChannel
        ? normalizeChannel(defaultDeliveryChannel)
        : null;
      data.defaultDeliveryChannel = ch;
    }
    if (deliveryWhatsapp !== undefined) {
      data.deliveryWhatsapp = deliveryWhatsapp?.trim() || null;
    }
    if (deliveryTelegram !== undefined) {
      data.deliveryTelegram = deliveryTelegram?.trim() || null;
    }
    if (deliveryViber !== undefined) {
      data.deliveryViber = deliveryViber?.trim() || null;
    }

    const user = await prisma.user.update({
      where: { id: req.user.sub },
      data,
      select: USER_PUBLIC_SELECT,
    });

    res.json(serializeUser(user));
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "User not found" });
    }
    next(err);
  }
});

module.exports = router;
