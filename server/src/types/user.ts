export type Gender = "male" | "female" | "other";
export type Orientation = "heterosexual" | "homosexual" | "bisexual";

export type UserRow = {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  password_hash: string;
  email_verified: boolean;
  gender: Gender | null;
  orientation: Orientation;
  bio: string | null;
  birth_date: string | null;
  fame_rating: number;
  latitude: number | null;
  longitude: number | null;
  location_label: string | null;
  gps_consent: boolean;
  is_online: boolean;
  last_seen_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type PhotoRow = {
  id: string;
  path: string;
  is_profile: boolean;
  position: number;
};

export type PublicUser = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  gender: Gender | null;
  orientation: Orientation;
  bio: string | null;
  birthDate: string | null;
  fameRating: number;
  latitude: number | null;
  longitude: number | null;
  locationLabel: string | null;
  gpsConsent: boolean;
  isOnline: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  tags: string[];
  photos: PhotoRow[];
  profileComplete: boolean;
};

export function isProfileComplete(user: {
  gender: Gender | null;
  bio: string | null;
  birth_date: string | null;
  location_label: string | null;
  latitude: number | null;
  longitude: number | null;
  tags: string[];
  photos: PhotoRow[];
}): boolean {
  return Boolean(
    user.gender &&
      user.bio?.trim() &&
      user.birth_date &&
      user.location_label?.trim() &&
      user.latitude != null &&
      user.longitude != null &&
      user.tags.length > 0 &&
      user.photos.some((p) => p.is_profile),
  );
}

export function toPublicUser(row: UserRow, tags: string[] = [], photos: PhotoRow[] = []): PublicUser {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    firstName: row.first_name,
    lastName: row.last_name,
    emailVerified: row.email_verified,
    gender: row.gender,
    orientation: row.orientation,
    bio: row.bio,
    birthDate: row.birth_date
      ? typeof row.birth_date === "string"
        ? row.birth_date.slice(0, 10)
        : new Date(row.birth_date).toISOString().slice(0, 10)
      : null,
    fameRating: row.fame_rating,
    latitude: row.latitude,
    longitude: row.longitude,
    locationLabel: row.location_label,
    gpsConsent: row.gps_consent,
    isOnline: row.is_online,
    lastSeenAt: row.last_seen_at,
    createdAt: row.created_at,
    tags,
    photos,
    profileComplete: isProfileComplete({ ...row, tags, photos }),
  };
}
