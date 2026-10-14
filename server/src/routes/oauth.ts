import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { hashPassword } from "../utils/password.js";
import { generateToken } from "../utils/token.js";
import { findUserByEmail, insertOAuthUser, loadPublicUser, setOnline } from "../db/users.js";
import { findUserIdByOAuth, linkOAuth } from "../db/oauth.js";
import { query } from "../db/pool.js";
import {
  authorizeUrl,
  enabledProviders,
  fetchOAuthProfile,
  getProvider,
} from "../services/oauth.js";

export const oauthRouter = Router();

oauthRouter.get("/providers", (_req, res) => {
  res.json({ providers: enabledProviders() });
});

oauthRouter.get(
  "/oauth/:provider",
  asyncHandler(async (req, res) => {
    const provider = getProvider(req.params.provider);
    if (!provider) {
      res.status(404).json({ error: "Ce fournisseur OAuth n'est pas configuré." });
      return;
    }
    const state = generateToken();
    req.session.oauthState = state;
    req.session.oauthProvider = provider.id;
    req.session.save((err) => {
      if (err) {
        res.status(500).json({ error: "Session OAuth impossible." });
        return;
      }
      res.redirect(authorizeUrl(provider, state));
    });
  }),
);

oauthRouter.get(
  "/oauth/:provider/callback",
  asyncHandler(async (req, res) => {
    const fail = (msg: string) => {
      res.redirect(`${env.CLIENT_URL}/login?error=${encodeURIComponent(msg)}`);
    };
    const parsed = z
      .object({
        code: z.string().min(1).optional(),
        state: z.string().min(1).optional(),
        error: z.string().optional(),
      })
      .safeParse(req.query);
    if (!parsed.success || parsed.data.error || !parsed.data.code || !parsed.data.state) {
      fail("Connexion OAuth annulée.");
      return;
    }
    if (
      parsed.data.state !== req.session.oauthState ||
      req.session.oauthProvider !== req.params.provider
    ) {
      fail("État OAuth invalide.");
      return;
    }
    const provider = getProvider(req.params.provider);
    if (!provider) {
      fail("Fournisseur OAuth inconnu.");
      return;
    }

    req.session.oauthState = undefined;
    req.session.oauthProvider = undefined;

    let profile;
    try {
      profile = await fetchOAuthProfile(provider, parsed.data.code);
    } catch (err) {
      console.error(err);
      fail("Impossible de récupérer le profil OAuth.");
      return;
    }

    let userId = await findUserIdByOAuth(profile.provider, profile.providerId);
    if (!userId) {
      const existing = await findUserByEmail(profile.email);
      if (existing) {
        userId = existing.id;
      } else {
        const username = await uniqueUsername(profile.username);
        const created = await insertOAuthUser({
          email: profile.email,
          username,
          firstName: profile.firstName.slice(0, 50) || "Prénom",
          lastName: profile.lastName.slice(0, 50) || "Nom",
          passwordHash: await hashPassword(generateToken() + "Aa1"),
        });
        userId = created.id;
      }
      await linkOAuth(userId, profile.provider, profile.providerId);
    }

    const uid = userId;
    req.session.regenerate((err) => {
      if (err) {
        fail("Session impossible.");
        return;
      }
      req.session.userId = uid;
      req.session.save(async (saveErr) => {
        if (saveErr) {
          fail("Session impossible.");
          return;
        }
        await setOnline(uid, true);
        const user = await loadPublicUser(uid);
        res.redirect(`${env.CLIENT_URL}${user?.profileComplete ? "/browse" : "/profile"}`);
      });
    });
  }),
);

async function uniqueUsername(base: string): Promise<string> {
  let candidate = base;
  for (let i = 0; i < 20; i += 1) {
    const { rows } = await query<{ n: string }>(
      `SELECT count(*)::text AS n FROM users WHERE lower(username) = lower($1)`,
      [candidate],
    );
    if (Number(rows[0]?.n ?? 1) === 0) return candidate;
    candidate = `${base.slice(0, 12)}_${Math.floor(Math.random() * 9000 + 1000)}`;
  }
  return `user_${generateToken().slice(0, 8)}`;
}
