import type { User } from "../api/client";

export function profileGaps(user: User): string[] {
  const gaps: string[] = [];
  if (!user.gender) gaps.push("le genre");
  if (!user.bio?.trim()) gaps.push("la bio");
  if (!user.birthDate) gaps.push("la date de naissance");
  if (!user.locationLabel?.trim() || user.latitude == null || user.longitude == null) {
    gaps.push("la localisation");
  }
  if (user.tags.length === 0) gaps.push("au moins un tag");
  if (!user.photos.some((p) => p.is_profile)) gaps.push("une photo de profil");
  return gaps;
}
