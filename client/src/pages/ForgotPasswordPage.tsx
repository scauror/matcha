import { useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { Field, FormStatus } from "../components/Field";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    setError("");
    setSuccess("");
    setPending(true);
    try {
      const data = await api<{ message: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSuccess(data.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'envoyer l'e-mail.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <h1 className="page-title">Mot de passe oublié</h1>
      <p className="page-lead">Entre l’e-mail de ton compte. Si un compte existe, tu recevras un lien.</p>
      <form
        className="panel form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <FormStatus error={error} success={success} />
        <Field label="E-mail">
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Envoi…" : "Envoyer le lien"}
        </button>
        <p className="form-links">
          <Link to="/login">Retour à la connexion</Link>
        </p>
      </form>
    </section>
  );
}
