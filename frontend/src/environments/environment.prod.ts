/**
 * Production Environment Configuration (Cloud Deployment — Vercel / Netlify)
 *
 * STEP TO CONFIGURE:
 * Once your backend Web Service is deployed on Render (e.g., https://vendor-reliability-backend.onrender.com),
 * replace the placeholder string below with your actual Render URL (without any trailing slash).
 */
export const RENDER_BACKEND_URL = '__REPLACE_WITH_RENDER_BACKEND_URL__'; // e.g. 'https://vendor-reliability-backend.onrender.com'

// Helper to determine the effective backend base URL
const getBaseUrl = (): string => {
  // 1. Allow optional runtime environment override via window object if injected
  if (typeof window !== 'undefined' && (window as any).__ENV?.apiUrl) {
    return (window as any).__ENV.apiUrl.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');
  }
  // 2. Use configured placeholder if updated
  if (RENDER_BACKEND_URL && !RENDER_BACKEND_URL.startsWith('__REPLACE')) {
    return RENDER_BACKEND_URL.replace(/\/+$/, '');
  }
  // 3. Fallback placeholder URL for unconfigured state
  return 'https://YOUR_RENDER_BACKEND_URL.onrender.com';
};

const baseUrl = getBaseUrl();

export const environment = {
  production: true,
  apiUrl: `${baseUrl}/api/v1`,
  healthUrl: `${baseUrl}/health`
};
