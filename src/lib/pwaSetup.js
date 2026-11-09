/**
 * Registers the Cloudflare Worker service-worker and manifest routes.
 */

const SW_URL = "/api/functions/pwaServiceWorker";
const MANIFEST_URL = "/api/functions/pwaManifest";
const THEME_COLOR = "#0ea5e9";
// Name shown under the installed app's icon.
const APP_NAME = "AuraDental";

export function setupPWA() {
  // Keep the local manifest and theme color aligned with the PWA installation UI.
  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (manifestLink) {
    manifestLink.href = MANIFEST_URL;
  }

  // Apply the app theme color.
  let themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute("content", THEME_COLOR);
  }

  // Home-screen name for the installed app.
  let appTitleMeta = document.querySelector(
    'meta[name="apple-mobile-web-app-title"]'
  );
  if (!appTitleMeta) {
    appTitleMeta = document.createElement("meta");
    appTitleMeta.setAttribute("name", "apple-mobile-web-app-title");
    document.head.appendChild(appTitleMeta);
  }
  appTitleMeta.setAttribute("content", APP_NAME);

  // Fix the status bar style (platform sets "black")
  const statusBarMeta = document.querySelector(
    'meta[name="apple-mobile-web-app-status-bar-style"]'
  );
  if (statusBarMeta) {
    statusBarMeta.setAttribute("content", "default");
  }

  // Register the service worker — Chrome requires this for the "Install" prompt.
  // Handle both cases: module loaded before 'load' event, or after (lazy-loaded).
  if ("serviceWorker" in navigator) {
    const register = () =>
      navigator.serviceWorker
        .register(SW_URL, { scope: "/" })
        .catch((err) => console.error("[PWA] SW registration failed:", err));
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
    }
  }
}
