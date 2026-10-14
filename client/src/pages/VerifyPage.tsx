import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { FormStatus } from "../components/Field";

const started = new Set<string>();

export function VerifyPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Lien de vérification incomplet.");
      return;
    }
    if (started.has(token)) return;
    started.add(token);
    api<{ message: string }>("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then((data) => setSuccess(data.message))
      .catch((err: unknown) => {
        started.delete(token);
        setError(err instanceof ApiError ? err.message : "Vérification impossible.");
      });
  }, [token]);

  return (
    <section>
      <h1 className="page-title">Vérification</h1>
      <div className="panel">
        {!error && !success ? <p className="page-lead">Confirmation en cours…</p> : null}
        <FormStatus error={error} success={success} />
        {success ? (
          <p className="form-links">
            <Link to="/login" className="btn">
              Se connecter
            </Link>
          </p>
        ) : null}
      </div>
    </section>
  );
}
