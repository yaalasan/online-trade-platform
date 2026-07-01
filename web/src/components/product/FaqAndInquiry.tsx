"use client";

import { useState } from "react";
import type { Faq } from "./types";
import { bySort } from "./types";

export function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  const ordered = [...faqs].sort(bySort);
  return (
    <div className="faq">
      {ordered.map((f, i) => (
        <details key={f.id} open={i === 0}>
          <summary>{f.question}</summary>
          <div className="ans">{f.answer}</div>
        </details>
      ))}
    </div>
  );
}

export interface InquiryValues {
  name: string;
  email: string;
  company: string;
  quantity: string;
  message: string;
  website: string; // honeypot — must be empty on real submissions
}

export function InquiryForm({
  onSubmit,
}: {
  onSubmit?: (v: InquiryValues) => Promise<void> | void;
}) {
  const [v, setV] = useState<InquiryValues>({
    name: "", email: "", company: "", quantity: "", message: "", website: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof InquiryValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((s) => ({ ...s, [k]: e.target.value }));

  const submit = async () => {
    if (!v.name || !/^\S+@\S+\.\S+$/.test(v.email)) return setErr("Enter your name and a valid email.");
    if (v.message.trim().length < 20) return setErr("Message must be at least 20 characters.");
    setErr(null);
    setBusy(true);
    try {
      await onSubmit?.(v);
      setDone(true);
      setV({ name: "", email: "", company: "", quantity: "", message: "", website: "" });
    } catch {
      setErr("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return <p style={{ color: "var(--brand)", fontWeight: 600 }}>✓ Your inquiry has been sent. We'll be in touch shortly.</p>;
  }

  return (
    <div className="formgrid">
      {/* honeypot — hidden from real users, bots fill it in */}
      <input
        type="text"
        name="website"
        value={v.website}
        onChange={set("website")}
        style={{ display: "none" }}
        aria-hidden="true"
        tabIndex={-1}
        autoComplete="off"
      />
      <div className="field"><label>Your name</label><input value={v.name} onChange={set("name")} placeholder="Full name" /></div>
      <div className="field"><label>Company email</label><input value={v.email} onChange={set("email")} placeholder="you@company.com" /></div>
      <div className="field"><label>Company</label><input value={v.company} onChange={set("company")} placeholder="Company name" /></div>
      <div className="field"><label>Target quantity</label><input value={v.quantity} onChange={set("quantity")} placeholder="e.g. 200" /></div>
      <div className="field full">
        <label>Message</label>
        <textarea rows={4} value={v.message} onChange={set("message")} placeholder="Requirement, target price, destination port… (20–4000 characters)" />
      </div>
      {err && <div className="field full err">{err}</div>}
      <div className="field full">
        <button className="cta primary" style={{ maxWidth: 220 }} disabled={busy} onClick={submit}>
          {busy ? "Sending…" : "Send inquiry"}
        </button>
      </div>
    </div>
  );
}
