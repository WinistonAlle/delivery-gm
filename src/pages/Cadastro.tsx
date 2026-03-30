import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Bg, Card } from "../components/ui/app-surface";
import logo from "../images/logop.jpg";
import {
  createCustomerSession,
  normalizeCpf,
  normalizeRedirectPath,
  normalizePhone,
  upsertCustomer,
} from "@/lib/customerAuth";
import { trackCustomerEvent } from "@/lib/customerInsights";
import { createFullAddress, fetchAddressFromCEP, formatCEP, formatCPF } from "@/utils/formatUtils";

const Screen = styled(Bg)`
  min-height: 100dvh;
  width: 100%;
  overflow-y: auto;
  padding: calc(env(safe-area-inset-top) + 24px) 16px calc(env(safe-area-inset-bottom) + 24px);
  display: flex;
  align-items: flex-start;
  justify-content: center;

  @media (max-width: 640px) {
    padding: calc(env(safe-area-inset-top) + 72px) 10px calc(env(safe-area-inset-bottom) + 18px);
  }
`;

const BackButton = styled.button`
  position: fixed;
  top: calc(16px + env(safe-area-inset-top));
  left: 16px;
  z-index: 3;
  width: 46px;
  height: 46px;
  border: 0;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
  cursor: pointer;
  transition: transform 0.18s ease, background 0.18s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.22);
  }

  &:active {
    transform: scale(0.96);
  }
`;

const StyledCard = styled(Card)`
  position: relative;
  z-index: 1;
  width: min(980px, calc(100% - 32px));
  max-width: min(980px, calc(100% - 32px));
  margin-top: max(32px, env(safe-area-inset-top));
  padding: 30px 24px 24px;
  border-radius: 30px;
  box-sizing: border-box;
  background: linear-gradient(180deg, #fffaf8 0%, #ffffff 100%);
  box-shadow: 0 24px 64px rgba(91, 14, 14, 0.25);

  @media (max-width: 640px) {
    width: 100%;
    max-width: 100%;
    margin-top: 0;
    padding: 22px 14px 16px;
    border-radius: 26px;
  }
`;

const LogoWrapper = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 18px;
`;

const LogoImg = styled.img`
  width: 120px;
  height: auto;
  user-select: none;
`;

const Title = styled.h1`
  margin: 0 0 10px;
  text-align: center;
  font-size: clamp(1.9rem, 3vw, 2.2rem);
  line-height: 1.05;
  color: #221717;
`;

const Subtitle = styled.p`
  margin: 0 0 22px;
  text-align: center;
  font-size: 0.98rem;
  line-height: 1.5;
  color: #6e5b5b;
`;

const Form = styled.form`
  display: grid;
  gap: 18px;
