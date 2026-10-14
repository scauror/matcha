import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { io } from "socket.io-client";
import { api, ApiError, type ChatMessage, type Conversation } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationsContext";
import { useCall } from "../context/CallContext";
import { DateProposeForm } from "./DatesPage";

export function ChatPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const peerQuery = params.get("user");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshUnreadMessages } = useNotifications();
  const { startCall } = useCall();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [canChat, setCanChat] = useState(true);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const active = conversations.find((c) => c.id === id);

  const loadConversations = useCallback(async () => {
    const data = await api<{ conversations: Conversation[] }>("/api/chat/conversations");
    setConversations(data.conversations);
    await refreshUnreadMessages();
  }, [refreshUnreadMessages]);

  useEffect(() => {
    if (!peerQuery) return;
    api<{ conversationId: string }>(`/api/chat/with/${peerQuery}`)
      .then((data) => navigate(`/chat/${data.conversationId}`, { replace: true }))
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Impossible d'ouvrir le chat.");
      });
  }, [peerQuery, navigate]);

  useEffect(() => {
    void loadConversations().catch((err: unknown) => {
      setError(err instanceof ApiError ? err.message : "Chargement impossible.");
    });
  }, [loadConversations]);

  useEffect(() => {
    if (!id) {
      setMessages([]);
      return;
    }
    api<{ messages: ChatMessage[]; canChat: boolean; peerId: string }>(
      `/api/chat/conversations/${id}/messages`,
    )
      .then((data) => {
        setMessages(data.messages);
        setCanChat(data.canChat);
        setPeerId(data.peerId);
        void loadConversations();
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Conversation introuvable.");
      });
  }, [id, loadConversations]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!user) return;
    const socket = io({ withCredentials: true });
    socket.on("chat:message", (msg: ChatMessage) => {
      if (msg.conversationId === id) {
        setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
        void api(`/api/chat/conversations/${id}/messages`).catch(() => undefined);
      }
      void loadConversations();
    });
    return () => {
      socket.close();
    };
  }, [user, id, loadConversations]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!id || !draft.trim()) return;
    setPending(true);
    setError("");
    const body = draft.trim();
    setDraft("");
    try {
      const data = await api<{ message: ChatMessage }>(`/api/chat/conversations/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setMessages((prev) => (prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message]));
      await loadConversations();
    } catch (err) {
      setDraft(body);
      setError(err instanceof ApiError ? err.message : "Envoi impossible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <h1 className="page-title">Chat</h1>
      <p className="page-lead">Messages en temps réel avec tes matchs. Un nouveau message s’affiche aussi dans le header.</p>
      {error ? <p className="form-alert form-alert-error">{error}</p> : null}
      <div className="chat-layout">
        <aside className="chat-list panel">
          {conversations.length === 0 ? (
            <p className="muted">Aucun match pour l’instant. Envoie un crush réciproque pour discuter.</p>
          ) : null}
          {conversations.map((c) => (
            <Link
              key={c.id}
              to={`/chat/${c.id}`}
              className={c.id === id ? "chat-preview active" : "chat-preview"}
            >
              {c.peerPhoto ? <img src={c.peerPhoto} alt="" /> : <span className="chat-avatar" />}
              <span>
                <strong>
                  {c.peerFirstName} {c.isOnline ? "· en ligne" : ""}
                </strong>
                <span className="muted">{c.lastBody ?? "Nouvelle conversation"}</span>
              </span>
              {c.unread > 0 ? <span className="badge">{c.unread}</span> : null}
            </Link>
          ))}
        </aside>
        <div className="chat-thread panel">
          {!id ? (
            <p className="muted">Choisis une conversation.</p>
          ) : (
            <>
              <header className="chat-thread-head">
                {active ? (
                  <Link to={`/profile/${active.peerId}`}>
                    {active.peerFirstName} (@{active.peerUsername})
                  </Link>
                ) : peerId ? (
                  <Link to={`/profile/${peerId}`}>Profil</Link>
                ) : (
                  "Conversation"
                )}
                {canChat && (active?.peerId || peerId) ? (
                  <span className="chat-call-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() =>
                        startCall(active?.peerId ?? peerId!, "audio", active?.peerFirstName)
                      }
                    >
                      Appel audio
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() =>
                        startCall(active?.peerId ?? peerId!, "video", active?.peerFirstName)
                      }
                    >
                      Visio
                    </button>
                  </span>
                ) : null}
              </header>
              <div className="chat-messages">
                {messages.map((m) => (
                  <p
                    key={m.id}
                    className={m.senderId === user?.id ? "bubble mine" : "bubble"}
                  >
                    {m.body}
                    <time>{new Date(m.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</time>
                  </p>
                ))}
                <div ref={bottomRef} />
              </div>
              {canChat ? (
                <>
                  <form className="chat-compose" onSubmit={(e) => void send(e)}>
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Écrire un message…"
                      maxLength={2000}
                      disabled={pending}
                    />
                    <button className="btn" type="submit" disabled={pending || !draft.trim()}>
                      Envoyer
                    </button>
                  </form>
                  {id ? <DateProposeForm conversationId={id} /> : null}
                </>
              ) : (
                <p className="muted">Le chat est désactivé (crush retiré ou blocage).</p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
