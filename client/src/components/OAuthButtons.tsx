import { useEffect, useState } from "react";

export type OAuthProvider = { id: string; label: string };

export function OAuthButtons({ title }: { title?: string }) {
  const [providers, setProviders] = useState<OAuthProvider[]>([]);

  useEffect(() => {
    fetch("/api/auth/providers", { credentials: "include" })
      .then((res) => res.json())
      .then((data: { providers?: OAuthProvider[] }) => setProviders(data.providers ?? []))
      .catch(() => setProviders([]));
  }, []);

  if (providers.length === 0) return null;

  return (
    <div className="oauth-block">
      <p className="oauth-title">{title ?? "Ou continuer avec"}</p>
      <div className="oauth-row">
        {providers.map((p) => (
          <a key={p.id} className="btn btn-ghost" href={`/api/auth/oauth/${p.id}`}>
            {p.label}
          </a>
        ))}
      </div>
    </div>
  );
}
