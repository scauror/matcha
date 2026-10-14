type NominatimSearch = { lat: string; lon: string; display_name: string };
type NominatimReverse = { display_name?: string };

export type GeoResult = { latitude: number; longitude: number; label: string };

export async function geocodeLabel(q: string): Promise<GeoResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  const res = await fetch(url, {
    headers: { "User-Agent": "Matcha-42-student-project/1.0", Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as NominatimSearch[];
  const hit = data[0];
  if (!hit) return null;
  return { latitude: Number(hit.lat), longitude: Number(hit.lon), label: hit.display_name };
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("format", "json");
  url.searchParams.set("zoom", "14");
  const res = await fetch(url, {
    headers: { "User-Agent": "Matcha-42-student-project/1.0", Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as NominatimReverse;
  return data.display_name ?? null;
}
