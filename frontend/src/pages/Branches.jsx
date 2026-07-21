import { useEffect, useState } from "react";
import { api, errorText } from "../api";

export default function Branches() {
  const [branches, setBranches] = useState([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");

  const load = () => api.get("/tenants/branches/").then((res) => setBranches(res.data.results));
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/tenants/branches/", { name, address });
      setName(""); setAddress("");
      load();
    } catch (err) { setError(errorText(err)); }
  };

  return (
    <>
      <h2 className="page">Branches</h2>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <h3>Create branch</h3>
        <form className="row" onSubmit={create}>
          <div className="field"><label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          <div className="field"><label>Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} /></div>
          <div className="field" style={{ alignSelf: "end", flex: 0 }}><button>Create</button></div>
        </form>
        <p style={{ fontSize: ".8rem", color: "#8a94a2" }}>
          Creation is blocked automatically when your plan's branch limit is reached.
        </p>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Name</th><th>Address</th><th>Status</th></tr></thead>
          <tbody>
            {branches.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td><td>{b.address}</td>
                <td><span className={`badge ${b.is_active ? "green" : "red"}`}>{b.is_active ? "active" : "inactive"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
