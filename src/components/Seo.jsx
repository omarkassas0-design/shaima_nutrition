import { useEffect } from 'react';

const SITE_URL = 'https://auradentalcloud.com';
const DEFAULT_IMAGE = '/assets/brand.png';

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', 'canonical');
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Lightweight per-page SEO manager for the SPA.
 * Updates document.title, meta description, canonical URL, Open Graph,
 * Twitter Card, and robots directives on mount. Restores defaults on unmount.
 */
export default function Seo({ title, description, path, noindex = false, image = DEFAULT_IMAGE }) {
  useEffect(() => {
    const fullTitle = title;
    const url = `${SITE_URL}${path}`;

    document.title = fullTitle;
    setMeta('name', 'description', description);
    setMeta('name', 'robots', noindex ? 'noindex, nofollow' : 'index, follow');
    setCanonical(url);

    // Open Graph
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:url', url);
    setMeta('property', 'og:image', image);

    // Twitter
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);

    return () => {
      // Restore defaults on unmount
      document.title = 'AuraDental Cloud — Cloud-Based Dental Practice Management';
      setMeta('name', 'description', 'AuraDental Cloud is a secure, cloud-based practice management platform for modern dental clinics — patient records, scheduling, 3D dental charting, billing, and reports in one multilingual workspace.');
      setMeta('name', 'robots', 'index, follow');
      setCanonical(SITE_URL);
      setMeta('property', 'og:title', 'AuraDental Cloud — Cloud-Based Dental Practice Management');
      setMeta('property', 'og:description', 'Run your dental clinic beautifully. Patient records, scheduling, 3D charting, billing, and reports in one secure, multilingual cloud platform.');
      setMeta('property', 'og:url', SITE_URL);
      setMeta('property', 'og:image', DEFAULT_IMAGE);
      setMeta('name', 'twitter:title', 'AuraDental Cloud — Cloud-Based Dental Practice Management');
      setMeta('name', 'twitter:description', 'Run your dental clinic beautifully. One secure, multilingual cloud platform for patients, scheduling, charting, billing, and reports.');
      setMeta('name', 'twitter:image', DEFAULT_IMAGE);
    };
  }, [title, description, path, noindex, image]);

  return null;
}
