import React, { useEffect, useMemo, useState } from "react";
import styled, { keyframes } from "styled-components";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Bg, Card } from "../components/ui/app-surface";
import logo from "../images/logop.jpg";
import {
  loginCustomer,
  normalizeCnpj,
  normalizeCpf,
  normalizePhone,
  normalizeRedirectPath,
} from "@/lib/customerAuth";
import { trackCustomerEvent } from "@/lib/customerInsights";

const Screen = styled(Bg)`
  min-height: 100dvh;
  width: 100%;
  overflow: hidden;
  overscroll-behavior: none;
  touch-action: none;
  padding: env(safe-area-inset-top) 16px env(safe-area-inset-bottom);
  display: flex;
  align-items: center;
  justify-content: center;
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
  width: min(440px, calc(100% - 32px));
  padding: 30px 24px 24px;
  border-radius: 30px;
  box-sizing: border-box;
  background: linear-gradient(180deg, #fffaf8 0%, #ffffff 100%);
  box-shadow: 0 24px 64px rgba(91, 14, 14, 0.25);

  @media (max-width: 640px) {
    padding: 26px 18px 18px;
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
  gap: 16px;
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
`;

const PhoneInput = styled.input`
  width: 100%;
  border: none;
  outline: none;
  background: #f5f1f0;
  color: #553c3c;
  font-size: 1.05rem;
  letter-spacing: 0.02em;
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
`;

const ErrorMsg = styled.p`
  margin: 0;
  font-size: 0.9rem;
  font-weight: 600;
  color: #b82626;
`;

const ButtonRow = styled.div`
  display: grid;
  gap: 12px;
  margin-top: 4px;
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

const shimmer = keyframes`
  0%, 70% {
    box-shadow: 2px 2px 3px 2px rgba(0, 0, 0, 0.18);
    transform: scale(0);
  }
  100% {
    box-shadow: 10px 10px 15px 0 rgba(0, 0, 0, 0.28);
    transform: scale(1);
  }
`;

const shimmerMid = keyframes`
  0%, 40% {
    box-shadow: 2px 2px 3px 2px rgba(0, 0, 0, 0.18);
    transform: scale(0);
  }
  100% {
    box-shadow: 10px 10px 15px 0 rgba(0, 0, 0, 0.28);
    transform: scale(1);
  }
`;

const shimmerBase = keyframes`
  0%, 10% {
    box-shadow: 2px 2px 3px 2px rgba(0, 0, 0, 0.18);
    transform: scale(0);
  }
  100% {
    box-shadow: 10px 10px 15px 0 rgba(0, 0, 0, 0.28);
    transform: scale(1);
  }
`;

const LoadingOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 5;
  background: rgba(125, 23, 23, 0.78);
  backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Frame = styled.div`
  position: relative;
  width: 220px;
  height: 220px;
`;

const Dot = styled.div<{ $size: number; $top: number; $left: number; $bg: string; $z: number; $anim: ReturnType<typeof keyframes>; }>`
  position: absolute;
  z-index: ${({ $z }) => $z};
  width: ${({ $size }) => `${$size}px`};
  height: ${({ $size }) => `${$size}px`};
  top: ${({ $top }) => `${$top}px`};
  left: ${({ $left }) => `${$left}px`};
  background: ${({ $bg }) => $bg};
  border-radius: 999px;
  animation: ${({ $anim }) => $anim} 2s cubic-bezier(0.21, 0.98, 0.6, 0.99)
    infinite alternate;
`;

const LoadingText = styled.div`
  position: absolute;
  bottom: -36px;
  width: 100%;
  text-align: center;
  color: rgba(255, 255, 255, 0.94);
  font-size: 0.95rem;
  font-weight: 700;
