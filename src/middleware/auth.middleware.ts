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

// Augment Express Request so downstream middlewares can access the user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: CognitoUser;
    }
  }
}

/**
 * Build the Cognito JWKS URL from environment variables.
 * Cached at module-load time – no runtime env dependency after startup.
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

const JWKS = createRemoteJWKSet(buildJwksUrl());

/**
 * Cognito JWT verification middleware.
 *
 * Reads the `Authorization: Bearer <token>` header, verifies the RS256
 * signature against the Cognito JWKS endpoint, and populates `req.user`.
 *
 * On failure it short-circuits with a descriptive 401 JSON response.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      statusCode: 401,
      error: 'Unauthorized',
      message:
        'Missing authorization token. Provide a valid Cognito JWT in the Authorization header.',
    });
    return;
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const clientId = process.env.COGNITO_CLIENT_ID;
    const region = process.env.COGNITO_REGION;
    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

    const { payload } = await jwtVerify(token, JWKS, {
      issuer,
      audience: clientId,
      algorithms: ['RS256'],
    });

    const claims = payload as JWTPayload & Record<string, unknown>;

    const user: CognitoUser = {
      sub: claims.sub as string,
      email: claims['email'] as string | undefined,
      username: claims['cognito:username'] as string | undefined,
      groups: (claims['cognito:groups'] as string[] | undefined) ?? [],
    };

    req.user = user;

    // Forward user context to the upstream service via headers
    req.headers['x-user-id'] = user.sub;
    if (user.email) req.headers['x-user-email'] = user.email;
    if (user.username) req.headers['x-user-username'] = user.username;
    if (user.groups?.length) {
      req.headers['x-user-groups'] = user.groups.join(',');
    }

    next();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Token verification failed.';

    res.status(401).json({
      statusCode: 401,
      error: 'Unauthorized',
      message: `Invalid or expired token: ${message}`,
    });
  }
}
