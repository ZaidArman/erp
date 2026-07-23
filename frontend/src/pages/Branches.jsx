import { useEffect, useState } from "react";
import { api, errorText, errorTitle } from "../api";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";

const emptyForm = {
  name: "", address: "", branch_code: "", email: "",
  branch_phone_number: "", branch_city: "", branch_province: "",
};

export default function Branches() {
  const [branches, setBranches] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  const load = () => {
    api.get(`/tenants/branches/?page=${page}&page_size=${pageSize}`).then((res) => {
      setBranches(res.data.results);
      setCount(res.data.count);
    });
  };
  useEffect(load, [page, pageSize]);

  const pageCount = Math.max(1, Math.ceil(count / pageSize));
  const goToPage = (p) => setPage(Math.min(Math.max(1, p), pageCount));
  const changePageSize = (n) => { setPageSize(n); setPage(1); };

  const create = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/tenants/branches/", form);
      setForm(emptyForm);
      load();
    } catch (err) { setError(errorText(err)); }
  };

  const toggleActive = async (branch) => {
    try {
      await api.patch(`/tenants/branches/${branch.id}/`, { is_active: !branch.is_active });
      load();
    } catch (err) { setError(errorText(err)); }
  };

  return (
    <>
      <h2 className="page">Branches</h2>
      <Modal title={errorTitle(error)} message={error} onClose={() => setError("")} />
      <div className="card">
        <h3>Create branch</h3>
        <form onSubmit={create}>
          <div className="row">
            <div className="field"><label>Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div className="field"><label>Branch code</label>
              <input value={form.branch_code} placeholder="e.g. BR001"
                onChange={(e) => setForm({ ...form, branch_code: e.target.value })} /></div>
            <div className="field"><label>Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <div className="row">
            <div className="field"><label>Email</label>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div className="field"><label>Phone number</label>
              <input value={form.branch_phone_number}
                onChange={(e) => setForm({ ...form, branch_phone_number: e.target.value })} /></div>
            <div className="field"><label>City</label>
              <input value={form.branch_city} onChange={(e) => setForm({ ...form, branch_city: e.target.value })} /></div>
            <div className="field"><label>Province</label>
              <input value={form.branch_province} onChange={(e) => setForm({ ...form, branch_province: e.target.value })} /></div>
          </div>
          <div className="row" style={{ marginTop: ".4rem" }}>
            <div style={{ flex: 1 }} />
            <button>Create</button>
          </div>
        </form>
        <p style={{ fontSize: ".8rem", color: "#8a94a2" }}>
          Creation is blocked automatically when your plan's branch limit is reached.
        </p>
      </div>
      <div className="card" style={{ padding: 0 }}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Code</th><th>Address</th><th>City</th><th>Province</th>
                <th>Email</th><th>Phone</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {branches.map((b) => (
                <tr key={b.id}>
                  <td>{b.name}</td>
                  <td>{b.branch_code || "—"}</td>
                  <td title={b.address}>{b.address || "—"}</td>
                  <td>{b.branch_city || "—"}</td>
                  <td>{b.branch_province || "—"}</td>
                  <td>{b.email || "—"}</td>
                  <td>{b.branch_phone_number || "—"}</td>
                  <td>
                    <button className="ghost small" onClick={() => toggleActive(b)}>
                      <span className={`badge ${b.is_active ? "green" : "gray"}`}>
                        {b.is_active ? "active" : "inactive"}
                      </span>
                    </button>
                  </td>
                </tr>
              ))}
              {branches.length === 0 && (
                <tr><td colSpan={8} style={{ color: "#8a94a2" }}>Nothing yet — create the first branch above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={page}
          pageCount={pageCount}
          count={count}
          pageSize={pageSize}
          onPageChange={goToPage}
          onPageSizeChange={changePageSize}
        />
      </div>
    </>
  );
}
