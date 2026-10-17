/**
 * Utilitaires de sécurité cryptographique et de protection contre les injections (OWASP Top 10)
 * - Hachage de mots de passe PBKDF2-HMAC-SHA256 (Web Crypto API + repli pur JS conforme RFC 2898)
 * - Comparaison en temps constant contre les attaques temporelles (Timing Attacks)
 * - Validation et assainissement strict des identifiants PostgREST (.or / .eq)
 */

const PBKDF2_PREFIX = 'pbkdf2_sha256';
const DEFAULT_ITERATIONS = 60000;
const KEY_LENGTH_BYTES = 32; // 256 bits

/**
 * Normalise un nom d'utilisateur pour dériver un sel déterministe propre au compte
 */
function normalizeUsernameForSalt(username: string): string {
  return username
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]/g, '_');
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16) || 0;
  }
  return out;
}

function utf8ToBytes(str: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(str);
  }
  const encoded = unescape(encodeURIComponent(str));
  const out = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    out[i] = encoded.charCodeAt(i);
  }
  return out;
}

/**
 * Implémentation SHA-256 pure JS (RFC 6234) utilisée en repli si Web Crypto (crypto.subtle)
 * n'est pas disponible (ex: test sur IP locale HTTP non-TLS).
 */
const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256Fallback(message: Uint8Array): Uint8Array {
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const bitLen = message.length * 8;
  const paddedLen = Math.ceil((message.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(message);
  padded[message.length] = 0x80;

  const view = new DataView(padded.buffer);
  view.setUint32(paddedLen - 8, Math.floor(bitLen / 0x100000000), false);
  view.setUint32(paddedLen - 4, bitLen >>> 0, false);

  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const out = new Uint8Array(32);
  const outView = new DataView(out.buffer);
  outView.setUint32(0, h0, false);
  outView.setUint32(4, h1, false);
  outView.setUint32(8, h2, false);
  outView.setUint32(12, h3, false);
  outView.setUint32(16, h4, false);
  outView.setUint32(20, h5, false);
  outView.setUint32(24, h6, false);
  outView.setUint32(28, h7, false);
  return out;
}

function hmacSha256Fallback(key: Uint8Array, data: Uint8Array): Uint8Array {
  const blockSize = 64;
  let normalizedKey = key;
  if (normalizedKey.length > blockSize) {
    normalizedKey = sha256Fallback(normalizedKey);
  }
  const paddedKey = new Uint8Array(blockSize);
  paddedKey.set(normalizedKey);

  const ipad = new Uint8Array(blockSize + data.length);
  const opad = new Uint8Array(blockSize + 32);
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = paddedKey[i] ^ 0x36;
    opad[i] = paddedKey[i] ^ 0x5c;
  }
  ipad.set(data, blockSize);
  const innerHash = sha256Fallback(ipad);
  opad.set(innerHash, blockSize);
  return sha256Fallback(opad);
}

function pbkdf2Sha256Fallback(
  passwordBytes: Uint8Array,
  saltBytes: Uint8Array,
  iterations: number
): Uint8Array {
  // Pour keyLength = 32 octets (1 bloc SHA-256), bloc index = 1 (big-endian 0x00000001)
  const saltWithIndex = new Uint8Array(saltBytes.length + 4);
  saltWithIndex.set(saltBytes);
  saltWithIndex[saltBytes.length + 3] = 1;

  let u = hmacSha256Fallback(passwordBytes, saltWithIndex);
  const result = new Uint8Array(u);

  for (let i = 1; i < iterations; i++) {
    u = hmacSha256Fallback(passwordBytes, u);
    for (let j = 0; j < 32; j++) {
      result[j] ^= u[j];
    }
  }
  return result;
}

async function derivePbkdf2Sha256Hex(
  password: string,
  saltBytes: Uint8Array,
  iterations: number
): Promise<string> {
  const passwordBytes = utf8ToBytes(password);

  if (
    typeof globalThis !== 'undefined' &&
    globalThis.crypto &&
    globalThis.crypto.subtle &&
    typeof globalThis.crypto.subtle.importKey === 'function'
  ) {
    try {
      const baseKey = await globalThis.crypto.subtle.importKey(
        'raw',
        passwordBytes as BufferSource,
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );
      const derivedBits = await globalThis.crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: saltBytes as BufferSource,
          iterations,
          hash: 'SHA-256',
        },
        baseKey,
        KEY_LENGTH_BYTES * 8
      );
      return bytesToHex(new Uint8Array(derivedBits));
    } catch {
      // Repli sur l'implémentation déterministe pure JS
    }
  }

  return bytesToHex(pbkdf2Sha256Fallback(passwordBytes, saltBytes, iterations));
}

