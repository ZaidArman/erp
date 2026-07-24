import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  Bell, ChevronRight, LogOut, Moon, Settings, Sun, User,
} from "lucide-react";
import { useAuth } from "../AuthContext";
import { applyTheme, getInitialTheme } from "../theme";
import useClickOutside from "../hooks/useClickOutside";

const ROUTE_TITLES = {
  "/": ["Dashboard"],
  "/products-list": ["Products"],
  "/pos": ["Sales", "Point of sale"],
  "/loans": ["Sales", "Loan"],
  "/sales": ["Sales", "Sales history"],
  "/reports": ["Reports"],
  "/stock": ["Inventory", "Stock"],
  "/stock/intake": ["Inventory", "Stock intake"],
  "/categories": ["Inventory", "Categories"],
  "/brands": ["Inventory", "Brands"],
  "/suppliers": ["Inventory", "Suppliers"],
  "/branches": ["User management", "Branches"],
  "/employees": ["User management", "Employees"],
};

function initials(user) {
  const source = user.full_name || user.email || "?";
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("") || "?";
}


export default function TopBar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [theme, setTheme] = useState(getInitialTheme());
  const [openMenu, setOpenMenu] = useState(null); // "profile" | null

  useEffect(() => { applyTheme(theme); }, [theme]);

  const crumbs = ROUTE_TITLES[location.pathname] || ["Nexora"];

  const menuRef = useClickOutside(() => setOpenMenu(null));

  return (
    <div className="topbar">
      <div className="topbar-crumbs">
        <div className="breadcrumbs">
          {crumbs.map((c, i) => (
            <span key={c} style={{ display: "flex", alignItems: "center", gap: ".35rem" }}>
              {i > 0 && <ChevronRight size={12} className="sep" />}
              {c}
            </span>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }} />

      <div className="topbar-actions" ref={menuRef}>
        <button className="icon-action" title="Notifications" aria-label="Notifications">
          <Bell size={17} />
          <span className="dot" />
        </button>

        <div className="theme-toggle" title="Toggle theme">
          <button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")} aria-label="Light theme">
            <Sun size={14} />
          </button>
          <button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")} aria-label="Dark theme">
            <Moon size={14} />
          </button>
        </div>

        <div className="menu-wrap">
          <button
            className="icon-action"
            style={{ width: "auto", padding: "0 .3rem" }}
            onClick={() => setOpenMenu(openMenu === "profile" ? null : "profile")}
          >
            <span className="profile-avatar" style={{ width: 28, height: 28, fontSize: ".72rem" }}>
              {initials(user)}
            </span>
          </button>
          {openMenu === "profile" && (
            <div className="menu-popover">
              <div className="menu-user">
                <div className="name">{user.full_name || user.email}</div>
                <div className="email">{user.email}</div>
              </div>
              <div className="menu-divider" />
              <button className="menu-item"><User size={14} /> Account</button>
              <button className="menu-item"><Settings size={14} /> Preferences</button>
              <div className="menu-divider" />
              <button className="menu-item danger" onClick={logout}>
                <LogOut size={14} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
