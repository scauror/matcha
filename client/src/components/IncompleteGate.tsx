import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { profileGaps } from "../lib/profileGaps";

export function IncompleteGate() {
  const { user } = useAuth();
  const gaps = user ? profileGaps(user) : [];

  return (
    <section>
      <h1 className="page-title">Profil incomplet</h1>
      <p className="page-lead">
        Suggestions, recherche et chat s’ouvrent seulement quand le profil est complet.
      </p>
      <div className="panel">
        {gaps.length > 0 ? (
          <>
            <p>Il manque encore :</p>
            <ul className="plain-list">
              {gaps.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </>
        ) : (
          <p>Enregistre ton profil, puis réessaie.</p>
        )}
        <p className="form-links">
          <Link to="/profile" className="btn">
            Compléter mon profil
          </Link>
        </p>
      </div>
    </section>
  );
}
