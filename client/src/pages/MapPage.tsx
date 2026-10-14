import { useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { api, ApiError, type BrowseCard } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useGpsWatch } from "../hooks/useGpsWatch";
import "leaflet/dist/leaflet.css";

function pin(label: string, mine = false) {
  return L.divIcon({
    className: mine ? "map-pin mine" : "map-pin",
    html: `<span>${label.slice(0, 1).toUpperCase()}</span>`,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -28],
  });
}

export function MapPage() {
  const { user } = useAuth();
  useGpsWatch(true);
  const [profiles, setProfiles] = useState<BrowseCard[]>([]);
  const [error, setError] = useState("");
  const center = useMemo<[number, number]>(() => {
    if (user?.latitude != null && user.longitude != null) {
      return [user.latitude, user.longitude];
    }
    return [48.8566, 2.3522];
  }, [user?.latitude, user?.longitude]);

  useEffect(() => {
    api<{ profiles: BrowseCard[] }>("/api/browse/map")
      .then((data) => setProfiles(data.profiles))
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Carte indisponible.");
      });
  }, []);

  return (
    <section>
      <h1 className="page-title">Carte</h1>
      <p className="page-lead">
        Profils compatibles autour de toi. La position GPS se met à jour en continu si tu l’as
        autorisée.
      </p>
      {error ? <p className="form-alert form-alert-error">{error}</p> : null}
      <div className="panel map-wrap">
        <LeafletMap center={center} me={user} profiles={profiles} />
      </div>
    </section>
  );
}

function LeafletMap({
  center,
  me,
  profiles,
}: {
  center: [number, number];
  me: { firstName: string; latitude: number | null; longitude: number | null } | null;
  profiles: BrowseCard[];
}) {
  const [el, setEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!el) return;
    const map = L.map(el, { scrollWheelZoom: true }).setView(center, 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    if (me?.latitude != null && me.longitude != null) {
      L.marker([me.latitude, me.longitude], { icon: pin(me.firstName, true) })
        .addTo(map)
        .bindPopup("Toi");
    }

    for (const p of profiles) {
      if (p.latitude == null || p.longitude == null) continue;
      const popup = document.createElement("div");
      popup.innerHTML = `<strong></strong><br/><span></span><br/>`;
      popup.querySelector("strong")!.textContent = `${p.firstName}, ${p.age}`;
      popup.querySelector("span")!.textContent = `${p.distanceKm} km · ${p.locationLabel ?? ""}`;
      const a = document.createElement("a");
      a.href = `/profile/${p.id}`;
      a.textContent = "Voir le profil";
      popup.appendChild(a);
      L.marker([p.latitude, p.longitude], { icon: pin(p.firstName) })
        .addTo(map)
        .bindPopup(popup);
    }

    const t = window.setTimeout(() => map.invalidateSize(), 80);
    return () => {
      window.clearTimeout(t);
      map.remove();
    };
  }, [el, center, me, profiles]);

  return <div ref={setEl} className="leaflet-host" />;
}
