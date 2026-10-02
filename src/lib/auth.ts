// Passwords and session tokens. Server only: it uses node:crypto.
//
// A password is stored as "scrypt$<salt>$<hash>" (both base64url), never as
// text. A session token is a random string kept in the browser's cookie; the
// database stores only its SHA-256 hash, so a copy of the sessions table
// cannot be used to sign in.

import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

/** False for a wrong password and for anything that is not a stored hash. */
export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const [scheme, salt, hash] = (stored ?? "").split("$");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  if (expected.length !== KEY_LENGTH) return false;
  const key = await derive(password, Buffer.from(salt, "base64url"));
  return timingSafeEqual(key, expected);
}

export function newSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// No 0, O, 1, I or L, which are easy to mix up when a code is read aloud.
const JOIN_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** A six-character class code such as "K7WQ3M". */
export function newJoinCode(): string {
  // 31 letters fit 8 times into 248, so bytes from 248 up are thrown away to
  // keep every letter equally likely.
  let code = "";
  while (code.length < 6) {
    for (const byte of randomBytes(12)) {
      if (byte < 248 && code.length < 6) code += JOIN_CODE_ALPHABET[byte % 31];
    }
  }
  return code;
}
