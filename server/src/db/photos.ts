import { query } from "./pool.js";
import type { PhotoRow } from "../types/user.js";

export async function countPhotos(userId: string): Promise<number> {
  const { rows } = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM photos WHERE user_id = $1`,
    [userId],
  );
  return Number(rows[0]?.n ?? 0);
}

export async function insertPhoto(
  userId: string,
  filePath: string,
  isProfile: boolean,
  position: number,
): Promise<PhotoRow> {
  const { rows } = await query<PhotoRow>(
    `INSERT INTO photos (user_id, path, is_profile, position)
     VALUES ($1, $2, $3, $4)
     RETURNING id, path, is_profile, position`,
    [userId, filePath, isProfile, position],
  );
  return rows[0];
}

export async function findPhoto(userId: string, photoId: string): Promise<PhotoRow | null> {
  const { rows } = await query<PhotoRow>(
    `SELECT id, path, is_profile, position FROM photos WHERE id = $1 AND user_id = $2`,
    [photoId, userId],
  );
  return rows[0] ?? null;
}

export async function deletePhoto(userId: string, photoId: string): Promise<PhotoRow | null> {
  const { rows } = await query<PhotoRow>(
    `DELETE FROM photos WHERE id = $1 AND user_id = $2
     RETURNING id, path, is_profile, position`,
    [photoId, userId],
  );
  return rows[0] ?? null;
}

export async function setProfilePhoto(userId: string, photoId: string): Promise<void> {
  await query(`UPDATE photos SET is_profile = FALSE WHERE user_id = $1`, [userId]);
  await query(`UPDATE photos SET is_profile = TRUE WHERE id = $1 AND user_id = $2`, [
    photoId,
    userId,
  ]);
}

export async function reorderPhotos(userId: string, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += 1) {
    await query(`UPDATE photos SET position = $3 WHERE id = $1 AND user_id = $2`, [
      ids[i],
      userId,
      i,
    ]);
  }
}

export async function promoteFirstPhoto(userId: string): Promise<void> {
  await query(
    `UPDATE photos SET is_profile = TRUE
     WHERE id = (
       SELECT id FROM photos WHERE user_id = $1 ORDER BY position, created_at LIMIT 1
     )`,
    [userId],
  );
}
