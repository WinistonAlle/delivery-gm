export type CustomerRecord = {
  id: string;
  full_name: string;
  phone: string;
  document_cpf: string;
  cep?: string;
  address: string;
  addresses?: string[];
  how_found_us: string;
  how_found_us_details?: string;
  created_at: string;
};

export type CustomerSession = {
  id: string;
  full_name: string;
  name: string;
  cpf: string;
  phone: string;
  document_cpf: string;
  cep: string;
  address: string;
  addresses: string[];
  how_found_us: string;
  how_found_us_details: string;
  role: "admin" | "customer";
  is_admin: boolean;
};

const CUSTOMERS_KEY = "gm_customers_v1";
export const CUSTOMER_SESSION_KEY = "customer_session";
export const LEGACY_SESSION_KEY = "employee_session";
export const CUSTOMER_SESSION_EVENT = "gm:customer-session-changed";
const ADMIN_PHONES_KEY = "gm_admin_phones_v1";

export const normalizePhone = (value: string) => value.replace(/\D/g, "");
export const normalizeCpf = (value: string) => value.replace(/\D/g, "").slice(0, 11);

function readEnvAdminPhones(): string[] {
  try {
    const raw = import.meta.env.VITE_ADMIN_PHONES;
    if (!raw || typeof raw !== "string") return [];
    return raw
      .split(",")
      .map((p: string) => normalizePhone(p))
      .filter((p: string) => p.length >= 10);
  } catch {
    return [];
  }
}

export function getAdminPhones(): string[] {
  try {
    const raw = localStorage.getItem(ADMIN_PHONES_KEY);
    const local = raw ? (JSON.parse(raw) as string[]) : [];
    const normalizedLocal = Array.isArray(local)
      ? local.map((p) => normalizePhone(String(p))).filter((p) => p.length >= 10)
      : [];
    const merged = Array.from(new Set([...normalizedLocal, ...readEnvAdminPhones()]));
    return merged;
  } catch {
    return readEnvAdminPhones();
  }
}

export function saveAdminPhones(phones: string[]) {
  const normalized = Array.from(
    new Set(
      (phones ?? [])
        .map((p) => normalizePhone(String(p)))
        .filter((p) => p.length >= 10)
    )
  );
  localStorage.setItem(ADMIN_PHONES_KEY, JSON.stringify(normalized));
}

export function addAdminPhone(phone: string) {
  const normalized = normalizePhone(phone);
  if (normalized.length < 10) return;
  const current = getAdminPhones();
  if (current.includes(normalized)) return;
  saveAdminPhones([...current, normalized]);
}

export function removeAdminPhone(phone: string) {
  const normalized = normalizePhone(phone);
  if (normalized.length < 10) return;
  const current = getAdminPhones();
  saveAdminPhones(current.filter((p) => p !== normalized));
}

export function isAdminPhone(phone: string) {
  const normalized = normalizePhone(phone);
  if (!normalized) return false;
  return getAdminPhones().includes(normalized);
}

export function getCustomers(): CustomerRecord[] {
  try {
    const raw = localStorage.getItem(CUSTOMERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => {
      const phone = normalizePhone(String(item?.phone ?? ""));
      const legacyCpf = normalizeCpf(String(item?.cpf ?? ""));
      return {
        id: String(item?.id ?? `customer-${phone || Date.now()}`),
        full_name: String(item?.full_name ?? ""),
        phone,
        document_cpf: normalizeCpf(String(item?.document_cpf ?? legacyCpf)),
        cep: String(item?.cep ?? "").replace(/\D/g, "").slice(0, 8),
        address: String(item?.address ?? ""),
        addresses: Array.isArray(item?.addresses)
          ? item.addresses.map((address) => String(address)).filter(Boolean)
          : undefined,
        how_found_us: String(item?.how_found_us ?? ""),
        how_found_us_details: String(item?.how_found_us_details ?? ""),
        created_at: String(item?.created_at ?? new Date().toISOString()),
      } satisfies CustomerRecord;
    });
  } catch {
    return [];
  }
}

export function saveCustomers(customers: CustomerRecord[]) {
  localStorage.setItem(CUSTOMERS_KEY, JSON.stringify(customers));
}

function dispatchCustomerSessionChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CUSTOMER_SESSION_EVENT));
}

export function normalizeRedirectPath(value: unknown, fallback = "/catalogo") {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  if (!normalized.startsWith("/")) return fallback;
  if (normalized.startsWith("//")) return fallback;
  return normalized;
}

