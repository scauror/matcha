import { Link } from "react-router-dom";
import type { BrowseCard } from "../api/client";

type Props = {
  profile: BrowseCard;
  onLike?: (id: string) => void;
  onUnlike?: (id: string) => void;
  busy?: boolean;
};

export function ProfileCard({ profile, onLike, onUnlike, busy }: Props) {
  return (
    <article className="card">
      <Link to={`/profile/${profile.id}`} className="card-photo">
        {profile.photo ? (
          <img src={profile.photo} alt="" />
        ) : (
          <div className="card-photo-fallback" />
        )}
        {profile.isOnline ? <span className="online-dot" title="En ligne" /> : null}
      </Link>
      <div className="card-body">
        <h2>
          <Link to={`/profile/${profile.id}`}>
            {profile.firstName}, {profile.age}
          </Link>
        </h2>
        <p className="muted">
          {profile.distanceKm} km · famé {profile.fameRating}
          {profile.sharedTags ? ` · ${profile.sharedTags} tag${profile.sharedTags > 1 ? "s" : ""} en commun` : ""}
        </p>
        <p className="card-bio">{profile.bio}</p>
        <div className="chips">
          {profile.tags.slice(0, 4).map((tag) => (
            <span className="chip static" key={tag}>
              #{tag}
            </span>
          ))}
        </div>
        {profile.likesMe && !profile.isMatch ? (
          <p className="crush-hint">Cette personne t’a envoyé un crush.</p>
        ) : null}
        {profile.isMatch ? <p className="crush-hint match">Vous êtes connectés.</p> : null}
        <div className="card-actions">
          {profile.likedByMe ? (
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => onUnlike?.(profile.id)}>
              Retirer le crush
            </button>
          ) : (
            <button type="button" className="btn" disabled={busy} onClick={() => onLike?.(profile.id)}>
              Crush
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
