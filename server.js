
const express = require("express");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = 3000;

// Create local database
const db = new Database("jarvis.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Get all notes
app.get("/api/notes", (req, res) => {
  res.json(db.prepare("SELECT * FROM notes ORDER BY id DESC").all());
});

// Save a note
app.post("/api/notes", (req, res) => {
  const text = String(req.body.text || "").trim();

  if (!text) {
    return res.status(400).json({ error: "Note cannot be empty" });
  }

  const result = db.prepare("INSERT INTO notes (text) VALUES (?)").run(text);
  res.status(201).json(
    db.prepare("SELECT * FROM notes WHERE id = ?").get(result.lastInsertRowid)
  );
});

// Delete a note
app.delete("/api/notes/:id", (req, res) => {
  const result = db.prepare("DELETE FROM notes WHERE id = ?").run(req.params.id);

  if (!result.changes) {
    return res.status(404).json({ error: "Note not found" });
  }

  res.json({ success: true });
});

// Save command history
app.post("/api/commands", (req, res) => {
  const command = String(req.body.command || "").trim();

  if (!command) {
    return res.status(400).json({ error: "Command cannot be empty" });
  }

  db.prepare("INSERT INTO commands (command) VALUES (?)").run(command);
  res.status(201).json({ success: true });
});

// Get recent command history
app.get("/api/commands", (req, res) => {
  res.json(
    db.prepare("SELECT * FROM commands ORDER BY id DESC LIMIT 20").all()
  );
});

app.listen(PORT, () => {
  console.log(`JARVIS is running at http://localhost:${PORT}`);
});
