export type BrowseSort = "smart" | "age" | "distance" | "fame" | "tags";

export type BrowseFilters = {
  minAge?: number;
  maxAge?: number;
  minFame?: number;
  maxFame?: number;
  maxDistance?: number;
  tags?: string[];
  sort: BrowseSort;
  order: "asc" | "desc";
  /** Suggestions : exclure les profils déjà crush. Recherche : tout le monde compatible. */
  excludeLiked: boolean;
  limit: number;
  offset: number;
};

export type BrowseCard = {
  id: string;
  username: string;
  firstName: string;
  age: number;
  gender: string;
  orientation: string;
  bio: string | null;
  fameRating: number;
  distanceKm: number;
  sharedTags: number;
  locationLabel: string | null;
  tags: string[];
  photo: string | null;
  isOnline: boolean;
  lastSeenAt: Date | null;
  likedByMe: boolean;
  likesMe: boolean;
  isMatch: boolean;
  latitude?: number;
  longitude?: number;
};
