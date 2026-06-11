const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3001;
const DB_PATH = path.join(__dirname, 'data', 'ong.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

app.use(cors());
app.use(express.json());

const db = new sqlite3.Database(DB_PATH, (error) => {
  if (error) {
    console.error('Erro ao abrir o banco:', error.message);
    process.exit(1);
  }

  db.serialize(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS students (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        birth_date TEXT,
        class_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'Ativo',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (class_id) REFERENCES classes(id)
      );

      CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        student_id INTEGER NOT NULL,
        class_id INTEGER NOT NULL,
        attendance_date TEXT NOT NULL,
        status TEXT NOT NULL,
        UNIQUE(student_id, attendance_date),
        FOREIGN KEY (student_id) REFERENCES students(id),
        FOREIGN KEY (class_id) REFERENCES classes(id)
      );
    `);

    const seedClasses = [
      'Rouxinol',
      'Canário',
      'Sabiá',
      'Andorinha',
      'Beija-Flor',
      'Bem-Te-Vi'
    ];

    const insertClass = db.prepare(`
      INSERT OR IGNORE INTO classes (name)
      VALUES (?)
    `);

    seedClasses.forEach((name) => insertClass.run(name));
    insertClass.finalize();
  });
});

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function callback(error) {
      if (error) {
        reject(error);
        return;
      }

      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(row);
    });
  });
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/classes', async (_req, res) => {
  try {
    const classes = await all('SELECT id, name FROM classes ORDER BY name ASC');
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/students', async (req, res) => {
  try {
    const classId = req.query.classId;

    const sql = `
      SELECT s.id, s.name, s.birth_date AS birthDate, s.status, s.class_id AS classId, c.name AS className
      FROM students s
      INNER JOIN classes c ON c.id = s.class_id
      ${classId ? 'WHERE s.class_id = ?' : ''}
      ORDER BY s.name ASC
    `;

    const students = await all(sql, classId ? [classId] : []);
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/students/:id', async (req, res) => {
  try {
    const student = await get(
      `
        SELECT s.id, s.name, s.birth_date AS birthDate, s.status, s.class_id AS classId, c.name AS className
        FROM students s
        INNER JOIN classes c ON c.id = s.class_id
        WHERE s.id = ?
      `,
      [req.params.id]
    );

    if (!student) {
      res.status(404).json({ error: 'Aluno não encontrado.' });
      return;
    }

    res.json(student);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/students', async (req, res) => {
  try {
    const { name, birthDate, classId, status = 'Ativo' } = req.body;

    if (!name || !classId) {
      res.status(400).json({ error: 'Nome e turma são obrigatórios.' });
      return;
    }

    const result = await run(
      'INSERT INTO students (name, birth_date, class_id, status) VALUES (?, ?, ?, ?)',
      [name, birthDate || null, classId, status]
    );

    res.status(201).json({ id: result.lastID });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/students/:id', async (req, res) => {
  try {
    const { name, birthDate, classId, status } = req.body;

    const result = await run(
      'UPDATE students SET name = ?, birth_date = ?, class_id = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [name, birthDate || null, classId, status || 'Ativo', req.params.id]
    );

    if (result.changes === 0) {
      res.status(404).json({ error: 'Aluno não encontrado.' });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/attendance', async (req, res) => {
  try {
    const classId = req.query.classId;
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    const sql = `
      SELECT a.id, a.attendance_date AS attendanceDate, a.status, s.id AS studentId, s.name, c.name AS className
      FROM attendance a
      INNER JOIN students s ON s.id = a.student_id
      INNER JOIN classes c ON c.id = a.class_id
      WHERE a.attendance_date = ?
      ${classId ? 'AND a.class_id = ?' : ''}
      ORDER BY s.name ASC
    `;

    const rows = await all(sql, classId ? [date, classId] : [date]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/attendance', async (req, res) => {
  try {
    const { studentId, classId, attendanceDate, status } = req.body;

    if (!studentId || !classId || !attendanceDate || !status) {
      res.status(400).json({ error: 'studentId, classId, attendanceDate e status são obrigatórios.' });
      return;
    }

    const result = await run(
      `
        INSERT INTO attendance (student_id, class_id, attendance_date, status)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(student_id, attendance_date)
        DO UPDATE SET class_id = excluded.class_id, status = excluded.status
      `,
      [studentId, classId, attendanceDate, status]
    );

    res.status(201).json({ id: result.lastID, success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
});
