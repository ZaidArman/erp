import { useCallback, useEffect, useState } from "react";
import { api, errorText } from "../api";

export default function SimpleCrud({ title, endpoint, extraField }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [extra, setExtra] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(() => {
    api.get(endpoint).then((res) => setItems(res.data.results));
  }, [endpoint]);

  useEffect(load, [load]);

  const create = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const payload = { name };
      if (extraField) payload[extraField] = extra;
      await api.post(endpoint, payload);
      setName(""); setExtra("");
      load();
    } catch (err) { setError(errorText(err)); }
  };

  const remove = async (id) => {
    if (!confirm("Delete this item?")) return;
    try { await api.delete(`${endpoint}${id}/`); load(); }
    catch (err) { setError(errorText(err)); }
  };

  return (
    <>
      <h2 className="page">{title}</h2>
      {error && <div className="error">{error}</div>}
      <div className="card">
        <form className="row" onSubmit={create}>
          <div className="field"><label>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required /></div>
          {extraField && (
            <div className="field"><label>{extraField}</label>
              <input value={extra} onChange={(e) => setExtra(e.target.value)} /></div>
          )}
          <div className="field" style={{ alignSelf: "end", flex: "0" }}>
            <button>Add</button>
          </div>
        </form>
      </div>
      <div className="card">
        <table>
          <thead><tr><th>Name</th>{extraField && <th>{extraField}</th>}<th /></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                {extraField && <td>{item[extraField]}</td>}
                <td style={{ textAlign: "right" }}>
                  <button className="danger small" onClick={() => remove(item.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {items.length === 0 && <tr><td colSpan={3} style={{ color: "#8a94a2" }}>Nothing yet — add the first one above.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
