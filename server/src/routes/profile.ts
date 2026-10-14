import { mkdirSync, renameSync, unlinkSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { env } from "../config/env.js";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { detectImageExt } from "../utils/image.js";
import { generateToken, hashToken } from "../utils/token.js";
import { sendEmailChangedEmail } from "../services/email.js";
import { geocodeLabel, reverseGeocode } from "../services/geocode.js";
import {
  findUserByEmail,
  loadPublicUser,
  replaceUserTags,
  setVerifyToken,
  updateUserFields,
} from "../db/users.js";
import {
  countPhotos,
  deletePhoto,
  findPhoto,
  insertPhoto,
  promoteFirstPhoto,
  reorderPhotos,
  setProfilePhoto,
} from "../db/photos.js";
import { isBlockedEitherWay, listLikers, listViewers, recordFirstViewAndFame, getRelation } from "../db/social.js";
import { insertNotification } from "../db/notifications.js";
import { emitToUser } from "../sockets/index.js";

export const profileRouter = Router();
profileRouter.use(requireAuth);

const nameSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(/^[\p{L}][\p{L}\s'-]*$/u, "Lettres, espaces, apostrophes ou tirets uniquement");

const tagSchema = z
  .string()
  .trim()
  .toLowerCase()
  .transform((v) => v.replace(/^#/, ""))
  .pipe(z.string().min(2).max(24).regex(/^[a-z0-9-]+$/, "Tags : lettres, chiffres, tirets"));

function adultDate(): Date {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d;
}

const patchSchema = z.object({
  firstName: nameSchema.optional(),
  lastName: nameSchema.optional(),
  email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()).optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  orientation: z.enum(["heterosexual", "homosexual", "bisexual"]).optional(),
  bio: z.string().trim().min(1).max(500).optional(),
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((v) => {
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d <= adultDate() && d.getUTCFullYear() > 1900;
    }, "Tu dois avoir au moins 18 ans.")
    .optional(),
  gpsConsent: z.boolean().optional(),
  locationLabel: z.string().trim().min(2).max(120).optional(),
  latitude: z.number().gte(-90).lte(90).optional(),
  longitude: z.number().gte(-180).lte(180).optional(),
  tags: z.array(tagSchema).max(12).optional(),
});

const geocodeSchema = z.object({
  query: z.string().trim().min(2).max(120),
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = path.resolve(env.UPLOAD_DIR, req.session.userId!);
      mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, _file, cb) => {
      cb(null, `${randomUUID()}.tmp`);
    },
  }),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(new Error("INVALID_TYPE"));
      return;
    }
    cb(null, true);
  },
});

profileRouter.get(
  "/me",
  asyncHandler(async (req, res) => {
    const user = await loadPublicUser(req.session.userId!);
    if (!user) {
      res.status(404).json({ error: "Utilisateur introuvable." });
      return;
    }
    res.json({ user });
  }),
);

profileRouter.patch(
  "/me",
  validateBody(patchSchema),
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const body = req.body as z.infer<typeof patchSchema>;
    const current = await loadPublicUser(userId);
    if (!current) {
      res.status(404).json({ error: "Utilisateur introuvable." });
      return;
    }

    if (body.email && body.email !== current.email) {
      const taken = await findUserByEmail(body.email);
      if (taken) {
        res.status(409).json({ error: "Cette adresse e-mail est déjà utilisée." });
        return;
      }
    }

    let latitude = body.latitude;
    let longitude = body.longitude;
    let locationLabel = body.locationLabel;

    if (body.gpsConsent && latitude != null && longitude != null && !locationLabel) {
      locationLabel = (await reverseGeocode(latitude, longitude)) ?? "Position actuelle";
    }

    if (locationLabel && (latitude == null || longitude == null)) {
      const geo = await geocodeLabel(locationLabel);
      if (!geo) {
        res.status(400).json({ error: "Localisation introuvable. Précise une ville ou un quartier." });
        return;
      }
      latitude = geo.latitude;
      longitude = geo.longitude;
      locationLabel = geo.label;
    }

    await updateUserFields(userId, {
      first_name: body.firstName,
      last_name: body.lastName,
      email: body.email,
      gender: body.gender,
      orientation: body.orientation,
      bio: body.bio,
      birth_date: body.birthDate,
      latitude,
      longitude,
      location_label: locationLabel,
      gps_consent: body.gpsConsent,
    });

    if (body.tags) {
      await replaceUserTags(userId, body.tags);
    }

    if (body.email && body.email !== current.email) {
      const token = generateToken();
      await setVerifyToken(userId, hashToken(token));
      await sendEmailChangedEmail(body.email, token);
      req.session.destroy(() => undefined);
      res.json({
        user: null,
        message: "E-mail modifié. Vérifie ta nouvelle adresse avant de te reconnecter.",
      });
      return;
    }

    res.json({ user: await loadPublicUser(userId) });
  }),
);

