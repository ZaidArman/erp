export default function Receipt({ sale }) {
  return (
    <div className="print-area receipt">
      <div className="r-center r-bold r-lg">{sale.shop_name}</div>
      <div className="r-center">{sale.branch_name}</div>
      <div className="r-line" />
      <div className="r-row"><span>Receipt #</span><span>{sale.receipt.receipt_number}</span></div>
      <div className="r-row"><span>Date</span><span>{new Date(sale.created_at).toLocaleString()}</span></div>
      <div className="r-row"><span>Seller</span><span>{sale.sold_by_name}</span></div>
      {sale.customer_name && (
        <div className="r-row"><span>Customer</span><span>{sale.customer_name}</span></div>
      )}
      <div className="r-line" />
      {sale.items.map((item) => (
        <div key={item.id} style={{ marginBottom: "4px" }}>
          <div>{item.sku_label}</div>
          <div className="r-row">
            <span className="r-mono">{item.imei_serial}</span>
            <span>{item.sell_price_at_sale}</span>
          </div>
        </div>
      ))}
      <div className="r-line" />
      <div className="r-row r-bold r-lg"><span>TOTAL</span><span>{sale.total_amount}</span></div>
      {sale.payment_method === "credit" ? (
        <>
          <div className="r-row"><span>Paid now</span><span>{sale.amount_paid}</span></div>
          <div className="r-row r-bold"><span>Balance (loan)</span><span>{sale.balance_due}</span></div>
        </>
      ) : (
        <div className="r-row"><span>Paid</span><span>Cash</span></div>
      )}
      <div className="r-line" />
      <div className="r-center" style={{ marginTop: "6px" }}>Thank you for your purchase!</div>
      <div className="r-center">Keep this receipt for warranty claims.</div>
    </div>
  );
}
