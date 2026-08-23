import cors from 'cors';
import bcrypt from 'bcryptjs';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.join(__dirname, 'data');
fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(path.join(dbDir, 'taxpal.sqlite'));
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    profession TEXT,
    linkedin TEXT,
    portfolio TEXT,
    pan TEXT,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS user_data (
    user_id INTEGER PRIMARY KEY,
    data_json TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )
`);

const columns = db.prepare('PRAGMA table_info(users)').all().map((column) => column.name);

for (const column of ['linkedin', 'portfolio', 'pan']) {
  if (!columns.includes(column)) {
    db.prepare(`ALTER TABLE users ADD COLUMN ${column} TEXT`).run();
  }
}

const seedDemoUser = db.prepare(
  'SELECT id FROM users WHERE email = ?'
).get('demo@taxpal.in');

if (!seedDemoUser) {
  db.prepare(
    `INSERT INTO users (name, email, phone, profession, linkedin, portfolio, pan, password_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    'Arjun Sharma',
    'demo@taxpal.in',
    '',
    'Freelance Developer',
    'linkedin.com/in/arjunsharma',
    'arjunsharma.dev',
    'ABCDE1234F',
    bcrypt.hashSync('demo123', 10)
  );
}

const app = express();

app.use(cors());
app.use(express.json());

function sendError(res, status, message) {
  res.status(status).json({ error: message });
}

function toUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    profession: row.profession || '',
    linkedin: row.linkedin || '',
    portfolio: row.portfolio || '',
    pan: row.pan || '',
  };
}

function getUserRow(userId) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(Number(userId));
}

function sendUserData(res, row) {
  if (!row) {
    res.json({ data: null });
    return;
  }

  res.json({ data: JSON.parse(row.data_json) });
}

function validateAppData(data) {
  return data && typeof data === 'object' && !Array.isArray(data);
}

