import crypto from 'node:crypto';

const COOKIE = 'carlitos_admin';
const SESSION_DAYS = 30;

// ---------- Contraseñas ----------

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
  const [scheme, saltHex, hashHex] = String(stored).split('$');
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

// ---------- Sesión: cookie "adminId.vence.firma" ----------

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function readCookie(req, name) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function createSessionCookie(adminId, { secret, secure }) {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const value = `${adminId}.${expires}`;
  const token = `${value}.${sign(value, secret)}`;
  return [
    `${COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    // Strict: el navegador no manda la cookie en pedidos que vienen de otros sitios (protege los formularios del admin).
    'SameSite=Strict',
    `Max-Age=${SESSION_DAYS * 24 * 60 * 60}`,
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
}

export function readSession(req, secret) {
  const token = readCookie(req, COOKIE);
  if (!token) return null;
  const [id, expires, sig] = token.split('.');
  if (!id || !expires || !sig) return null;
  const expected = sign(`${id}.${expires}`, secret);
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  if (Number(expires) < Date.now()) return null;
  return Number(id);
}

// ---------- Freno a intentos de login ----------

// Máximo 5 intentos fallidos cada 15 minutos por IP.
export function createLoginLimiter({ max = 5, windowMs = 15 * 60 * 1000 } = {}) {
  const attempts = new Map();
  return {
    blocked(ip) {
      const entry = attempts.get(ip);
      if (!entry) return false;
      if (Date.now() - entry.first > windowMs) {
        attempts.delete(ip);
        return false;
      }
      return entry.count >= max;
    },
    fail(ip) {
      const entry = attempts.get(ip);
      if (!entry || Date.now() - entry.first > windowMs) attempts.set(ip, { count: 1, first: Date.now() });
      else entry.count++;
    },
    reset(ip) {
      attempts.delete(ip);
    },
  };
}
