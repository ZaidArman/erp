import { useEffect, useMemo, useState } from "react";
import { api, errorText, errorTitle } from "../api";
import Modal from "../components/Modal";

const emptyProductForm = {
  name: "", brand: "", description: "",
  model_number: "", product_code: "", barcode: "", qr_code: "",
  warranty_required: false, warranty_period: "", warranty_terms: "",
  minimum_stock: "", maximum_stock: "", product_color: "",
  purchase_price: "", cost_price: "", selling_price: "",
};

// Strip blank optional fields so DRF doesn't reject "" for numeric fields.
function cleanPayload(form) {
  const payload = {};
  Object.entries(form).forEach(([key, value]) => {
    if (value === "" || value === null) return;
    payload[key] = value;
  });
  return payload;
}

export default function Products() {
  const [products, setProducts] = useState([]);
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [skus, setSkus] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [pForm, setPForm] = useState(emptyProductForm);
  const [sForm, setSForm] = useState({ variant_name: "" });
  const [sAttrs, setSAttrs] = useState({});

  const loadProducts = () => api.get("/inventory/products/").then((res) => setProducts(res.data.results));
  useEffect(() => {
    loadProducts();
    api.get("/inventory/brands/").then((res) => setBrands(res.data.results));
    api.get("/inventory/categories/").then((res) => setCategories(res.data.results));
  }, []);

  const selectedBrand = brands.find((b) => String(b.id) === String(pForm.brand));

  const previewMargin = useMemo(() => {
    const selling = parseFloat(pForm.selling_price);
    const cost = parseFloat(pForm.cost_price);
    if (Number.isNaN(selling) || Number.isNaN(cost)) return null;
    return (selling - cost).toFixed(2);
  }, [pForm.selling_price, pForm.cost_price]);

  const selectedCategorySchema = useMemo(() => {
    if (!selected) return [];
    const cat = categories.find((c) => c.id === selected.category);
    return cat?.attribute_schema || [];
  }, [selected, categories]);

  const openProduct = (product) => {
    setSelected(product);
    setSAttrs({});
    api.get(`/inventory/skus/?product=${product.id}`).then((res) => setSkus(res.data.results));
  };

  const createProduct = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await api.post("/inventory/products/", cleanPayload(pForm));
      setPForm(emptyProductForm);
      loadProducts();
    } catch (err) { setError(errorText(err)); }
  };

  const toggleActive = async (product) => {
    try {
      await api.patch(`/inventory/products/${product.id}/`, { is_active: !product.is_active });
      loadProducts();
    } catch (err) { setError(errorText(err)); }
  };

  const createSku = async (e) => {
    e.preventDefault();
    setError("");
    const attributes = {};
    selectedCategorySchema.forEach((f) => {
      if (sAttrs[f.key]) attributes[f.key] = sAttrs[f.key];
    });
    try {
      await api.post("/inventory/skus/", {
        product: selected.id,
        variant_name: sForm.variant_name,
        attributes,
      });
      setSForm({ variant_name: "" });
      setSAttrs({});
      openProduct(selected);
      loadProducts();
    } catch (err) { setError(errorText(err)); }
  };

  return (
    <>
      <h2 className="page">Products &amp; SKUs</h2>
      <Modal title={errorTitle(error)} message={error} onClose={() => setError("")} />
      <div className="card">
        <h3>New product</h3>
        <form onSubmit={createProduct}>
          <div className="row">
            <div className="field"><label>Name</label>
              <input value={pForm.name} onChange={(e) => setPForm({ ...pForm, name: e.target.value })} required /></div>
            <div className="field"><label>Brand</label>
              <select value={pForm.brand} onChange={(e) => setPForm({ ...pForm, brand: e.target.value })} required>
                <option value="">Select…</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select></div>
            <div className="field"><label>Category</label>
              <input value={selectedBrand?.category_name || ""} placeholder="Follows brand" disabled /></div>
            <div className="field"><label>Description</label>
              <input value={pForm.description} onChange={(e) => setPForm({ ...pForm, description: e.target.value })} /></div>
          </div>

          <label style={{ marginTop: ".4rem" }}>Identity</label>
          <div className="row">
            <div className="field"><label>Model number</label>
              <input value={pForm.model_number} placeholder="e.g. Samsung AC 1.5 Ton"
                onChange={(e) => setPForm({ ...pForm, model_number: e.target.value })} /></div>
            <div className="field"><label>Product code</label>
              <input value={pForm.product_code} placeholder="e.g. AC001"
                onChange={(e) => setPForm({ ...pForm, product_code: e.target.value })} /></div>
            <div className="field"><label>Barcode</label>
              <input value={pForm.barcode}
                onChange={(e) => setPForm({ ...pForm, barcode: e.target.value })} /></div>
            <div className="field"><label>QR code</label>
              <input value={pForm.qr_code}
                onChange={(e) => setPForm({ ...pForm, qr_code: e.target.value })} /></div>
            <div className="field"><label>Color</label>
              <input value={pForm.product_color}
                onChange={(e) => setPForm({ ...pForm, product_color: e.target.value })} /></div>
          </div>

          <label style={{ marginTop: ".4rem" }}>Warranty</label>
          <div className="row">
            <div className="field" style={{ minWidth: "auto" }}>
              <label style={{ display: "flex", alignItems: "center", gap: ".4rem" }}>
                <input type="checkbox" style={{ width: "auto" }}
                  checked={pForm.warranty_required}
                  onChange={(e) => setPForm({ ...pForm, warranty_required: e.target.checked })} />
                Warranty required
              </label>
            </div>
            <div className="field"><label>Warranty period (months)</label>
              <input type="number" min="0" value={pForm.warranty_period}
                onChange={(e) => setPForm({ ...pForm, warranty_period: e.target.value })} /></div>
            <div className="field"><label>Warranty terms</label>
              <input value={pForm.warranty_terms}
                onChange={(e) => setPForm({ ...pForm, warranty_terms: e.target.value })} /></div>
          </div>

          <label style={{ marginTop: ".4rem" }}>Stock thresholds</label>
          <div className="row">
            <div className="field"><label>Minimum stock</label>
              <input type="number" min="0" value={pForm.minimum_stock}
                onChange={(e) => setPForm({ ...pForm, minimum_stock: e.target.value })} /></div>
            <div className="field"><label>Maximum stock</label>
              <input type="number" min="0" value={pForm.maximum_stock}
                onChange={(e) => setPForm({ ...pForm, maximum_stock: e.target.value })} /></div>
          </div>

          <label style={{ marginTop: ".4rem" }}>Pricing</label>
          <p style={{ fontSize: ".78rem", color: "#8a94a2", marginBottom: ".6rem" }}>
            Price lives on the Product — SKUs and stock intake inherit it automatically.
          </p>
          <div className="row">
            <div className="field"><label>Purchase price</label>
              <input type="number" min="0" step="0.01" value={pForm.purchase_price}
                onChange={(e) => setPForm({ ...pForm, purchase_price: e.target.value })} /></div>
            <div className="field"><label>Cost price</label>
              <input type="number" min="0" step="0.01" value={pForm.cost_price}
                onChange={(e) => setPForm({ ...pForm, cost_price: e.target.value })} /></div>
            <div className="field"><label>Selling price</label>
              <input type="number" min="0" step="0.01" value={pForm.selling_price}
                onChange={(e) => setPForm({ ...pForm, selling_price: e.target.value })} /></div>
            <div className="field"><label>Profit margin</label>
              <input value={previewMargin ?? ""} placeholder="Auto" disabled /></div>
          </div>

          <div className="row" style={{ marginTop: ".4rem" }}>
            <div style={{ flex: 1 }} />
            <button>Add product</button>
          </div>
        </form>
        {brands.length === 0 && (
          <p style={{ fontSize: ".8rem", color: "#8a94a2" }}>Create categories and brands first.</p>
        )}
      </div>

      <div className="card">
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Product</th><th>Category</th><th>Brand</th>
                <th>Selling price</th><th>Stock</th><th>SKUs</th><th>Status</th><th />
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td><td>{p.category_name}</td><td>{p.brand_name}</td>
                  <td>{p.selling_price ?? "—"}</td>
                  <td>
                    {p.current_stock}
                    {(p.minimum_stock || p.maximum_stock) && (
                      <span style={{ color: "#8a94a2", fontSize: ".78rem" }}>
                        {" "}({p.minimum_stock ?? "—"}–{p.maximum_stock ?? "—"})
                      </span>
                    )}
                  </td>
                  <td>{p.sku_count}</td>
                  <td>
                    <button className="ghost small" onClick={() => toggleActive(p)}>
                      <span className={`badge ${p.is_active ? "green" : "gray"}`}>
                        {p.is_active ? "active" : "inactive"}
                      </span>
                    </button>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button className="ghost small" onClick={() => openProduct(p)}>Manage SKUs</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="card">
          <h3>SKUs — {selected.name} <span style={{ color: "#8a94a2", fontWeight: 400 }}>({selected.category_name})</span></h3>
          <p style={{ fontSize: ".85rem", color: "#5c6673" }}>
            Sell price: <strong>{selected.selling_price ?? "not set — set it above before adding SKUs"}</strong>
          </p>
          <form className="row" onSubmit={createSku}>
            <div className="field"><label>Variant name</label>
              <input value={sForm.variant_name} placeholder="256GB Black"
                onChange={(e) => setSForm({ ...sForm, variant_name: e.target.value })} required /></div>
            {selectedCategorySchema.map((f) => (
              <div className="field" key={f.key}><label>{f.label}</label>
                <input
                  type={f.type === "number" ? "number" : "text"}
                  value={sAttrs[f.key] || ""}
                  onChange={(e) => setSAttrs({ ...sAttrs, [f.key]: e.target.value })}
                /></div>
            ))}
            <div className="field" style={{ alignSelf: "end", flex: 0 }}><button>Add SKU</button></div>
          </form>
          {selectedCategorySchema.length === 0 && (
            <p style={{ fontSize: ".78rem", color: "#8a94a2" }}>
              This category has no custom fields yet — add some on the Categories page.
            </p>
          )}
          <table>
            <thead><tr><th>Variant</th><th>Sell price</th><th>Attributes</th><th>Available units</th></tr></thead>
            <tbody>
              {skus.map((s) => (
                <tr key={s.id}>
                  <td>{s.variant_name}</td><td>{s.sell_price}</td>
                  <td style={{ fontSize: ".8rem", color: "#5c6673" }}>
                    {Object.entries(s.attributes || {}).map(([k, v]) => `${k}: ${v}`).join(", ") || "—"}
                  </td>
                  <td>{s.available_units}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
