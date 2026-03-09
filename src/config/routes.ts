/**
 * Route Registry
 *
 * Define ONLY the public routes here (routes that bypass JWT verification).
 * ALL OTHER routes require a valid Cognito JWT in the Authorization header.
 *
 * This is a "deny-by-default" security model:
 *  - If a route path matches a pattern in `publicRoutes` → skip JWT verification
 *  - If a route path does NOT match → require JWT validation before proxying
 *  - No need to pre-register routes; they're checked dynamically at request time
 *
 * Fields:
 *  - path   : Express-compatible path pattern (supports wildcards)
 *  - target : Currently unused (always proxies to BACKEND_SERVICE_URL)
 */

export interface RouteConfig {
  /** Express-compatible path pattern, e.g. "/api/v1/users/*" */
  path: string;
  /** The env variable key pointing to the upstream base URL (currently unused) */
  target: string;
  /** Restrict to specific HTTP verbs; omit to allow all */
  methods?: string[];
}

/**
 * Public routes that bypass JWT verification.
 *
 * All requests not matching these patterns will require JWT authentication.
 * No need to register every endpoint here – only define what should be public.
 */
export const publicRoutes: RouteConfig[] = [
  // ─── Health checks ──────────────────────────────────────────
  {
    path: '/api/v1/health',
    target: 'BACKEND_SERVICE_URL',
  },

  // ─── Authentication endpoints ────────────────────────────────
  {
    path: '/api/v1/auth',
    target: 'BACKEND_SERVICE_URL',
  },
  {
    path: '/api/v1/auth/*',
    target: 'BACKEND_SERVICE_URL',
  },

  // ─── Stripe webhooks & public pricing ───────────────────────
  {
    path: '/api/v1/stripe',
    target: 'BACKEND_SERVICE_URL',
  },
  {
    path: '/api/v1/stripe/*',
    target: 'BACKEND_SERVICE_URL',
  },

  // ─── Public pricing information ─────────────────────────────
  {
    path: '/api/v1/plans/*',
    target: 'BACKEND_SERVICE_URL',
  },

  // ─── User registration ─────────────────────────────────────────
  {
    path: '/api/v1/users/register',
    target: 'BACKEND_SERVICE_URL',
  },

  {
    path: '/ /api/v1/subscription/plans/country/*',
    target: 'BACKEND_SERVICE_URL',
  },
];
