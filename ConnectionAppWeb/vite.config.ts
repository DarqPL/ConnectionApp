import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

const resolveAllowedHosts = (publicUrl?: string): string[] => {
  const hosts = new Set<string>([".ngrok-free.app", ".ngrok.io", "localhost"]);

  if (!publicUrl) {
    return Array.from(hosts);
  }

  try {
    hosts.add(new URL(publicUrl).hostname);
  } catch {
    // Ignore invalid optional public URL and keep defaults.
  }

  return Array.from(hosts);
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: "0.0.0.0",
      allowedHosts: resolveAllowedHosts(env.VITE_PUBLIC_APP_URL),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      global: "window",
    },
  };
});
