const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = 8889;

require('dotenv').config();
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
});

app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'datagap.html'));
});

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return value !== '' &&
    value !== null &&
    value !== undefined &&
    Number.isSafeInteger(number) &&
    number >= 0
    ? number
    : null;
}

app.post('/post_gap', async (req, res) => {
  try {
    const {
      core_part_no, core_type, nb_date,
      point_1, point_2, point_3, point_4, point_5, judge,
    } = req.body ?? {};

    if (!core_part_no || !validDate(nb_date)) {
      return res.status(400).json({
        message: 'core_part_no and a valid nb_date (YYYY-MM-DD) are required',
      });
    }

    await pool.query(
      `INSERT INTO gap_data
        (core_part_no, core_type, nb_pd,
         point_1, point_2, point_3, point_4, point_5, judge)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        core_part_no, core_type ?? null, nb_date,
        point_1 ?? null, point_2 ?? null, point_3 ?? null,
        point_4 ?? null, point_5 ?? null, judge ?? null,
      ]
    );

    return res.status(200).json({ message: 'Data saved successfully' });
  } catch (err) {
    console.error('Error /post_gap:', err);
    return res.status(500).json({ message: 'Error saving data' });
  }
});

app.get('/get_gap_data', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (nb_pd, core_part_no) *
       FROM gap_data
       WHERE nb_pd::date >= CURRENT_DATE - 14
         AND nb_pd IS NOT NULL
       ORDER BY nb_pd DESC, core_part_no, id DESC`
    );

    return res.json(rows);
  } catch (err) {
    console.error('Error /get_gap_data:', err);
    return res.status(500).json({ message: 'Error fetching data' });
  }
});

app.post('/post_water', async (req, res) => {
  const { core_part_no, core_type, nb_date, quantity, leak } = req.body ?? {};
  const qty = nonNegativeInteger(quantity);
  const lk = nonNegativeInteger(leak);

  if (!core_part_no || !validDate(nb_date) ||
    qty === null || lk === null || lk > qty) {
    return res.status(400).json({
      message: 'Invalid core_part_no, nb_date, quantity or leak',
    });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO water_leak
         (core_part_no, core_type, nb_pd, quantity, leak, ratio, judge)
       VALUES (
         $1, $2, $3, $4, $5,
         CASE WHEN $4::numeric > 0
           THEN ROUND($5::numeric * 100 / $4::numeric, 2)
           ELSE 0 END,
         CASE WHEN $4::numeric > 0 AND $5::numeric * 100 > $4::numeric * 5
           THEN 'NG' ELSE 'OK' END
       )
       ON CONFLICT (core_part_no, nb_pd) DO UPDATE
       SET quantity = water_leak.quantity + EXCLUDED.quantity,
           leak = water_leak.leak + EXCLUDED.leak,
           ratio = CASE
             WHEN water_leak.quantity + EXCLUDED.quantity > 0
             THEN ROUND(
               (water_leak.leak + EXCLUDED.leak)::numeric * 100 /
               (water_leak.quantity + EXCLUDED.quantity)::numeric, 2
             )
             ELSE 0 END,
           judge = CASE
             WHEN (water_leak.leak + EXCLUDED.leak) * 100 >
                  (water_leak.quantity + EXCLUDED.quantity) * 5
             THEN 'NG' ELSE 'OK' END
       RETURNING quantity, leak, ratio, judge`,
      [core_part_no, core_type ?? null, nb_date, qty, lk]
    );

    return res.json({
      message: 'Data saved successfully',
      data: rows[0],
    });
  } catch (err) {
    console.error('Error /post_water:', err);
    return res.status(500).json({ message: 'Error saving data' });
  }
});

app.get('/get_water', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT *
       FROM water_leak
        WHERE nb_pd::date >= CURRENT_DATE - 14
       ORDER BY nb_pd DESC, id DESC`
    );

    return res.json(rows);
  } catch (err) {
    console.error('Error /get_water:', err);
    return res.status(500).json({ message: 'Error fetching data' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
