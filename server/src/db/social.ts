import { query } from "./pool.js";
import { computeFameDelta } from "../services/fame.js";

export async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  const { rows } = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM blocks
     WHERE (blocker_id = $1 AND blocked_id = $2)
        OR (blocker_id = $2 AND blocked_id = $1)`,
    [a, b],
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

export async function recordFirstViewAndFame(viewerId: string, viewedId: string): Promise<boolean> {
  const { rows } = await query(
    `INSERT INTO profile_views (viewer_id, viewed_id, viewed_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (viewer_id, viewed_id) DO NOTHING
     RETURNING viewer_id`,
    [viewerId, viewedId],
  );
  if (rows.length > 0) {
    await bumpFame(viewedId, "view");
    return true;
  }
  await query(
    `UPDATE profile_views SET viewed_at = NOW() WHERE viewer_id = $1 AND viewed_id = $2`,
    [viewerId, viewedId],
  );
  return false;
}

export async function bumpFame(
  userId: string,
  event: "view" | "like" | "unlike" | "report",
): Promise<void> {
  await query(
    `UPDATE users SET fame_rating = LEAST(1000, GREATEST(0, fame_rating + $2)), updated_at = NOW() WHERE id = $1`,
    [userId, computeFameDelta(event)],
  );
}

export type ProfileVisitor = {
  id: string;
  username: string;
  firstName: string;
  fameRating: number;
  at: Date;
};

export async function listViewers(userId: string): Promise<ProfileVisitor[]> {
  const { rows } = await query<{
    id: string;
    username: string;
    first_name: string;
    fame_rating: number;
    viewed_at: Date;
  }>(
    `SELECT u.id, u.username, u.first_name, u.fame_rating, pv.viewed_at
     FROM profile_views pv
     JOIN users u ON u.id = pv.viewer_id
     WHERE pv.viewed_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM blocks b
         WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
            OR (b.blocker_id = u.id AND b.blocked_id = $1)
       )
     ORDER BY pv.viewed_at DESC
     LIMIT 100`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    firstName: r.first_name,
    fameRating: r.fame_rating,
    at: r.viewed_at,
  }));
}

export async function listLikers(userId: string): Promise<ProfileVisitor[]> {
  const { rows } = await query<{
    id: string;
    username: string;
    first_name: string;
    fame_rating: number;
    created_at: Date;
  }>(
    `SELECT u.id, u.username, u.first_name, u.fame_rating, l.created_at
     FROM likes l
     JOIN users u ON u.id = l.from_user_id
     WHERE l.to_user_id = $1
       AND NOT EXISTS (
         SELECT 1 FROM blocks b
         WHERE (b.blocker_id = $1 AND b.blocked_id = u.id)
            OR (b.blocker_id = u.id AND b.blocked_id = $1)
       )
     ORDER BY l.created_at DESC
     LIMIT 100`,
    [userId],
  );
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    firstName: r.first_name,
    fameRating: r.fame_rating,
    at: r.created_at,
  }));
}

export type Relation = {
  likedByMe: boolean;
  likesMe: boolean;
  isMatch: boolean;
};

export async function areMatched(a: string, b: string): Promise<boolean> {
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

export async function getRelation(me: string, them: string): Promise<Relation> {
  const { rows } = await query<{ liked_by_me: boolean; likes_me: boolean }>(
    `SELECT
       EXISTS (SELECT 1 FROM likes WHERE from_user_id = $1 AND to_user_id = $2) AS liked_by_me,
       EXISTS (SELECT 1 FROM likes WHERE from_user_id = $2 AND to_user_id = $1) AS likes_me`,
    [me, them],
  );
  const likedByMe = rows[0]?.liked_by_me ?? false;
  const likesMe = rows[0]?.likes_me ?? false;
  return { likedByMe, likesMe, isMatch: likedByMe && likesMe };
}

export async function hasProfilePhoto(userId: string): Promise<boolean> {
  const { rows } = await query<{ ok: boolean }>(
    `SELECT EXISTS (SELECT 1 FROM photos WHERE user_id = $1 AND is_profile = TRUE) AS ok`,
    [userId],
  );
  return rows[0]?.ok ?? false;
}

export async function insertLike(fromId: string, toId: string): Promise<boolean> {
  const { rowCount } = await query(
    `INSERT INTO likes (from_user_id, to_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [fromId, toId],
  );
  return (rowCount ?? 0) > 0;
}

export async function deleteLike(fromId: string, toId: string): Promise<boolean> {
  const { rowCount } = await query(
    `DELETE FROM likes WHERE from_user_id = $1 AND to_user_id = $2`,
    [fromId, toId],
  );
  return (rowCount ?? 0) > 0;
}

export async function ensureConversation(a: string, b: string): Promise<string> {
  const [userA, userB] = a < b ? [a, b] : [b, a];
  const inserted = await query<{ id: string }>(
    `INSERT INTO conversations (user_a, user_b) VALUES ($1, $2)
     ON CONFLICT (user_a, user_b) DO NOTHING
     RETURNING id`,
    [userA, userB],
  );
  if (inserted.rows[0]) return inserted.rows[0].id;
  const existing = await query<{ id: string }>(
    `SELECT id FROM conversations WHERE user_a = $1 AND user_b = $2`,
    [userA, userB],
  );
  return existing.rows[0].id;
}

export async function insertBlock(blockerId: string, blockedId: string): Promise<void> {
  await query(
    `INSERT INTO blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [blockerId, blockedId],
  );
  await query(
    `DELETE FROM likes WHERE (from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1)`,
    [blockerId, blockedId],
  );
}

export async function deleteBlock(blockerId: string, blockedId: string): Promise<boolean> {
  const { rowCount } = await query(
    `DELETE FROM blocks WHERE blocker_id = $1 AND blocked_id = $2`,
    [blockerId, blockedId],
  );
  return (rowCount ?? 0) > 0;
}

export async function insertReport(
  reporterId: string,
  reportedId: string,
  reason: string | null,
): Promise<boolean> {
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM reports WHERE reporter_id = $1 AND reported_id = $2 LIMIT 1`,
    [reporterId, reportedId],
  );
  if (rows[0]) return false;
  await query(
    `INSERT INTO reports (reporter_id, reported_id, reason) VALUES ($1, $2, $3)`,
    [reporterId, reportedId, reason],
  );
  return true;
}