function persistCustomerSession(session: CustomerSession) {
  localStorage.setItem(CUSTOMER_SESSION_KEY, JSON.stringify(session));
  localStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify(session));
  dispatchCustomerSessionChanged();
}

export function findCustomerByPhone(phone: string): CustomerRecord | null {
  const clean = normalizePhone(phone);
  if (!clean) return null;
  const customers = getCustomers();
  return customers.find((c) => normalizePhone(c.phone) === clean) ?? null;
}

export function upsertCustomer(record: Omit<CustomerRecord, "id" | "created_at">) {
  const phone = normalizePhone(record.phone);
  const documentCpf = normalizeCpf(record.document_cpf);
  const cep = String(record.cep ?? "").replace(/\D/g, "").slice(0, 8);
  const customers = getCustomers();
  const existing = customers.find((c) => normalizePhone(c.phone) === phone);

  if (existing) {
    const baseAddresses = Array.isArray(existing.addresses)
      ? existing.addresses.filter(Boolean)
      : [existing.address].filter(Boolean);
    const dedup = Array.from(new Set([...baseAddresses, record.address.trim()]));
    const updated: CustomerRecord = {
      ...existing,
      full_name: record.full_name.trim(),
      address: record.address.trim(),
      phone,
      document_cpf: documentCpf,
      cep,
      addresses: dedup,
      how_found_us: record.how_found_us.trim(),
      how_found_us_details: record.how_found_us_details?.trim() ?? "",
    };
    saveCustomers(customers.map((c) => (c.id === existing.id ? updated : c)));
    return updated;
  }

  const created: CustomerRecord = {
    id: `customer-${phone || Date.now()}`,
    full_name: record.full_name.trim(),
    phone,
    document_cpf: documentCpf,
    cep,
    address: record.address.trim(),
    addresses: [record.address.trim()],
    how_found_us: record.how_found_us.trim(),
    how_found_us_details: record.how_found_us_details?.trim() ?? "",
    created_at: new Date().toISOString(),
  };

  saveCustomers([...customers, created]);
  return created;
}

export function createCustomerSession(customer: CustomerRecord) {
  const cleanPhone = normalizePhone(customer.phone);
  const isAdmin = isAdminPhone(cleanPhone);
  const session: CustomerSession = {
    id: customer.id,
    full_name: customer.full_name,
    name: customer.full_name,
    cpf: cleanPhone,
    phone: cleanPhone,
    document_cpf: customer.document_cpf,
    cep: customer.cep ?? "",
    address: customer.address,
    addresses: customer.addresses ?? [customer.address],
    how_found_us: customer.how_found_us,
    how_found_us_details: customer.how_found_us_details ?? "",
    role: isAdmin ? "admin" : "customer",
    is_admin: isAdmin,
  };

  // Mantemos a chave legada por compatibilidade durante a transição.
  persistCustomerSession(session);
  return session;
}

export function saveCustomerSession(session: CustomerSession) {
  persistCustomerSession(session);
}

export function getCustomerSession(): CustomerSession | null {
  try {
    const raw =
      localStorage.getItem(CUSTOMER_SESSION_KEY) ??
      localStorage.getItem(LEGACY_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CustomerSession>;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.role || (!parsed.phone && !parsed.cpf)) return null;
    return {
      id: String(parsed.id ?? ""),
      full_name: String(parsed.full_name ?? parsed.name ?? ""),
      name: String(parsed.name ?? parsed.full_name ?? ""),
      cpf: normalizePhone(String(parsed.cpf ?? parsed.phone ?? "")),
      phone: normalizePhone(String(parsed.phone ?? parsed.cpf ?? "")),
      document_cpf: normalizeCpf(String(parsed.document_cpf ?? "")),
      cep: String(parsed.cep ?? "").replace(/\D/g, "").slice(0, 8),
      address: String(parsed.address ?? ""),
      addresses: Array.isArray(parsed.addresses)
        ? parsed.addresses.map((address) => String(address)).filter(Boolean)
        : [String(parsed.address ?? "")].filter(Boolean),
      how_found_us: String(parsed.how_found_us ?? ""),
      how_found_us_details: String(parsed.how_found_us_details ?? ""),
      role: parsed.role === "admin" ? "admin" : "customer",
      is_admin: Boolean(parsed.is_admin ?? parsed.role === "admin"),
    };
  } catch {
    return null;
  }
}

export function clearCustomerSession() {
  localStorage.removeItem(CUSTOMER_SESSION_KEY);
  localStorage.removeItem(LEGACY_SESSION_KEY);
  dispatchCustomerSessionChanged();
}
