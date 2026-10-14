import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { faker } from "@faker-js/faker/locale/fr";
import bcrypt from "bcrypt";
import { env } from "../config/env.js";
import { pool } from "./pool.js";

const PLACEHOLDER_PNG = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082",
  "hex",
);

const CITIES: { label: string; lat: number; lon: number }[] = [
  { label: "Paris", lat: 48.8566, lon: 2.3522 },
  { label: "Lyon", lat: 45.764, lon: 4.8357 },
  { label: "Marseille", lat: 43.2965, lon: 5.3698 },
  { label: "Lille", lat: 50.6292, lon: 3.0573 },
  { label: "Toulouse", lat: 43.6047, lon: 1.4442 },
  { label: "Bordeaux", lat: 44.8378, lon: -0.5792 },
  { label: "Nantes", lat: 47.2184, lon: -1.5536 },
  { label: "Strasbourg", lat: 48.5734, lon: 7.7521 },
  { label: "Nice", lat: 43.7102, lon: 7.262 },
  { label: "Rennes", lat: 48.1173, lon: -1.6778 },
];

const TAGS = [
  "vegan",
  "geek",
  "piercing",
  "yoga",
  "musique",
  "voyage",
  "cinema",
  "sport",
  "lecture",
  "cuisine",
  "photo",
  "art",
  "gaming",
  "rando",
  "cafe",
];

function jitter(n: number, spread = 0.08): number {
  return n + (Math.random() * 2 - 1) * spread;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seed() {
  const { rows } = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM users WHERE username LIKE 'seed_%'`,
  );
  if (Number(rows[0]?.n ?? 0) > 0) {
    console.log("Removing previous seed users…");
    await pool.query(`DELETE FROM users WHERE username LIKE 'seed_%'`);
  }

  mkdirSync(path.resolve(env.UPLOAD_DIR), { recursive: true });
  writeFileSync(path.join(path.resolve(env.UPLOAD_DIR), "placeholder.png"), PLACEHOLDER_PNG);

  const passwordHash = await bcrypt.hash("MatchaSeed#42", 10);

  for (const label of TAGS) {
    await pool.query(`INSERT INTO tags (label) VALUES ($1) ON CONFLICT (label) DO NOTHING`, [label]);
  }
  const tagRows = await pool.query<{ id: number; label: string }>(`SELECT id, label FROM tags`);
  const tagIds = tagRows.rows.map((t) => t.id);

  const bios = [
    "Amateur de cafés trop chauds et de playlists trop longues.",
    "Je marche vite, je parle encore plus vite.",
    "À la recherche de quelqu'un pour partager des restos moyens et de grands films.",
    "Le week-end : rando ou canapé, selon la météo intérieure.",
    "Je code, je cuisine, je me plains du métro.",
    "Fan de fromage, allergique aux conversations fades.",
  ];

  const BATCH = 5;
  const TOTAL = 5;

  for (let i = 0; i < TOTAL; i += BATCH) {
    const values: unknown[] = [];
    const placeholders: string[] = [];
    let p = 1;
    const n = Math.min(BATCH, TOTAL - i);

    for (let j = 0; j < n; j++) {
      const idx = i + j + 1;
      const gender = faker.helpers.weightedArrayElement([
        { value: "female" as const, weight: 48 },
        { value: "male" as const, weight: 48 },
        { value: "other" as const, weight: 4 },
      ]);
      const orientation = faker.helpers.weightedArrayElement([
        { value: "heterosexual" as const, weight: 70 },
        { value: "bisexual" as const, weight: 20 },
        { value: "homosexual" as const, weight: 10 },
      ]);
      const city = faker.helpers.arrayElement(CITIES);
      const first = faker.person.firstName(gender === "female" ? "female" : "male");
      const last = faker.person.lastName();
      const birth = faker.date.birthdate({ min: 21, max: 42, mode: "age" });
      const birthStr = birth.toISOString().slice(0, 10);

      placeholders.push(
        `($${p++}, $${p++}, $${p++}, $${p++}, $${p++}, TRUE, $${p++}::gender_t, $${p++}::orientation_t, $${p++}, $${p++}::date, $${p++}, $${p++}, $${p++}, $${p++}, FALSE)`,
      );
      values.push(
        `seed${idx}@matcha.local`,
        `seed_${idx}`,
        first,
        last,
        passwordHash,
        gender,
        orientation,
        pick(bios),
        birthStr,
        faker.number.int({ min: 0, max: 80 }),
        jitter(city.lat),
        jitter(city.lon),
        city.label,
      );
    }

    const inserted = await pool.query<{ id: string }>(
      `INSERT INTO users (
         email, username, first_name, last_name, password_hash, email_verified,
         gender, orientation, bio, birth_date, fame_rating, latitude, longitude,
         location_label, gps_consent
       ) VALUES ${placeholders.join(",")}
       RETURNING id`,
      values,
    );

    for (const row of inserted.rows) {
      await pool.query(
        `INSERT INTO photos (user_id, path, is_profile, position)
         VALUES ($1, '/uploads/placeholder.png', TRUE, 0)`,
        [row.id],
      );
      const chosen = faker.helpers.arrayElements(tagIds, faker.number.int({ min: 2, max: 5 }));
      for (const tagId of chosen) {
        await pool.query(
          `INSERT INTO user_tags (user_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [row.id, tagId],
        );
      }
    }
    console.log(`Seeded ${Math.min(i + BATCH, TOTAL)} / ${TOTAL}`);
  }

  console.log("Seed done: 5 test profiles.");
  await pool.end();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
