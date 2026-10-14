import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireCompleteProfile } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { validateBody } from "../middleware/validate.js";
import { insertNotification } from "../db/notifications.js";
import {
  ChatError,
  countUnreadMessages,
  getConversationForUser,
  insertMessage,
  listConversations,
  listMessages,
  markConversationRead,
  openConversationWith,
} from "../db/chat.js";
import { emitToUser } from "../sockets/index.js";

export const chatRouter = Router();
chatRouter.use(requireAuth, requireCompleteProfile);

const sendSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

function handleChatError(err: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) {
  if (err instanceof ChatError) {
    res.status(err.status).json({ error: err.message });
    return true;
  }
  return false;
}

chatRouter.get(
  "/unread",
  asyncHandler(async (req, res) => {
    res.json({ unread: await countUnreadMessages(req.session.userId!) });
  }),
);

chatRouter.get(
  "/conversations",
  asyncHandler(async (req, res) => {
    res.json({ conversations: await listConversations(req.session.userId!) });
  }),
);

chatRouter.get(
  "/with/:userId",
  asyncHandler(async (req, res) => {
    const parsed = z.string().uuid().safeParse(req.params.userId);
    if (!parsed.success) {
      res.status(400).json({ error: "Profil invalide." });
      return;
    }
    try {
      const id = await openConversationWith(req.session.userId!, parsed.data);
      res.json({ conversationId: id });
    } catch (err) {
      if (!handleChatError(err, res)) throw err;
    }
  }),
);

chatRouter.get(
  "/conversations/:id/messages",
  asyncHandler(async (req, res) => {
    const parsed = z.string().uuid().safeParse(req.params.id);
    if (!parsed.success) {
      res.status(400).json({ error: "Conversation invalide." });
      return;
    }
    try {
      const me = req.session.userId!;
      const conv = await getConversationForUser(me, parsed.data);
      await markConversationRead(conv.id, me);
      const messages = await listMessages(conv.id);
      res.json({
        conversationId: conv.id,
        peerId: conv.peerId,
        canChat: conv.canChat,
        messages,
      });
    } catch (err) {
      if (!handleChatError(err, res)) throw err;
    }
  }),
);

chatRouter.post(
  "/conversations/:id/messages",
  validateBody(sendSchema),
  asyncHandler(async (req, res) => {
    const parsed = z.string().uuid().safeParse(req.params.id);
    if (!parsed.success) {
      res.status(400).json({ error: "Conversation invalide." });
      return;
    }
    try {
      const me = req.session.userId!;
      const conv = await getConversationForUser(me, parsed.data);
      if (!conv.canChat) {
        res.status(403).json({ error: "Le chat n'est plus disponible (crush retiré ou blocage)." });
        return;
      }
      const { body } = req.body as z.infer<typeof sendSchema>;
      const message = await insertMessage(conv.id, me, body);
      const notif = await insertNotification({
        userId: conv.peerId,
        actorId: me,
        kind: "message",
        payload: { conversationId: conv.id },
      });
      emitToUser(conv.peerId, "chat:message", { ...message, peerId: me });
      emitToUser(me, "chat:message", { ...message, peerId: conv.peerId });
      emitToUser(conv.peerId, "notification:new", notif);
      res.status(201).json({ message });
    } catch (err) {
      if (!handleChatError(err, res)) throw err;
    }
  }),
);
