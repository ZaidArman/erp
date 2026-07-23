import { useEffect, useState } from "react";
import { api, errorText } from "../api";

export default function StockIntake() {
  const [skus, setSkus] = useState([]);
  const [branches, setBranches] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({
    sku: "", branch: "", supplier: "", condition: "new",
    warranty_expiry: "", imeis: "",
  });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  useEffect(() => {
    api.get("/inventory/skus/").then((res) => setSkus(res.data.results));
    api.get("/tenants/branches/").then((res) => setBranches(res.data.results)).catch(() => {
      // Employees can't list branches via the admin endpoint; fall back to stock data.
      setBranches([]);
    });
    api.get("/inventory/suppliers/").then((res) => setSuppliers(res.data.results));
  }, []);

  const selectedSku = skus.find((s) => String(s.id) === String(form.sku));

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setOk("");
    const imeis = form.imeis.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    try {
      const payload = {
        sku: form.sku, branch: form.branch, condition: form.condition, imeis,
      };
      if (form.supplier) payload.supplier = form.supplier;
      if (form.warranty_expiry) payload.warranty_expiry = form.warranty_expiry;
      const res = await api.post("/inventory/stock-units/bulk-intake/", payload);
      setOk(`Received ${res.data.length} unit(s) into stock.`);
      setForm({ ...form, imeis: "" });
    } catch (err) { setError(errorText(err)); }
  };

  return (
    <>
      <h2 className="page">Stock intake</h2>
      {error && <div className="error">{error}</div>}
      {ok && <div className="ok">{ok}</div>}
      <div className="card">
        <form onSubmit={submit}>
          <div className="row">
            <div className="field"><label>SKU</label>
              <select value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required>
                <option value="">Select…</option>
                {skus.map((s) => <option key={s.id} value={s.id}>{s.product_name} — {s.variant_name}</option>)}
              </select></div>
            <div className="field"><label>Branch</label>
              <select value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} required>
                <option value="">Select…</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select></div>
            <div className="field"><label>Supplier (optional)</label>
              <select value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })}>
                <option value="">None</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select></div>
          </div>
          <div className="row">
            <div className="field"><label>Condition</label>
              <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}>
                <option value="new">New</option>
                <option value="open_box">Open box</option>
                <option value="refurbished">Refurbished</option>
                <option value="used">Used</option>
              </select></div>
            <div className="field"><label>Purchase cost (per unit)</label>
              <input
                value={selectedSku?.product_purchase_price ?? ""}
                placeholder={selectedSku ? "Not set on product" : "Select a SKU"}
                disabled
              /></div>
            <div className="field"><label>Warranty expiry (optional)</label>
              <input type="date" value={form.warranty_expiry}
                onChange={(e) => setForm({ ...form, warranty_expiry: e.target.value })} /></div>
          </div>
          {selectedSku && selectedSku.product_purchase_price == null && (
            <p style={{ fontSize: ".8rem", color: "#a32d2d", marginTop: "-.4rem" }}>
              This product has no purchase price set yet — set it on the Products page first.
            </p>
          )}
          <div className="field">
            <label>IMEIs / serial numbers — one per line (or comma-separated)</label>
            <textarea
              rows={6}
              style={{ width: "100%", padding: ".5rem .6rem", border: "1px solid #cdd6e1", borderRadius: 6, fontFamily: "monospace" }}
              value={form.imeis}
              onChange={(e) => setForm({ ...form, imeis: e.target.value })}
              placeholder={"358743110912345\n358743110912346\n358743110912347"}
              required
            />
          </div>
          <button>Receive batch into stock</button>
        </form>
      </div>
    </>
  );
}
