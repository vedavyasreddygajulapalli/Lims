import { tw } from "../../styles/utilities";
import { useState, type FormEvent } from "react";
import { FlaskConical, ArrowRight, ShieldCheck } from "lucide-react";
import { Button, Field, Notice } from "../../components/ui";
import { request } from "../../lib/client";
import type { User } from "../../lib/types";
export function LoginPage({ onLogin }: { onLogin: (u: User) => void }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onLogin(
        await request<User>(
          "/auth/login",
          "POST",
          Object.fromEntries(new FormData(e.currentTarget)),
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={tw("login-layout")}>
      <section className={tw("login-visual")}>
        <div className={tw("brand")}>
          <span className={tw("brand-icon")}>
            <FlaskConical />
          </span>
          <div>
            Sri Sainath<span>LABORATORY MANAGEMENT</span>
          </div>
        </div>
        <div>
          <p className={tw("eyebrow")}>PRECISION BEGINS WITH A CLEAR PROCESS</p>
          <h1>
            Every sample.
            <br />
            Every detail.
            <br />
            <em>One workspace.</em>
          </h1>
          <p>Bring your laboratory’s people, samples and records together.</p>
          <div className={tw("login-path")}>
            Receive <span>→</span> Test <span>→</span> Review
          </div>
        </div>
        <small>
          <ShieldCheck size={14} /> Controlled access for your laboratory team
        </small>
      </section>
      <form className={tw("login-form")} onSubmit={submit}>
        <p className={tw("eyebrow")}>WELCOME TO YOUR WORKSPACE</p>
        <h2>Sign in to Sri Sainath</h2>
        <p>Use the account created by your administrator.</p>
        <Field
          label="Email address"
          name="email"
          type="email"
          autoComplete="username"
          required
          placeholder="you@laboratory.com"
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {error && <Notice tone="red">{error}</Notice>}
        <Button disabled={busy} type="submit">
          {busy ? "Signing in…" : "Sign in"}
          <ArrowRight size={17} />
        </Button>
        <small>Need access? Contact your laboratory administrator.</small>
      </form>
    </div>
  );
}
