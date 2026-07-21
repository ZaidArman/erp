import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    // Accept any lvh.me subdomain so alpha.lvh.me:3000 works in dev.
    allowedHosts: [".lvh.me", "localhost"],
  },
});
