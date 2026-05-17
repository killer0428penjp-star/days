// QuizHub サーバー
// 起動: node server.js
// 必要: npm install express cors

const express = require('express');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;
const DB   = path.join(__dirname, 'quizzes.json');

// ── ミドルウェア ──
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname)); // index.html を同じフォルダに置けばそのまま配信

// ── データ読み書きヘルパー ──
function readDB() {
  if (!fs.existsSync(DB)) return [];
  try { return JSON.parse(fs.readFileSync(DB, 'utf8')); }
  catch { return []; }
}
function writeDB(data) {
  fs.writeFileSync(DB, JSON.stringify(data, null, 2), 'utf8');
}

// ── API ──

// 全クイズ取得
app.get('/api/quizzes', (req, res) => {
  res.json(readDB());
});

// クイズ追加
app.post('/api/quizzes', (req, res) => {
  const { title, cat, qCount, timeLimit, author, authorColor, userId } = req.body;
  if (!title || !cat || qCount == null || timeLimit == null) {
    return res.status(400).json({ error: '必須項目が不足しています' });
  }
  const list = readDB();
  const quiz = {
    id: 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    title, cat, qCount, timeLimit,
    author: author || 'ゲスト',
    authorColor: authorColor || '#667eea',
    userId: userId || 'anonymous',
    createdAt: Date.now()
  };
  list.push(quiz);
  writeDB(list);
  res.status(201).json(quiz);
});

// クイズ削除（自分の作品のみ）
app.delete('/api/quizzes/:id', (req, res) => {
  const { userId } = req.body;
  let list = readDB();
  const target = list.find(q => q.id === req.params.id);
  if (!target) return res.status(404).json({ error: '見つかりません' });
  if (target.userId !== userId) return res.status(403).json({ error: '権限がありません' });
  list = list.filter(q => q.id !== req.params.id);
  writeDB(list);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`✅ QuizHub サーバー起動: http://localhost:${PORT}`);
});
