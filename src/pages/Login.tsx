import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../images/logop.jpg";
import {
  createCustomerSession,
  findCustomerByPhone,
  normalizePhone,
} from "@/lib/customerAuth";
import { trackCustomerEvent } from "@/lib/customerInsights";

const maskPhone = (value: string) => {
  const d = normalizePhone(value).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => normalizePhone(phone).length >= 10, [phone]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("Informe seu telefone para entrar.");
      return;
    }

    setSubmitting(true);

    try {
      const customer = findCustomerByPhone(phone);

      if (!customer) {
        navigate("/cadastro", {
          replace: true,
          state: { prefilledPhone: normalizePhone(phone) },
        });
        return;
      }

      createCustomerSession(customer);
      void trackCustomerEvent({
        eventName: "login_success",
        customerName: customer.full_name,
        phone: customer.phone,
        documentCpf: customer.document_cpf,
      });
      navigate("/catalogo", { replace: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-red-700/95 px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-red-100">
        <div className="flex justify-center mb-4">
          <img src={logo} alt="Gostinho Mineiro" className="h-16 w-auto" />
        </div>

        <h1 className="text-2xl font-bold text-center text-gray-900">Entrar</h1>
        <p className="text-sm text-gray-600 text-center mt-1 mb-6">
          Entre com seu telefone cadastrado.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Telefone (WhatsApp)</label>
            <input
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-red-200"
              value={maskPhone(phone)}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
              inputMode="numeric"
              disabled={submitting}
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="submit"
            className="w-full rounded-lg bg-red-600 text-white font-semibold py-2.5 hover:bg-red-700 disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? "Entrando..." : "Entrar"}
          </button>

          <button
            type="button"
            onClick={() =>
              navigate("/cadastro", {
                state: { prefilledPhone: normalizePhone(phone) },
              })
            }
            className="w-full rounded-lg border border-gray-300 text-gray-800 font-semibold py-2.5 hover:bg-gray-50"
          >
            Ainda não tenho conta
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
