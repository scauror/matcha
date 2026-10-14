import { query } from "./pool.js";
import {
  DISTANCE_KM,
  NOT_BLOCKED,
  ORIENTATION_COMPATIBLE,
  PROFILE_READY,
  SAME_AREA_KM,
} from "../services/matching.js";
import type { BrowseCard, BrowseFilters } from "../types/browse.js";

type Row = {
  id: string;
  username: string;
  first_name: string;
  age: string;
  gender: string;
  orientation: string;
  bio: string | null;
  fame_rating: number;
  distance_km: string;
  shared_tags: string;
  location_label: string | null;
  tags: string[] | null;
  photo: string | null;
  is_online: boolean;
  last_seen_at: Date | null;
  liked_by_me: boolean;
  likes_me: boolean;
  latitude?: string;
  longitude?: string;
};

export async function listBrowseProfiles(
  meId: string,
  filters: BrowseFilters,
): Promise<{ profiles: BrowseCard[]; total: number }> {
  const params: unknown[] = [meId];
  const where: string[] = [
    "u.id <> me.id",
    PROFILE_READY,
    NOT_BLOCKED,
    ORIENTATION_COMPATIBLE,
  ];

  if (filters.excludeLiked) {
    where.push(
      `NOT EXISTS (SELECT 1 FROM likes l WHERE l.from_user_id = me.id AND l.to_user_id = u.id)`,
    );
  }

  if (filters.minAge != null) {
    params.push(filters.minAge);
    where.push(`EXTRACT(YEAR FROM AGE(u.birth_date)) >= $${params.length}`);
  }
  if (filters.maxAge != null) {
    params.push(filters.maxAge);
    where.push(`EXTRACT(YEAR FROM AGE(u.birth_date)) <= $${params.length}`);
  }
  if (filters.minFame != null) {
    params.push(filters.minFame);
    where.push(`u.fame_rating >= $${params.length}`);
  }
  if (filters.maxFame != null) {
    params.push(filters.maxFame);
    where.push(`u.fame_rating <= $${params.length}`);
  }
  if (filters.maxDistance != null) {
    params.push(filters.maxDistance);
    where.push(`(${DISTANCE_KM}) <= $${params.length}`);
  }
  if (filters.tags && filters.tags.length > 0) {
    params.push(filters.tags);
    where.push(`
      (
        SELECT count(*) FROM user_tags ut
        JOIN tags t ON t.id = ut.tag_id
        WHERE ut.user_id = u.id AND t.label = ANY($${params.length}::text[])
      ) = ${filters.tags.length}
    `);
  }

  const whereSql = where.join("\nAND ");

  const orderSql = orderClause(filters);

  params.push(filters.limit);
  const limitIdx = params.length;
  params.push(filters.offset);
  const offsetIdx = params.length;

  const fromSql = `
    FROM users u
    CROSS JOIN users me
    WHERE me.id = $1
      AND ${whereSql}
  `;

  const { rows: countRows } = await query<{ n: string }>(
    `SELECT count(*)::text AS n ${fromSql}`,
    params.slice(0, params.length - 2),
  );

  const { rows } = await query<Row>(
    `
    SELECT * FROM (
      SELECT
        u.id,
        u.username,
        u.first_name,
        EXTRACT(YEAR FROM AGE(u.birth_date))::int AS age,
        u.gender::text,
        u.orientation::text,
        u.bio,
        u.fame_rating,
        (${DISTANCE_KM}) AS distance_km,
        (
          SELECT count(*)::int FROM user_tags a
          JOIN user_tags b ON a.tag_id = b.tag_id
          WHERE a.user_id = me.id AND b.user_id = u.id
        ) AS shared_tags,
        u.location_label,
        ARRAY(
          SELECT t.label FROM user_tags ut
          JOIN tags t ON t.id = ut.tag_id
          WHERE ut.user_id = u.id
          ORDER BY t.label
        ) AS tags,
        (SELECT path FROM photos WHERE user_id = u.id AND is_profile = TRUE LIMIT 1) AS photo,
        u.is_online,
        u.last_seen_at,
        EXISTS (SELECT 1 FROM likes WHERE from_user_id = me.id AND to_user_id = u.id) AS liked_by_me,
        EXISTS (SELECT 1 FROM likes WHERE from_user_id = u.id AND to_user_id = me.id) AS likes_me
      ${fromSql}
    ) ranked
    ORDER BY ${orderSql}
    LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `,
    params,
  );

  return {
    total: Number(countRows[0]?.n ?? 0),
    profiles: rows.map(toCard),
  };
}

