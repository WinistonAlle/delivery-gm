import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { ServerCustomerSession } from "./customerProfiles";
import { getCustomerProfileByPhone } from "./customerProfiles";

const SESSION_COOKIE_NAME = "gm_delivery_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

class SessionError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

type SessionPayload = {
  phone: string;
  role: "admin" | "customer";
  exp: number;
};

function getSessionSecret() {
  const secret =
    process.env.AUTH_SESSION_SECRET ||
    process.env.CUSTOMER_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error("Missing AUTH_SESSION_SECRET / CUSTOMER_SESSION_SECRET / SUPABASE_SERVICE_ROLE_KEY");
  }

  return secret;
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signValue(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

function parseCookies(headerValue?: string) {
  const result = new Map<string, string>();
  for (const part of String(headerValue ?? "").split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) continue;
    result.set(rawKey, rest.join("="));
  }
  return result;
}

function serializeCookie(name: string, value: string, maxAgeSeconds: number) {
  const attrs = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (process.env.NODE_ENV === "production") {
    attrs.push("Secure");
  }

  return attrs.join("; ");
}

function encodeSession(payload: SessionPayload) {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function decodeSession(rawValue: string | undefined): SessionPayload | null {
  if (!rawValue) return null;

  const [encodedPayload, signature] = rawValue.split(".");
  if (!encodedPayload || !signature) return null;

  const expectedSignature = signValue(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(encodedPayload)) as Partial<SessionPayload>;
    if (!parsed?.phone || !parsed?.role || !parsed?.exp) return null;
    if (Date.now() >= Number(parsed.exp)) return null;
    return {
      phone: String(parsed.phone).replace(/\D/g, ""),
      role: parsed.role === "admin" ? "admin" : "customer",
      exp: Number(parsed.exp),
    };
  } catch {
    return null;
  }
}

export function writeCustomerSession(res: VercelResponse, session: ServerCustomerSession) {
  const payload: SessionPayload = {
    phone: String(session.phone).replace(/\D/g, ""),
    role: session.role === "admin" ? "admin" : "customer",
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };

  res.setHeader(
    "Set-Cookie",
    serializeCookie(SESSION_COOKIE_NAME, encodeSession(payload), SESSION_MAX_AGE_SECONDS)
  );
}

export function clearCustomerSessionCookie(res: VercelResponse) {
  res.setHeader("Set-Cookie", serializeCookie(SESSION_COOKIE_NAME, "", 0));
}

export async function getAuthenticatedCustomerSession(req: VercelRequest) {
  const cookies = parseCookies(req.headers.cookie);
  const payload = decodeSession(cookies.get(SESSION_COOKIE_NAME));
  if (!payload?.phone) return null;

  const session = await getCustomerProfileByPhone(payload.phone);
  if (!session) return null;
  if (payload.role === "admin" && session.role !== "admin") return null;

  return session;
}

export async function requireCustomerSession(req: VercelRequest) {
  const session = await getAuthenticatedCustomerSession(req);
  if (!session) {
    throw new SessionError(401, "Sessao invalida ou expirada.");
  }
  return session;
}

export async function requireAdminSession(req: VercelRequest) {
  const session = await requireCustomerSession(req);
  if (session.role !== "admin" || !session.is_admin) {
    throw new SessionError(403, "Acesso restrito.");
  }
  return session;
}

export function isSessionError(error: unknown): error is SessionError {
  return error instanceof SessionError;
}
