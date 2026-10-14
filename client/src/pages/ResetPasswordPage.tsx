import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { Field, FormStatus } from "../components/Field";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState(token ? "" : "Lien de réinitialisation incomplet.");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);

  async function submit() {
    setError("");
    setSuccess("");
    setPending(true);
    try {
      const data = await api<{ message: string }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setSuccess(data.message);
    } catch (err) {
      if (err instanceof ApiError) {
        const firstField = err.fields ? Object.values(err.fields).flat()[0] : undefined;
        setError(firstField ?? err.message);
      } else {
        setError("Réinitialisation impossible.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <h1 className="page-title">Nouveau mot de passe</h1>
      <p className="page-lead">Choisis un mot de passe solide (pas un mot anglais courant).</p>
      <form
        className="panel form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <FormStatus error={error} success={success} />
        <Field label="Nouveau mot de passe">
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={!token || Boolean(success)}
          />
        </Field>
        <button className="btn" type="submit" disabled={pending || !token || Boolean(success)}>
          {pending ? "Enregistrement…" : "Mettre à jour"}
        </button>
        {success ? (
          <p className="form-links">
            <Link to="/login">Se connecter</Link>
          </p>
        ) : null}
      </form>
    </section>
  );
}
