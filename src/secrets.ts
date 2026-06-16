type SecretStoreBinding = {
  get: () => Promise<string | null>;
};

type SecretValue = string | SecretStoreBinding | undefined;

const WORKER_API_KEY_COOKIE = "worker_api_key";

function envRecord(env: CloudflareBindings): Record<string, SecretValue> {
  return env as unknown as Record<string, SecretValue>;
}

function isSecretStoreBinding(value: SecretValue): value is SecretStoreBinding {
  return typeof value === "object" && value !== null && typeof value.get === "function";
}

export async function getSecret(env: CloudflareBindings, key: string): Promise<string | undefined> {
  const value = envRecord(env)[key];

  if (typeof value === "string") {
    return value.trim() || undefined;
  }

  if (isSecretStoreBinding(value)) {
    const secret = await value.get();
    return secret?.trim() || undefined;
  }

  return undefined;
}

export async function getRequiredSecret(env: CloudflareBindings, key: string): Promise<string> {
  const value = await getSecret(env, key);

  if (!value) {
    throw new Error(`${key} is not configured`);
  }

  return value;
}

export async function getWorkerApiKey(env: CloudflareBindings): Promise<string> {
  return getRequiredSecret(env, "WORKER_API_KEY");
}

export async function getGoogleServiceAccountPrivateKey(env: CloudflareBindings): Promise<string> {
  const firstPart = await getRequiredSecret(env, "GOOGLE_CREDS_SA_PRIVATE_KEY_PT_1");
  const secondPart = await getRequiredSecret(env, "GOOGLE_CREDS_SA_PRIVATE_KEY_PT_2");
  return `${firstPart}${secondPart}`.trim();
}

export async function getGoogleServiceAccountClientEmail(env: CloudflareBindings): Promise<string> {
  return getRequiredSecret(env, "GOOGLE_CREDS_SA_CLIENT_EMAIL");
}

export async function getGoogleUserToImpersonate(env: CloudflareBindings): Promise<string> {
  return (await getSecret(env, "GOOGLE_USER_TO_IMPERSONATE")) ?? "justin@126colby.com";
}

function providedWorkerApiKey(request: Request): string | undefined {
  const explicitKey = request.headers.get("x-worker-api-key") ?? request.headers.get("x-api-key");

  if (explicitKey?.trim()) {
    return explicitKey.trim();
  }

  const cookieKey = requestCookie(request, WORKER_API_KEY_COOKIE);

  if (cookieKey?.trim()) {
    return cookieKey.trim();
  }

  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

function requestCookie(request: Request, name: string): string | undefined {
  const cookie = request.headers.get("cookie");

  if (!cookie) {
    return undefined;
  }

  for (const entry of cookie.split(";")) {
    const [rawName, ...rawValue] = entry.trim().split("=");

    if (rawName === name) {
      try {
        return decodeURIComponent(rawValue.join("="));
      } catch (error) {
        return rawValue.join("=");
      }
    }
  }

  return undefined;
}

async function digest(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function isWorkerApiKeyAuthorized(
  request: Request,
  env: CloudflareBindings
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  const expected = await getWorkerApiKey(env);
  const provided = providedWorkerApiKey(request);

  if (!provided) {
    return { ok: false, status: 401, message: "Worker API key required" };
  }

  const [providedHash, expectedHash] = await Promise.all([digest(provided), digest(expected)]);

  if (providedHash !== expectedHash) {
    return { ok: false, status: 401, message: "Invalid Worker API key" };
  }

  return { ok: true };
}
