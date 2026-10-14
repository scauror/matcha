import { z, ZodError } from "zod";
import { Router } from "express";
import { requireAuth, requireCompleteProfile } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { listBrowseProfiles, listMapProfiles } from "../db/browse.js";
import type { BrowseFilters, BrowseSort } from "../types/browse.js";

export const browseRouter = Router();
browseRouter.use(requireAuth, requireCompleteProfile);

const querySchema = z.object({
  minAge: z.coerce.number().int().min(18).max(99).optional(),
  maxAge: z.coerce.number().int().min(18).max(99).optional(),
  minFame: z.coerce.number().int().min(0).max(1000).optional(),
  maxFame: z.coerce.number().int().min(0).max(1000).optional(),
  maxDistance: z.coerce.number().min(1).max(20000).optional(),
  tags: z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(",")
            .map((t) => t.trim().replace(/^#/, "").toLowerCase())
            .filter(Boolean)
        : undefined,
    ),
  sort: z.enum(["smart", "age", "distance", "fame", "tags"]).default("smart"),
  order: z.enum(["asc", "desc"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});

function parseFilters(raw: unknown, excludeLiked: boolean): BrowseFilters {
  const q = querySchema.parse(raw);
  const order =
    q.order ?? (q.sort === "age" || q.sort === "distance" ? "asc" : "desc");
  return {
    minAge: q.minAge,
    maxAge: q.maxAge,
    minFame: q.minFame,
    maxFame: q.maxFame,
    maxDistance: q.maxDistance,
    tags: q.tags,
    sort: q.sort as BrowseSort,
    order,
    excludeLiked,
    limit: q.limit,
    offset: q.offset,
  };
}

browseRouter.get(
  "/suggestions",
  asyncHandler(async (req, res) => {
    try {
      const filters = parseFilters(req.query, true);
      const result = await listBrowseProfiles(req.session.userId!, filters);
      res.json(result);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: "Filtres invalides.", details: err.flatten() });
        return;
      }
      throw err;
    }
  }),
);

browseRouter.get(
  "/search",
  asyncHandler(async (req, res) => {
    try {
      const filters = parseFilters(req.query, false);
      const result = await listBrowseProfiles(req.session.userId!, filters);
      res.json(result);
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json({ error: "Filtres invalides.", details: err.flatten() });
        return;
      }
      throw err;
    }
  }),
);

browseRouter.get(
  "/map",
  asyncHandler(async (req, res) => {
    const profiles = await listMapProfiles(req.session.userId!);
    res.json({ profiles });
  }),
);
