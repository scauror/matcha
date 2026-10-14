import { query } from "./pool.js";
import { ensureConversation, isBlockedEitherWay } from "./social.js";

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: Date;
};

export type ConversationCard = {
  id: string;
  peerId: string;
  peerUsername: string;
  peerFirstName: string;
  peerPhoto: string | null;
  isOnline: boolean;
  lastSeenAt: Date | null;
  lastBody: string | null;
  lastAt: Date | null;
  unread: number;
  canChat: boolean;
};

export class ChatError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function areMatched(a: string, b: string): Promise<boolean> {
  const { rows } = await query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM likes l1
       JOIN likes l2
         ON l1.from_user_id = l2.to_user_id
        AND l1.to_user_id = l2.from_user_id
       WHERE l1.from_user_id = $1 AND l1.to_user_id = $2
     ) AS ok`,
    [a, b],
  );
  return rows[0]?.ok ?? false;
}

export async function getConversationForUser(userId: string, conversationId: string) {
  const { rows } = await query<{ id: string; user_a: string; user_b: string }>(
    `SELECT id, user_a, user_b FROM conversations WHERE id = $1`,
    [conversationId],
  );
  const conv = rows[0];
  if (!conv || (conv.user_a !== userId && conv.user_b !== userId)) {
    throw new ChatError(404, "Conversation introuvable.");
  }
  const peerId = conv.user_a === userId ? conv.user_b : conv.user_a;
  if (await isBlockedEitherWay(userId, peerId)) {
    throw new ChatError(403, "Conversation indisponible.");
  }
  const canChat = await areMatched(userId, peerId);
  return { ...conv, peerId, canChat };
}

export async function openConversationWith(me: string, peerId: string): Promise<string> {
  if (me === peerId) throw new ChatError(400, "Conversation invalide.");
  if (await isBlockedEitherWay(me, peerId)) {
    throw new ChatError(404, "Profil introuvable.");
  }
  if (!(await areMatched(me, peerId))) {
    throw new ChatError(403, "Vous devez être matchés pour discuter.");
  }
  return ensureConversation(me, peerId);
}

export async function listConversations(me: string): Promise<ConversationCard[]> {
  const { rows } = await query<{
    id: string;
    peer_id: string;
    username: string;
    first_name: string;
    photo: string | null;
    is_online: boolean;
    last_seen_at: Date | null;
    last_body: string | null;
    last_at: Date | null;
    unread: string;
    can_chat: boolean;
  }>(
    `
    SELECT
      c.id,
      u.id AS peer_id,
      u.username,
      u.first_name,
      (SELECT path FROM photos WHERE user_id = u.id AND is_profile = TRUE LIMIT 1) AS photo,
      u.is_online,
      u.last_seen_at,
      (
        SELECT m.body FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC LIMIT 1
      ) AS last_body,
      (
        SELECT m.created_at FROM messages m
        WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC LIMIT 1
      ) AS last_at,
      (
        SELECT count(*)::text FROM messages m
        WHERE m.conversation_id = c.id AND m.sender_id <> $1 AND m.read_at IS NULL
      ) AS unread,
      EXISTS (
        SELECT 1 FROM likes l1
        JOIN likes l2
          ON l1.from_user_id = l2.to_user_id AND l1.to_user_id = l2.from_user_id
        WHERE l1.from_user_id = $1 AND l1.to_user_id = u.id
      ) AS can_chat
    FROM conversations c
    JOIN users u ON u.id = CASE WHEN c.user_a = $1 THEN c.user_b ELSE c.user_a END
    WHERE (c.user_a = $1 OR c.user_b = $1)
      AND NOT EXISTS (
        SELECT 1 FROM blocks b
        WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
           OR (b.blocker_id = u.id AND b.blocked_id = $1)
      )
    ORDER BY last_at DESC NULLS LAST, c.created_at DESC
    `,
    [me],
  );

  return rows
    .filter((r) => r.can_chat)
    .map((r) => ({
      id: r.id,
      peerId: r.peer_id,
      peerUsername: r.username,
      peerFirstName: r.first_name,
      peerPhoto: r.photo,
      isOnline: r.is_online,
      lastSeenAt: r.last_seen_at,
      lastBody: r.last_body,
      lastAt: r.last_at,
      unread: Number(r.unread),
      canChat: r.can_chat,
    }));
}

export async function listMessages(conversationId: string): Promise<ChatMessage[]> {
  const { rows } = await query<{
    id: string;
    conversation_id: string;
    sender_id: string;
    body: string;
    created_at: Date;
  }>(
    `SELECT id, conversation_id, sender_id, body, created_at
     FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at ASC
     LIMIT 200`,
    [conversationId],
  );
  return rows.map((r) => ({
    id: r.id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    body: r.body,
    createdAt: r.created_at,
  }));
}

export async function markConversationRead(conversationId: string, me: string): Promise<void> {
  await query(
    `UPDATE messages SET read_at = NOW()
     WHERE conversation_id = $1 AND sender_id <> $2 AND read_at IS NULL`,
    [conversationId, me],
  );
}

export async function insertMessage(
  conversationId: string,
  senderId: string,
  body: string,
): Promise<ChatMessage> {
  const { rows } = await query<{
    id: string;
    conversation_id: string;
    sender_id: string;
    body: string;
    created_at: Date;
  }>(
    `INSERT INTO messages (conversation_id, sender_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, conversation_id, sender_id, body, created_at`,
    [conversationId, senderId, body],
  );
  const r = rows[0];
  return {
    id: r.id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    body: r.body,
    createdAt: r.created_at,
  };
}

export async function countUnreadMessages(me: string): Promise<number> {
  const { rows } = await query<{ n: string }>(
    `
    SELECT count(*)::text AS n
    FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    JOIN users u ON u.id = CASE WHEN c.user_a = $1 THEN c.user_b ELSE c.user_a END
    WHERE (c.user_a = $1 OR c.user_b = $1)
      AND m.sender_id <> $1
      AND m.read_at IS NULL
      AND EXISTS (
        SELECT 1 FROM likes l1
        JOIN likes l2
          ON l1.from_user_id = l2.to_user_id AND l1.to_user_id = l2.from_user_id
        WHERE l1.from_user_id = $1 AND l1.to_user_id = u.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM blocks b
        WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
           OR (b.blocker_id = u.id AND b.blocked_id = $1)
      )
    `,
    [me],
  );
  return Number(rows[0]?.n ?? 0);
}
