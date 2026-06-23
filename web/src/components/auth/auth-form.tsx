"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient, signIn, signUp } from "@/lib/auth/client";
import { useT } from "@/lib/i18n/client";

type Mode = "sign-in" | "sign-up";
type Method = "email" | "phone";

/**
 * Self-hosted sign-in / sign-up form (replaces Clerk's hosted widgets).
 *
 * Two methods share one component:
 *   - email + password
 *   - phone + SMS OTP — the path for mainland-China suppliers. The OTP flow is
 *     identical for sign-in and sign-up: better-auth's signUpOnVerification
 *     creates the account on first successful verify.
 */
export function AuthForm({ mode }: { mode: Mode }) {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get("redirect") || "/dashboard";

  const [method, setMethod] = useState<Method>("email");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function done() {
    router.push(redirectTo);
    router.refresh();
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res =
      mode === "sign-up"
        ? await signUp.email({ email, password, name: name || email })
        : await signIn.email({ email, password });
    setBusy(false);
    if (res.error) {
      setError(res.error.message || t("auth.genericError"));
      return;
    }
    done();
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await authClient.phoneNumber.sendOtp({ phoneNumber: phone });
    setBusy(false);
    if (res.error) {
      setError(res.error.message || t("auth.genericError"));
      return;
    }
    setOtpSent(true);
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await authClient.phoneNumber.verify({ phoneNumber: phone, code });
    setBusy(false);
    if (res.error) {
      setError(res.error.message || t("auth.genericError"));
      return;
    }
    done();
  }

  const inputCls =
    "w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-brand focus:outline-none";
  const btnCls =
    "w-full rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50";

  return (
    <div className="w-full max-w-sm">
      <div className="mb-4 flex rounded-md border border-neutral-200 p-1 text-sm">
        <button
          type="button"
          onClick={() => { setMethod("email"); setError(null); }}
          className={`flex-1 rounded px-3 py-1.5 ${method === "email" ? "bg-brand text-white" : "text-neutral-600"}`}
        >
          {t("auth.tabEmail")}
        </button>
        <button
          type="button"
          onClick={() => { setMethod("phone"); setError(null); }}
          className={`flex-1 rounded px-3 py-1.5 ${method === "phone" ? "bg-brand text-white" : "text-neutral-600"}`}
        >
          {t("auth.tabPhone")}
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {method === "email" ? (
        <form onSubmit={submitEmail} className="space-y-3">
          {mode === "sign-up" && (
            <input
              className={inputCls}
              placeholder={t("auth.nameLabel")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          )}
          <input
            className={inputCls}
            type="email"
            required
            placeholder={t("auth.emailLabel")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            className={inputCls}
            type="password"
            required
            minLength={8}
            placeholder={t("auth.passwordLabel")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          />
          <button type="submit" disabled={busy} className={btnCls}>
            {mode === "sign-up" ? t("auth.signUpBtn") : t("auth.signInBtn")}
          </button>
        </form>
      ) : (
        <form onSubmit={otpSent ? verifyCode : sendCode} className="space-y-3">
          <input
            className={inputCls}
            type="tel"
            required
            placeholder={t("auth.phoneLabel")}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            disabled={otpSent}
          />
          <p className="text-xs text-neutral-500">{t("auth.phoneHint")}</p>
          {otpSent && (
            <>
              <input
                className={inputCls}
                inputMode="numeric"
                required
                placeholder={t("auth.codeLabel")}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                autoComplete="one-time-code"
              />
              <p className="text-xs text-green-700">{t("auth.codeSent")}</p>
            </>
          )}
          <button type="submit" disabled={busy} className={btnCls}>
            {otpSent ? t("auth.verifyBtn") : t("auth.sendCode")}
          </button>
          {otpSent && (
            <button
              type="button"
              onClick={() => { setOtpSent(false); setCode(""); }}
              className="w-full text-center text-xs text-neutral-500 hover:text-brand"
            >
              {t("auth.changePhone")}
            </button>
          )}
        </form>
      )}
    </div>
  );
}