function orderClause(filters: BrowseFilters): string {
  const dir = filters.order === "asc" ? "ASC" : "DESC";
  switch (filters.sort) {
    case "age":
      return `age ${dir}, id`;
    case "distance":
      return `distance_km ${dir}, id`;
    case "fame":
      return `fame_rating ${dir}, id`;
    case "tags":
      return `shared_tags ${dir}, distance_km ASC, id`;
    default:
      return `(distance_km <= ${SAME_AREA_KM}) DESC, distance_km ASC, shared_tags DESC, fame_rating DESC, id`;
  }
}

function toCard(r: Row): BrowseCard {
  return {
    id: r.id,
    username: r.username,
    firstName: r.first_name,
    age: Number(r.age),
    gender: r.gender,
    orientation: r.orientation,
    bio: r.bio,
    fameRating: r.fame_rating,
    distanceKm: Math.round(Number(r.distance_km) * 10) / 10,
    sharedTags: Number(r.shared_tags),
    locationLabel: r.location_label,
    tags: r.tags ?? [],
    photo: r.photo,
    isOnline: r.is_online,
    lastSeenAt: r.last_seen_at,
    likedByMe: r.liked_by_me,
    likesMe: r.likes_me,
    isMatch: r.liked_by_me && r.likes_me,
    latitude: r.latitude != null ? Number(r.latitude) : undefined,
    longitude: r.longitude != null ? Number(r.longitude) : undefined,
  };
}

export async function listMapProfiles(meId: string): Promise<BrowseCard[]> {
  const { rows } = await query<Row>(
    `
    SELECT
      u.id,
      u.username,
      u.first_name,
      EXTRACT(YEAR FROM AGE(u.birth_date))::int AS age,
      u.gender::text,
      u.orientation::text,
      u.bio,
      u.fame_rating,
      (${DISTANCE_KM}) AS distance_km,
      (
        SELECT count(*)::int FROM user_tags a
        JOIN user_tags b ON a.tag_id = b.tag_id
        WHERE a.user_id = me.id AND b.user_id = u.id
      ) AS shared_tags,
      u.location_label,
      ARRAY(
        SELECT t.label FROM user_tags ut
        JOIN tags t ON t.id = ut.tag_id
        WHERE ut.user_id = u.id
        ORDER BY t.label
      ) AS tags,
      (SELECT path FROM photos WHERE user_id = u.id AND is_profile = TRUE LIMIT 1) AS photo,
      u.is_online,
      u.last_seen_at,
      EXISTS (SELECT 1 FROM likes WHERE from_user_id = me.id AND to_user_id = u.id) AS liked_by_me,
      EXISTS (SELECT 1 FROM likes WHERE from_user_id = u.id AND to_user_id = me.id) AS likes_me,
      u.latitude::text,
      u.longitude::text
    FROM users u
    CROSS JOIN users me
    WHERE me.id = $1
      AND u.id <> me.id
      AND ${PROFILE_READY}
      AND ${NOT_BLOCKED}
      AND ${ORIENTATION_COMPATIBLE}
      AND u.latitude IS NOT NULL
      AND u.longitude IS NOT NULL
    ORDER BY (${DISTANCE_KM}) ASC
    LIMIT 400
    `,
    [meId],
  );
  return rows.map(toCard);
}
