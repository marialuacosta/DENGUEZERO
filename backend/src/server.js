// app.js
const express = require('express');
const dotenv = require('dotenv');
dotenv.config();
const cors = require('cors');
const pool = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const auth = require('./authMiddleware');
const getUserIdMiddleware = require('./getUserId');

const jwtSecret = process.env.JWT_SECRET || 'dev_secret';
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Register
app.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ message: 'Campos obrigatórios ausentes' });

    if (password.length < 6) {
      return res.status(400).json({message: "Senha deve conter ao menos 6 caracteres"});
    }

    // check existing
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (rows.length > 0) return res.status(409).json({ message: 'Email já cadastrado' });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const [result] = await pool.query('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, email, hash]);
    const userId = result.insertId;

    // create token
    const token = jwt.sign({ id: userId, email, name }, jwtSecret, { expiresIn: jwtExpiresIn });
    res.status(201).json({ id: userId, name, email, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Login
app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Campos obrigatórios ausentes' });

    const [rows] = await pool.query('SELECT id, name, email, password, role FROM users WHERE email = ?', [email]);
    if (rows.length === 0) return res.status(401).json({ message: 'Credenciais inválidas' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Credenciais inválidas' });

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, jwtSecret, { expiresIn: jwtExpiresIn });
    res.json({ id: user.id, name: user.name, email: user.email, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro no servidor' });
  }
});

// Pegar o usuário
app.get('/me', auth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

// 🔹 Editar usuário
app.put('/users', auth, async (req, res) => {
  const { id } = req.user;
  const { name, email, password } = req.body;

  try {
    let query = 'UPDATE users SET name = ?, email = ?';
    const params = [name, email];

    if (password) {
      const hash = await bcrypt.hash(password, 10);
      query += ', password = ?';
      params.push(hash);
    }

    query += ' WHERE id = ?';
    params.push(id);

    await pool.query(query, params);
    res.json({ message: 'Usuário atualizado!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar usuário' });
  }
});

// 🔹 Excluir usuário
app.delete('/users', auth, async (req, res) => {
  const { id } = req.user;
  try {
    await pool.query('DELETE FROM users WHERE id = ?', [id]);
    res.json({ message: 'Usuário excluído!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir usuário' });
  }
});

// GET /api/posts -> lista posts (mais recentes primeiro)
app.get('/posts', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT p.id, p.content, p.created_at, u.id as user_id, u.name as author
      FROM posts p
      JOIN users u ON u.id = p.user_id
      ORDER BY p.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao buscar posts' });
  }
});

// Pegar um post
app.get('/posts/:id', getUserIdMiddleware ,async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const [rows] = await pool.query(`
      SELECT p.id, p.content, p.created_at, u.name AS author, p.user_id
      FROM posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `, [id]);

    if (!rows.length) return res.status(404).json({ error: 'Post não encontrado' });

    const post = rows[0];

    const isOwner = user ? post.user_id === user.id || user.role === "ADMIN" : false;

    res.json({ ...post, isOwner, user_id: undefined });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar post' });
  }
});

// POST /posts -> cria post (autenticado)
app.post('/posts', auth, async (req, res) => {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) return res.status(400).json({ message: 'Conteúdo vazio' });

    const userId = req.user.id;
    const [result] = await pool.query('INSERT INTO posts (user_id, content) VALUES (?, ?)', [userId, content]);
    const insertId = result.insertId;

    // buscar post criado com dados do autor
    const [rows] = await pool.query(
      `SELECT p.id, p.content, p.created_at, u.id as user_id, u.name as author
       FROM posts p JOIN users u ON u.id = p.user_id
       WHERE p.id = ?`, [insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erro ao criar post' });
  }
});

// Editar Post
app.put('/posts/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;

  if (!content) return res.status(400).json({ error: 'Conteúdo é obrigatório' });

  try {
    // Verifica se o post pertence ao usuário logado
    const [posts] = await pool.query('SELECT * FROM posts WHERE id = ?', [id]);
    const post = posts[0];
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });
    if (post.user_id !== req.user.id) return res.status(403).json({ error: 'Sem permissão para editar este post' });

    await pool.query('UPDATE posts SET content = ? WHERE id = ?', [content, id]);
    res.json({ message: 'Post atualizado com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao atualizar post' });
  }
});

// Excluir post
app.delete('/posts/:id', auth, async (req, res) => {
  const { id } = req.params;

  try {
    const [posts] = await pool.query('SELECT * FROM posts WHERE id = ?', [id]);
    const post = posts[0];
    if (!post) return res.status(404).json({ error: 'Post não encontrado' });
    if (post.user_id !== req.user.id && req.user.role !== "ADMIN") return res.status(403).json({ error: 'Sem permissão para excluir este post' });

    await pool.query('DELETE FROM posts WHERE id = ?', [id]);
    res.json({ message: 'Post excluído com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir post' });
  }
});

// Criar comentário
app.post('/comments', auth, async (req, res) => {
  const { post_id, content } = req.body;
  if (!post_id || !content) return res.status(400).json({ error: 'Conteúdo é obrigatório' });

  try {
    // Verifica se o post existe
    const [posts] = await pool.query('SELECT * FROM posts WHERE id = ?', [post_id]);
    if (!posts.length) return res.status(404).json({ error: 'Post não encontrado' });

    await pool.query(
      'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
      [post_id, req.user.id, content]
    );

    res.json({ message: 'Comentário criado com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao criar comentário' });
  }
});

// Obter todos os comentários de um post
app.get('/comments/:postId', async (req, res) => {
  const { postId } = req.params;

  try {
    const [comments] = await pool.query(`
      SELECT c.id, c.content, c.created_at, u.name AS author
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `, [postId]);

    res.json(comments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao buscar comentários' });
  }
});

// Editar comentário
app.put('/comments/:id', auth, async (req, res) => {
  const { id } = req.params;
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Conteúdo é obrigatório' });  

  try {
    const [comments] = await pool.query('SELECT * FROM comments WHERE id = ?', [id]);
    const comment = comments[0];
    if (!comment) return res.status(404).json({ error: 'Comentário não encontrado' });
    if (comment.user_id !== req.user.id) return res.status(403).json({ error: 'Sem permissão para editar este comentário' });

    await pool.query('UPDATE comments SET content = ? WHERE id = ?', [content, id]);
    res.json({ message: 'Comentário atualizado com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao editar comentário' });
  }
});

// Excluir comentário
app.delete('/comments/:id', auth, async (req, res) => {
  const { id } = req.params;

  try {
    const [comments] = await pool.query('SELECT * FROM comments WHERE id = ?', [id]);
    const comment = comments[0];
    if (!comment) return res.status(404).json({ error: 'Comentário não encontrado' });
    if (comment.user_id !== req.user.id) return res.status(403).json({ error: 'Sem permissão para excluir este comentário' });

    await pool.query('DELETE FROM comments WHERE id = ?', [id]);
    res.json({ message: 'Comentário excluído com sucesso!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro ao excluir comentário' });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error', err);
  res.status(500).json({ message: 'Erro interno' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
