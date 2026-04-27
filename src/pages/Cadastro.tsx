import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styled from "styled-components";
import { useBeforeUnload, useLocation, useNavigate } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ChevronRight } from "lucide-react";
import { Bg, Card } from "../components/ui/app-surface";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import logo from "../images/logop.jpg";
import {
  normalizeCpf,
  normalizeRedirectPath,
  normalizePhone,
  signupCustomer,
} from "@/lib/customerAuth";
import { trackCustomerEvent } from "@/lib/customerInsights";
import { SHIPPING_RATES } from "@/data/shipping";
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
  align-items: start;

  @media (min-width: 640px) {
    grid-template-columns: minmax(0, 1fr) 96px;
  }
`;

const Field = styled.div`
  display: grid;
  gap: 10px;
  min-width: 0;
`;

const UfField = styled(Field)`
  width: 100%;

  @media (min-width: 640px) {
    max-width: 96px;
    justify-self: end;
  }
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
  box-sizing: border-box;
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

const sanitizeName = (value: string) =>
  value
    .replace(/[^A-Za-zÀ-ÿ\s]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^\s/, "");

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
  const prefilledCpf =
    location.state && typeof (location.state as { prefilledCpf?: unknown }).prefilledCpf === "string"
      ? normalizeCpf((location.state as { prefilledCpf?: string }).prefilledCpf ?? "")
      : "";
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(prefilledPhone);
  const [cpf, setCpf] = useState(prefilledCpf);
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [district, setDistrict] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [deliveryRegion, setDeliveryRegion] = useState("");
  const [howFoundUs, setHowFoundUs] = useState("");
  const [howFoundUsDetails, setHowFoundUsDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [error, setError] = useState("");
  const numberInputRef = useRef<HTMLInputElement | null>(null);
  const lastFetchedCepRef = useRef("");
  const pendingLeaveActionRef = useRef<(() => void) | null>(null);
  const [exitDialogOpen, setExitDialogOpen] = useState(false);

  const requiresDetails = howFoundUs === "Outro";
  const fullAddress = useMemo(
    () => createFullAddress(street.trim(), number.trim(), complement.trim(), district.trim(), city.trim(), state.trim()),
    [street, number, complement, district, city, state]
  );
  const isFormDirty = useMemo(() => {
    return [
      name,
      phone,
      cpf,
      cep,
      street,
      number,
      complement,
      district,
      city,
      state,
      deliveryRegion,
      howFoundUs,
      howFoundUsDetails,
    ].some((value) => String(value).trim().length > 0);
  }, [
    name,
    phone,
    cpf,
    cep,
    street,
    number,
    complement,
    district,
    city,
    state,
    deliveryRegion,
    howFoundUs,
    howFoundUsDetails,
  ]);
  const shouldConfirmExit = isFormDirty && !submitting;

  const canSubmit = useMemo(() => {
    return (
      name.trim().length >= 3 &&
      !/\d/.test(name) &&
      normalizePhone(phone).length >= 10 &&
      normalizeCpf(cpf).length === 11 &&
      street.trim().length >= 3 &&
      number.trim().length >= 1 &&
      district.trim().length >= 2 &&
      deliveryRegion.trim().length >= 2 &&
      city.trim().length >= 2 &&
      state.trim().length === 2 &&
      howFoundUs.trim().length > 0 &&
      (!requiresDetails || howFoundUsDetails.trim().length >= 3)
    );
  }, [name, phone, cpf, street, number, district, deliveryRegion, city, state, howFoundUs, howFoundUsDetails, requiresDetails]);

  useBeforeUnload(
    useCallback((event) => {
      if (!shouldConfirmExit) return;
      event.preventDefault();
      event.returnValue = "";
    }, [shouldConfirmExit]),
    { capture: true }
  );

  const requestLeaveConfirmation = useCallback(
    (action: () => void) => {
      if (!shouldConfirmExit) {
        action();
        return;
      }

      pendingLeaveActionRef.current = action;
      setExitDialogOpen(true);
    },
    [shouldConfirmExit]
  );

  const handleCancelLeave = useCallback(() => {
    pendingLeaveActionRef.current = null;
    setExitDialogOpen(false);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", window.location.href);
    }
  }, []);

  const handleConfirmLeave = useCallback(() => {
    const action = pendingLeaveActionRef.current;
    pendingLeaveActionRef.current = null;
    setExitDialogOpen(false);
    action?.();
  }, []);

  const handleExitDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        handleCancelLeave();
        return;
      }

      setExitDialogOpen(true);
    },
    [handleCancelLeave]
  );

  useEffect(() => {
    if (!shouldConfirmExit) return;

    const handlePopState = () => {
      requestLeaveConfirmation(() => {
        window.removeEventListener("popstate", handlePopState);
        navigate(-1);
      });
    };

    window.history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [navigate, requestLeaveConfirmation, shouldConfirmExit]);

  const handleLeavePage = useCallback(
    (
      target: string,
      state?: { redirectTo: string; prefilledPhone: string; prefilledCpf?: string }
    ) => {
      requestLeaveConfirmation(() => {
        navigate(target, state ? { state } : undefined);
      });
    },
    [navigate, requestLeaveConfirmation]
  );

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("Preencha nome, telefone, CPF, endereço completo, região de entrega e como conheceu a gente.");
      return;
    }

    setSubmitting(true);

    try {
      const customer = await signupCustomer({
        full_name: name,
        phone,
        document_cpf: cpf,
        cep,
        address: fullAddress,
        city: deliveryRegion,
        how_found_us: howFoundUs,
        how_found_us_details: requiresDetails ? howFoundUsDetails : "",
      });

      void trackCustomerEvent({
        eventName: "signup_completed",
        customerName: customer.full_name,
        phone: customer.phone,
        documentCpf: customer.document_cpf,
        metadata: {
          deliveryRegion,
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
        onClick={() =>
          handleLeavePage("/login", {
            redirectTo,
            prefilledPhone: normalizePhone(phone),
            prefilledCpf: normalizeCpf(cpf),
          })
        }
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
                      onChange={(e) => setName(sanitizeName(e.target.value))}
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
                  <Label htmlFor="deliveryRegion">Região de entrega</Label>
                  <InputShell>
                    <SelectInput
                      id="deliveryRegion"
                      value={deliveryRegion}
                      onChange={(e) => setDeliveryRegion(e.target.value)}
                      disabled={submitting}
                    >
                      <option value="">Selecione a região</option>
                      {SHIPPING_RATES.map((rate) => (
                        <option key={rate.city} value={rate.city}>
                          {rate.city}
                        </option>
                      ))}
                    </SelectInput>
                  </InputShell>
                  <HelperText>Essa região será usada para calcular o frete no checkout.</HelperText>
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
                        placeholder="Cidade do endereço"
                        autoComplete="address-level2"
                        disabled={submitting}
                      />
                    </InputShell>
                    <HelperText>Cidade informativa do endereço. O frete usa a região selecionada acima.</HelperText>
                  </Field>

                  <UfField>
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
                    <HelperText>&nbsp;</HelperText>
                  </UfField>
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
            <SecondaryButton
              type="button"
              onClick={() =>
                handleLeavePage("/login", {
                  redirectTo,
                  prefilledPhone: normalizePhone(phone),
                  prefilledCpf: normalizeCpf(cpf),
                })
              }
              disabled={submitting}
            >
              Já tenho conta
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={submitting}>
              {submitting ? "Cadastrando..." : "Cadastrar"}
            </PrimaryButton>
          </ButtonRow>
        </Form>
      </StyledCard>

      <AlertDialog open={exitDialogOpen} onOpenChange={handleExitDialogOpenChange}>
        <AlertDialogContent className="overflow-y-auto border border-white/50 bg-[linear-gradient(180deg,rgba(255,255,255,0.82)_0%,rgba(255,247,245,0.76)_100%)] p-0 shadow-[0_30px_80px_rgba(85,24,24,0.28)] backdrop-blur-2xl sm:max-w-md sm:rounded-[32px]">
          <div className="relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.85),transparent_48%),linear-gradient(180deg,rgba(255,255,255,0.24),transparent)]" />
            <div className="relative p-6 sm:p-7">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] border border-white/70 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_18px_36px_rgba(125,23,23,0.12)] backdrop-blur-xl">
                <AlertTriangle className="h-7 w-7 text-red-500" />
              </div>

              <div className="mt-5 text-center">
                <AlertDialogTitle className="text-[1.45rem] font-black tracking-[-0.02em] text-slate-950">
                  Deseja sair do cadastro?
                </AlertDialogTitle>
                <AlertDialogDescription className="mt-2 text-[15px] leading-6 text-slate-600">
                  Os dados preenchidos até agora podem ser perdidos se você sair desta tela.
                </AlertDialogDescription>
              </div>

              <AlertDialogFooter className="mt-6 flex-col gap-3 sm:flex-row sm:justify-center sm:space-x-0">
                <AlertDialogCancel
                  onClick={handleCancelLeave}
                  className="mt-0 h-12 rounded-2xl border-white/70 bg-white/55 px-5 text-sm font-semibold text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_14px_28px_rgba(15,23,42,0.08)] backdrop-blur-xl hover:bg-white/70"
                >
                  Continuar aqui
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleConfirmLeave}
                  className="h-12 rounded-2xl bg-[linear-gradient(135deg,#c93232,#8b1d1d)] px-5 text-sm font-bold text-white shadow-[0_18px_36px_rgba(185,40,40,0.28)] hover:opacity-95"
                >
                  Sair mesmo
                  <ChevronRight className="ml-1 h-4 w-4" />
                </AlertDialogAction>
              </AlertDialogFooter>
            </div>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </Screen>
  );
};

export default Cadastro;
