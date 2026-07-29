import { Navigate, Route, Routes } from "react-router";
import { AuthPage } from "../auth/auth-page";
import { useAuth } from "../auth/auth-context";
import { MasterPasswordPage } from "../auth/master-password-page";
import { VaultPage } from "../vault/vault-page";

export function App() {
  const { stage } = useAuth();

  if (stage === "signed-out") {
    return (
      <Routes>
        <Route path="/login" element={<AuthPage action="login" />} />
        <Route path="/register" element={<AuthPage action="register" />} />
        <Route path="*" element={<Navigate replace to="/login" />} />
      </Routes>
    );
  }

  if (stage === "setup") {
    return (
      <Routes>
        <Route path="/setup" element={<MasterPasswordPage mode="setup" />} />
        <Route path="*" element={<Navigate replace to="/setup" />} />
      </Routes>
    );
  }

  if (stage === "locked") {
    return (
      <Routes>
        <Route path="/unlock" element={<MasterPasswordPage mode="unlock" />} />
        <Route path="*" element={<Navigate replace to="/unlock" />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/vault" element={<VaultPage />} />
      <Route path="*" element={<Navigate replace to="/vault" />} />
    </Routes>
  );
}
