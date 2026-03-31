import { getSupabaseAdminClient } from "./supabaseAdmin";

export type ServerCustomerSession = {
  id: string;
  full_name: string;
  name: string;
  cpf: string;
  phone: string;
  document_cpf: string;
  cep: string;
  city: string;
  address: string;
  addresses: string[];
  saved_addresses: ServerCustomerAddress[];
  how_found_us: string;
  how_found_us_details: string;
  role: "admin" | "customer";
  is_admin: boolean;
};

export type ServerCustomerAddress = {
  id: string;
  address: string;
  city: string;
  cep: string;
  label: string;
  is_primary: boolean;
};

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeAdminPhone(value: unknown) {
  const digits = onlyDigits(value);
  if (digits.startsWith("55") && digits.length >= 12) {
    return digits.slice(2);
  }
  return digits;
}

function getServerAdminPhones() {
  const raw = process.env.ADMIN_PHONES || process.env.VITE_ADMIN_PHONES || "";
  return raw
    .split(",")
    .map((value) => normalizeAdminPhone(value))
    .filter((value) => value.length >= 10);
}

function isAdminPhone(phone: string) {
  return getServerAdminPhones().includes(normalizeAdminPhone(phone));
}

type DeliveryCustomerRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  document_cpf: string | null;
  primary_address: string | null;
  how_found_us: string | null;
  how_found_us_details: string | null;
};

