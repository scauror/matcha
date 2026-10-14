import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireCompleteProfile } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateBody } from "../middleware/validate.js";
import { ChatError } from "../db/chat.js";
import { insertDate, listDates, listDatesForConversation, updateDateStatus } from "../db/dates.js";
import { insertNotification } from "../db/notifications.js";
import { emitToUser } from "../sockets/index.js";

export const datesRouter = Router();
datesRouter.use(requireAuth, requireCompleteProfile);

const createSchema = z.object({
  conversationId: z.string().uuid(),
  title: z.string().trim().min(1).max(80),
  place: z.string().trim().min(1).max(120),
  startsAt: z.coerce.date(),
  note: z.string().trim().max(400).optional(),
});

const statusSchema = z.object({
  status: z.enum(["accepted", "declined", "cancelled"]),
});

function handleErr(err: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) {
  if (err instanceof ChatError) {
    res.status(err.status).json({ error: err.message });
    return true;
  }
  return false;
}

datesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ dates: await listDates(req.session.userId!) });
  }),
);

datesRouter.get(
  "/conversation/:id",
  asyncHandler(async (req, res) => {
    const parsed = z.string().uuid().safeParse(req.params.id);
    if (!parsed.success) {
      res.status(400).json({ error: "Conversation invalide." });
      return;
    }
    try {
      res.json({ dates: await listDatesForConversation(req.session.userId!, parsed.data) });
    } catch (err) {
      if (!handleErr(err, res)) throw err;
    }
  }),
);

datesRouter.post(
  "/",
  validateBody(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    const startsAt = body.startsAt;
    if (startsAt.getTime() < Date.now() - 60_000) {
      res.status(400).json({ error: "La date doit être dans le futur." });
      return;
    }
    try {
      const date = await insertDate({
        me: req.session.userId!,
        conversationId: body.conversationId,
        title: body.title,
        place: body.place,
        startsAt,
        note: body.note || null,
      });
      const notif = await insertNotification({
        userId: date.peerId,
        actorId: req.session.userId!,
        kind: "date",
        payload: { dateId: date.id, conversationId: date.conversationId },
      });
      emitToUser(date.peerId, "notification:new", notif);
      emitToUser(date.peerId, "date:update", date);
      res.status(201).json({ date });
    } catch (err) {
      if (!handleErr(err, res)) throw err;
    }
  }),
);

datesRouter.patch(
  "/:id",
  validateBody(statusSchema),
  asyncHandler(async (req, res) => {
    const parsed = z.string().uuid().safeParse(req.params.id);
    if (!parsed.success) {
      res.status(400).json({ error: "Rendez-vous invalide." });
      return;
    }
    const { status } = req.body as z.infer<typeof statusSchema>;
    try {
      const date = await updateDateStatus(req.session.userId!, parsed.data, status);
      const notif = await insertNotification({
        userId: date.peerId,
        actorId: req.session.userId!,
        kind: "date",
        payload: { dateId: date.id, status },
      });
      emitToUser(date.peerId, "notification:new", notif);
      emitToUser(date.peerId, "date:update", date);
      res.json({ date });
    } catch (err) {
      if (!handleErr(err, res)) throw err;
    }
  }),
);
