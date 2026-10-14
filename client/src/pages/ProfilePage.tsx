import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiError, type Relation, type User } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useCall } from "../context/CallContext";
import { Field, FormStatus } from "../components/Field";
import { PhotoGallery } from "../components/PhotoGallery";
import { profileGaps } from "../lib/profileGaps";
import { useGpsWatch } from "../hooks/useGpsWatch";

type Visitor = { id: string; username: string; firstName: string; fameRating: number; at: string };

export function ProfilePage() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const isOwn = !id || id === "me" || id === me?.id;

  if (isOwn) return <OwnProfile />;
  return <OtherProfile id={id!} />;
}

type ProfileForm = {
  firstName: string;
  lastName: string;
  email: string;
  gender: string;
  orientation: "heterosexual" | "homosexual" | "bisexual";
  bio: string;
  birthDate: string;
  locationLabel: string;
  gpsConsent: boolean;
  latitude: number | null;
  longitude: number | null;
  tags: string[];
};

function OwnProfile() {
  const { user, setUser } = useAuth();
  useGpsWatch(Boolean(user?.gpsConsent));
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pending, setPending] = useState(false);
  const [tagDraft, setTagDraft] = useState("");
  const [views, setViews] = useState<Visitor[]>([]);
  const [likes, setLikes] = useState<Visitor[]>([]);
  const [form, setForm] = useState<ProfileForm>({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    gender: user?.gender ?? "",
    orientation: user?.orientation ?? "bisexual",
    bio: user?.bio ?? "",
    birthDate: user?.birthDate ?? "",
    locationLabel: user?.locationLabel ?? "",
    gpsConsent: user?.gpsConsent ?? false,
    latitude: user?.latitude ?? null,
    longitude: user?.longitude ?? null,
    tags: user?.tags ?? [],
  });

  useEffect(() => {
    if (!user) return;
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      gender: user.gender ?? "",
      orientation: user.orientation,
      bio: user.bio ?? "",
      birthDate: user.birthDate ?? "",
      locationLabel: user.locationLabel ?? "",
      gpsConsent: user.gpsConsent,
      latitude: user.latitude,
      longitude: user.longitude,
      tags: user.tags,
    });
  }, [user]);

  useEffect(() => {
    void Promise.all([
      api<{ views: Visitor[] }>("/api/profile/me/views").then((d) => setViews(d.views)),
      api<{ likes: Visitor[] }>("/api/profile/me/likes").then((d) => setLikes(d.likes)),
    ]).catch(() => undefined);
  }, []);

  if (!user) return null;

  function addTag() {
    const label = tagDraft.trim().replace(/^#/, "").toLowerCase();
    if (!label || form.tags.includes(label)) {
      setTagDraft("");
      return;
    }
    setForm((prev) => ({ ...prev, tags: [...prev.tags, label] }));
    setTagDraft("");
  }

  async function save() {
    setError("");
    setSuccess("");
    setPending(true);
    try {
      const data = await api<{ user: User | null; message?: string }>("/api/profile/me", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          email: form.email,
          gender: form.gender || undefined,
          orientation: form.orientation,
          bio: form.bio,
          birthDate: form.birthDate || undefined,
          locationLabel: form.locationLabel || undefined,
          gpsConsent: form.gpsConsent,
          latitude: form.latitude ?? undefined,
          longitude: form.longitude ?? undefined,
          tags: form.tags,
        }),
      });
      setUser(data.user);
      if (data.user && !data.user.profileComplete) {
        const missing = profileGaps(data.user);
        setSuccess(
          missing.length
            ? `Enregistré. Pour débloquer Suggestions / Recherche, ajoute encore : ${missing.join(", ")}.`
            : "Profil enregistré.",
        );
      } else {
        setSuccess(data.message ?? "Profil enregistré. Suggestions et recherche sont débloquées.");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        const firstField = err.fields ? Object.values(err.fields).flat()[0] : undefined;
        setError(firstField ?? err.message);
      } else {
        setError("Enregistrement impossible.");
      }
    } finally {
      setPending(false);
    }
  }

  async function locate() {
    setError("");
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas disponible sur ce navigateur.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          gpsConsent: true,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        }));
        setSuccess("Position GPS récupérée. Clique sur « Enregistrer le profil » pour la sauver.");
      },
      () => setError("Localisation GPS refusée. Saisis une ville manuellement."),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  }

  async function lookupCity() {
    setError("");
    try {
      const geo = await api<{ latitude: number; longitude: number; label: string }>(
        "/api/profile/me/geocode",
        { method: "POST", body: JSON.stringify({ query: form.locationLabel }) },
      );
      setForm((prev) => ({
        ...prev,
        gpsConsent: false,
        latitude: geo.latitude,
        longitude: geo.longitude,
        locationLabel: geo.label,
      }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ville introuvable.");
    }
  }

  return (
    <section>
      <h1 className="page-title">Mon profil</h1>
      {user.profileComplete ? (
        <p className="page-lead">Popularité : {user.fameRating}</p>
      ) : (
        <div className="form-alert form-alert-error" style={{ marginBottom: "1rem" }}>
          <strong>Profil incomplet.</strong> Suggestions et recherche restent bloquées tant qu’il
          manque : {profileGaps(user).join(", ") || "un enregistrement"}.
        </div>
      )}
      <form
        className="panel form"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <FormStatus error={error} success={success} />
        <div className="form-row">
          <Field label="Prénom">
            <input
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
            />
          </Field>
          <Field label="Nom">
            <input
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              required
            />
          </Field>
        </div>
        <Field label="E-mail" hint="Changer d'e-mail exige une nouvelle vérification.">
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </Field>
        <div className="form-row">
          <Field label="Genre">
            <select
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              required
            >
              <option value="">Choisir…</option>
              <option value="female">Femme</option>
              <option value="male">Homme</option>
              <option value="other">Autre</option>
            </select>
          </Field>
          <Field label="Orientation">
            <select
              value={form.orientation}
              onChange={(e) =>
                setForm({
                  ...form,
                  orientation: e.target.value as ProfileForm["orientation"],
                })
              }
            >
              <option value="heterosexual">Hétérosexuel</option>
              <option value="homosexual">Homosexuel</option>
              <option value="bisexual">Bisexuel (défaut)</option>
            </select>
          </Field>
        </div>
        <Field label="Date de naissance">
          <input
            type="date"
            value={form.birthDate}
            onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
            required
          />
        </Field>
        <Field label="Bio">
          <textarea
            rows={4}
            maxLength={500}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            required
          />
        </Field>
        <Field label="Tags d'intérêts" hint="Ajoute au moins un tag, puis enregistre le profil.">
          <div className="chips">
            {form.tags.map((tag) => (
              <button
                type="button"
                className="chip"
                key={tag}
                onClick={() =>
                  setForm((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }))
                }
              >
                #{tag} ×
              </button>
            ))}
          </div>
          <div className="form-row">
            <input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="#geek"
            />
            <button type="button" className="btn btn-ghost" onClick={addTag}>
              Ajouter
            </button>
          </div>
        </Field>
        <Field label="Localisation" hint="GPS (quartier) ou saisie manuelle d'une ville.">
          <input
            value={form.locationLabel}
            onChange={(e) => setForm({ ...form, locationLabel: e.target.value })}
            placeholder="Ville ou quartier"
          />
        </Field>
        <div className="form-row">
          <button type="button" className="btn btn-ghost" onClick={() => void locate()}>
            Utiliser ma position GPS
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void lookupCity()}>
            Chercher cette ville
          </button>
        </div>
        {form.latitude != null && form.longitude != null ? (
          <p className="field-hint">
            Coordonnées : {form.latitude.toFixed(4)}, {form.longitude.toFixed(4)}
            {form.gpsConsent ? " (GPS)" : ""}
          </p>
        ) : null}

        <button className="btn" type="submit" disabled={pending}>
          {pending ? "Enregistrement…" : "Enregistrer le profil"}
        </button>
      </form>

      <h2 className="section-title">Photos ({user.photos.length}/5)</h2>
      <div className="panel">
        <PhotoGallery
          photos={user.photos}
          onUser={setUser}
          onError={setError}
        />
      </div>

      <div className="split">
        <section>
          <h2 className="section-title">Qui a vu mon profil</h2>
          <div className="panel">
            {views.length === 0 ? <p className="muted">Personne pour l’instant.</p> : null}
            <ul className="plain-list">
              {views.map((v) => (
                <li key={v.id}>
                  <Link to={`/profile/${v.id}`}>{v.firstName} (@{v.username})</Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section>
          <h2 className="section-title">Qui m’a liké</h2>
          <div className="panel">
            {likes.length === 0 ? <p className="muted">Personne pour l’instant.</p> : null}
            <ul className="plain-list">
              {likes.map((v) => (
                <li key={v.id}>
                  <Link to={`/profile/${v.id}`}>{v.firstName} (@{v.username})</Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </section>
  );
}

function OtherProfile({ id }: { id: string }) {
  const { user: me } = useAuth();
  const { startCall } = useCall();
  const [profile, setProfile] = useState<Omit<User, "email" | "emailVerified" | "gpsConsent"> | null>(
    null,
  );
  const [relation, setRelation] = useState<Relation>({
    likedByMe: false,
    likesMe: false,
    isMatch: false,
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api<{ user: Omit<User, "email" | "emailVerified" | "gpsConsent">; relation: Relation }>(
      `/api/profile/${id}`,
    )
      .then((d) => {
        setProfile(d.user);
        setRelation(d.relation);
      })
      .catch((err: unknown) => {
        setError(err instanceof ApiError ? err.message : "Profil introuvable.");
      });
  }, [id]);

  async function like() {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ relation: Relation }>(`/api/social/like/${id}`, { method: "POST" });
      setRelation(data.relation);
      setSuccess(data.relation.isMatch ? "C'est un match — vous pouvez discuter." : "Crush envoyé.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'envoyer le crush.");
    } finally {
      setBusy(false);
    }
  }

  async function unlike() {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ relation: Relation }>(`/api/social/like/${id}`, { method: "DELETE" });
      setRelation(data.relation);
      setSuccess("Crush retiré. Le chat n'est plus disponible.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de retirer le crush.");
    } finally {
      setBusy(false);
    }
  }

  async function block() {
    if (!confirm("Bloquer ce profil ? Il disparaîtra des recherches et du chat.")) return;
    setBusy(true);
    try {
      await api(`/api/social/block/${id}`, { method: "POST" });
      navigate("/browse", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Blocage impossible.");
      setBusy(false);
    }
  }

  async function report() {
    if (!confirm("Signaler ce compte comme faux profil ?")) return;
    setBusy(true);
    try {
      await api(`/api/social/report/${id}`, {
        method: "POST",
        body: JSON.stringify({ reason: "fake account" }),
      });
      setSuccess("Profil signalé.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Signalement impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !profile) return <p className="form-alert form-alert-error">{error}</p>;
  if (!profile) return <p className="page-lead">Chargement du profil…</p>;

  const profilePhoto = profile.photos.find((p) => p.is_profile) ?? profile.photos[0];
  const canLike = me?.photos.some((p) => p.is_profile);
  const age = profile.birthDate
    ? Math.floor((Date.now() - new Date(profile.birthDate).getTime()) / 31557600000)
    : null;

  return (
    <section>
      <h1 className="page-title">
        {profile.firstName}
        {age != null ? `, ${age}` : ""} <span className="muted">@{profile.username}</span>
      </h1>
      <p className="page-lead">
        Popularité {profile.fameRating} · {profile.isOnline ? "en ligne" : "hors ligne"}
        {!profile.isOnline && profile.lastSeenAt
          ? ` · dernière connexion ${new Date(profile.lastSeenAt).toLocaleString("fr-FR")}`
          : ""}
      </p>
      <FormStatus error={error} success={success} />
      <div className="panel">
        {profilePhoto ? <img className="hero-photo" src={profilePhoto.path} alt="" /> : null}
        <p>
          {profile.gender === "female" ? "Femme" : profile.gender === "male" ? "Homme" : "Autre"} ·{" "}
          {profile.orientation}
        </p>
        <p>{profile.bio}</p>
        <p className="muted">{profile.locationLabel}</p>
        <div className="chips">
          {profile.tags.map((tag) => (
            <span className="chip static" key={tag}>
              #{tag}
            </span>
          ))}
        </div>
        {relation.likesMe && !relation.isMatch ? (
          <p className="crush-hint">Cette personne t’a envoyé un crush.</p>
        ) : null}
        {relation.isMatch ? (
          <p className="crush-hint match">
            Vous êtes connectés. <Link to={`/chat?user=${profile.id}`}>Ouvrir le chat</Link>
            {" · "}
            <button
              type="button"
              className="linkish"
              onClick={() => startCall(profile.id, "audio", profile.firstName)}
            >
              Appel audio
            </button>
            {" · "}
            <button
              type="button"
              className="linkish"
              onClick={() => startCall(profile.id, "video", profile.firstName)}
            >
              Visio
            </button>
          </p>
        ) : null}
        <div className="card-actions" style={{ marginTop: "1rem" }}>
          {relation.likedByMe ? (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void unlike()}>
              Retirer le crush
            </button>
          ) : (
            <button type="button" className="btn" disabled={busy || !canLike} onClick={() => void like()}>
              Crush
            </button>
          )}
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => void block()}>
            Bloquer
          </button>
          <button type="button" className="btn btn-ghost danger-text" disabled={busy} onClick={() => void report()}>
            Faux compte
          </button>
        </div>
        {!canLike ? (
          <p className="field-hint">Ajoute une photo de profil pour pouvoir envoyer un crush.</p>
        ) : null}
      </div>
    </section>
  );
}
