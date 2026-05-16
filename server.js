const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      cat TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      month TEXT NOT NULL,
      date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      note TEXT DEFAULT ''
    )
  `);
  // Add note column if it doesn't exist (for existing deployments)
  await pool.query(`
    ALTER TABLE transactions ADD COLUMN IF NOT EXISTS note TEXT DEFAULT ''
  `).catch(() => {});
}

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/api/transactions', async (req, res) => {
  try {
    const { month } = req.query;
    const result = await pool.query(
      'SELECT * FROM transactions WHERE month = $1 ORDER BY date DESC',
      [month]
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Last 6 months for dashboard
app.get('/api/monthly-summary', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        month,
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as expense
      FROM transactions
      WHERE month >= TO_CHAR(NOW() - INTERVAL '5 months', 'YYYY-MM')
      GROUP BY month
      ORDER BY month ASC
    `);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const { id, type, cat, amount, month, date, note } = req.body;
    await pool.query(
      'INSERT INTO transactions (id, type, cat, amount, month, date, note) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [id, type, cat, amount, month, date, note || '']
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM transactions WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

initDB().then(() => {
  app.listen(PORT, () => console.log(`Casa Finanzas en puerto ${PORT}`));
}).catch(err => { console.error('DB init error:', err); process.exit(1); });
