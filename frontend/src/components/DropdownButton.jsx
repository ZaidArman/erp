import { useState } from "react";
import { ChevronDown } from "lucide-react";
import useClickOutside from "../hooks/useClickOutside";

export default function DropdownButton({ label, ghost, disabled, children }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  return (
    <div className="menu-wrap" ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        className={ghost ? "ghost" : ""}
        disabled={disabled}
        style={{ whiteSpace: "nowrap" }}
        onClick={() => setOpen((v) => !v)}
      >
        {label} <ChevronDown size={14} />
      </button>
      {open && (
        <div className="menu-popover" style={{ minWidth: 200 }}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}
