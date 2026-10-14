import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError, type DatePlan, type DateStatus } from "../api/client";
import { useAuth } from "../context/AuthContext";

const STATUS: Record<DateStatus, string> = {
  pending: "En attente",
  accepted: "Accepté",
  declined: "Refusé",
  cancelled: "Annulé",
};

export function DatesPage() {
  const { user } = useAuth();
  const [dates, setDates] = useState<DatePlan[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const data = await api<{ dates: DatePlan[] }>("/api/dates");
    setDates(data.dates);
  }

  useEffect(() => {
    void load().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.message : "Chargement impossible.");
    });
  }, []);

  async function setStatus(id: string, status: DateStatus) {
    setError("");
    try {
      await api(`/api/dates/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Mise à jour impossible.");
    }
  }

  return (
    <section>
      <h1 className="page-title">Rendez-vous</h1>
      <p className="page-lead">Propose un IRL depuis le chat, puis suis les réponses ici.</p>
      {error ? <p className="form-alert form-alert-error">{error}</p> : null}
      <div className="panel">
        {dates.length === 0 ? <p className="muted">Aucun rendez-vous pour l’instant.</p> : null}
        <ul className="plain-list date-list">
          {dates.map((d) => (
            <li key={d.id} className={`date-card status-${d.status}`}>
              <strong>{d.title}</strong>
              <span>
                avec{" "}
                <Link to={`/profile/${d.peerId}`}>
                  {d.peerFirstName} (@{d.peerUsername})
                </Link>
              </span>
              <span>
                {new Date(d.startsAt).toLocaleString("fr-FR")} · {d.place}
              </span>
              {d.note ? <span className="muted">{d.note}</span> : null}
              <span className="date-status">{STATUS[d.status]}</span>
              <span className="date-actions">
                {d.status === "pending" && d.proposerId !== user?.id ? (
                  <>
                    <button type="button" className="btn" onClick={() => void setStatus(d.id, "accepted")}>
                      Accepter
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => void setStatus(d.id, "declined")}
                    >
                      Refuser
                    </button>
                  </>
                ) : null}
                {(d.status === "pending" && d.proposerId === user?.id) || d.status === "accepted" ? (
                  <button
                    type="button"
                    className="linkish danger"
                    onClick={() => void setStatus(d.id, "cancelled")}
                  >
                    Annuler
                  </button>
                ) : null}
                <Link to={`/chat/${d.conversationId}`}>Ouvrir le chat</Link>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function DateProposeForm({ conversationId }: { conversationId: string }) {
  const [title, setTitle] = useState("Café");
  const [place, setPlace] = useState("");
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [pending, setPending] = useState(false);
  const [dates, setDates] = useState<DatePlan[]>([]);

  async function load() {
    const data = await api<{ dates: DatePlan[] }>(`/api/dates/conversation/${conversationId}`);
    setDates(data.dates);
  }

  useEffect(() => {
    void load().catch(() => undefined);
  }, [conversationId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    if (!when) {
      setError("Choisis une date.");
      return;
    }
    setPending(true);
    try {
      await api("/api/dates", {
        method: "POST",
        body: JSON.stringify({
          conversationId,
          title,
          place,
          startsAt: new Date(when).toISOString(),
          note: note || undefined,
        }),
      });
      setOk("Proposition envoyée.");
      setPlace("");
      setNote("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de proposer ce rendez-vous.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="date-box">
      <h3>Proposer un rendez-vous</h3>
      {dates.length > 0 ? (
        <ul className="plain-list">
          {dates.map((d) => (
            <li key={d.id}>
              {d.title} · {new Date(d.startsAt).toLocaleString("fr-FR")} · {STATUS[d.status]}
            </li>
          ))}
        </ul>
      ) : null}
      <form className="form" onSubmit={(e) => void submit(e)}>
        {error ? <p className="form-alert form-alert-error">{error}</p> : null}
        {ok ? <p className="form-alert form-alert-ok">{ok}</p> : null}
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" maxLength={80} required />
        <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Lieu" maxLength={120} required />
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optionnel)" maxLength={400} />
        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Envoi…" : "Proposer"}
        </button>
      </form>
    </div>
  );
}
