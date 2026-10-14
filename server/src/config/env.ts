import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const envFile = [resolve(projectRoot, ".env"), resolve(process.cwd(), ".env")].find((p) =>
  existsSync(p),
);
dotenv.config({ path: envFile });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(3000),
  CLIENT_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  SESSION_SECRET: z.string().min(16),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_FROM: z.string().min(1),
  EMAIL_VERIFY_BASE_URL: z.string().url(),
  PASSWORD_RESET_BASE_URL: z.string().url(),
  UPLOAD_DIR: z.string().default("./uploads"),
  MAX_UPLOAD_BYTES: z.coerce.number().default(5 * 1024 * 1024),
  PUBLIC_API_URL: z.string().url().optional(),
  OAUTH_42_UID: z.string().optional().default(""),
  OAUTH_42_SECRET: z.string().optional().default(""),
  OAUTH_GITHUB_ID: z.string().optional().default(""),
  OAUTH_GITHUB_SECRET: z.string().optional().default(""),
  OAUTH_GOOGLE_ID: z.string().optional().default(""),
  OAUTH_GOOGLE_SECRET: z.string().optional().default(""),
});

export const env = envSchema.parse(process.env);
export const SESSION_COOKIE = "matcha.sid";
export const API_PUBLIC_URL = env.PUBLIC_API_URL ?? `http://localhost:${env.PORT}`;
