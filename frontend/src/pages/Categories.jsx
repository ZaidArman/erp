import { useCallback, useEffect, useState } from "react";
import { api, errorText, errorTitle } from "../api";
import Modal from "../components/Modal";

const FIELD_TYPES = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
];

const emptyField = () => ({ key: "", label: "", type: "text" });

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [fields, setFields] = useState([]);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api.get("/inventory/categories/").then((res) => setCategories(res.data.results));
  }, []);

  useEffect(load, [load]);

  const addField = () => setFields((f) => [...f, emptyField()]);
  const updateField = (idx, patch) =>
    setFields((f) => f.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  const removeField = (idx) => setFields((f) => f.filter((_, i) => i !== idx));

  const create = async (e) => {
    e.preventDefault();
    setError("");
    const attribute_schema = fields
      .filter((f) => f.key.trim())
      .map((f) => ({
        key: f.key.trim().toLowerCase().replace(/\s+/g, "_"),
        label: f.label.trim() || f.key.trim(),
        type: f.type,
      }));
    try {
      await api.post("/inventory/categories/", { name, description, attribute_schema });
      setName("");
      setDescription("");
      setFields([]);
      load();
    } catch (err) { setError(errorText(err)); }
  };

  const remove = async (id) => {
    if (!confirm("Delete this category?")) return;
    try { await api.delete(`/inventory/categories/${id}/`); load(); }
    catch (err) { setError(errorText(err)); }
  };

  const toggleActive = async (category) => {
    try {
      await api.patch(`/inventory/categories/${category.id}/`, { is_active: !category.is_active });
      load();
    } catch (err) { setError(errorText(err)); }
  };

  return (
    <>
      <h2 className="page">Categories</h2>
      <Modal title={errorTitle(error)} message={error} onClose={() => setError("")} />
      <div className="card">
        <h3>New category</h3>
        <form onSubmit={create}>
          <div className="row">
            <div className="field"><label>Category name</label>
              <input value={name} placeholder="e.g. Air Conditioners"
                onChange={(e) => setName(e.target.value)} required /></div>
            <div className="field"><label>Description</label>
              <input value={description} placeholder="e.g. Electronics, Home Appliances"
                onChange={(e) => setDescription(e.target.value)} /></div>
          </div>

          <label style={{ marginTop: ".4rem" }}>Custom fields for this category's products</label>
          <p style={{ fontSize: ".78rem", color: "#8a94a2", marginBottom: ".6rem" }}>
            e.g. Mobiles → Storage, RAM, Color. AC → Tonnage, Energy rating. Fridge → Capacity (Liters).
          </p>
          {fields.map((f, idx) => (
            <div className="row" key={idx}>
              <div className="field"><label>Field key</label>
                <input value={f.key} placeholder="tonnage"
                  onChange={(e) => updateField(idx, { key: e.target.value })} /></div>
              <div className="field"><label>Display label</label>
                <input value={f.label} placeholder="Tonnage"
                  onChange={(e) => updateField(idx, { label: e.target.value })} /></div>
              <div className="field"><label>Type</label>
                <select value={f.type} onChange={(e) => updateField(idx, { type: e.target.value })}>
                  {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select></div>
              <div className="field" style={{ alignSelf: "end", flex: 0 }}>
                <button type="button" className="danger small" onClick={() => removeField(idx)}>Remove</button>
              </div>
            </div>
          ))}
          <div className="row" style={{ marginTop: ".4rem" }}>
            <button type="button" className="ghost small" onClick={addField}>+ Add field</button>
            <div style={{ flex: 1 }} />
            <button>Save category</button>
          </div>
        </form>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Category</th><th>Description</th><th>Custom fields</th><th>Status</th><th /></tr></thead>
          <tbody>
            {categories.map((c) => (
              <tr key={c.id}>
                <td>{c.name}</td>
                <td style={{ color: "#5c6673" }}>{c.description || "—"}</td>
                <td>
                  {(c.attribute_schema || []).length === 0
                    ? <span style={{ color: "#8a94a2" }}>—</span>
                    : c.attribute_schema.map((f) => (
                        <span key={f.key} className="badge gray" style={{ marginRight: ".3rem" }}>{f.label}</span>
                      ))}
                </td>
                <td>
                  <button className="ghost small" onClick={() => toggleActive(c)}>
                    <span className={`badge ${c.is_active ? "green" : "gray"}`}>
                      {c.is_active ? "active" : "inactive"}
                    </span>
                  </button>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button className="danger small" onClick={() => remove(c.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr><td colSpan={5} style={{ color: "#8a94a2" }}>Nothing yet — add the first category above.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
