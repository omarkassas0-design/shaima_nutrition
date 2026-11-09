/**
 * PWA Manifest — served via backend function.
 *
 * The platform auto-generates /manifest.json with absolute start_url/scope,
 * theme_color #000000, and no maskable icons. We can't override that file,
 * but we CAN serve a better manifest here and point to it from JavaScript
 * (the platform strips <link> tags in HTML head but can't strip JS code).
 *
 * This endpoint is public (no auth) — it returns static JSON, like a webhook.
 */
/**
 * Full-bleed launcher icons: the blue background covers the whole square and
 * the white tooth sits inside Android's adaptive-icon safe zone (66% inner
 * circle), so no mask adds a white plate around the artwork. Paths are
 * root-relative so they resolve on every domain the app is served from.
 */
const ICON_192 = "/icons/auradental-icon-192.png";
const ICON_512 = "/icons/auradental-icon-512.png";

export default async function (req) {
  const manifest = {
    id: "/",
    name: "AuraDental",
    short_name: "AuraDental",
    description:
      "Cloud-based dental practice management platform for modern dental clinics — patient records, scheduling, 3D dental charting, billing, and reports.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    theme_color: "#0ea5e9",
    background_color: "#f0f4f8",
    categories: ["medical", "productivity", "business", "health"],
    lang: "en",
    dir: "ltr",
    prefer_related_applications: false,
    icons: [
      {
        src: ICON_192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: ICON_192,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: ICON_512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: ICON_512,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };

  return new Response(JSON.stringify(manifest), {
    status: 200,
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "no-cache",
    },
  });
}
