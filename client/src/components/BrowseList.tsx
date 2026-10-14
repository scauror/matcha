import { useCallback, useEffect, useState } from "react";
import { api, ApiError, type BrowseCard, type Relation } from "../api/client";
import { BrowseFilters, emptyQuery, toSearchParams, type BrowseQuery } from "../components/BrowseFilters";
import { ProfileCard } from "../components/ProfileCard";

type Props = {
  endpoint: "/api/browse/suggestions" | "/api/browse/search";
  title: string;
  lead: string;
  smartDefault?: boolean;
};

export function BrowseList({ endpoint, title, lead, smartDefault = true }: Props) {
  const [query, setQuery] = useState<BrowseQuery>({
    ...emptyQuery,
    sort: smartDefault ? "smart" : "distance",
    order: smartDefault ? "desc" : "asc",
  });
  const [applied, setApplied] = useState(query);
  const [profiles, setProfiles] = useState<BrowseCard[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const qs = toSearchParams(applied);
      const data = await api<{ profiles: BrowseCard[]; total: number }>(
        `${endpoint}${qs ? `?${qs}` : ""}`,
      );
      setProfiles(data.profiles);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chargement impossible.");
    }
  }, [applied, endpoint]);

  useEffect(() => {
    void load();
  }, [load]);

  async function like(id: string) {
    setBusyId(id);
    try {
      const data = await api<{ relation: Relation }>(`/api/social/like/${id}`, { method: "POST" });
      if (endpoint.endsWith("suggestions")) {
        setProfiles((prev) => prev.filter((p) => p.id !== id));
        setTotal((n) => Math.max(0, n - 1));
      } else {
        setProfiles((prev) =>
          prev.map((p) => (p.id === id ? { ...p, ...data.relation } : p)),
        );
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'envoyer le crush.");
    } finally {
      setBusyId(null);
    }
  }

  async function unlike(id: string) {
    setBusyId(id);
    try {
      const data = await api<{ relation: Relation }>(`/api/social/like/${id}`, { method: "DELETE" });
      setProfiles((prev) => prev.map((p) => (p.id === id ? { ...p, ...data.relation } : p)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de retirer le crush.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <h1 className="page-title">{title}</h1>
      <p className="page-lead">{lead}</p>
      <BrowseFilters
        value={query}
        onChange={setQuery}
        onSubmit={() => setApplied(query)}
        smartDefault={smartDefault}
      />
      {error ? <p className="form-alert form-alert-error">{error}</p> : null}
      <p className="muted">{total} profil{total > 1 ? "s" : ""}</p>
      <div className="card-grid">
        {profiles.map((p) => (
          <ProfileCard
            key={p.id}
            profile={p}
            busy={busyId === p.id}
            onLike={() => void like(p.id)}
            onUnlike={() => void unlike(p.id)}
          />
        ))}
      </div>
      {profiles.length === 0 && !error ? (
        <div className="panel">Aucun profil pour ces critères.</div>
      ) : null}
    </section>
  );
}
