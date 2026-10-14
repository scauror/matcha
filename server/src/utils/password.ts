import bcrypt from "bcrypt";
import { COMMON_WORDS } from "../data/common-words.js";

const BCRYPT_ROUNDS = 12;
const MIN_LEN = 8;
const MAX_LEN = 72;

export function passwordIssues(
  password: string,
  extras: { username?: string; email?: string } = {},
): string[] {
  const issues: string[] = [];

  if (password.length < MIN_LEN) {
    issues.push(`Le mot de passe doit contenir au moins ${MIN_LEN} caractères.`);
  }
  if (password.length > MAX_LEN) {
    issues.push(`Le mot de passe ne peut pas dépasser ${MAX_LEN} caractères.`);
  }
  if (!/[a-z]/.test(password)) {
    issues.push("Ajoute au moins une minuscule.");
  }
  if (!/[A-Z]/.test(password)) {
    issues.push("Ajoute au moins une majuscule.");
  }
  if (!/[0-9]/.test(password)) {
    issues.push("Ajoute au moins un chiffre.");
  }

  const lower = password.toLowerCase();
  const lettersOnly = lower.replace(/[^a-z]/g, "");
  const username = extras.username?.toLowerCase();
  const emailLocal = extras.email?.split("@")[0]?.toLowerCase();

  if (username && lower.includes(username) && username.length >= 3) {
    issues.push("Le mot de passe ne doit pas contenir ton nom d'utilisateur.");
  }
  if (emailLocal && emailLocal.length >= 3 && lower.includes(emailLocal)) {
    issues.push("Le mot de passe ne doit pas contenir ton adresse e-mail.");
  }
  if (COMMON_WORDS.has(lower) || (lettersOnly.length >= 4 && COMMON_WORDS.has(lettersOnly))) {
    issues.push("Ce mot de passe est trop courant (mot anglais ou mot de passe trop utilisé).");
  }

  return issues;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