`;

const maskPhone = (value: string) => {
  const d = normalizePhone(value).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const normalizeDocument = (value: string) => normalizePhone(value).slice(0, 14);

const maskDocument = (value: string) => {
  const digits = normalizeDocument(value);
  if (digits.length > 11) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
    if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
    if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = normalizeRedirectPath(
    (location.state as { redirectTo?: unknown } | null)?.redirectTo
  );
  const prefilledPhone = String(
    (location.state as { prefilledPhone?: unknown } | null)?.prefilledPhone ?? ""
  );
  const prefilledCpf = String(
    (location.state as { prefilledCpf?: unknown } | null)?.prefilledCpf ?? ""
  );
  const [phone, setPhone] = useState(prefilledPhone);
  const [cpf, setCpf] = useState(prefilledCpf);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(
    () => {
      const document = normalizeDocument(cpf);
      return normalizePhone(phone).length >= 10 && (document.length === 11 || document.length === 14);
    },
    [cpf, phone]
  );

  useEffect(() => {
    const prev = {
      htmlOverflow: document.documentElement.style.overflow,
      bodyOverflow: document.body.style.overflow,
      bodyPosition: document.body.style.position,
      bodyInset: (document.body.style as CSSStyleDeclaration & { inset?: string }).inset,
      bodyWidth: document.body.style.width,
      htmlBg: document.documentElement.style.background,
      bodyBg: document.body.style.background,
    };

    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    (document.body.style as CSSStyleDeclaration & { inset?: string }).inset = "0";
    document.body.style.width = "100%";
    document.documentElement.style.background = "#a41616";
    document.body.style.background = "#a41616";

    return () => {
      document.documentElement.style.overflow = prev.htmlOverflow;
      document.body.style.overflow = prev.bodyOverflow;
      document.body.style.position = prev.bodyPosition;
      (document.body.style as CSSStyleDeclaration & { inset?: string }).inset = prev.bodyInset;
      document.body.style.width = prev.bodyWidth;
      document.documentElement.style.background = prev.htmlBg;
      document.body.style.background = prev.bodyBg;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("Informe telefone com DDD e CPF ou CNPJ para continuar.");
      return;
    }

    setSubmitting(true);

    try {
      const customer = await loginCustomer({ phone, cpf });
      void trackCustomerEvent({
        eventName: "login_success",
        customerName: customer.full_name,
        phone: customer.phone,
        documentCpf: customer.document_cpf,
      });
      navigate(redirectTo, { replace: true });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Não foi possível validar seus dados.";

      if (message.includes("Cadastro não encontrado")) {
        navigate("/cadastro", {
          replace: true,
          state: {
            prefilledPhone: normalizePhone(phone),
            prefilledCpf: normalizeDocument(cpf).length === 14 ? normalizeCnpj(cpf) : normalizeCpf(cpf),
            redirectTo,
          },
        });
        return;
      }

      setError(
        message
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen>
      {submitting ? (
        <LoadingOverlay aria-label="Verificando acesso">
          <Frame>
            <Dot $size={90} $top={65} $left={65} $bg="#d33100" $z={1} $anim={shimmerBase} />
            <Dot $size={60} $top={80} $left={80} $bg="#f0be00" $z={2} $anim={shimmerMid} />
            <Dot $size={30} $top={95} $left={95} $bg="#ffffff" $z={3} $anim={shimmer} />
            <LoadingText>Verificando seu acesso...</LoadingText>
          </Frame>
        </LoadingOverlay>
      ) : null}

      <BackButton
        type="button"
        aria-label="Voltar"
        onClick={() => navigate("/", { replace: true })}
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

        <Title>Entrar na sua conta</Title>
        <Subtitle>
          Use seu telefone e CPF ou CNPJ cadastrados para continuar.
        </Subtitle>

        <Form onSubmit={handleSubmit} noValidate>
          <Field>
            <Label htmlFor="phone">Telefone (WhatsApp)</Label>
            <InputShell>
              <PhoneInput
                id="phone"
                name="phone"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="(00) 00000-0000"
                value={maskPhone(phone)}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? "phone-error" : undefined}
                disabled={submitting}
              />
            </InputShell>
          </Field>

          <Field>
            <Label htmlFor="cpf">CPF ou CNPJ</Label>
            <InputShell>
              <PhoneInput
                id="cpf"
                name="cpf"
                inputMode="numeric"
                autoComplete="off"
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                value={maskDocument(cpf)}
                onChange={(e) => setCpf(e.target.value)}
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? "login-error" : undefined}
                disabled={submitting}
              />
            </InputShell>
            {error ? <ErrorMsg id="login-error">{error}</ErrorMsg> : null}
          </Field>

          <ButtonRow>
            <PrimaryButton type="submit" disabled={submitting}>
              Entrar
            </PrimaryButton>
            <SecondaryButton
              type="button"
              onClick={() =>
                navigate("/cadastro", {
                  state: {
                    prefilledPhone: normalizePhone(phone),
                    prefilledCpf: normalizeDocument(cpf).length === 14 ? normalizeCnpj(cpf) : normalizeCpf(cpf),
                    redirectTo,
                  },
                })
              }
              disabled={submitting}
            >
              Ainda não tenho conta
            </SecondaryButton>
          </ButtonRow>
        </Form>
      </StyledCard>
    </Screen>
  );
};

export default Login;
