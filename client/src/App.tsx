import { NavLink, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { CompleteProfileRoute, GuestRoute, ProtectedRoute } from "./components/Guards";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { VerifyPage } from "./pages/VerifyPage";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { BrowsePage } from "./pages/BrowsePage";
import { SearchPage } from "./pages/SearchPage";
import { ProfilePage } from "./pages/ProfilePage";
import { ChatPage } from "./pages/ChatPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { MapPage } from "./pages/MapPage";
import { DatesPage } from "./pages/DatesPage";

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="verify" element={<VerifyPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />

        <Route element={<GuestRoute />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route path="profile/:id?" element={<ProfilePage />} />
        </Route>

        <Route element={<CompleteProfileRoute />}>
          <Route path="browse" element={<BrowsePage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="chat/:id?" element={<ChatPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="map" element={<MapPage />} />
          <Route path="dates" element={<DatesPage />} />
        </Route>

        <Route
          path="*"
          element={
            <p>
              Page introuvable. <NavLink to="/">Retour</NavLink>
            </p>
          }
        />
      </Route>
    </Routes>
  );
}
