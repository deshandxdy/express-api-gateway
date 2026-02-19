# YMR API Gateway

A standalone Express.js service acting as the central entry point for the YMR platform. It handles routing, authentication (AWS Cognito), and proxying requests to upstream microservices.

## 🚀 Features

- **Centralized Routing**: Single entry point for all client requests.
- **Authentication**: Validates AWS Cognito JWTs (RS256 signature verification) for private routes.
- **Proxying**: Forwards authenticated requests to upstream services (e.g., `ymr-backend-service`) using `http-proxy-middleware`.
- **Public/Private Route config**: Declarative route configuration in `src/config/routes.ts`.
- **Security**: Sets `x-user-*` headers for downstream services to identify the authenticated user.
- **Standardized Errors**: Returns consistent JSON error responses (401 Unauthorized, 404 Route Not Registered, 502 Bad Gateway).

## 🛠️ Tech Stack

- **Runtime**: Node.js (v20+)
- **Framework**: Express
- **Language**: TypeScript
- **Auth**: `jose` (JWT verification), `jwks-rsa`
- **Proxy**: `http-proxy-middleware`
- **Logging**: `morgan`

## 📦 Installation

```bash
cd ymr-api-gateway
npm install
```

## ⚙️ Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `PORT` | Port the gateway listens on | `4003` |
| `NODE_ENV` | Environment (`development` or `production`) | `development` |
| `COGNITO_USER_POOL_ID` | AWS Cognito User Pool ID | (Required) |
| `COGNITO_CLIENT_ID` | AWS Cognito Client ID (App Client) | (Required) |
| `COGNITO_REGION` | AWS Region (e.g., `us-east-1`) | `us-east-1` |
| `BACKEND_SERVICE_URL` | URL of the upstream backend service | `http://localhost:4002` |

## 🏃‍♂️ Running Locally

### Development (Hot Reload)

```bash
npm run dev
```
The gateway will start on `http://localhost:4003`.

### Production Build

```bash
npm run build
npm start
```

## 🐳 Docker Support

The service is configured in the root `docker-compose.yml`.

```yaml
  ymr-api-gateway:
    build:
      context: ./ymr-api-gateway
      dockerfile: Dockerfile.dev
    container_name: ymr-api-gateway
    ports:
      - "4003:4003"
    command: npm run dev
    volumes:
      - ./ymr-api-gateway:/usr/src/app
      - /usr/src/app/node_modules
    environment:
      PORT: 4003
      NODE_ENV: development
      COGNITO_REGION: ap-southeast-1
      COGNITO_USER_POOL_ID: ap-southeast-1_7WFAeXRe3
      COGNITO_CLIENT_ID: 1c3mvfbj1k8uriju5bl0oebf20
      BACKEND_SERVICE_URL: http://ymr-backend-service:4002
    networks:
      - ymr-net
    depends_on:
      - ymr-backend-service
```

```bash
# Start the gateway and backend
docker-compose up -d --build ymr-api-gateway
```

This maps port **4003** on the host to the gateway container.

## Routing

Routes are defined in `src/config/routes.ts`. Each route specifies:
- `path`: The path pattern to match (supports wildcards like `/api/v1/users/*`).
- `target`: The environment variable name pointing to the upstream service URL.
- `public`: `true` to skip auth, `false` to require a valid Cognito token.

**Example Configuration:**

```typescript
export const routes: RouteConfig[] = [
  // Public Route (e.g., Health check, Webhooks)
  {
    path: '/api/v1/health',
    target: 'BACKEND_SERVICE_URL',
    public: true,
  },

  // Private Route (Requires Bearer Token)
  {
    path: '/api/v1/users/*',
    target: 'BACKEND_SERVICE_URL',
    public: false,
  },
];
```

### Adding a New Route
1. Open `src/config/routes.ts`.
2. Add a new object to the `routes` array.
3. Save the file (server auto-reloads in dev).

## 🔒 Authentication Flow

1. **Client** sends request with `Authorization: Bearer <token>`.
2. **Gateway**:
   - Checks if route is `public`. If yes, forwards immediately.
   - If `private`, verifies the JWT signature against AWS Cognito JWKS.
   - If valid, injects user info headers (`x-user-id`, `x-user-email`, `x-user-groups`) and forwards to upstream.
   - If invalid/missing, returns `401 Unauthorized`.
3. **Upstream Service** receives the request with guaranteed user identity headers.

## 🛑 Error Handling

- **401 Unauthorized**: Missing or invalid JWT on a private route.
- **404 Route Not Registered**: Request path does not match any entry in `routes.ts`.
- **502 Bad Gateway**: Upstream service is unreachable.
