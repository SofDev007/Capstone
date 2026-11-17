// Map configuration shared by all apps. One place to switch tile provider.
// OpenFreeMap: free, no API key, no usage limits, OpenStreetMap data, vector tiles.
// For a public launch in India, consider Ola Maps or Mappls (official boundaries) — change the style URL here.
export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
// Night Glass: OpenFreeMap "dark" (a Dark Matter fork), recoloured after load by applyNightGlassStyle (neonMap.js).
export const MAP_STYLE_DARK_URL = 'https://tiles.openfreemap.org/styles/dark';
export const MAP_ATTRIBUTION = '© OpenStreetMap contributors · OpenFreeMap';

// Whole-India view used when we know nothing better (no GPS, no buses).
export const INDIA_VIEW = { center: [78.9629, 22.5937], zoom: 4.1 };
export const INDIA_BOUNDS = [[68.1, 6.5], [97.5, 35.7]];

// The phone apps' maps load MapLibre as-is from the CDN instead of bundling it: Metro's Babel
// rewrites its `class` code into helpers that live outside the code MapLibre copies into its
// tile worker, so the worker dies ("y is not defined") and the map stays blank on Android.
// Pinned version + integrity hashes: the browser refuses any other file.
const MAPLIBRE = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl';
let loading;
export function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  loading ||= new Promise((resolve, reject) => {
    const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `${MAPLIBRE}.css`, crossOrigin: 'anonymous', integrity: 'sha384-MinO0mNliZ3vwppuPOUnGa+iq619pfMhLVUXfC4LHwSCvF9H+6P/KO4Q7qBOYV5V' });
    const js = Object.assign(document.createElement('script'), { src: `${MAPLIBRE}.js`, crossOrigin: 'anonymous', integrity: 'sha384-SYKAG6cglRMN0RVvhNeBY0r3FYKNOJtznwA0v7B5Vp9tr31xAHsZC0DqkQ/pZDmj' });
    js.onload = () => resolve(window.maplibregl);
    js.onerror = () => { loading = null; reject(new Error('Map library failed to load')); };
    document.head.append(css, js);
  });
  return loading;
}