app.post('/api/auth/register', (req, res) => {
  const {
    name,
    email,
    phone = '',
    profession = '',
    linkedin = '',
    portfolio = '',
    pan = '',
    password,
  } = req.body || {};

  if (!name || !email || !password) {
    sendError(res, 400, 'Name, email and password are required.');
    return;
  }

  if (password.length < 6) {
    sendError(res, 400, 'Password must be at least 6 characters.');
    return;
  }

  try {
    const passwordHash = bcrypt.hashSync(password, 10);
    const result = db
      .prepare(
        `INSERT INTO users (name, email, phone, profession, linkedin, portfolio, pan, password_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(name, email, phone, profession, linkedin, portfolio, pan, passwordHash);

    res.status(201).json({
      user: toUser({
        id: result.lastInsertRowid,
        name,
        email,
        phone,
        profession,
        linkedin,
        portfolio,
        pan,
      }),
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      sendError(res, 409, 'Email already registered. Please login.');
      return;
    }

    console.error(error);
    sendError(res, 500, 'Unable to create account.');
  }
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    sendError(res, 400, 'Email and password are required.');
    return;
  }

  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!row) {
    sendError(res, 401, 'Invalid email or password.');
    return;
  }

  const validPassword = bcrypt.compareSync(password, row.password_hash);

  if (!validPassword) {
    sendError(res, 401, 'Invalid email or password.');
    return;
  }

  res.json({ user: toUser(row) });
});

app.get('/api/auth/me/:id', (req, res) => {
  const row = getUserRow(req.params.id);

  if (!row) {
    sendError(res, 404, 'User not found.');
    return;
  }

  res.json({ user: toUser(row) });
});

app
  .route('/api/data/:id')
  .get((req, res) => {
    const user = getUserRow(req.params.id);

    if (!user) {
      sendError(res, 404, 'User not found.');
      return;
    }

    const row = db
      .prepare('SELECT data_json FROM user_data WHERE user_id = ?')
      .get(user.id);
    sendUserData(res, row);
  })
  .put((req, res) => {
    const user = getUserRow(req.params.id);

    if (!user) {
      sendError(res, 404, 'User not found.');
      return;
    }

    if (!validateAppData(req.body)) {
      sendError(res, 400, 'Invalid user data.');
      return;
    }

    db.prepare(
      `INSERT INTO user_data (user_id, data_json, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET
         data_json = excluded.data_json,
         updated_at = datetime('now')`
    ).run(user.id, JSON.stringify(req.body));

    res.json({ ok: true });
  });

app.put('/api/profile/:id', (req, res) => {
  const user = getUserRow(req.params.id);

  if (!user) {
    sendError(res, 404, 'User not found.');
    return;
  }

  const {
    name,
    email,
    phone = '',
    profession = '',
    linkedin = '',
    portfolio = '',
    pan = '',
  } = req.body || {};

  if (!name || !email) {
    sendError(res, 400, 'Name and email are required.');
    return;
  }

  try {
    db.prepare(
      `UPDATE users
       SET name = ?, email = ?, phone = ?, profession = ?, linkedin = ?, portfolio = ?, pan = ?
       WHERE id = ?`
    ).run(name, email, phone, profession, linkedin, portfolio, pan, user.id);

    const updated = getUserRow(user.id);
    res.json({ user: toUser(updated) });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      sendError(res, 409, 'Email already registered.');
      return;
    }

    console.error(error);
    sendError(res, 500, 'Unable to update profile.');
  }
});

app.post('/api/ai/ask', async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY;

  const { messages, systemPrompt } = req.body || {};

  if (!messages || !Array.isArray(messages)) {
    sendError(res, 400, 'Invalid request.');
    return;
  }

  const lastMessage = messages[messages.length - 1]?.content?.toLowerCase() || '';

  if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
    const demoResponse = getDemoResponse(lastMessage, systemPrompt);
    res.json({ text: demoResponse });
    return;
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3001',
        'X-Title': 'TaxPal AI',
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-maverick:free',
        max_tokens: 1000,
        system: systemPrompt,
        messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('OpenRouter error:', data);
      sendError(res, response.status, data.error?.message || 'AI request failed.');
      return;
    }

    const text = data.choices?.[0]?.message?.content || 'No response generated.';
    res.json({ text });
  } catch (error) {
    console.error('AI request error:', error);
    sendError(res, 500, 'Connection error. Please try again.');
  }
});

function getDemoResponse(question, systemPrompt) {
  const q = question.toLowerCase();

  if (q.includes('tax') || q.includes('liability')) {
    return 'Based on your current income and expenses, consider maximizing deductions under Section 80C (up to ₹1.5L) and home office expenses. Your estimated tax of around ₹1.2L could potentially be reduced by ₹15,000-₹30,000 with proper planning. Consult a CA for regime comparison.';
  }

  if (q.includes('regime') || q.includes('new tax') || q.includes('old tax')) {
    return 'The new regime offers lower rates but fewer deductions. Given your income level and current deductions, the old regime may still be better if you have significant 80C/80D investments. Run both scenarios with your CA to be sure.';
  }

  if (q.includes('health score') || q.includes('improve') || q.includes('financial health')) {
    return 'To improve your score: 1) Build a 6-month emergency fund, 2) Reduce client dependency to under 40%, 3) Invoice within 15 days, 4) Track every expense, and 5) Set aside 30% of income for taxes/savings.';
  }

  if (q.includes('client') || q.includes('risk') || q.includes('exposure')) {
    return 'You currently have revenue concentration risk. Add 2-3 smaller clients to reduce dependency. Also review overdue payments and consider retainer contracts for stable monthly income.';
  }

  if (q.includes('expense') || q.includes('reduce') || q.includes('spending')) {
    return 'Review recurring subscriptions and software tools — cancel unused ones. Consider annual billing for discounts. Track per-project expenses to identify unprofitable work.';
  }

  return 'Based on your numbers, focus on: 1) Increasing income by 15-20% this quarter, 2) Maintaining expenses below 60% of income, 3) Saving at least 25% of net profit, and 4) Reviewing tax planning before the due date. Need more specific advice? Share more details.';
}


const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`TaxPal API running on http://localhost:${port}`);
});
