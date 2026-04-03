import "server-only";

import bcrypt from "bcryptjs";
import { scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCallback);
const BCRYPT_ROUNDS = 10;

const toBuffer = (value: string) => Buffer.from(value, "hex");

export const hashPassword = async (password: string) => {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
};

const verifyLegacyScrypt = async (password: string, storedHash: string) => {
  const [algorithm, salt, key] = storedHash.split(":");

  if (algorithm !== "scrypt" || !salt || !key) {
    return false;
  }

  const expectedKey = toBuffer(key);
  const derivedKey = (await scrypt(password, salt, expectedKey.length)) as Buffer;

  if (expectedKey.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(expectedKey, derivedKey);
};

export const verifyPassword = async (password: string, storedHash: string) => {
  if (storedHash.startsWith("$2")) {
    return bcrypt.compare(password, storedHash);
  }

  return verifyLegacyScrypt(password, storedHash);
};
