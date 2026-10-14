import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { countUnread, listNotifications, markAllRead } from "../db/notifications.js";

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const [items, unread] = await Promise.all([
      listNotifications(userId),
      countUnread(userId),
    ]);
    res.json({ notifications: items, unread });
  }),
);

notificationsRouter.post(
  "/read",
  asyncHandler(async (req, res) => {
    await markAllRead(req.session.userId!);
    res.json({ ok: true, unread: 0 });
  }),
);
