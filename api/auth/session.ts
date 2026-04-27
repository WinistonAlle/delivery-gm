import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  clearCustomerSessionCookie,
  getAuthenticatedCustomerSession,
} from "../_lib/authSession";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const session = await getAuthenticatedCustomerSession(req);
    if (!session) {
      clearCustomerSessionCookie(res);
      return res.status(200).json({ session: null });
    }

    return res.status(200).json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao carregar sessão.";
    return res.status(503).json({ error: message });
  }
}
