import type { VercelRequest, VercelResponse } from "@vercel/node";
import { upsertCustomerProfile } from "../_lib/customerProfiles";
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const phone = onlyDigits(body.phone);
    const ip = getRequestIp(req);

    assertRateLimit(`auth:signup:ip:${ip}`, { limit: 12, windowMs: 60 * 60 * 1000 });
    if (phone) {
      assertRateLimit(`auth:signup:phone:${phone}`, { limit: 4, windowMs: 60 * 60 * 1000 });
    }

    const session = await upsertCustomerProfile({
      customerType: body.customer_type === "pessoa_juridica" ? "pessoa_juridica" : "pessoa_fisica",
      fullName: String(body.full_name ?? body.fullName ?? ""),
      phone,
      documentCpf: String(body.document_cpf ?? body.documentCpf ?? ""),
      documentCnpj: String(body.document_cnpj ?? body.documentCnpj ?? ""),
      companyLegalName: String(body.company_legal_name ?? body.companyLegalName ?? ""),
      companyTradeName: String(body.company_trade_name ?? body.companyTradeName ?? ""),
      stateRegistration: String(body.state_registration ?? body.stateRegistration ?? ""),
      orderResponsibleName: String(body.order_responsible_name ?? body.orderResponsibleName ?? ""),
      cep: String(body.cep ?? ""),
      address: String(body.address ?? ""),
      city: String(body.city ?? ""),
      howFoundUs: String(body.how_found_us ?? body.howFoundUs ?? ""),
      howFoundUsDetails: String(body.how_found_us_details ?? body.howFoundUsDetails ?? ""),
    });

    writeCustomerSession(res, session);
    return res.status(200).json({ session });
  } catch (error) {
    if (isRateLimitError(error)) {
      res.setHeader("Retry-After", String(error.retryAfterSeconds));
      return res.status(429).json({ error: error.message });
    }
    const message = error instanceof Error ? error.message : "Erro ao concluir cadastro.";
    return res.status(400).json({ error: message });
  }
}
