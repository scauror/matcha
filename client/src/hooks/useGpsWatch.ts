import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

/** Met à jour les coordonnées GPS avec une précision élevée, au plus toutes les 30 s. */
export function useGpsWatch(enabled: boolean) {
  const { user, setUser } = useAuth();
  const lastSent = useRef(0);
  const userRef = useRef(user);
  userRef.current = user;

  useEffect(() => {
    if (!enabled || !user?.gpsConsent || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSent.current < 30_000) return;
        lastSent.current = now;
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        void api("/api/profile/me/coords", {
          method: "PATCH",
          body: JSON.stringify({ latitude, longitude }),
        })
          .then(() => {
            const current = userRef.current;
            if (current) setUser({ ...current, latitude, longitude, gpsConsent: true });
          })
          .catch(() => undefined);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled, user?.id, user?.gpsConsent, setUser]);
}
