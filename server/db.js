// db.js — single shared SQL Server connection pool.
// Credentials come from environment variables (set these in Railway, never in code).
import sql from 'mssql';

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,        // e.g. "myserver.database.windows.net" or an IP
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 1433,
  options: {
    // Azure SQL needs encrypt:true. For a self-hosted server with a self-signed cert,
    // set DB_TRUST_CERT=true to allow it.
    encrypt: process.env.DB_ENCRYPT ? process.env.DB_ENCRYPT === 'true' : true,
    trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
};

let poolPromise = null;

export function getPool() {
  if (!poolPromise) {
    poolPromise = sql.connect(config).then((pool) => {
      console.log('[db] connected to SQL Server');
      return pool;
    }).catch((err) => {
      poolPromise = null; // allow retry on next request
      console.error('[db] connection failed:', err.message);
      throw err;
    });
  }
  return poolPromise;
}

// Helper: run a parameterized query and return the recordset (array of rows).
// Usage: const rows = await query('SELECT * FROM t WHERE x=@x', { x: 5 });
export async function query(text, params = {}) {
  const pool = await getPool();
  const req = pool.request();
  for (const [key, value] of Object.entries(params)) {
    req.input(key, value);
  }
  const result = await req.query(text);
  return result.recordset;
}

export { sql };