type DeliveryCustomerAddressRow = {
  id: string;
  customer_id: string;
  cep: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  is_primary: boolean | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export async function getCustomerProfileByPhone(phone: string): Promise<ServerCustomerSession | null> {
  const normalizedPhone = onlyDigits(phone);
  if (!normalizedPhone) return null;

  const supabase = getSupabaseAdminClient();
  const { data: customer, error: customerError } = await supabase
    .from("delivery_customers")
    .select(
      "id, full_name, phone, document_cpf, primary_address, how_found_us, how_found_us_details"
    )
    .eq("phone", normalizedPhone)
    .maybeSingle<DeliveryCustomerRow>();

  if (customerError) throw customerError;
  if (!customer) return null;

  let primaryAddress: DeliveryCustomerAddressRow | null = null;
  const addressResult = await supabase
    .from("delivery_customer_addresses")
    .select("id, customer_id, cep, address_line, city, state, is_primary, updated_at, created_at, label")
    .eq("customer_id", customer.id)
    .order("is_primary", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(25);

  let savedAddresses: ServerCustomerAddress[] = [];
  if (!addressResult.error) {
    const rawAddresses = (addressResult.data ?? []) as Array<DeliveryCustomerAddressRow & { label?: string | null }>;
    primaryAddress = rawAddresses[0] ?? null;
    savedAddresses = rawAddresses
      .map((item) => ({
        id: String(item.id),
        address: String(item.address_line ?? "").trim(),
        city: String(item.city ?? "").trim(),
        cep: onlyDigits(item.cep),
        label: String(item.label ?? "").trim(),
        is_primary: Boolean(item.is_primary),
      }))
      .filter((item) => item.address);
  }

  const addressLine =
    String(primaryAddress?.address_line ?? "").trim() ||
    String(customer.primary_address ?? "").trim();
  const addressList = Array.from(
    new Set([addressLine, ...savedAddresses.map((item) => item.address)].filter(Boolean))
  );
  const role = isAdminPhone(normalizedPhone) ? "admin" : "customer";

  if (!savedAddresses.length && addressLine) {
    savedAddresses = [
      {
        id: "primary-address",
        address: addressLine,
        city: String(primaryAddress?.city ?? "").trim(),
        cep: onlyDigits(primaryAddress?.cep),
        label: "",
        is_primary: true,
      },
    ];
  }

  return {
    id: String(customer.id),
    full_name: String(customer.full_name ?? "").trim(),
    name: String(customer.full_name ?? "").trim(),
    cpf: normalizedPhone,
    phone: normalizedPhone,
    document_cpf: onlyDigits(customer.document_cpf),
    cep: onlyDigits(primaryAddress?.cep),
    city: String(primaryAddress?.city ?? "").trim(),
    address: addressLine,
    addresses: addressList,
    saved_addresses: savedAddresses,
    how_found_us: String(customer.how_found_us ?? "").trim(),
    how_found_us_details: String(customer.how_found_us_details ?? "").trim(),
    role,
    is_admin: role === "admin",
  };
}

type UpsertCustomerProfileParams = {
  fullName: string;
  phone: string;
  documentCpf?: string;
  cep?: string;
  address?: string;
  city?: string;
  howFoundUs?: string;
  howFoundUsDetails?: string;
};

export async function upsertCustomerProfile(params: UpsertCustomerProfileParams) {
  const fullName = String(params.fullName ?? "").trim();
  const phone = onlyDigits(params.phone);
  const documentCpf = onlyDigits(params.documentCpf);
  const cep = onlyDigits(params.cep).slice(0, 8);
  const address = String(params.address ?? "").trim();
  const city = String(params.city ?? "").trim();
  const howFoundUs = String(params.howFoundUs ?? "").trim();
  const howFoundUsDetails = String(params.howFoundUsDetails ?? "").trim();

  if (fullName.length < 3) throw new Error("Nome do cliente invalido.");
  if (phone.length < 10) throw new Error("Telefone do cliente invalido.");
  if (documentCpf.length !== 11) throw new Error("CPF do cliente invalido.");

  const supabase = getSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("delivery_customers")
    .select("id")
    .eq("phone", phone)
    .maybeSingle<{ id: string }>();

  if (existingError) throw existingError;

  let customerId = existing?.id ?? null;

  if (customerId) {
    const { error } = await supabase
      .from("delivery_customers")
      .update({
        full_name: fullName,
        document_cpf: documentCpf,
        primary_address: address || null,
        how_found_us: howFoundUs || null,
        how_found_us_details: howFoundUsDetails || null,
      })
      .eq("id", customerId);

    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from("delivery_customers")
      .insert({
        full_name: fullName,
        phone,
        document_cpf: documentCpf,
        primary_address: address || null,
        how_found_us: howFoundUs || null,
        how_found_us_details: howFoundUsDetails || null,
      })
      .select("id")
      .single<{ id: string }>();

    if (error || !data) throw error ?? new Error("Nao foi possivel criar o cliente.");
    customerId = data.id;
  }

  if (customerId && address) {
    const { data: primaryAddress, error: addressLookupError } = await supabase
      .from("delivery_customer_addresses")
      .select("id")
      .eq("customer_id", customerId)
      .eq("is_primary", true)
      .maybeSingle<{ id: string }>();

    if (addressLookupError) throw addressLookupError;

    if (primaryAddress?.id) {
      const { error } = await supabase
        .from("delivery_customer_addresses")
        .update({
          address_line: address,
          cep: cep || null,
          city: city || null,
          is_primary: true,
        })
        .eq("id", primaryAddress.id);

      if (error) throw error;
    } else {
      const { error } = await supabase.from("delivery_customer_addresses").insert({
        customer_id: customerId,
        address_line: address,
        cep: cep || null,
        city: city || null,
        is_primary: true,
      });

      if (error) throw error;
    }
  }

  const session = await getCustomerProfileByPhone(phone);
  if (!session) throw new Error("Nao foi possivel carregar o perfil do cliente.");
  return session;
}

type AddCustomerAddressParams = {
  phone: string;
  address: string;
  city?: string;
  cep?: string;
  label?: string;
  setPrimary?: boolean;
};

export async function addCustomerAddress(params: AddCustomerAddressParams) {
  const phone = onlyDigits(params.phone);
  const address = String(params.address ?? "").trim();
  const city = String(params.city ?? "").trim();
  const cep = onlyDigits(params.cep).slice(0, 8);
  const label = String(params.label ?? "").trim();
  const setPrimary = Boolean(params.setPrimary);

  if (phone.length < 10) throw new Error("Telefone do cliente invalido.");
  if (address.length < 6) throw new Error("Endereco invalido.");
  if (city.length < 2) throw new Error("Cidade invalida.");

  const supabase = getSupabaseAdminClient();
  const { data: customer, error: customerError } = await supabase
    .from("delivery_customers")
    .select("id")
    .eq("phone", phone)
    .maybeSingle<{ id: string }>();

  if (customerError) throw customerError;
  if (!customer?.id) throw new Error("Cliente nao encontrado.");

  const { data: existingAddresses, error: lookupError } = await supabase
    .from("delivery_customer_addresses")
    .select("id, address_line, city")
    .eq("customer_id", customer.id)
    .order("is_primary", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(25);

  if (lookupError) throw lookupError;

  const normalizedAddress = address.toLowerCase();
  const normalizedCity = city.toLowerCase();
  const duplicate = (existingAddresses ?? []).find((item) => {
    const itemAddress = String(item.address_line ?? "").trim().toLowerCase();
    const itemCity = String(item.city ?? "").trim().toLowerCase();
    return itemAddress === normalizedAddress && itemCity === normalizedCity;
  });

  if (duplicate?.id) {
    if (setPrimary) {
      await supabase
        .from("delivery_customer_addresses")
        .update({ is_primary: false })
        .eq("customer_id", customer.id);

      await supabase
        .from("delivery_customer_addresses")
        .update({ is_primary: true })
        .eq("id", duplicate.id);

      await supabase
        .from("delivery_customers")
        .update({ primary_address: address })
        .eq("id", customer.id);
    }

    const session = await getCustomerProfileByPhone(phone);
    if (!session) throw new Error("Nao foi possivel carregar os enderecos do cliente.");
    return session;
  }

  if (setPrimary) {
    const { error: clearPrimaryError } = await supabase
      .from("delivery_customer_addresses")
      .update({ is_primary: false })
      .eq("customer_id", customer.id);

    if (clearPrimaryError) throw clearPrimaryError;
  }

  const { error: insertError } = await supabase.from("delivery_customer_addresses").insert({
    customer_id: customer.id,
    address_line: address,
    city: city || null,
    cep: cep || null,
    label: label || null,
    is_primary: setPrimary,
  });

  if (insertError) throw insertError;

  if (setPrimary) {
    const { error: customerUpdateError } = await supabase
      .from("delivery_customers")
      .update({ primary_address: address })
      .eq("id", customer.id);

    if (customerUpdateError) throw customerUpdateError;
  }

  const session = await getCustomerProfileByPhone(phone);
  if (!session) throw new Error("Nao foi possivel carregar os enderecos do cliente.");
  return session;
}
