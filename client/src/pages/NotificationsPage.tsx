import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useNotifications } from "../context/NotificationsContext";

const LABELS: Record<string, string> = {
  like: "t’a envoyé un crush",
  match: "a matché avec toi",
  unlike: "a retiré son crush",
  view: "a consulté ton profil",
  message: "t’a envoyé un message",
  date: "a mis à jour un rendez-vous",
};

export function NotificationsPage() {
  const { items, unread, markRead } = useNotifications();

  useEffect(() => {
    if (unread > 0) void markRead();
  }, [unread, markRead]);

  return (
    <section>
      <h1 className="page-title">Notifications</h1>
      <p className="page-lead">Crush, vues, matchs et messages — visibles depuis n’importe quelle page.</p>
      <div className="panel">
        {items.length === 0 ? <p className="muted">Rien pour le moment.</p> : null}
        <ul className="plain-list notif-list">
          {items.map((n) => (
            <li key={n.id}>
              {n.actorId ? (
                <Link
                  to={
                    n.kind === "message"
                      ? `/chat?user=${n.actorId}`
                      : n.kind === "date"
                        ? "/dates"
                        : `/profile/${n.actorId}`
                  }
                >
                  {n.actorFirstName ?? n.actorUsername ?? "Quelqu’un"}
                </Link>
              ) : (
                "Quelqu’un"
              )}{" "}
              {LABELS[n.kind] ?? n.kind}
              <span className="muted">
                {" "}
                · {new Date(n.createdAt).toLocaleString("fr-FR")}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
