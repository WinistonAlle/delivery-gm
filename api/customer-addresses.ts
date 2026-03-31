import type { VercelRequest, VercelResponse } from "@vercel/node";
import { isSessionError, requireCustomerSession, writeCustomerSession } from "./_lib/authSession";
import { addCustomerAddress } from "./_lib/customerProfiles";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await requireCustomerSession(req);
    const body = (req.body ?? {}) as Record<string, unknown>;

    const updatedSession = await addCustomerAddress({
      phone: session.phone,
      address: String(body.address ?? ""),
      city: String(body.city ?? ""),
      cep: String(body.cep ?? ""),
      label: String(body.label ?? ""),
      setPrimary: Boolean(body.setPrimary),
    });

    writeCustomerSession(res, updatedSession);
    return res.status(200).json({ session: updatedSession });
  } catch (error) {
    if (isSessionError(error)) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    const message = error instanceof Error ? error.message : "Erro ao salvar endereco.";
    return res.status(400).json({ error: message });
  }
}
