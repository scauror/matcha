import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError, type User } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Field, FormStatus } from "../components/Field";
import { OAuthButtons } from "../components/OAuthButtons";

export function LoginPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(params.get("error") ?? "");
  const [pending, setPending] = useState(false);

  async function submit() {
    setError("");
    setPending(true);
    try {
      const data = await api<{ user: User }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setUser(data.user);
      navigate(data.user.profileComplete ? "/browse" : "/profile", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Connexion impossible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <h1 className="page-title">Connexion</h1>
      <p className="page-lead">Connecte-toi avec ton nom d’utilisateur et ton mot de passe.</p>
      <form
        className="panel form"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <FormStatus error={error} />
        <Field label="Nom d'utilisateur">
          <input
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </Field>
        <Field label="Mot de passe">
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Connexion…" : "Se connecter"}
        </button>
        <OAuthButtons />
        <p className="form-links">
          <Link to="/forgot-password">Mot de passe oublié ?</Link>
          <Link to="/register">Créer un compte</Link>
        </p>
      </form>
    </section>
  );
}