/**
 * Comparaison de chaînes en temps constant (résistante aux Timing Attacks)
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const aBytes = utf8ToBytes(a);
  const bBytes = utf8ToBytes(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < maxLen; i++) {
    const byteA = i < aBytes.length ? aBytes[i] : 0;
    const byteB = i < bBytes.length ? bBytes[i] : 0;
    diff |= byteA ^ byteB;
  }
  return diff === 0;
}

/**
 * Indique si une valeur stockée est déjà un condensat cryptographique (et non un mot de passe en clair)
 */
export function isHashedPassword(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false;
  return (
    value.startsWith(`${PBKDF2_PREFIX}$`) ||
    value.startsWith('$2a$') ||
    value.startsWith('$2b$') ||
    value.startsWith('$2y$')
  );
}

/**
 * Génère un hachage PBKDF2-HMAC-SHA256 salé de manière déterministe par compte athlète
 * Format : pbkdf2_sha256$60000$<saltHex>$<hashHex>
 */
export async function hashPasswordPBKDF2(password: string, username: string): Promise<string> {
  const cleanUser = normalizeUsernameForSalt(username);
  const saltBytes = utf8ToBytes(`vitax_auth_salt_v1:${cleanUser}`);
  const saltHex = bytesToHex(saltBytes);
  const hashHex = await derivePbkdf2Sha256Hex(password, saltBytes, DEFAULT_ITERATIONS);
  return `${PBKDF2_PREFIX}$${DEFAULT_ITERATIONS}$${saltHex}$${hashHex}`;
}

/**
 * Vérifie un mot de passe candidat contre une empreinte stockée (PBKDF2 ou ancien mot de passe en clair à migrer)
 */
export async function verifyPasswordSecure(
  candidatePassword: string,
  username: string,
  storedSecret: string
): Promise<{ valid: boolean; needsMigration: boolean }> {
  if (!candidatePassword || !storedSecret) {
    return { valid: false, needsMigration: false };
  }

  if (storedSecret.startsWith(`${PBKDF2_PREFIX}$`)) {
    const parts = storedSecret.split('$');
    if (parts.length !== 4) {
      return { valid: false, needsMigration: false };
    }
    const iterations = parseInt(parts[1], 10);
    const saltHex = parts[2];
    const expectedHashHex = parts[3];
    if (!Number.isFinite(iterations) || iterations < 1000 || iterations > 1000000 || !saltHex || !expectedHashHex) {
      return { valid: false, needsMigration: false };
    }
    const saltBytes = hexToBytes(saltHex);
    const candidateHashHex = await derivePbkdf2Sha256Hex(candidatePassword, saltBytes, iterations);
    return {
      valid: constantTimeEqual(candidateHashHex, expectedHashHex),
      needsMigration: false,
    };
  }

  // Rétrocompatibilité avec les anciens comptes stockés en clair avant la migration de sécurité :
  // vérifie en temps constant et signale qu'une migration immédiate vers PBKDF2 est requise.
  const isLegacyMatch = constantTimeEqual(candidatePassword, storedSecret);
  return {
    valid: isLegacyMatch,
    needsMigration: isLegacyMatch,
  };
}

/**
 * Valide et nettoie un identifiant ou code ami avant utilisation dans un filtre PostgREST (.or / .eq)
 * Bloque tout caractère d'injection PostgREST (virgules, parenthèses, points, opérateurs, quotes).
 */
const SAFE_POSTGREST_IDENTIFIER_REGEX = /^[A-Za-z0-9_-]{1,64}$/;

export function sanitizePostgrestIdentifier(value?: string | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!SAFE_POSTGREST_IDENTIFIER_REGEX.test(trimmed)) {
    return null;
  }
  return trimmed;
}