profileRouter.post(
  "/me/geocode",
  validateBody(geocodeSchema),
  asyncHandler(async (req, res) => {
    const { query } = req.body as z.infer<typeof geocodeSchema>;
    const geo = await geocodeLabel(query);
    if (!geo) {
      res.status(404).json({ error: "Aucun résultat pour cette localisation." });
      return;
    }
    res.json(geo);
  }),
);

profileRouter.get(
  "/me/views",
  asyncHandler(async (req, res) => {
    res.json({ views: await listViewers(req.session.userId!) });
  }),
);

profileRouter.get(
  "/me/likes",
  asyncHandler(async (req, res) => {
    res.json({ likes: await listLikers(req.session.userId!) });
  }),
);

profileRouter.post(
  "/me/photos",
  (req, res, next) => {
    upload.single("photo")(req, res, (err: unknown) => {
      if (err) {
        res.status(400).json({ error: "Fichier invalide (JPEG, PNG ou WebP, 5 Mo max)." });
        return;
      }
      next();
    });
  },
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Aucune photo envoyée." });
      return;
    }

    const ext = detectImageExt(file.path);
    if (!ext) {
      unlinkSync(file.path);
      res.status(400).json({ error: "Le fichier n'est pas une image autorisée." });
      return;
    }

    const n = await countPhotos(userId);
    if (n >= 5) {
      unlinkSync(file.path);
      res.status(400).json({ error: "Maximum 5 photos." });
      return;
    }

    const finalName = `${randomUUID()}${ext}`;
    const finalAbs = path.join(path.dirname(file.path), finalName);
    renameSync(file.path, finalAbs);
    const publicPath = `/uploads/${userId}/${finalName}`;
    const photo = await insertPhoto(userId, publicPath, n === 0, n);
    res.status(201).json({ photo });
  }),
);

profileRouter.patch(
  "/me/coords",
  validateBody(
    z.object({
      latitude: z.number().gte(-90).lte(90),
      longitude: z.number().gte(-180).lte(180),
    }),
  ),
  asyncHandler(async (req, res) => {
    const { latitude, longitude } = req.body as { latitude: number; longitude: number };
    await updateUserFields(req.session.userId!, {
      latitude,
      longitude,
      gps_consent: true,
    });
    res.json({ ok: true, latitude, longitude });
  }),
);

profileRouter.patch(
  "/me/photos/order",
  validateBody(z.object({ ids: z.array(z.string().uuid()).min(1).max(5) })),
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const { ids } = req.body as { ids: string[] };
    const unique = new Set(ids);
    if (unique.size !== ids.length) {
      res.status(400).json({ error: "Ordre de photos invalide." });
      return;
    }
    for (const id of ids) {
      if (!(await findPhoto(userId, id))) {
        res.status(400).json({ error: "Photo introuvable." });
        return;
      }
    }
    await reorderPhotos(userId, ids);
    res.json({ user: await loadPublicUser(userId) });
  }),
);

profileRouter.post(
  "/me/photos/:id/profile",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const photo = await findPhoto(userId, req.params.id);
    if (!photo) {
      res.status(404).json({ error: "Photo introuvable." });
      return;
    }
    await setProfilePhoto(userId, photo.id);
    res.json({ user: await loadPublicUser(userId) });
  }),
);

profileRouter.delete(
  "/me/photos/:id",
  asyncHandler(async (req, res) => {
    const userId = req.session.userId!;
    const photo = await deletePhoto(userId, req.params.id);
    if (!photo) {
      res.status(404).json({ error: "Photo introuvable." });
      return;
    }
    const abs = path.resolve(env.UPLOAD_DIR, photo.path.replace(/^\/uploads\//, ""));
    try {
      unlinkSync(abs);
    } catch {
      // fichier déjà absent
    }
    if (photo.is_profile) {
      await promoteFirstPhoto(userId);
    }
    res.json({ user: await loadPublicUser(userId) });
  }),
);

profileRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const viewerId = req.session.userId!;
    const parsed = z.string().uuid().safeParse(req.params.id);
    if (!parsed.success) {
      res.status(404).json({ error: "Profil introuvable." });
      return;
    }
    const targetId = parsed.data;
    if (targetId === viewerId) {
      res.json({ user: await loadPublicUser(viewerId) });
      return;
    }
    if (await isBlockedEitherWay(viewerId, targetId)) {
      res.status(404).json({ error: "Profil introuvable." });
      return;
    }
    const user = await loadPublicUser(targetId);
    if (!user || !user.profileComplete) {
      res.status(404).json({ error: "Profil introuvable." });
      return;
    }
    const firstView = await recordFirstViewAndFame(viewerId, targetId);
    if (firstView) {
      const notif = await insertNotification({
        userId: targetId,
        actorId: viewerId,
        kind: "view",
      });
      emitToUser(targetId, "notification:new", notif);
    }
    const { email: _email, emailVerified: _ev, gpsConsent: _g, ...publicProfile } = user;
    res.json({
      user: publicProfile,
      relation: await getRelation(viewerId, targetId),
    });
  }),
);
