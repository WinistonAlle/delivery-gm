import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getCustomerProfileByPhone } from "../_lib/customerProfiles";
import { writeCustomerSession } from "../_lib/authSession";
import { assertRateLimit, isRateLimitError } from "../_lib/rateLimit";

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function getRequestIp(req: VercelRequest) {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return String(raw ?? req.socket?.remoteAddress ?? "unknown")
    .split(",")[0]
    .trim();
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const phone = onlyDigits((req.body ?? {}).phone);
    const cpf = onlyDigits((req.body ?? {}).cpf).slice(0, 11);
    const ip = getRequestIp(req);

    assertRateLimit(`auth:login:ip:${ip}`, { limit: 25, windowMs: 15 * 60 * 1000 });
    if (phone) {
      assertRateLimit(`auth:login:phone:${phone}`, { limit: 6, windowMs: 15 * 60 * 1000 });
    }

    if (phone.length < 10) {
      return res.status(400).json({ error: "Informe seu telefone com DDD." });
    }

    if (cpf.length !== 11) {
      return res.status(400).json({ error: "Informe seu CPF com 11 dígitos." });
    }

    const session = await getCustomerProfileByPhone(phone);
    if (!session || session.document_cpf !== cpf) {
      await wait(350);
      return res.status(401).json({ error: "Telefone ou CPF inválidos." });
    }

    writeCustomerSession(res, session);
    return res.status(200).json({ session });
  } catch (error) {
    if (isRateLimitError(error)) {
      res.setHeader("Retry-After", String(error.retryAfterSeconds));
      return res.status(429).json({ error: error.message });
    }
    const message = error instanceof Error ? error.message : "Erro ao autenticar.";
    return res.status(400).json({ error: message });
  }
}
