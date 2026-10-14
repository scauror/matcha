import { query } from "./pool.js";
import { ChatError, getConversationForUser } from "./chat.js";

export type DateStatus = "pending" | "accepted" | "declined" | "cancelled";

export type DateCard = {
  id: string;
  conversationId: string;
  proposerId: string;
  peerId: string;
  peerUsername: string;
  peerFirstName: string;
  title: string;
  place: string;
  startsAt: Date;
  note: string | null;
  status: DateStatus;
  createdAt: Date;
};

type Row = {
  id: string;
  conversation_id: string;
  proposer_id: string;
  peer_id: string;
  username: string;
  first_name: string;
  title: string;
  place: string;
  starts_at: Date;
  note: string | null;
  status: DateStatus;
  created_at: Date;
};

function toCard(r: Row): DateCard {
  return {
    id: r.id,
    conversationId: r.conversation_id,
    proposerId: r.proposer_id,
    peerId: r.peer_id,
    peerUsername: r.username,
    peerFirstName: r.first_name,
    title: r.title,
    place: r.place,
    startsAt: r.starts_at,
    note: r.note,
    status: r.status,
    createdAt: r.created_at,
  };
}

export async function listDates(me: string): Promise<DateCard[]> {
  const { rows } = await query<Row>(
    `
    SELECT
      d.id,
      d.conversation_id,
      d.proposer_id,
      u.id AS peer_id,
      u.username,
      u.first_name,
      d.title,
      d.place,
      d.starts_at,
      d.note,
      d.status,
      d.created_at
    FROM dates d
    JOIN conversations c ON c.id = d.conversation_id
    JOIN users u ON u.id = CASE WHEN c.user_a = $1 THEN c.user_b ELSE c.user_a END
    WHERE (c.user_a = $1 OR c.user_b = $1)
      AND NOT EXISTS (
        SELECT 1 FROM blocks b
        WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
           OR (b.blocker_id = u.id AND b.blocked_id = $1)
      )
    ORDER BY d.starts_at ASC
    `,
    [me],
  );
  return rows.map(toCard);
}

export async function listDatesForConversation(me: string, conversationId: string): Promise<DateCard[]> {
  await getConversationForUser(me, conversationId);
  const all = await listDates(me);
  return all.filter((d) => d.conversationId === conversationId);
}

export async function insertDate(input: {
  me: string;
  conversationId: string;
  title: string;
  place: string;
  startsAt: Date;
  note: string | null;
}): Promise<DateCard> {
  const conv = await getConversationForUser(input.me, input.conversationId);
  if (!conv.canChat) {
    throw new ChatError(403, "Tu dois être matché pour proposer un rendez-vous.");
  }
  const { rows } = await query<{ id: string }>(
    `INSERT INTO dates (conversation_id, proposer_id, title, place, starts_at, note)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [input.conversationId, input.me, input.title, input.place, input.startsAt, input.note],
  );
  const created = (await listDates(input.me)).find((d) => d.id === rows[0].id);
  if (!created) throw new ChatError(500, "Rendez-vous introuvable après création.");
  return created;
}

export async function updateDateStatus(
  me: string,
  dateId: string,
  status: DateStatus,
): Promise<DateCard> {
  const { rows } = await query<{
    id: string;
    conversation_id: string;
    proposer_id: string;
    status: DateStatus;
  }>(
    `SELECT id, conversation_id, proposer_id, status FROM dates WHERE id = $1`,
    [dateId],
  );
  const row = rows[0];
  if (!row) throw new ChatError(404, "Rendez-vous introuvable.");
  await getConversationForUser(me, row.conversation_id);

  const isProposer = row.proposer_id === me;
  if (status === "cancelled") {
    const allowed =
      (row.status === "pending" && isProposer) || row.status === "accepted";
    if (!allowed) {
      throw new ChatError(400, "Tu ne peux pas annuler ce rendez-vous.");
    }
  } else if (status === "accepted" || status === "declined") {
    if (isProposer) {
      throw new ChatError(400, "Seul l'autre match peut accepter ou refuser.");
    }
    if (row.status !== "pending") {
      throw new ChatError(400, "Ce rendez-vous n'est plus en attente.");
    }
  } else {
    throw new ChatError(400, "Statut invalide.");
  }

  await query(`UPDATE dates SET status = $2 WHERE id = $1`, [dateId, status]);
  const updated = (await listDates(me)).find((d) => d.id === dateId);
  if (!updated) throw new ChatError(500, "Rendez-vous introuvable.");
  return updated;
}
