import { useCallback, useEffect, useState } from "react";
import { api, errorText, errorTitle } from "../api";
import Modal from "../components/Modal";

export default function Brands() {
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api.get("/inventory/brands/").then((res) => setBrands(res.data.results));
  }, []);

  useEffect(() => {
    load();
    api.get("/inventory/categories/").then((res) => setCategories(res.data.results));
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/inventory/brands/", { name, category });
      setName("");
      setCategory("");
      load();
    } catch (err) { setError(errorText(err)); }
  };

  const remove = async (id) => {
    if (!confirm("Delete this brand?")) return;
    try { await api.delete(`/inventory/brands/${id}/`); load(); }
    catch (err) { setError(errorText(err)); }
  };

  return (
    <>
      <h2 className="page">Brands</h2>
      <Modal title={errorTitle(error)} message={error} onClose={() => setError("")} />
      <div className="card">
        <form className="row" onSubmit={create}>
          <div className="field"><label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} required>
              <option value="">Select…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select></div>
          <div className="field"><label>Brand name</label>
            <input value={name} placeholder="e.g. Apple"
              onChange={(e) => setName(e.target.value)} required /></div>
          <div className="field" style={{ alignSelf: "end", flex: "0" }}>
            <button>Add</button>
          </div>
        </form>
        {categories.length === 0 && (
          <p style={{ fontSize: ".8rem", color: "#8a94a2", marginTop: ".6rem" }}>
            Create a category first.
          </p>
        )}
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Brand</th><th>Category</th><th /></tr></thead>
          <tbody>
            {brands.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td>{b.category_name}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="danger small" onClick={() => remove(b.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {brands.length === 0 && (
              <tr><td colSpan={3} style={{ color: "#8a94a2" }}>Nothing yet — add the first brand above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
