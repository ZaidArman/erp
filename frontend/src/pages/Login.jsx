import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { errorText } from "../api";
import { useAuth } from "../AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const shop = window.location.hostname.split(".")[0];
  const isBareDomain = ["localhost", "lvh", "127"].includes(shop);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>Shop ERP</h1>
        {/* Remove sub domain  */}
        {/* <p className="sub">Signing in to shop: <b>{shop}</b></p> */}
        <p className="sub">
          {isBareDomain ? "Sign in with your shop account" : <>Signing in to shop: <b>{shop}</b></>}
        </p>
        {error && <div className="error">{error}</div>}
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button disabled={busy} style={{ width: "100%" }}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
