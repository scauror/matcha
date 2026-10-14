import { query } from "./pool.js";

export async function findUserIdByOAuth(provider: string, providerId: string): Promise<string | null> {
  const { rows } = await query<{ user_id: string }>(
    `SELECT user_id FROM oauth_identities WHERE provider = $1 AND provider_id = $2`,
    [provider, providerId],
  );
  return rows[0]?.user_id ?? null;
}

export async function linkOAuth(userId: string, provider: string, providerId: string): Promise<void> {
  await query(
    `INSERT INTO oauth_identities (user_id, provider, provider_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (provider, provider_id) DO NOTHING`,
    [userId, provider, providerId],
  );
}
