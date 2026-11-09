export interface AuthenticatedUser {
  id: string;
  email: string;
}

interface AuthGraphqlResponse {
  data?: {
    validateToken?: {
      id?: unknown;
      email?: unknown;
    } | null;
  };
  errors?: Array<{
    message?: string;
    extensions?: { code?: string };
  }>;
}

const VALIDATE_TOKEN_QUERY = /* GraphQL */ `
  query ValidateToken {
    validateToken {
      id
      email
    }
  }
`;

export function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.email === 'string' &&
    candidate.email.length > 0
  );
}

export type { AuthGraphqlResponse, VALIDATE_TOKEN_QUERY as validateTokenQuery };
export { VALIDATE_TOKEN_QUERY };
