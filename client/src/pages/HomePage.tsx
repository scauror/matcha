import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function HomePage() {
  const { user } = useAuth();

  return (
    <section>
      <h1 className="page-title">Matcha</h1>
      <p className="page-lead">
        Inscris-toi, complète ton profil, trouve des profils compatibles, like, matche et discute
        en temps réel.
      </p>
      <div className="panel" style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        {user ? (
          <Link to={user.profileComplete ? "/browse" : "/profile"} className="btn">
            {user.profileComplete ? "Voir les suggestions" : "Compléter mon profil"}
          </Link>
        ) : (
          <>
            <Link to="/register" className="btn">
              Créer un compte
            </Link>
            <Link to="/login" className="btn btn-ghost">
              Se connecter
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
