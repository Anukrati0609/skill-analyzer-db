require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const app = express();
const PORT = 3000;

// Serve frontend from public folder
app.use(express.static(path.join(__dirname, 'public')));

// MySQL connection
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { rejectUnauthorized: true }
});

// Connect to DB
db.connect((err) => {
  if (err) {
    console.error('❌ Database connection error:', err);
    return;
  }
  console.log('✅ Connected to Railway DB');
});


// ✅ API: Get courses from a specific table (e.g., /courses/python)
app.get('/courses/:topic', (req, res) => {
  const topic = req.params.topic.toLowerCase();

  // ✅ Safelist of allowed tables
  const allowedTables = [
    'python',
    'machinelearning',
    'cybersecurity',
    'django',
    'dsa',
    'github',
    'java',
    'rust',
    'webdevelopment'
  ];

  if (!allowedTables.includes(topic)) {
    return res.status(400).send('Invalid topic');
  }

  const query = `SELECT * FROM ${topic}`;
  db.query(query, (err, results) => {
    if (err) return res.status(500).send('Query error');
    res.json(results);
  });
});


// ✅ Optional: List all tables in the database
app.get('/tables', (req, res) => {
  db.query("SHOW TABLES", (err, results) => {
    if (err) return res.status(500).send('Error listing tables');
    const tableNames = results.map(row => Object.values(row)[0]);
    res.json(tableNames);
  });
});


// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