`;

const SectionsGrid = styled.div`
  display: grid;
  gap: 16px;

  @media (min-width: 760px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const SectionCard = styled.section`
  padding: 18px;
  border-radius: 24px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, #f8ece9 100%);
  border: 1px solid rgba(125, 23, 23, 0.1);
  box-shadow: 0 16px 30px rgba(125, 23, 23, 0.08);

  @media (max-width: 640px) {
    padding: 14px;
    border-radius: 20px;
  }
`;

const SectionTitle = styled.h2`
  margin: 0 0 14px;
  font-size: 1rem;
  font-weight: 700;
  color: #3f2b2b;
`;

const Fields = styled.div`
  display: grid;
  gap: 14px;

  @media (max-width: 640px) {
    gap: 12px;
  }
`;

const TwoColumns = styled.div`
  display: grid;
  gap: 14px;

  @media (min-width: 640px) {
    grid-template-columns: 1fr 1fr;
  }
`;

const CityRow = styled.div`
  display: grid;
  gap: 14px;

  @media (min-width: 640px) {
    grid-template-columns: minmax(0, 1fr) 88px;
  }
`;

const Field = styled.div`
  display: grid;
  gap: 10px;
`;

const Label = styled.label`
  font-size: 0.92rem;
  font-weight: 600;
  color: #4b3636;
`;

const InputShell = styled.div`
  padding: 8px;
  border-radius: 28px;
  background: linear-gradient(180deg, #fff 0%, #f8ece9 100%);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.95),
    0 16px 30px rgba(125, 23, 23, 0.08);

  @media (max-width: 640px) {
    padding: 6px;
    border-radius: 22px;
  }
`;

const inputBase = `
  width: 100%;
  border: none;
  outline: none;
  background: #f5f1f0;
  color: #553c3c;
  font-size: 1rem;
  border-radius: 22px;
  padding: 16px 18px;
  box-shadow: inset 8px 8px 16px #ddd4d2, inset -8px -8px 16px #ffffff;
  transition: box-shadow 0.18s ease, transform 0.18s ease;

  &::placeholder {
    color: #9d8d8d;
  }

  &:focus {
    box-shadow: inset 8px 8px 16px #ddd4d2, inset -8px -8px 16px #ffffff,
      0 0 0 3px rgba(184, 38, 38, 0.16);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  @media (max-width: 640px) {
    font-size: 16px;
    border-radius: 18px;
    padding: 14px 14px;
  }
`;

const TextInput = styled.input`
  ${inputBase}
`;

const SelectInput = styled.select`
  ${inputBase}
  appearance: none;
`;

const TextArea = styled.textarea`
  ${inputBase}
  min-height: 120px;
  resize: vertical;
`;

const ErrorMsg = styled.p`
  margin: 0;
  font-size: 0.92rem;
  font-weight: 600;
  color: #b82626;
  text-align: center;
`;

const HelperText = styled.p`
  margin: 0;
  font-size: 0.8rem;
  color: #8a7171;
`;

const ButtonRow = styled.div`
  display: grid;
  gap: 12px;

  @media (min-width: 640px) {
    grid-template-columns: 1fr 1fr;
  }

  @media (max-width: 640px) {
    gap: 10px;
  }
`;

const Button = styled.button`
  height: 50px;
  border: 0;
  border-radius: 16px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const PrimaryButton = styled(Button)`
  color: #fff;
  background: linear-gradient(135deg, #b82626, #7d1717);
  box-shadow: 0 16px 28px rgba(125, 23, 23, 0.28);

  &:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 20px 32px rgba(125, 23, 23, 0.34);
  }
`;

const SecondaryButton = styled(Button)`
  color: #5d4444;
  background: linear-gradient(180deg, #fff 0%, #f6efee 100%);
  border: 1px solid rgba(125, 23, 23, 0.12);
  box-shadow: 0 12px 24px rgba(70, 35, 35, 0.08);

  &:hover:not(:disabled) {
    transform: translateY(-1px);
  }
`;

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
  const redirectTo = normalizeRedirectPath(
    (location.state as { redirectTo?: unknown } | null)?.redirectTo
  );
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
      !/\d/.test(name) &&
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

  useEffect(() => {
    const prev = {
      htmlBg: document.documentElement.style.background,
      bodyBg: document.body.style.background,
    };

    document.documentElement.style.background = "#a41616";
    document.body.style.background = "#a41616";

    return () => {
      document.documentElement.style.background = prev.htmlBg;
      document.body.style.background = prev.bodyBg;
    };
  }, []);

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
        cep,
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
      navigate(redirectTo, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir seu cadastro.");
    } finally {
      setSubmitting(false);
    }
  };

  const fetchCepAndFill = useCallback(async (rawCep: string, focusNumberField = false) => {
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
  }, [loadingCep]);

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
  }, [cep, fetchCepAndFill]);

  return (
    <Screen>
      <BackButton
        type="button"
        aria-label="Voltar"
        onClick={() => navigate("/login", { state: { redirectTo, prefilledPhone: normalizePhone(phone) } })}
      >
        <ArrowLeft size={20} />
      </BackButton>

      <StyledCard>
        <LogoWrapper>
          <LogoImg
            src={logo}
            alt="Gostinho Mineiro"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/fallback_logo.png";
            }}
          />
        </LogoWrapper>

        <Title>Criar sua conta</Title>
        <Subtitle>
          Preencha seus dados para continuar no delivery com o mesmo visual do acesso.
        </Subtitle>

        <Form onSubmit={handleSubmit} noValidate>
          <SectionsGrid>
            <SectionCard>
              <SectionTitle>Dados pessoais</SectionTitle>
              <Fields>
                <Field>
                  <Label htmlFor="name">Nome completo</Label>
                  <InputShell>
                    <TextInput
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value.replace(/\d/g, ""))}
                      placeholder="Seu nome"
                      autoComplete="name"
                      disabled={submitting}
                    />
                  </InputShell>
                </Field>

                <TwoColumns>
                  <Field>
                    <Label htmlFor="phone">Telefone</Label>
                    <InputShell>
                      <TextInput
                        id="phone"
                        value={maskPhone(phone)}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(00) 00000-0000"
                        inputMode="numeric"
                        autoComplete="tel"
                        disabled={submitting}
                      />
                    </InputShell>
                  </Field>

                  <Field>
                    <Label htmlFor="cpf">CPF</Label>
                    <InputShell>
                      <TextInput
                        id="cpf"
                        value={formatCPF(cpf)}
                        onChange={(e) => setCpf(e.target.value)}
                        placeholder="000.000.000-00"
                        inputMode="numeric"
                        disabled={submitting}
                      />
                    </InputShell>
                  </Field>
                </TwoColumns>

                <Field>
                  <Label htmlFor="howFoundUs">Como conheceu a gente?</Label>
                  <InputShell>
                    <SelectInput
                      id="howFoundUs"
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
                    </SelectInput>
                  </InputShell>
                </Field>

                {requiresDetails ? (
                  <Field>
                    <Label htmlFor="howFoundUsDetails">Detalhe</Label>
                    <InputShell>
                      <TextInput
                        id="howFoundUsDetails"
                        value={howFoundUsDetails}
                        onChange={(e) => setHowFoundUsDetails(e.target.value)}
                        placeholder="Ex.: indicação de um amigo"
                        disabled={submitting}
                      />
                    </InputShell>
                  </Field>
                ) : null}
              </Fields>
            </SectionCard>

            <SectionCard>
              <SectionTitle>Endereço</SectionTitle>
              <Fields>
                <Field>
                  <Label htmlFor="cep">CEP</Label>
                  <InputShell>
                    <TextInput
                      id="cep"
                      value={formatCEP(cep)}
                      onChange={(e) => setCep(e.target.value)}
                      placeholder="00000-000"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      disabled={submitting}
                    />
                  </InputShell>
                  {loadingCep ? <HelperText>Buscando endereço pelo CEP...</HelperText> : null}
                </Field>

                <Field>
                  <Label htmlFor="street">Rua / logradouro</Label>
                  <InputShell>
                    <TextInput
                      id="street"
                      value={street}
                      onChange={(e) => setStreet(e.target.value)}
                      placeholder="Rua / logradouro"
                      autoComplete="address-line1"
                      disabled={submitting}
                    />
                  </InputShell>
                </Field>

                <TwoColumns>
                  <Field>
                    <Label htmlFor="number">Número</Label>
                    <InputShell>
                      <TextInput
                        ref={numberInputRef}
                        id="number"
                        value={number}
                        onChange={(e) => setNumber(e.target.value)}
                        placeholder="Número"
                        autoComplete="address-line2"
                        disabled={submitting}
                      />
                    </InputShell>
                  </Field>

                  <Field>
                    <Label htmlFor="complement">Complemento</Label>
                    <InputShell>
                      <TextInput
                        id="complement"
                        value={complement}
                        onChange={(e) => setComplement(e.target.value)}
                        placeholder="Complemento"
                        disabled={submitting}
                      />
                    </InputShell>
                  </Field>
                </TwoColumns>

                <Field>
                  <Label htmlFor="district">Bairro</Label>
                  <InputShell>
                    <TextInput
                      id="district"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      placeholder="Bairro"
                      autoComplete="address-level3"
                      disabled={submitting}
                    />
                  </InputShell>
                </Field>

                <CityRow>
                  <Field>
                    <Label htmlFor="city">Cidade</Label>
                    <InputShell>
                      <TextInput
                        id="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Cidade"
                        autoComplete="address-level2"
                        disabled={submitting}
                      />
                    </InputShell>
                  </Field>

                  <Field>
                    <Label htmlFor="state">UF</Label>
                    <InputShell>
                      <TextInput
                        id="state"
                        value={state}
                        onChange={(e) => setState(e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2))}
                        placeholder="UF"
                        maxLength={2}
                        disabled={submitting}
                      />
                    </InputShell>
                  </Field>
                </CityRow>

                <Field>
                  <Label htmlFor="addressSummary">Resumo do endereço</Label>
                  <InputShell>
                    <TextArea
                      id="addressSummary"
                      value={fullAddress}
                      readOnly
                      placeholder="O endereço completo aparece aqui."
                      disabled={submitting}
                    />
                  </InputShell>
                </Field>
              </Fields>
            </SectionCard>
          </SectionsGrid>

          {error ? <ErrorMsg>{error}</ErrorMsg> : null}

          <ButtonRow>
            <PrimaryButton type="submit" disabled={submitting}>
              {submitting ? "Cadastrando..." : "Cadastrar"}
            </PrimaryButton>
            <SecondaryButton
              type="button"
              onClick={() => navigate("/login", { state: { redirectTo, prefilledPhone: normalizePhone(phone) } })}
              disabled={submitting}
            >
              Já tenho conta
            </SecondaryButton>
          </ButtonRow>
        </Form>
      </StyledCard>
    </Screen>
  );
};

export default Cadastro;
