import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getCustomerProfileByPhone } from "../_lib/customerProfiles";
import { writeCustomerSession } from "../_lib/authSession";

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
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

    if (phone.length < 10) {
      return res.status(400).json({ error: "Informe seu telefone com DDD." });
    }

    if (cpf.length !== 11) {
      return res.status(400).json({ error: "Informe seu CPF com 11 dígitos." });
    }

    const session = await getCustomerProfileByPhone(phone);
    if (!session) {
      return res.status(404).json({ error: "Cadastro não encontrado para este telefone." });
    }

    if (session.document_cpf !== cpf) {
      return res.status(401).json({ error: "Telefone ou CPF inválidos." });
    }

    writeCustomerSession(res, session);
    return res.status(200).json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao autenticar.";
    return res.status(400).json({ error: message });
  }
}
