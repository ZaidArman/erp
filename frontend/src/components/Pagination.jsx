const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

function pageList(page, pageCount) {
  // Always show first, last, current ± 1, collapsing the rest into "…".
  const pages = new Set([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

export default function Pagination({
  page, pageCount, count, pageSize, onPageChange, onPageSizeChange,
}) {
  const items = pageList(page, Math.max(1, pageCount));

  return (
    <div className="pager">
      <span className="pager-count">{count} row{count === 1 ? "" : "s"}</span>
      <div className="pager-pages">
        <button
          className="pager-btn"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          ‹
        </button>
        {items.map((p, i) =>
          p === "…" ? (
            <span key={`ellipsis-${i}`} className="pager-ellipsis">…</span>
          ) : (
            <button
              key={p}
              className={`pager-btn ${p === page ? "active" : ""}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}
        <button
          className="pager-btn"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          aria-label="Next page"
        >
          ›
        </button>
      </div>
      {onPageSizeChange && (
        <select
          className="pager-size"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n} / page</option>)}
        </select>
      )}
    </div>
  );
}
