import { useEffect, useRef, useState } from "react";
import { api, errorText } from "../api";
import { useAuth } from "../AuthContext";
import Receipt from "../components/Receipt";

export default function POS() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState("");
  const [imei, setImei] = useState("");
  const [customer, setCustomer] = useState("");
  const [cart, setCart] = useState([]);
  const [error, setError] = useState("");
  const [sale, setSale] = useState(null); // completed sale -> receipt view
  const [busy, setBusy] = useState(false);
  const imeiRef = useRef(null);

  useEffect(() => {
    api.get("/tenants/branches/").then((res) => {
      setBranches(res.data.results);
      // Employees default to their own branch; admin to the first branch.
      const preferred = user.branch || res.data.results[0]?.id;
      if (preferred) setBranch(String(preferred));
    });
  }, [user.branch]);

  const addByImei = async (e) => {
    e.preventDefault();
    setError("");
    const code = imei.trim();
    if (!code) return;
    if (cart.some((u) => u.imei_serial === code)) {
      setError("That unit is already in the cart.");
      return;
    }
    try {
      const res = await api.get(
        `/inventory/stock-units/?imei=${encodeURIComponent(code)}&is_sold=false`
      );
      const unit = res.data.results[0];
      if (!unit) {
        setError(`No available unit with IMEI "${code}" — check the number or it may be sold.`);
      } else if (String(unit.branch) !== String(branch)) {
        setError(`Unit ${code} belongs to branch "${unit.branch_name}", not the selected branch.`);
      } else {
        // Fetch its sell price from the SKU list entry embedded label; we need price:
        const sku = await api.get(`/inventory/skus/${unit.sku}/`);
        setCart([...cart, { ...unit, sell_price: sku.data.sell_price }]);
        setImei("");
      }
    } catch (err) {
      setError(errorText(err));
    }
    imeiRef.current?.focus();
  };

  const removeFromCart = (id) => setCart(cart.filter((u) => u.id !== id));

  const total = cart.reduce((sum, u) => sum + Number(u.sell_price || 0), 0);

  const checkout = async () => {
    setError("");
    setBusy(true);
    try {
      const res = await api.post("/pos/sales/checkout/", {
        stock_unit_ids: cart.map((u) => u.id),
        branch: Number(branch),
        customer_name: customer,
      });
      setSale(res.data);
      setCart([]);
      setCustomer("");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const printReceipt = () => {
    if (sale) api.post(`/pos/sales/${sale.id}/mark-printed/`).catch(() => {});
    window.print();
  };

  if (sale) {
    return (
      <>
        <h2 className="page no-print">Sale complete — Receipt #{sale.receipt.receipt_number}</h2>
        <div className="ok no-print">
          Total {sale.total_amount} received in cash. Stock updated.
        </div>
        <div className="card no-print" style={{ display: "flex", gap: ".8rem" }}>
          <button onClick={printReceipt}>Print receipt</button>
          <button className="ghost" onClick={() => setSale(null)}>New sale</button>
        </div>
        <Receipt sale={sale} />
      </>
    );
  }

  return (
    <>
      <h2 className="page">Point of sale</h2>
      {error && <div className="error">{error}</div>}

      <div className="card">
        <div className="row">
          <div className="field">
            <label>Branch</label>
            <select
              value={branch}
              onChange={(e) => { setBranch(e.target.value); setCart([]); }}
              disabled={user.role === "employee" && Boolean(user.branch)}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Customer name (optional)</label>
            <input value={customer} onChange={(e) => setCustomer(e.target.value)} />
          </div>
        </div>
        <form onSubmit={addByImei} className="row">
          <div className="field" style={{ flex: 2 }}>
            <label>Scan / type IMEI and press Enter</label>
            <input
              ref={imeiRef}
              autoFocus
              value={imei}
              onChange={(e) => setImei(e.target.value)}
              placeholder="358743110912345"
              style={{ fontFamily: "monospace" }}
            />
          </div>
          <div className="field" style={{ alignSelf: "end", flex: 0 }}>
            <button type="submit">Add to cart</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h3>Cart ({cart.length})</h3>
        <table>
          <thead>
            <tr><th>IMEI</th><th>Item</th><th>Condition</th><th style={{ textAlign: "right" }}>Price</th><th /></tr>
          </thead>
          <tbody>
            {cart.map((u) => (
              <tr key={u.id}>
                <td style={{ fontFamily: "monospace" }}>{u.imei_serial}</td>
                <td>{u.sku_label}</td>
                <td><span className="badge gray">{u.condition}</span></td>
                <td style={{ textAlign: "right" }}>{Number(u.sell_price).toFixed(2)}</td>
                <td style={{ textAlign: "right" }}>
                  <button className="danger small" onClick={() => removeFromCart(u.id)}>Remove</button>
                </td>
              </tr>
            ))}
            {cart.length === 0 && (
              <tr><td colSpan={5} style={{ color: "#8a94a2" }}>Cart is empty — scan an IMEI above.</td></tr>
            )}
          </tbody>
        </table>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
          <div style={{ fontSize: "1.15rem" }}>
            Total: <b>{total.toFixed(2)}</b> <span style={{ color: "#8a94a2", fontSize: ".85rem" }}>(cash)</span>
          </div>
          <button disabled={cart.length === 0 || busy} onClick={checkout}>
            {busy ? "Processing…" : "Complete sale (cash)"}
          </button>
        </div>
      </div>
    </>
  );
}
