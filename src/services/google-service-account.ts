import {
  getGoogleServiceAccountClientEmail,
  getGoogleServiceAccountPrivateKey,
  getGoogleUserToImpersonate,
} from "../secrets";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_WORKSPACE_SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/spreadsheets",
].join(" ");

type CachedGoogleToken = {
  accessToken: string;
  cacheKey: string;
  expiresAt: number;
};

let cachedToken: CachedGoogleToken | undefined;

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlEncodeJson(value: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)));
}

function normalizePrivateKeyPem(value: string): string {
  const unescaped = value.replace(/\\n/g, "\n").trim();

  if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(unescaped)) {
    return unescaped;
  }

  const body = unescaped.replace(/\s+/g, "");
  const chunkedBody = body.match(/.{1,64}/g)?.join("\n") ?? body;
  return `-----BEGIN PRIVATE KEY-----\n${chunkedBody}\n-----END PRIVATE KEY-----`;
}

function pemToDerBytes(pem: string): Uint8Array {
  const base64 = pem
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, "")
    .replace(/-----END [A-Z ]*PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function derLength(length: number): Uint8Array {
  if (length < 128) {
    return new Uint8Array([length]);
  }

  const bytes: number[] = [];
  let remaining = length;

  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>= 8;
  }

  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function derTagged(tag: number, payload: Uint8Array): Uint8Array {
  return concatBytes(new Uint8Array([tag]), derLength(payload.length), payload);
}

function derSequence(...parts: Uint8Array[]): Uint8Array {
  return derTagged(0x30, concatBytes(...parts));
}

function wrapPkcs1RsaPrivateKey(pkcs1Der: Uint8Array): Uint8Array {
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  const rsaEncryptionOid = new Uint8Array([
    0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01,
  ]);
  const nullParams = new Uint8Array([0x05, 0x00]);
  const algorithmIdentifier = derSequence(rsaEncryptionOid, nullParams);
  const privateKeyOctetString = derTagged(0x04, pkcs1Der);

  return derSequence(version, algorithmIdentifier, privateKeyOctetString);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function importPrivateKey(privateKey: string): Promise<CryptoKey> {
  const pem = normalizePrivateKeyPem(privateKey);
  const derBytes = pemToDerBytes(pem);
  const algorithm: RsaHashedImportParams = {
    name: "RSASSA-PKCS1-v1_5",
    hash: "SHA-256",
  };

  try {
    return await crypto.subtle.importKey("pkcs8", toArrayBuffer(derBytes), algorithm, false, ["sign"]);
  } catch (error) {
    return crypto.subtle.importKey(
      "pkcs8",
      toArrayBuffer(wrapPkcs1RsaPrivateKey(derBytes)),
      algorithm,
      false,
      ["sign"]
    );
  }
}

async function signJwt(privateKey: string, clientEmail: string, subject: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: clientEmail,
    scope: GOOGLE_WORKSPACE_SCOPES,
    aud: GOOGLE_TOKEN_ENDPOINT,
    exp: now + 3600,
    iat: now,
    sub: subject,
  };
  const signingInput = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(claims)}`;
  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function getGoogleWorkspaceAccessToken(env: CloudflareBindings): Promise<string> {
  const [privateKey, clientEmail, subject] = await Promise.all([
    getGoogleServiceAccountPrivateKey(env),
    getGoogleServiceAccountClientEmail(env),
    getGoogleUserToImpersonate(env),
  ]);
  const cacheKey = `${clientEmail}:${subject}`;
  const now = Date.now();

  if (cachedToken?.cacheKey === cacheKey && cachedToken.expiresAt - 60_000 > now) {
    return cachedToken.accessToken;
  }

  const assertion = await signJwt(privateKey, clientEmail, subject);
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
    expires_in?: number;
  };

  if (!response.ok || !body.access_token) {
    throw new Error(
      body.error_description || body.error || `Google service account token exchange failed (${response.status})`
    );
  }

  cachedToken = {
    accessToken: body.access_token,
    cacheKey,
    expiresAt: now + Number(body.expires_in ?? 3600) * 1000,
  };

  return cachedToken.accessToken;
}
