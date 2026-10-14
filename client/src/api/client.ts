export type Photo = {
  id: string;
  path: string;
  is_profile: boolean;
  position: number;
};

export type User = {
  id: string;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  gender: "male" | "female" | "other" | null;
  orientation: "heterosexual" | "homosexual" | "bisexual";
  bio: string | null;
  birthDate: string | null;
  fameRating: number;
  latitude: number | null;
  longitude: number | null;
  locationLabel: string | null;
  gpsConsent: boolean;
  isOnline: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  tags: string[];
  photos: Photo[];
  profileComplete: boolean;
};

export type Relation = {
  likedByMe: boolean;
  likesMe: boolean;
  isMatch: boolean;
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
  lastSeenAt: string | null;
  likedByMe: boolean;
  likesMe: boolean;
  isMatch: boolean;
  latitude?: number;
  longitude?: number;
};

export type DateStatus = "pending" | "accepted" | "declined" | "cancelled";

export type DatePlan = {
  id: string;
  conversationId: string;
  proposerId: string;
  peerId: string;
  peerUsername: string;
  peerFirstName: string;
  title: string;
  place: string;
  startsAt: string;
  note: string | null;
  status: DateStatus;
  createdAt: string;
};

export type AppNotification = {
  id: string;
  kind: "like" | "unlike" | "view" | "message" | "match" | "date";
  actorId: string | null;
  actorUsername: string | null;
  actorFirstName: string | null;
  isRead: boolean;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
};

export type Conversation = {
  id: string;
  peerId: string;
  peerUsername: string;
  peerFirstName: string;
  peerPhoto: string | null;
  isOnline: boolean;
  lastSeenAt: string | null;
  lastBody: string | null;
  lastAt: string | null;
  unread: number;
  canChat: boolean;
};

export class ApiError extends Error {
  readonly status: number;
  readonly fields?: Record<string, string[]>;

  constructor(status: number, message: string, fields?: Record<string, string[]>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const isForm = options.body instanceof FormData;
  if (!isForm && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: "include",
  });

  const data = (await res.json().catch(() => ({ error: "Réponse invalide" }))) as {
    error?: string;
    details?: { fieldErrors?: Record<string, string[]> };
  };

  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? "Une erreur est survenue.", data.details?.fieldErrors);
  }
  return data as T;
}
