import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useNotifications } from "../context/NotificationsContext";

export function Layout() {
  const { user, logout } = useAuth();
  const { unread, unreadMessages } = useNotifications();
  const navigate = useNavigate();

  return (
    <div className="layout">
      <header className="header">
        <NavLink to="/" className="brand">
          Matcha
        </NavLink>
        <nav className="nav" aria-label="Navigation principale">
          {user ? (
            <>
              <NavLink to="/browse">Suggestions</NavLink>
              <NavLink to="/search">Recherche</NavLink>
              <NavLink to="/chat">
                Chat
                {unreadMessages > 0 ? (
                  <span className="badge">{unreadMessages > 99 ? "99+" : unreadMessages}</span>
                ) : null}
              </NavLink>
              <NavLink to="/map">Carte</NavLink>
              <NavLink to="/dates">Rendez-vous</NavLink>
              <NavLink to="/notifications">
                Notifs
                {unread > 0 ? <span className="badge">{unread > 99 ? "99+" : unread}</span> : null}
              </NavLink>
              <NavLink to="/profile">Profil</NavLink>
              <button
                type="button"
                className="nav-logout"
                onClick={() => {
                  void logout().then(() => navigate("/", { replace: true }));
                }}
              >
                Déconnexion
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Connexion</NavLink>
              <NavLink to="/register">Inscription</NavLink>
            </>
          )}
        </nav>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">Matcha — parce que l’amour aussi, ça s’industrialise.</footer>
    </div>
  );
}
