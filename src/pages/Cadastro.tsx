import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import logo from "../images/logop.jpg";
import {
  createCustomerSession,
  normalizeCpf,
  normalizePhone,
  upsertCustomer,
} from "@/lib/customerAuth";
import { trackCustomerEvent } from "@/lib/customerInsights";
import { createFullAddress, fetchAddressFromCEP, formatCEP, formatCPF } from "@/utils/formatUtils";

const maskPhone = (value: string) => {
  const d = normalizePhone(value).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const Cadastro: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const prefilledPhone =
    location.state && typeof (location.state as { prefilledPhone?: unknown }).prefilledPhone === "string"
      ? normalizePhone((location.state as { prefilledPhone?: string }).prefilledPhone ?? "")
      : "";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(prefilledPhone);
  const [cpf, setCpf] = useState("");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [howFoundUs, setHowFoundUs] = useState("");
  const [howFoundUsDetails, setHowFoundUsDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [error, setError] = useState("");
  const numberInputRef = useRef<HTMLInputElement | null>(null);
  const lastFetchedCepRef = useRef("");

  const requiresDetails = howFoundUs === "Outro";
  const fullAddress = useMemo(
    () => createFullAddress(street.trim(), number.trim(), complement.trim(), district.trim(), city.trim(), state.trim()),
    [street, number, complement, district, city, state]
  );

  const canSubmit = useMemo(() => {
    return (
      name.trim().length >= 3 &&
      normalizePhone(phone).length >= 10 &&
      normalizeCpf(cpf).length === 11 &&
      street.trim().length >= 3 &&
      number.trim().length >= 1 &&
      district.trim().length >= 2 &&
      city.trim().length >= 2 &&
      state.trim().length === 2 &&
      howFoundUs.trim().length > 0 &&
      (!requiresDetails || howFoundUsDetails.trim().length >= 3)
    );
  }, [name, phone, cpf, street, number, district, city, state, howFoundUs, howFoundUsDetails, requiresDetails]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("Preencha nome, telefone, CPF, endereço completo e como conheceu a gente.");
      return;
    }

    setSubmitting(true);

    try {
      const customer = upsertCustomer({
        full_name: name,
        phone,
        document_cpf: cpf,
        address: fullAddress,
        how_found_us: howFoundUs,
        how_found_us_details: requiresDetails ? howFoundUsDetails : "",
      });

      createCustomerSession(customer);
      void trackCustomerEvent({
        eventName: "signup_completed",
        customerName: customer.full_name,
        phone: customer.phone,
        documentCpf: customer.document_cpf,
        metadata: {
          howFoundUs,
          howFoundUsDetails: requiresDetails ? howFoundUsDetails.trim() : "",
        },
      });
      navigate("/catalogo", { replace: true });
    } catch (err: any) {
      setError(err?.message || "Não foi possível concluir seu cadastro.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClassName =
    "w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-[15px] outline-none transition focus:border-red-300 focus:ring-2 focus:ring-red-200";
  const labelClassName = "mb-1 block text-sm font-medium text-gray-700";

  const fetchCepAndFill = async (rawCep: string, focusNumberField = false) => {
    const normalizedCep = rawCep.replace(/\D/g, "");
    if (normalizedCep.length !== 8 || loadingCep) return;

    setError("");
    setLoadingCep(true);

    try {
      const data = await fetchAddressFromCEP(normalizedCep);
      if (data?.erro) {
        setError("CEP não encontrado.");
        return;
      }

      lastFetchedCepRef.current = normalizedCep;
      setStreet(data.logradouro || "");
      setDistrict(data.bairro || "");
      setCity(data.localidade || "");
      setState((data.uf || "").toUpperCase());

      if (focusNumberField) {
        window.setTimeout(() => {
          numberInputRef.current?.focus();
        }, 0);
      }
    } catch {
      setError("Não foi possível validar o CEP.");
    } finally {
      setLoadingCep(false);
    }
  };

  useEffect(() => {
    const normalizedCep = cep.replace(/\D/g, "");
    if (normalizedCep.length !== 8) {
      if (lastFetchedCepRef.current !== normalizedCep) {
        lastFetchedCepRef.current = "";
      }
      return;
    }
    if (lastFetchedCepRef.current === normalizedCep) return;

    void fetchCepAndFill(normalizedCep, true);
  }, [cep]);

  return (
    <div className="min-h-screen bg-[linear-gradient(160deg,#7f1d1d_0%,#b91c1c_48%,#fee2e2_100%)] px-3 py-3 sm:px-4 sm:py-4">
      <div className="mx-auto w-full max-w-5xl rounded-[28px] border border-red-100 bg-white p-4 shadow-2xl sm:p-5 lg:p-6">
        <div className="mb-4 flex items-center gap-4 border-b border-gray-100 pb-4">
          <img src={logo} alt="Gostinho Mineiro" className="h-12 w-auto sm:h-14" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Cadastro</h2>
            <p className="text-sm text-gray-600">Preencha os dados para entrar no delivery.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3.5">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Dados pessoais</h3>
              </div>
              <div className="grid gap-3">
                <div>
                  <label className={labelClassName}>Nome completo</label>
                  <input
                    className={inputClassName}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    disabled={submitting}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClassName}>Telefone</label>
                    <input
                      className={inputClassName}
                      value={maskPhone(phone)}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      inputMode="numeric"
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label className={labelClassName}>CPF</label>
                    <input
                      className={inputClassName}
                      value={formatCPF(cpf)}
                      onChange={(e) => setCpf(e.target.value)}
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClassName}>Como conheceu a gente?</label>
                  <select
                    className={inputClassName}
                    value={howFoundUs}
                    onChange={(e) => {
                      setHowFoundUs(e.target.value);
                      if (e.target.value !== "Outro") setHowFoundUsDetails("");
                    }}
                    disabled={submitting}
                  >
                    <option value="">Selecione uma opção</option>
                    <option value="Instagram">Instagram</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Indicacao">Indicação</option>
                    <option value="Google">Google</option>
                    <option value="Passando na regiao">Passando na região</option>
                    <option value="Outro">Outro</option>
                  </select>
                </div>

                {requiresDetails ? (
                  <div>
                    <label className={labelClassName}>Detalhe</label>
                    <input
                      className={inputClassName}
                      value={howFoundUsDetails}
                      onChange={(e) => setHowFoundUsDetails(e.target.value)}
                      placeholder="Ex.: indicação de um amigo"
                      disabled={submitting}
                    />
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3.5">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Endereço</h3>
              </div>

              <div className="grid gap-3">
                <div>
                  <label className={labelClassName}>CEP</label>
                  <input
                    className={inputClassName}
                    value={formatCEP(cep)}
                    onChange={(e) => setCep(e.target.value)}
                    placeholder="00000-000"
                    inputMode="numeric"
                    disabled={submitting}
                  />
                </div>

                <div>
                  <label className={labelClassName}>Rua / logradouro</label>
                  <input
                    className={inputClassName}
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Rua / logradouro"
                    disabled={submitting}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClassName}>Número</label>
                    <input
                      ref={numberInputRef}
                      className={inputClassName}
                      value={number}
                      onChange={(e) => setNumber(e.target.value)}
                      placeholder="Número"
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label className={labelClassName}>Complemento</label>
                    <input
                      className={inputClassName}
                      value={complement}
                      onChange={(e) => setComplement(e.target.value)}
                      placeholder="Complemento"
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClassName}>Bairro</label>
                  <input
                    className={inputClassName}
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    placeholder="Bairro"
                    disabled={submitting}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-[1fr_88px]">
                  <div>
                    <label className={labelClassName}>Cidade</label>
                    <input
                      className={inputClassName}
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Cidade"
                      disabled={submitting}
                    />
                  </div>

                  <div>
                    <label className={labelClassName}>UF</label>
                    <input
                      className={`${inputClassName} uppercase`}
                      value={state}
                      onChange={(e) => setState(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))}
                      placeholder="UF"
                      disabled={submitting}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClassName}>Resumo do endereço</label>
                  <textarea
                    className="min-h-20 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-600 outline-none"
                    value={fullAddress}
                    readOnly
                    placeholder="O endereço completo aparece aqui."
                    disabled={submitting}
                  />
                </div>
              </div>
            </div>
          </div>

          {error ? <p className="rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="submit"
              className="w-full rounded-xl bg-red-600 px-4 py-2.5 font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? "Cadastrando..." : "Cadastrar"}
            </button>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full rounded-xl border border-gray-300 px-4 py-2.5 font-semibold text-gray-800 transition hover:bg-gray-50"
            >
              Já tenho conta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Cadastro;
