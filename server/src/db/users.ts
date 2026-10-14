import { query } from "./pool.js";
import { toPublicUser, type PhotoRow, type PublicUser, type UserRow } from "../types/user.js";

const USER_COLUMNS = `
  id, email, username, first_name, last_name, password_hash, email_verified,
  gender, orientation, bio, birth_date, fame_rating, latitude, longitude,
  location_label, gps_consent, is_online, last_seen_at, created_at, updated_at
`;

export async function findUserById(id: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users WHERE lower(username) = lower($1)`,
    [username],
  );
  return rows[0] ?? null;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users WHERE lower(email) = lower($1)`,
    [email],
  );
  return rows[0] ?? null;
}

export async function findUserByVerifyToken(tokenHash: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users WHERE verify_token = $1`,
    [tokenHash],
  );
  return rows[0] ?? null;
}

export async function findUserByResetToken(tokenHash: string): Promise<UserRow | null> {
  const { rows } = await query<UserRow>(
    `SELECT ${USER_COLUMNS} FROM users
     WHERE reset_token = $1 AND reset_expires > NOW()`,
    [tokenHash],
  );
  return rows[0] ?? null;
}

export async function insertUser(input: {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
  verifyTokenHash: string;
}): Promise<UserRow> {
  const { rows } = await query<UserRow>(
    `INSERT INTO users (email, username, first_name, last_name, password_hash, verify_token)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${USER_COLUMNS}`,
    [
      input.email,
      input.username,
      input.firstName,
      input.lastName,
      input.passwordHash,
      input.verifyTokenHash,
    ],
  );
  return rows[0];
}

export async function insertOAuthUser(input: {
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  passwordHash: string;
}): Promise<UserRow> {
  const { rows } = await query<UserRow>(
    `INSERT INTO users (email, username, first_name, last_name, password_hash, email_verified)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     RETURNING ${USER_COLUMNS}`,
    [input.email, input.username, input.firstName, input.lastName, input.passwordHash],
  );
  return rows[0];
}

export async function markEmailVerified(id: string): Promise<void> {
  await query(
    `UPDATE users SET email_verified = TRUE, verify_token = NULL, updated_at = NOW() WHERE id = $1`,
    [id],
  );
}

export async function setVerifyToken(id: string, tokenHash: string): Promise<void> {
  await query(
    `UPDATE users SET email_verified = FALSE, verify_token = $2, updated_at = NOW() WHERE id = $1`,
    [id, tokenHash],
  );
}

export async function setResetToken(id: string, tokenHash: string): Promise<void> {
  await query(
    `UPDATE users
     SET reset_token = $2, reset_expires = NOW() + INTERVAL '1 hour', updated_at = NOW()
     WHERE id = $1`,
    [id, tokenHash],
  );
}

export async function updatePassword(id: string, passwordHash: string): Promise<void> {
  await query(
    `UPDATE users
     SET password_hash = $2, reset_token = NULL, reset_expires = NULL, updated_at = NOW()
     WHERE id = $1`,
    [id, passwordHash],
  );
}

export async function setOnline(id: string, online: boolean): Promise<void> {
  await query(
    `UPDATE users SET is_online = $2, last_seen_at = NOW(), updated_at = NOW() WHERE id = $1`,
    [id, online],
  );
}

export async function getUserTags(userId: string): Promise<string[]> {
  const { rows } = await query<{ label: string }>(
    `SELECT t.label
     FROM user_tags ut
     JOIN tags t ON t.id = ut.tag_id
     WHERE ut.user_id = $1
     ORDER BY t.label`,
    [userId],
  );
  return rows.map((r) => r.label);
}

export async function getUserPhotos(userId: string): Promise<PhotoRow[]> {
  const { rows } = await query<PhotoRow>(
    `SELECT id, path, is_profile, position FROM photos WHERE user_id = $1 ORDER BY position, created_at`,
    [userId],
  );
  return rows;
}

export async function updateUserFields(
  id: string,
  fields: Partial<{
    first_name: string;
    last_name: string;
    email: string;
    gender: string;
    orientation: string;
    bio: string;
    birth_date: string;
    latitude: number;
    longitude: number;
    location_label: string;
    gps_consent: boolean;
  }>,
): Promise<void> {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return;
  const sets = entries.map(([col], i) => `${col} = $${i + 1}`);
  const values = entries.map(([, v]) => v);
  values.push(id);
  await query(
    `UPDATE users SET ${sets.join(", ")}, updated_at = NOW() WHERE id = $${values.length}`,
    values,
  );
}

export async function loadPublicUser(id: string): Promise<PublicUser | null> {
  const row = await findUserById(id);
  if (!row) return null;
  const [tags, photos] = await Promise.all([getUserTags(id), getUserPhotos(id)]);
  return toPublicUser(row, tags, photos);
}

export async function replaceUserTags(userId: string, labels: string[]): Promise<void> {
  await query(`DELETE FROM user_tags WHERE user_id = $1`, [userId]);
  for (const label of labels) {
    const { rows } = await query<{ id: number }>(
      `INSERT INTO tags (label) VALUES ($1)
       ON CONFLICT (label) DO UPDATE SET label = EXCLUDED.label
       RETURNING id`,
      [label],
    );
    await query(`INSERT INTO user_tags (user_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
      userId,
      rows[0].id,
    ]);
  }
}
