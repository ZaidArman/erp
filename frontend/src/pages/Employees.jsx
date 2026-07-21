import { useEffect, useState } from "react";
import { api, errorText } from "../api";

const FLAGS = [
  "can_view_finance",
  "can_use_pos",
  "can_manage_inventory",
  "can_create_users",
  "can_view_reports",
];

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [form, setForm] = useState({ email: "", full_name: "", password: "", branch: "" });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const load = () => api.get("/auth/employees/").then((res) => setEmployees(res.data.results));
  useEffect(() => {
    load();
    api.get("/tenants/branches/").then((res) => setBranches(res.data.results));
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setError(""); setOk("");
    try {
      await api.post("/auth/employees/", form);
      setForm({ email: "", full_name: "", password: "", branch: "" });
      setOk("Employee created. All permissions start OFF — enable below.");
      load();
    } catch (err) { setError(errorText(err)); }
  };

  const toggleFlag = async (employee, flag, value) => {
    setError("");
    try {
      await api.patch(`/auth/employees/${employee.id}/permissions/`, { [flag]: value });
      load();
    } catch (err) { setError(errorText(err)); }
  };

  const toggleActive = async (employee) => {
    setError("");
    const action = employee.is_active ? "deactivate" : "activate";
    try { await api.post(`/auth/employees/${employee.id}/${action}/`); load(); }
    catch (err) { setError(errorText(err)); }
  };

  return (
    <>
      <h2 className="page">Employees</h2>
      {error && <div className="error">{error}</div>}
      {ok && <div className="ok">{ok}</div>}
      <div className="card">
        <h3>Create employee</h3>
        <form className="row" onSubmit={create}>
          <div className="field"><label>Email</label>
            <input type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <div className="field"><label>Full name</label>
            <input value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="field"><label>Password (min 8)</label>
            <input type="password" value={form.password} minLength={8}
              onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
          <div className="field"><label>Branch</label>
            <select value={form.branch}
              onChange={(e) => setForm({ ...form, branch: e.target.value })} required>
              <option value="">Select…</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select></div>
          <div className="field" style={{ alignSelf: "end", flex: 0 }}><button>Create</button></div>
        </form>
      </div>

      {employees.map((emp) => (
        <div className="card" key={emp.id}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".6rem" }}>
            <div>
              <b>{emp.full_name || emp.email}</b>{" "}
              <span style={{ color: "#8a94a2", fontSize: ".85rem" }}>
                {emp.email} · {emp.branch_name}
              </span>{" "}
              <span className={`badge ${emp.is_active ? "green" : "red"}`}>
                {emp.is_active ? "active" : "deactivated"}
              </span>
            </div>
            <button className={emp.is_active ? "danger small" : "small"} onClick={() => toggleActive(emp)}>
              {emp.is_active ? "Deactivate" : "Reactivate"}
            </button>
          </div>
          <div className="perm-grid">
            {FLAGS.map((flag) => (
              <label key={flag}>
                <input
                  type="checkbox"
                  checked={Boolean(emp.permissions?.[flag])}
                  onChange={(e) => toggleFlag(emp, flag, e.target.checked)}
                />
                {flag.replace("can_", "").replaceAll("_", " ")}
              </label>
            ))}
          </div>
        </div>
      ))}
      {employees.length === 0 && (
        <div className="card" style={{ color: "#8a94a2" }}>No employees yet.</div>
      )}
    </>
  );
}
