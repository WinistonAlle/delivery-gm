export type CustomerRecord = {
  id: string;
  full_name: string;
  phone: string;
  document_cpf: string;
  address: string;
  addresses?: string[];
  how_found_us: string;
  how_found_us_details?: string;
  created_at: string;
};

const CUSTOMERS_KEY = "gm_customers_v1";
const SESSION_KEY = "employee_session";
const ADMIN_PHONES_KEY = "gm_admin_phones_v1";

export const normalizePhone = (value: string) => value.replace(/\D/g, "");
export const normalizeCpf = (value: string) => value.replace(/\D/g, "").slice(0, 11);

function readEnvAdminPhones(): string[] {
  try {
    const raw = (import.meta as any)?.env?.VITE_ADMIN_PHONES;
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

export function findCustomerByPhone(phone: string): CustomerRecord | null {
  const clean = normalizePhone(phone);
  if (!clean) return null;
  const customers = getCustomers();
  return customers.find((c) => normalizePhone(c.phone) === clean) ?? null;
}

export function upsertCustomer(record: Omit<CustomerRecord, "id" | "created_at">) {
  const phone = normalizePhone(record.phone);
  const documentCpf = normalizeCpf(record.document_cpf);
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
  const admins = getAdminPhones();

  // Bootstrap: se ainda não existe admin, promove o primeiro login automaticamente.
  if (admins.length === 0 && cleanPhone.length >= 10) {
    addAdminPhone(cleanPhone);
  }

  const isAdmin = isAdminPhone(cleanPhone);
  const session = {
    id: customer.id,
    full_name: customer.full_name,
    name: customer.full_name,
    cpf: cleanPhone,
    phone: cleanPhone,
    document_cpf: customer.document_cpf,
    address: customer.address,
    addresses: customer.addresses ?? [customer.address],
    how_found_us: customer.how_found_us,
    how_found_us_details: customer.how_found_us_details ?? "",
    role: isAdmin ? "admin" : "customer",
    is_admin: isAdmin,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export function getCustomerSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
