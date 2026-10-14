import type { RequestHandler } from "express";
import { loadPublicUser } from "../db/users.js";

declare module "express-session" {
  interface SessionData {
    userId?: string;
    oauthState?: string;
    oauthProvider?: string;
  }
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
};

export const requireCompleteProfile: RequestHandler = (req, res, next) => {
  const userId = req.session.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  loadPublicUser(userId)
    .then((user) => {
      if (!user?.profileComplete) {
        res.status(403).json({ error: "Complète ton profil pour continuer." });
        return;
      }
      next();
    })
    .catch(next);
};
