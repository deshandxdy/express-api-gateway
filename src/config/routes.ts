/**
 * Route Registry
 *
 * Define every route the gateway should handle here.
 * Any request NOT listed here will be rejected with a descriptive error
 * telling the caller to register the route first.
 *
 * Fields:
 *  - path     : Express-compatible path pattern (supports wildcards)
 *  - target   : env var key whose value is the upstream base URL
 *  - public   : if true, bypass JWT verification
 *  - methods  : optional allowlist of HTTP methods (omit = allow all)
 */

export interface RouteConfig {
  /** Express-compatible path pattern, e.g. "/api/v1/users/*" */
  path: string;
  /** The env variable key pointing to the upstream base URL */
  target: string;
  /** Skip JWT verification when true */
  public: boolean;
  /** Restrict to specific HTTP verbs; omit to allow all */
  methods?: string[];
}

export const routes: RouteConfig[] = [
  // ─── Public routes ──────────────────────────────────────────
  {
    path: '/api/v1/health',
    target: 'BACKEND_SERVICE_URL',
    public: true,
  },
  {
    // Auth endpoints: login, register, refresh, forgot-password, etc.
    // Matches both /api/v1/auth and /api/v1/auth/login etc.
    path: '/api/v1/auth',
    target: 'BACKEND_SERVICE_URL',
    public: true,
  },
  {
    path: '/api/v1/auth/*',
    target: 'BACKEND_SERVICE_URL',
    public: true,
  },
  {
    path: '/api/v1/stripe',
    target: 'BACKEND_SERVICE_URL',
    public: true,
  },
  {
    path: '/api/v1/stripe/*',
    target: 'BACKEND_SERVICE_URL',
    public: true,
  },

  // ─── Private routes (JWT required) ──────────────────────────
  {
    path: '/api/v1/users',
    target: 'BACKEND_SERVICE_URL',
    public: false,
  },
  {
    path: '/api/v1/users/*',
    target: 'BACKEND_SERVICE_URL',
    public: false,
  },
  {
    path: '/api/v1/subscription',
    target: 'BACKEND_SERVICE_URL',
    public: false,
  },
  {
    path: '/api/v1/subscription/*',
    target: 'BACKEND_SERVICE_URL',
    public: false,
  },
  {
    path: '/api/v1/access-control',
    target: 'BACKEND_SERVICE_URL',
    public: false,
  },
  {
    path: '/api/v1/access-control/*',
    target: 'BACKEND_SERVICE_URL',
    public: false,
  },
];
