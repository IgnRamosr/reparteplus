import * as SQLite from 'expo-sqlite';

export type NewUser = {
  email: string;
  phone?: string | null;
  password: string;          // ⚠️ Solo demo; en producción NO guardes plano
  inviteToken?: string | null;
};
export type Row = NewUser & { id: number; created_at: string };

/** Instancia única */
let db: SQLite.SQLiteDatabase | null = null;
async function getDb() {
  if (!db) db = await SQLite.openDatabaseAsync('app.db');
  return db;
}

/** Inicializa DB y crea tabla si no existe */
export async function initDb() {
  const d = await getDb();
  await d.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      password TEXT,
      inviteToken TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

/** Inserta usuario */
export async function saveUser(u: NewUser) {
  const d = await getDb();
  await d.runAsync(
    `INSERT INTO users (email, phone, password, inviteToken)
     VALUES (?, ?, ?, ?)`,
    [u.email, u.phone ?? null, u.password, u.inviteToken ?? null]
  );
}

/** ¿Existe email? */
export async function userExists(email: string): Promise<boolean> {
  const d = await getDb();
  const rows = await d.getAllAsync<{ count: number }>(
    `SELECT COUNT(*) as count FROM users WHERE email = ?`,
    [email]
  );
  return (rows?.[0]?.count ?? 0) > 0;
}

/** Obtiene 1 usuario por email */
export async function findUserByEmail(email: string) {
  const d = await getDb();
  const rows = await d.getAllAsync<Row>(
    `SELECT * FROM users WHERE email = ? LIMIT 1`,
    [email]
  );
  return rows?.[0] ?? null;
}

/** Verificación local (solo demo) */
export async function verifyUserLocal(email: string, password: string) {
  const u = await findUserByEmail(email);
  return !!u && u.password === password;
}

/** Lista usuarios */
export async function getUsers(): Promise<Row[]> {
  const d = await getDb();
  const rows = await d.getAllAsync<Row>(
    `SELECT id, email, phone, password, inviteToken, created_at
     FROM users
     ORDER BY created_at DESC`
  );
  return rows ?? [];
}

/** Borra todo */
export async function clearUsers() {
  const d = await getDb();
  await d.runAsync(`DELETE FROM users`);
}
