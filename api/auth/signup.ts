import type { VercelRequest, VercelResponse } from "@vercel/node";
import { upsertCustomerProfile } from "../_lib/customerProfiles";
import { writeCustomerSession } from "../_lib/authSession";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const session = await upsertCustomerProfile({
      fullName: String(body.full_name ?? body.fullName ?? ""),
      phone: String(body.phone ?? ""),
      documentCpf: String(body.document_cpf ?? body.documentCpf ?? ""),
      cep: String(body.cep ?? ""),
      address: String(body.address ?? ""),
      city: String(body.city ?? ""),
      howFoundUs: String(body.how_found_us ?? body.howFoundUs ?? ""),
      howFoundUsDetails: String(body.how_found_us_details ?? body.howFoundUsDetails ?? ""),
    });

    writeCustomerSession(res, session);
    return res.status(200).json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao concluir cadastro.";
    return res.status(400).json({ error: message });
  }
}
