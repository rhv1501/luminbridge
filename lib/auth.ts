import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_KEYLEN = 64;

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string | null) {
  if (!storedHash) return false;
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;

  const derived = scryptSync(password, salt, SCRYPT_KEYLEN);
  const known = Buffer.from(key, "hex");
  if (known.length !== derived.length) return false;
  return timingSafeEqual(known, derived);
}

export function generateVerificationToken() {
  return randomBytes(24).toString("hex");
}

export function generateTemporaryPassword() {
  // URL-safe, human-readable temporary password.
  return randomBytes(6).toString("base64url");
}