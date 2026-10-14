import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireCompleteProfile } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { loadPublicUser } from "../db/users.js";
import { insertNotification } from "../db/notifications.js";
import {
  bumpFame,
  deleteBlock,
  deleteLike,
  ensureConversation,
  getRelation,
  hasProfilePhoto,
  insertBlock,
  insertLike,
  insertReport,
  isBlockedEitherWay,
} from "../db/social.js";
import { emitToUser } from "../sockets/index.js";

export const socialRouter = Router();
socialRouter.use(requireAuth, requireCompleteProfile);

const idParam = z.string().uuid();
const reportSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

async function notify(
  userId: string,
  actorId: string,
  kind: "like" | "unlike" | "view" | "match",
) {
  const notif = await insertNotification({ userId, actorId, kind });
  emitToUser(userId, "notification:new", notif);
}

socialRouter.post(
  "/like/:userId",
  asyncHandler(async (req, res) => {
    const me = req.session.userId!;
    const parsed = idParam.safeParse(req.params.userId);
    if (!parsed.success || parsed.data === me) {
      res.status(400).json({ error: "Profil invalide." });
      return;
    }
    const targetId = parsed.data;
    if (!(await hasProfilePhoto(me))) {
      res.status(403).json({ error: "Ajoute une photo de profil pour envoyer un crush." });
      return;
    }
    if (await isBlockedEitherWay(me, targetId)) {
      res.status(404).json({ error: "Profil introuvable." });
      return;
    }
    const target = await loadPublicUser(targetId);
    if (!target?.profileComplete) {
      res.status(404).json({ error: "Profil introuvable." });
      return;
    }

    const created = await insertLike(me, targetId);
    if (created) {
      await bumpFame(targetId, "like");
      const relation = await getRelation(me, targetId);
      await notify(targetId, me, "like");
      if (relation.isMatch) {
        await ensureConversation(me, targetId);
        await notify(targetId, me, "match");
        await notify(me, targetId, "match");
      }
      res.json({ relation });
      return;
    }
    res.json({ relation: await getRelation(me, targetId) });
  }),
);

socialRouter.delete(
  "/like/:userId",
  asyncHandler(async (req, res) => {
    const me = req.session.userId!;
    const parsed = idParam.safeParse(req.params.userId);
    if (!parsed.success) {
      res.status(400).json({ error: "Profil invalide." });
      return;
    }
    const targetId = parsed.data;
    const before = await getRelation(me, targetId);
    const removed = await deleteLike(me, targetId);
    if (!removed) {
      res.status(404).json({ error: "Aucun crush à retirer." });
      return;
    }
    await bumpFame(targetId, "unlike");
    if (before.isMatch) {
      await notify(targetId, me, "unlike");
    }
    res.json({ relation: await getRelation(me, targetId) });
  }),
);

socialRouter.post(
  "/block/:userId",
  asyncHandler(async (req, res) => {
    const me = req.session.userId!;
    const parsed = idParam.safeParse(req.params.userId);
    if (!parsed.success || parsed.data === me) {
      res.status(400).json({ error: "Profil invalide." });
      return;
    }
    await insertBlock(me, parsed.data);
    res.json({ ok: true, blocked: true });
  }),
);

socialRouter.delete(
  "/block/:userId",
  asyncHandler(async (req, res) => {
    const me = req.session.userId!;
    const parsed = idParam.safeParse(req.params.userId);
    if (!parsed.success) {
      res.status(400).json({ error: "Profil invalide." });
      return;
    }
    await deleteBlock(me, parsed.data);
    res.json({ ok: true, blocked: false });
  }),
);

socialRouter.post(
  "/report/:userId",
  asyncHandler(async (req, res) => {
    const me = req.session.userId!;
    const parsed = idParam.safeParse(req.params.userId);
    const body = reportSchema.safeParse(req.body ?? {});
    if (!parsed.success || parsed.data === me || !body.success) {
      res.status(400).json({ error: "Signalement invalide." });
      return;
    }
    const created = await insertReport(me, parsed.data, body.data.reason ?? "fake account");
    if (created) {
      await bumpFame(parsed.data, "report");
    }
    res.json({ ok: true });
  }),
);
