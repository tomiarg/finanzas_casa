const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Init DB
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      cat TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      month TEXT NOT NULL,
      date TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// GET transactions for a month
app.get('/api/transactions', async (req, res) => {
  try {
    const { month } = req.query;
    const result = await pool.query(
      'SELECT * FROM transactions WHERE month = $1 ORDER BY date DESC',
      [month]
    );
    res.json(result.rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST new transaction
app.post('/api/transactions', async (req, res) => {
  try {
    const { id, type, cat, amount, month, date } = req.body;
    await pool.query(
      'INSERT INTO transactions (id, type, cat, amount, month, date) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, type, cat, amount, month, date]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE transaction
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM transactions WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET summary for a month
app.get('/api/summary', async (req, res) => {
  try {
    const { month } = req.query;
    const result = await pool.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN type='income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type='expense' THEN amount ELSE 0 END), 0) as expense
      FROM transactions WHERE month = $1
    `, [month]);
    res.json(result.rows[0]);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

initDB().then(() => {
  app.listen(PORT, () => console.log(`Casa Finanzas en puerto ${PORT}`));
}).catch(err => {
  console.error('DB init error:', err);
  process.exit(1);
});
