import { useEffect, useRef, useState } from "react";
import { Check, CreditCard, ScanLine, ShoppingCart, Trash2 } from "lucide-react";
import { api, errorText } from "../api";
import { useAuth } from "../AuthContext";
import Receipt from "../components/Receipt";

export default function POS() {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);
  const [branch, setBranch] = useState("");
  const [imei, setImei] = useState("");
  const [customer, setCustomer] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amountPaid, setAmountPaid] = useState("");
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
  const isCredit = paymentMethod === "credit";

  const checkout = async () => {
    setError("");
    setBusy(true);
    try {
      const payload = {
        stock_unit_ids: cart.map((u) => u.id),
        branch: Number(branch),
        customer_name: customer,
        payment_method: paymentMethod,
      };
      if (isCredit) {
        payload.customer_phone = customerPhone;
        if (amountPaid !== "") payload.amount_paid = amountPaid;
      }
      const res = await api.post("/pos/sales/checkout/", payload);
      setSale(res.data);
      setCart([]);
      setCustomer("");
      setCustomerPhone("");
      setAmountPaid("");
      setPaymentMethod("cash");
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
    const isSaleCredit = sale.payment_method === "credit";
    return (
      <>
        <h2 className="page no-print">Sale complete — Receipt #{sale.receipt.receipt_number}</h2>
        <div className="ok no-print">
          {isSaleCredit
            ? `Total ${sale.total_amount} — ${sale.amount_paid} paid now, ${sale.balance_due} on credit. Stock updated.`
            : `Total ${sale.total_amount} received in cash. Stock updated.`}
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

      <div className="pos-grid">
        {/* Left column: scan + cart */}
        <div>
          <div className="card">
            <div className="pos-card-label">Scan item</div>
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
            </div>
            <form onSubmit={addByImei} className="row" style={{ marginTop: ".2rem" }}>
              <div className="field" style={{ flex: 2 }}>
                <label>Scan / type IMEI and press Enter</label>
                <div style={{ position: "relative" }}>
                  <ScanLine
                    size={16}
                    style={{ position: "absolute", left: ".8rem", top: "50%", transform: "translateY(-50%)", color: "var(--text-tertiary)" }}
                  />
                  <input
                    ref={imeiRef}
                    autoFocus
                    value={imei}
                    onChange={(e) => setImei(e.target.value)}
                    placeholder="358743110912345"
                    style={{ fontFamily: "monospace", paddingLeft: "2.1rem" }}
                  />
                </div>
              </div>
              <div className="field" style={{ alignSelf: "end", flex: 0 }}>
                <button type="submit">Add to cart</button>
              </div>
            </form>
          </div>

          <div className="card">
            <div className="pos-card-label">Cart ({cart.length})</div>
            {cart.length === 0 ? (
              <div className="empty-state">
                <div className="icon-wrap"><ShoppingCart size={20} /></div>
                <h4>Cart is empty</h4>
                <p>Scan an IMEI above to add a unit to the sale.</p>
              </div>
            ) : (
              <div>
                {cart.map((u) => (
                  <div className="pos-cart-item" key={u.id}>
                    <div className="meta">
                      <div>{u.sku_label} <span className="badge gray">{u.condition}</span></div>
                      <div className="imei">{u.imei_serial}</div>
                    </div>
                    <div className="price">{Number(u.sell_price).toFixed(2)}</div>
                    <button className="icon-btn icon-btn-danger" title="Remove" aria-label="Remove" onClick={() => removeFromCart(u.id)}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: customer info + payment + checkout */}
        <div>
          <div className="card">
            <div className="pos-card-label">Customer info {isCredit ? "" : "(optional)"}</div>
            <div className="field">
              <label>Customer name</label>
              <input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Walk-in customer" />
            </div>
            {isCredit && (
              <div className="field">
                <label>Customer phone</label>
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="For loan reminders" />
              </div>
            )}
          </div>

          <div className="card">
            <div className="pos-card-label">Payment</div>
            <div className="pos-pay-toggle">
              <button
                type="button"
                className={`pos-pay-option${!isCredit ? " active" : ""}`}
                onClick={() => setPaymentMethod("cash")}
              >
                <Check size={15} /> Cash
              </button>
              <button
                type="button"
                className={`pos-pay-option${isCredit ? " active" : ""}`}
                onClick={() => setPaymentMethod("credit")}
              >
                <CreditCard size={15} /> Credit (loan)
              </button>
            </div>
            {isCredit && (
              <div className="field" style={{ marginTop: ".9rem", marginBottom: 0 }}>
                <label>Amount paid now (optional)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="0.00 — rest becomes a loan balance"
                />
              </div>
            )}
          </div>

          <div className="card">
            <div className="pos-card-label">Order summary</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "1.15rem", marginBottom: "1rem" }}>
              <span>Total</span>
              <b>{total.toFixed(2)}</b>
            </div>
            <button
              style={{ width: "100%" }}
              disabled={cart.length === 0 || busy}
              onClick={checkout}
            >
              {busy ? "Processing…" : isCredit ? "Complete sale (credit)" : "Complete sale (cash)"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
