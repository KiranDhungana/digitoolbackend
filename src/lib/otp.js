const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const OTP_LENGTH = 6;
const OTP_TTL_MS = 10 * 60 * 1000;

function generateOtpCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(OTP_LENGTH, "0");
}

async function hashOtpCode(code) {
  return bcrypt.hash(String(code), 10);
}

async function verifyOtpCode(code, codeHash) {
  return bcrypt.compare(String(code), codeHash);
}

function otpExpiresAt() {
  return new Date(Date.now() + OTP_TTL_MS);
}

function isOtpExpired(expiresAt) {
  return expiresAt.getTime() < Date.now();
}

module.exports = {
  OTP_LENGTH,
  OTP_TTL_MS,
  generateOtpCode,
  hashOtpCode,
  verifyOtpCode,
  otpExpiresAt,
  isOtpExpired,
};
