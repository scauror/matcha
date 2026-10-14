import { query } from "./pool.js";

export type NotifKind = "like" | "unlike" | "view" | "message" | "match" | "date";

export type NotificationRow = {
  id: string;
  kind: NotifKind;
  actorId: string | null;
  actorUsername: string | null;
  actorFirstName: string | null;
  payload: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
};

export async function insertNotification(input: {
  userId: string;
  actorId: string | null;
  kind: NotifKind;
  payload?: Record<string, unknown>;
}): Promise<NotificationRow> {
  const { rows } = await query<{
    id: string;
    kind: NotifKind;
    actor_id: string | null;
    payload: Record<string, unknown>;
    is_read: boolean;
    created_at: Date;
    username: string | null;
    first_name: string | null;
  }>(
    `INSERT INTO notifications (user_id, actor_id, kind, payload)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id, kind, actor_id, payload, is_read, created_at`,
    [input.userId, input.actorId, input.kind, JSON.stringify(input.payload ?? {})],
  );
  const row = rows[0];
  let username: string | null = null;
  let firstName: string | null = null;
  if (input.actorId) {
    const actor = await query<{ username: string; first_name: string }>(
      `SELECT username, first_name FROM users WHERE id = $1`,
      [input.actorId],
    );
    username = actor.rows[0]?.username ?? null;
    firstName = actor.rows[0]?.first_name ?? null;
  }
  return {
    id: row.id,
    kind: row.kind,
    actorId: row.actor_id,
    actorUsername: username,
    actorFirstName: firstName,
    payload: row.payload,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

export async function listNotifications(userId: string, limit = 50): Promise<NotificationRow[]> {
  const { rows } = await query<{
    id: string;
    kind: NotifKind;
    actor_id: string | null;
    payload: Record<string, unknown>;
    is_read: boolean;
    created_at: Date;
    username: string | null;
    first_name: string | null;
  }>(
    `SELECT n.id, n.kind, n.actor_id, n.payload, n.is_read, n.created_at,
            u.username, u.first_name
     FROM notifications n
     LEFT JOIN users u ON u.id = n.actor_id
     WHERE n.user_id = $1
     ORDER BY n.created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    actorId: r.actor_id,
    actorUsername: r.username,
    actorFirstName: r.first_name,
    payload: r.payload,
    isRead: r.is_read,
    createdAt: r.created_at,
  }));
}

export async function countUnread(userId: string): Promise<number> {
  const { rows } = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM notifications WHERE user_id = $1 AND is_read = FALSE`,
    [userId],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function markAllRead(userId: string): Promise<void> {
  await query(`UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`, [
    userId,
  ]);
}
