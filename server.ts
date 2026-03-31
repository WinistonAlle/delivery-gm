import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import adminOrdersHandler from "./api/admin-orders";
import adminOffersHandler from "./api/admin-offers";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, "dist");
const indexHtmlPath = path.join(distDir, "index.html");

const app = express();
const port = Number(process.env.PORT || 4174);

app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/healthz", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.all("/api/auth/login", (req, res) => authLoginHandler(req as any, res as any));
app.all("/api/auth/logout", (req, res) => authLogoutHandler(req as any, res as any));
app.all("/api/auth/session", (req, res) => authSessionHandler(req as any, res as any));
app.all("/api/auth/signup", (req, res) => authSignupHandler(req as any, res as any));
app.all("/api/admin-orders", (req, res) => adminOrdersHandler(req as any, res as any));
app.all("/api/admin-offers", (req, res) => adminOffersHandler(req as any, res as any));
app.all("/api/admin-theme", (req, res) => adminThemeHandler(req as any, res as any));
app.all("/api/admin-featured", (req, res) => adminFeaturedHandler(req as any, res as any));
app.all("/api/customer-orders", (req, res) => customerOrdersHandler(req as any, res as any));
app.all("/api/customer-addresses", (req, res) => customerAddressesHandler(req as any, res as any));
app.all("/api/delivery-ops", (req, res) => deliveryOpsHandler(req as any, res as any));
app.all("/api/orders", (req, res) => ordersHandler(req as any, res as any));
app.all("/api/reports-dashboard", (req, res) => reportsDashboardHandler(req as any, res as any));

app.use(express.static(distDir, { index: false, maxAge: "1h" }));

app.use((_req, res) => {
  res.sendFile(indexHtmlPath);
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Delivery GM listening on http://0.0.0.0:${port}`);
});
