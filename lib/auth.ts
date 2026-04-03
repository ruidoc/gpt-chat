import "server-only";

import { createHmac, timingSafeEqual } from "crypto";
import { cache } from "react";
import { cookies } from "next/headers";

import { getUserById } from "@/lib/chat-db";

export const SESSION_COOKIE_NAME = "datatalk_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

type SessionPayload = {
  userId: string;
  iat: number;
  exp: number;
};

const getAuthSecret = () => {
  const secret = process.env.AUTH_SECRET?.trim();

  if (!secret) {
    throw new Error("Missing AUTH_SECRET environment variable.");
  }

  return secret;
};

const encode = (value: string) => Buffer.from(value, "utf8").toString("base64url");
const decode = (value: string) => Buffer.from(value, "base64url").toString("utf8");

const sign = (value: string) =>
  createHmac("sha256", getAuthSecret()).update(value).digest("base64url");

const parseToken = (token: string): SessionPayload | null => {
  const [encodedPayload, signature] = token.split(".");

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const payload = JSON.parse(decode(encodedPayload)) as SessionPayload;

    if (!payload.userId || typeof payload.exp !== "number") {
      return null;
    }

    if (payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
};

export const createSessionToken = (userId: string) => {
  const now = Date.now();
  const payload: SessionPayload = {
    userId,
    iat: now,
    exp: now + SESSION_TTL_SECONDS * 1000,
  };
  const encodedPayload = encode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
};

export const getSessionCookieOptions = (maxAge = SESSION_TTL_SECONDS) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge,
});

export const setSessionCookie = async (userId: string) => {
  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE_NAME,
    createSessionToken(userId),
    getSessionCookieOptions(),
  );
};

export const clearSessionCookie = async () => {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", getSessionCookieOptions(0));
};

const getSessionPayload = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  return parseToken(token);
};

export const getCurrentUser = cache(async () => {
  const payload = await getSessionPayload();

  if (!payload) {
    return null;
  }

  const user = await getUserById(payload.userId);

  if (!user || user.status !== "active") {
    return null;
  }

  return user;
});
