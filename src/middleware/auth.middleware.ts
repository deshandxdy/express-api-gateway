import { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

/**
 * Decoded Cognito JWT claims attached to every authenticated request.
 */
export interface CognitoUser {
  sub: string;
  email?: string;
  username?: string;
  groups?: string[];
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: CognitoUser;
    }
  }
}

/**
 * Build Cognito JWKS URL
 */
function buildJwksUrl(): URL {
  const region = process.env.COGNITO_REGION;
  const userPoolId = process.env.COGNITO_USER_POOL_ID;

  if (!region || !userPoolId) {
    throw new Error(
      '[Gateway] Missing COGNITO_REGION or COGNITO_USER_POOL_ID environment variables.',
    );
  }

  return new URL(
    `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`,
  );
}

/**
 * JWKS client (cached)
 */
const JWKS = createRemoteJWKSet(buildJwksUrl());

/**
 * Cognito JWT verification middleware
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.warn(
      `[Auth] Missing/invalid Authorization header | ${req.method} ${req.path}`,
    );

    res.status(401).json({
      statusCode: 401,
      error: 'Unauthorized',
      message:
        'Missing authorization token. Provide a valid Cognito JWT in the Authorization header.',
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const clientId = process.env.COGNITO_CLIENT_ID;
    const region = process.env.COGNITO_REGION;
    const userPoolId = process.env.COGNITO_USER_POOL_ID;

    const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

    console.debug(
      `[Auth] Verifying token | ClientID configured: ${clientId ? 'yes' : 'no'} | Issuer: ${issuer}`,
    );

    /**
     * Decode token for debugging
     */
    try {
      const payloadPart = token.split('.')[1];
      const decoded = JSON.parse(
        Buffer.from(payloadPart, 'base64').toString('utf-8'),
      );

      console.debug(
        `[Auth] Token claims | sub: ${decoded.sub} | client_id: ${
          decoded.client_id || 'none'
        } | aud: ${decoded.aud || 'none'} | exp: ${new Date(
          decoded.exp * 1000,
        ).toISOString()}`,
      );
    } catch {
      console.debug('[Auth] Could not decode token preview');
    }

    /**
     * Verify JWT signature
     */
    const { payload } = await jwtVerify(token, JWKS, {
      issuer,
      algorithms: ['RS256'],
    });

    const claims = payload as JWTPayload & Record<string, any>;

    /**
     * Validate token type
     */
    if (claims.token_use !== 'access') {
      console.error(
        `[Auth] Invalid token_use | Expected: access | Got: ${claims.token_use}`,
      );

      throw new Error('Invalid token type');
    }

    /**
     * Validate client_id
     */
    if (clientId && claims.client_id !== clientId) {
      console.error(
        `[Auth] Client ID mismatch | Expected: ${clientId} | Got: ${claims.client_id}`,
      );

      throw new Error(
        `Client ID mismatch: expected ${clientId}, got ${claims.client_id}`,
      );
    }

    if (clientId) {
      console.debug(
        `[Auth] ✓ Client ID verified | ${claims.client_id}`,
      );
    }

    /**
     * Extract user
     */
    const user: CognitoUser = {
      sub: claims.sub as string,
      email: claims.email as string | undefined,
      username: claims['cognito:username'] as string | undefined,
      groups: claims['cognito:groups'] as string[] | undefined ?? [],
    };

    req.user = user;

    /**
     * Forward user headers to microservices
     */
    req.headers['x-user-id'] = user.sub;

    if (user.email) {
      req.headers['x-user-email'] = user.email;
    }

    if (user.username) {
      req.headers['x-user-username'] = user.username;
    }

    if (user.groups?.length) {
      req.headers['x-user-groups'] = user.groups.join(',');
    }

    console.debug(
      `[Auth] ✓ JWT verified | User: ${user.sub} | Groups: ${user.groups?.length} | ${req.method} ${req.path}`,
    );

    next();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Token verification failed';
    const name = err instanceof Error ? err.name : 'Unknown';

    console.error(
      `[Auth] ✗ JWT verification failed | ${req.method} ${req.path} | ${name}: ${message}`,
    );

    res.status(401).json({
      statusCode: 401,
      error: 'Unauthorized',
      message: `Invalid or expired token: ${message}`,
    });
  }
}