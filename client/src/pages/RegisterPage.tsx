import { useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { Field, FormStatus } from "../components/Field";
import { OAuthButtons } from "../components/OAuthButtons";

export function RegisterPage() {
  const [form, setForm] = useState({
    email: "",
    username: "",
    firstName: "",
    lastName: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit() {
    setError("");
    setSuccess("");
    setPending(true);
    try {
      const data = await api<{ message: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setSuccess(data.message);
      setForm({ email: "", username: "", firstName: "", lastName: "", password: "" });
    } catch (err) {
      if (err instanceof ApiError) {
        const firstField = err.fields ? Object.values(err.fields).flat()[0] : undefined;
        setError(firstField ?? err.message);
      } else {
        setError("Inscription impossible.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <h1 className="page-title">Inscription</h1>
      <p className="page-lead">
        Un e-mail de confirmation te sera envoyé. Mot de passe : 8 caractères min., majuscule,
        minuscule, chiffre — pas un mot anglais courant.
      </p>
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
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            required
          />
        </Field>
        <Field label="Nom d'utilisateur">
          <input
            autoComplete="username"
            value={form.username}
            onChange={(e) => set("username", e.target.value)}
            required
          />
        </Field>
        <div className="form-row">
          <Field label="Prénom">
            <input
              autoComplete="given-name"
              value={form.firstName}
              onChange={(e) => set("firstName", e.target.value)}
              required
            />
          </Field>
          <Field label="Nom">
            <input
              autoComplete="family-name"
              value={form.lastName}
              onChange={(e) => set("lastName", e.target.value)}
              required
            />
          </Field>
        </div>
        <Field label="Mot de passe">
          <input
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            required
          />
        </Field>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Création…" : "Créer mon compte"}
        </button>
        <OAuthButtons title="Ou s’inscrire avec" />
        <p className="form-links">
          <Link to="/login">Déjà inscrit ? Connexion</Link>
        </p>
      </form>
    </section>
  );
}
