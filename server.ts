import "dotenv/config";
import express from "express";
import type { Request, Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { VercelRequest, VercelResponse } from "@vercel/node";

import adminOrdersHandler from "./api/admin-orders";
import adminOffersHandler from "./api/admin-offers";
import adminProductsHandler from "./api/admin-products";
import adminThemeHandler from "./api/admin-theme";
import adminFeaturedHandler from "./api/admin-featured";
import authLoginHandler from "./api/auth/login";
import authLogoutHandler from "./api/auth/logout";
import authSessionHandler from "./api/auth/session";
import authSignupHandler from "./api/auth/signup";
import customerOrdersHandler from "./api/customer-orders";
import customerAddressesHandler from "./api/customer-addresses";
import deliveryOpsHandler from "./api/delivery-ops";
import ordersHandler from "./api/orders";
import reportsDashboardHandler from "./api/reports-dashboard";
import couponSlotsHandler from "./api/coupon-slots";
import spinRouletteHandler from "./api/spin-roulette";
import userCouponHandler from "./api/user-coupon";
import adminCouponsHandler from "./api/admin-coupons";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");
const indexHtmlPath = path.join(distDir, "index.html");

const app = express();
const port = Number(process.env.PORT || 4174);

type ApiHandler = (
  req: VercelRequest,
  res: VercelResponse
) => Promise<unknown> | unknown;

function adaptHandler(handler: ApiHandler) {
  return async (req: Request, res: Response) => {
    try {
      await handler(req as unknown as VercelRequest, res as unknown as VercelResponse);
    } catch (error) {
      console.error("API handler failed:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  };
}

app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.all("/api/auth/login", adaptHandler(authLoginHandler));
app.all("/api/auth/logout", adaptHandler(authLogoutHandler));
app.all("/api/auth/session", adaptHandler(authSessionHandler));
app.all("/api/auth/signup", adaptHandler(authSignupHandler));
app.all("/api/admin-orders", adaptHandler(adminOrdersHandler));
app.all("/api/admin-offers", adaptHandler(adminOffersHandler));
app.all("/api/admin-products", adaptHandler(adminProductsHandler));
app.all("/api/admin-theme", adaptHandler(adminThemeHandler));
app.all("/api/admin-featured", adaptHandler(adminFeaturedHandler));
app.all("/api/customer-orders", adaptHandler(customerOrdersHandler));
app.all("/api/customer-addresses", adaptHandler(customerAddressesHandler));
app.all("/api/delivery-ops", adaptHandler(deliveryOpsHandler));
app.all("/api/orders", adaptHandler(ordersHandler));
app.all("/api/reports-dashboard", adaptHandler(reportsDashboardHandler));
app.all("/api/coupon-slots", adaptHandler(couponSlotsHandler));
app.all("/api/spin-roulette", adaptHandler(spinRouletteHandler));
app.all("/api/user-coupon", adaptHandler(userCouponHandler));
app.all("/api/admin-coupons", adaptHandler(adminCouponsHandler));

app.use(express.static(distDir, { index: false, maxAge: "1h" }));

app.use((_req, res) => {
  res.sendFile(indexHtmlPath);
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Delivery GM listening on http://0.0.0.0:${port}`);
});
