import { Router } from "express";
import { z } from "zod";
import { SESSION_COOKIE } from "../config/env.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateBody } from "../middleware/validate.js";
import { hashPassword, passwordIssues, verifyPassword } from "../utils/password.js";
import { generateToken, hashToken } from "../utils/token.js";
import { sendResetEmail, sendVerifyEmail } from "../services/email.js";
import {
  findUserByEmail,
  findUserByResetToken,
  findUserByUsername,
  findUserByVerifyToken,
  insertUser,
  loadPublicUser,
  markEmailVerified,
  setOnline,
  setResetToken,
  updatePassword,
} from "../db/users.js";
import { oauthRouter } from "./oauth.js";

export const authRouter = Router();
authRouter.use(oauthRouter);

const nameSchema = z
  .string()
  .trim()
  .min(1, "Requis")
  .max(50)
  .regex(/^[\p{L}][\p{L}\s'-]*$/u, "Lettres, espaces, apostrophes ou tirets uniquement");

const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(20)
  .regex(/^[a-zA-Z0-9_]+$/, "Lettres, chiffres et underscore uniquement");

const registerSchema = z
  .object({
    email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
    username: usernameSchema,
    firstName: nameSchema,
    lastName: nameSchema,
    password: z.string().min(1).max(72),
  })
  .superRefine((data, ctx) => {
    for (const issue of passwordIssues(data.password, {
      username: data.username,
      email: data.email,
    })) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue, path: ["password"] });
    }
  });

const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

const forgotSchema = z.object({
  email: z.string().trim().email().transform((v) => v.toLowerCase()),
});

const tokenSchema = z.object({
  token: z.string().min(16).max(128),
});

const resetSchema = z
  .object({
    token: z.string().min(16).max(128),
    password: z.string().min(1).max(72),
  })
  .superRefine((data, ctx) => {
    for (const issue of passwordIssues(data.password)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue, path: ["password"] });
    }
  });

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "23505";
}

authRouter.post(
  "/register",
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, username, firstName, lastName, password } = req.body as z.infer<
      typeof registerSchema
    >;
    const token = generateToken();

    try {
      await insertUser({
        email,
        username,
        firstName,
        lastName,
        passwordHash: await hashPassword(password),
        verifyTokenHash: hashToken(token),
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        res.status(409).json({ error: "Ce nom d'utilisateur ou cet e-mail est déjà utilisé." });
        return;
      }
      throw err;
    }

    await sendVerifyEmail(email, token);
    res.status(201).json({
      ok: true,
      message: "Compte créé. Vérifie tes e-mails pour activer le compte.",
    });
  }),
);

authRouter.post(
  "/verify",
  validateBody(tokenSchema),
  asyncHandler(async (req, res) => {
    const { token } = req.body as z.infer<typeof tokenSchema>;
    const user = await findUserByVerifyToken(hashToken(token));
    if (!user) {
      res.status(400).json({ error: "Lien de vérification invalide ou déjà utilisé." });
      return;
    }
    await markEmailVerified(user.id);
    res.json({ ok: true, message: "Adresse e-mail confirmée. Tu peux te connecter." });
  }),
);

authRouter.post(
  "/login",
  validateBody(loginSchema),
  asyncHandler(async (req, res, next) => {
    const { username, password } = req.body as z.infer<typeof loginSchema>;
    const user = await findUserByUsername(username);
    const valid = user ? await verifyPassword(password, user.password_hash) : false;

    if (!user || !valid) {
      res.status(401).json({ error: "Identifiants invalides." });
      return;
    }
    if (!user.email_verified) {
      res.status(403).json({ error: "Vérifie ton e-mail avant de te connecter." });
      return;
    }

    req.session.regenerate((err) => {
      if (err) {
        next(err);
        return;
      }
      req.session.userId = user.id;
      req.session.save(async (saveErr) => {
        if (saveErr) {
          next(saveErr);
          return;
        }
        await setOnline(user.id, true);
        const publicUser = await loadPublicUser(user.id);
        res.json({ user: publicUser });
      });
    });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res, next) => {
    const userId = req.session.userId;
    if (userId) {
      await setOnline(userId, false);
    }
    req.session.destroy((err) => {
      if (err) {
        next(err);
        return;
      }
      res.clearCookie(SESSION_COOKIE);
      res.json({ ok: true });
    });
  }),
);

authRouter.post(
  "/forgot-password",
  validateBody(forgotSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.body as z.infer<typeof forgotSchema>;
    const user = await findUserByEmail(email);
    if (user?.email_verified) {
      const token = generateToken();
      await setResetToken(user.id, hashToken(token));
      await sendResetEmail(user.email, token);
    }
    res.json({
      ok: true,
      message: "Si un compte existe pour cet e-mail, un lien de réinitialisation a été envoyé.",
    });
  }),
);

authRouter.post(
  "/reset-password",
  validateBody(resetSchema),
  asyncHandler(async (req, res) => {
    const { token, password } = req.body as z.infer<typeof resetSchema>;
    const user = await findUserByResetToken(hashToken(token));
    if (!user) {
      res.status(400).json({ error: "Lien de réinitialisation invalide ou expiré." });
      return;
    }
    await updatePassword(user.id, await hashPassword(password));
    res.json({ ok: true, message: "Mot de passe mis à jour. Tu peux te connecter." });
  }),
);

authRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    if (!req.session.userId) {
      res.json({ user: null });
      return;
    }
    const user = await loadPublicUser(req.session.userId);
    if (!user) {
      req.session.destroy(() => undefined);
      res.json({ user: null });
      return;
    }
    res.json({ user });
  }),
);
