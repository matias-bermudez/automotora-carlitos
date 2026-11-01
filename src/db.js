import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// borrador: no se ve en la web · disponible / reservado: en el catálogo
// vendido: sale del catálogo pero queda en el historial y su link sigue andando
export const STATUSES = ['borrador', 'disponible', 'reservado', 'vendido'];
export const PUBLIC_STATUSES = ['disponible', 'reservado'];

export const BODY_TYPES = ['Hatch', 'Sedán', 'SUV', 'Pickup', 'Utilitario', 'Coupé', 'Rural'];
export const FUELS = ['Nafta', 'Diésel', 'Híbrido', 'Eléctrico', 'GNC'];
export const TRANSMISSIONS = ['Manual', 'Automático'];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS cars (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  km INTEGER NOT NULL DEFAULT 0,
  price INTEGER,
  fuel TEXT NOT NULL DEFAULT 'Nafta',
  transmission TEXT NOT NULL DEFAULT 'Manual',
  body_type TEXT NOT NULL DEFAULT 'Hatch',
  engine TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '',
  doors INTEGER,
  badge TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  equipment TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'disponible',
  featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  sold_at TEXT
);
CREATE INDEX IF NOT EXISTS cars_status ON cars(status);

CREATE TABLE IF NOT EXISTS photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  car_id INTEGER NOT NULL REFERENCES cars(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS photos_car ON photos(car_id, position);

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export function openDb(dataDir) {
  let file = ':memory:';
  if (dataDir !== ':memory:') {
    fs.mkdirSync(dataDir, { recursive: true });
    file = path.join(dataDir, 'automotora.sqlite');
  }
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

const CAR_COLUMNS = `
  c.*,
  (SELECT filename FROM photos p WHERE p.car_id = c.id ORDER BY position, id LIMIT 1) AS cover,
  (SELECT COUNT(*) FROM photos p WHERE p.car_id = c.id) AS photo_count
`;

const PUBLIC_WHERE = `c.status IN (${PUBLIC_STATUSES.map((s) => `'${s}'`).join(',')})`;

const SORTS = {
  nuevos: 'c.created_at DESC, c.id DESC',
  menor: 'c.price IS NULL, c.price ASC',
  mayor: 'c.price IS NULL, c.price DESC',
  km: 'c.km ASC',
  anio: 'c.year DESC, c.id DESC',
};

export function createStore(db) {
  const tx = (fn) => {
    db.exec('BEGIN');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };

  function photosFor(carId) {
    return db.prepare('SELECT id, filename, position FROM photos WHERE car_id = ? ORDER BY position, id').all(carId);
  }

  function carFields(data) {
    return {
      brand: data.brand,
      model: data.model,
      year: data.year,
      km: data.km ?? 0,
      price: data.price ?? null,
      fuel: data.fuel,
      transmission: data.transmission,
      body_type: data.body_type,
      engine: data.engine ?? '',
      color: data.color ?? '',
      doors: data.doors ?? null,
      badge: data.badge ?? '',
      description: data.description ?? '',
      equipment: data.equipment ?? '',
      status: data.status,
      featured: data.featured ? 1 : 0,
    };
  }

  return {
    // ---------- Sitio público ----------

    searchCars({ q = '', brand = '', type = '', trans = '', maxPrice = null, sort = 'nuevos', page = 1, perPage = 12 } = {}) {
      const where = [PUBLIC_WHERE];
      const params = {};
      if (q) {
        where.push("(c.brand || ' ' || c.model) LIKE :q");
        params.q = `%${q}%`;
      }
      if (brand) {
        where.push('c.brand = :brand');
        params.brand = brand;
      }
      if (type) {
        where.push('c.body_type = :type');
        params.type = type;
      }
      if (trans) {
        where.push('c.transmission = :trans');
        params.trans = trans;
      }
      if (maxPrice) {
        where.push('c.price <= :maxPrice');
        params.maxPrice = maxPrice;
      }
      const whereSql = where.join(' AND ');
      const total = db.prepare(`SELECT COUNT(*) AS n FROM cars c WHERE ${whereSql}`).get(params).n;
      const pages = Math.max(1, Math.ceil(total / perPage));
      const current = Math.min(Math.max(1, page), pages);
      const cars = db
        .prepare(`SELECT ${CAR_COLUMNS} FROM cars c WHERE ${whereSql} ORDER BY ${SORTS[sort] || SORTS.nuevos} LIMIT :limit OFFSET :offset`)
        .all({ ...params, limit: perPage, offset: (current - 1) * perPage });
      return { cars, total, page: current, pages };
    },

    latestCars(limit = 6) {
      return db.prepare(`SELECT ${CAR_COLUMNS} FROM cars c WHERE ${PUBLIC_WHERE} ORDER BY c.created_at DESC, c.id DESC LIMIT ?`).all(limit);
    },

    // El destacado de la semana; si no hay ninguno marcado, el último que entró con fotos.
    featuredCar() {
      return (
        db.prepare(`SELECT ${CAR_COLUMNS} FROM cars c WHERE ${PUBLIC_WHERE} AND c.featured = 1 ORDER BY c.updated_at DESC LIMIT 1`).get() ||
        db.prepare(`SELECT ${CAR_COLUMNS} FROM cars c WHERE ${PUBLIC_WHERE} AND cover IS NOT NULL ORDER BY c.created_at DESC LIMIT 1`).get() ||
        null
      );
    },

    similarCars(car, limit = 3) {
      return db
        .prepare(
          `SELECT ${CAR_COLUMNS} FROM cars c WHERE ${PUBLIC_WHERE} AND c.id != :id
           ORDER BY (c.body_type = :type) DESC, ABS(COALESCE(c.price, 0) - :price) ASC LIMIT :limit`
        )
        .all({ id: car.id, type: car.body_type, price: car.price || 0, limit });
    },

    facets() {
      const rows = (sql) => db.prepare(sql).all().map((r) => r.v);
      return {
        brands: rows(`SELECT DISTINCT brand AS v FROM cars c WHERE ${PUBLIC_WHERE} ORDER BY brand`),
        types: rows(`SELECT DISTINCT body_type AS v FROM cars c WHERE ${PUBLIC_WHERE} ORDER BY body_type`),
        maxPrice: db.prepare(`SELECT MAX(price) AS v FROM cars c WHERE ${PUBLIC_WHERE}`).get().v || 0,
      };
    },

    // ---------- Fichas (público y admin) ----------

    getCar(id) {
      const car = db.prepare(`SELECT ${CAR_COLUMNS} FROM cars c WHERE c.id = ?`).get(id);
      if (!car) return null;
      car.photos = photosFor(car.id);
      return car;
    },

    // ---------- Admin ----------

    listCars(status = '') {
      const where = status ? 'WHERE c.status = :status' : '';
      return db
        .prepare(`SELECT ${CAR_COLUMNS} FROM cars c ${where} ORDER BY CASE c.status WHEN 'vendido' THEN 1 ELSE 0 END, c.updated_at DESC`)
        .all(status ? { status } : {});
    },

    statusCounts() {
      const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
      for (const row of db.prepare('SELECT status, COUNT(*) AS n FROM cars GROUP BY status').all()) counts[row.status] = row.n;
      counts.total = Object.values(counts).reduce((a, b) => a + b, 0);
      return counts;
    },

    createCar(data) {
      const fields = carFields(data);
      const cols = Object.keys(fields);
      return tx(() => {
        if (fields.featured) db.exec('UPDATE cars SET featured = 0');
        const { lastInsertRowid } = db
          .prepare(`INSERT INTO cars (${cols.join(', ')}, sold_at) VALUES (${cols.map((c) => ':' + c).join(', ')}, CASE WHEN :status = 'vendido' THEN datetime('now') END)`)
          .run(fields);
        return Number(lastInsertRowid);
      });
    },

    updateCar(id, data) {
      const fields = carFields(data);
      const sets = Object.keys(fields).map((c) => `${c} = :${c}`);
      tx(() => {
        if (fields.featured) db.prepare('UPDATE cars SET featured = 0 WHERE id != ?').run(id);
        db.prepare(
          `UPDATE cars SET ${sets.join(', ')}, updated_at = datetime('now'),
             sold_at = CASE WHEN :status = 'vendido' THEN COALESCE(sold_at, datetime('now')) END
           WHERE id = :id`
        ).run({ ...fields, id });
      });
    },

    setStatus(id, status) {
      db.prepare(
        `UPDATE cars SET status = :status, updated_at = datetime('now'),
           sold_at = CASE WHEN :status = 'vendido' THEN COALESCE(sold_at, datetime('now')) END
         WHERE id = :id`
      ).run({ id, status });
    },

    // Devuelve los nombres de archivo de las fotos para que quien llama los borre del disco.
    deleteCar(id) {
      const files = photosFor(id).map((p) => p.filename);
      db.prepare('DELETE FROM cars WHERE id = ?').run(id);
      return files;
    },

    addPhotos(carId, filenames) {
      tx(() => {
        let next = db.prepare('SELECT COALESCE(MAX(position) + 1, 0) AS n FROM photos WHERE car_id = ?').get(carId).n;
        const insert = db.prepare('INSERT INTO photos (car_id, filename, position) VALUES (?, ?, ?)');
        for (const name of filenames) insert.run(carId, name, next++);
      });
    },

    // Borra las fotos indicadas (solo si son de ese auto) y devuelve sus archivos.
    deletePhotos(carId, photoIds) {
      const files = [];
      tx(() => {
        const find = db.prepare('SELECT filename FROM photos WHERE id = ? AND car_id = ?');
        const del = db.prepare('DELETE FROM photos WHERE id = ? AND car_id = ?');
        for (const pid of photoIds) {
          const row = find.get(pid, carId);
          if (!row) continue;
          del.run(pid, carId);
          files.push(row.filename);
        }
      });
      return files;
    },

    setCover(carId, photoId) {
      const photos = photosFor(carId);
      if (!photos.some((p) => p.id === photoId)) return;
      const ordered = [photos.find((p) => p.id === photoId), ...photos.filter((p) => p.id !== photoId)];
      tx(() => {
        const upd = db.prepare('UPDATE photos SET position = ? WHERE id = ?');
        ordered.forEach((p, i) => upd.run(i, p.id));
      });
    },

    // ---------- Cuenta de administrador ----------

    findAdmin(username) {
      return db.prepare('SELECT * FROM admins WHERE username = ?').get(username) || null;
    },

    getAdmin(id) {
      return db.prepare('SELECT id, username FROM admins WHERE id = ?').get(id) || null;
    },

    upsertAdmin(username, passwordHash) {
      db.prepare(
        'INSERT INTO admins (username, password_hash) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash'
      ).run(username, passwordHash);
    },

    adminCount() {
      return db.prepare('SELECT COUNT(*) AS n FROM admins').get().n;
    },
  };
}
