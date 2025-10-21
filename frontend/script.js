const API_URL = "http://localhost:3000"; // backend base URL
const tokenKey = "authToken";

// Helpers para token
const setToken = (token) => localStorage.setItem(tokenKey, token);
const getToken = () => localStorage.getItem(tokenKey) || true;
const clearToken = () => localStorage.removeItem(tokenKey);

// Cadastro
if (document.getElementById("registerForm")) {
  const token = getToken();
  if (token) {
   // window.location.href = "blog.html";
  }

  const form = document.getElementById("registerForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("registerName").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value.trim();

    if (!name || !email || !password) {
      alert("Preencha todos os campos!");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.message || "Erro ao cadastrar");
        return;
      }

      window.location.href = "index.html";
    } catch (err) {
      console.error(err);
      alert("Erro de conexão com o servidor.");
    }
  });
}

// Login
if (document.getElementById("loginForm")) {
  const token = getToken();
  if (token) {
  //  window.location.href = "blog.html";
  }

  const form = document.getElementById("loginForm");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value.trim();

    if (!email || !password) {
      alert("Preencha todos os campos!");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Credenciais inválidas");
        return;
      }

      // salvar token e redirecionar
      setToken(data.token);
      window.location.href = "blog.html";
    } catch (err) {
      console.error(err);
      alert("Erro de conexão com o servidor.");
    }
  });
}

// Blog
if (document.getElementById("postBtn")) {
  const token = getToken();
  if (!token) {
    window.location.href = "index.html";
  }

  const logoutBtn = document.getElementById("logoutBtn");
  const postBtn = document.getElementById("postBtn");
  const postList = document.getElementById("postList");
  const postContent = document.getElementById("postContent");

  logoutBtn.addEventListener("click", () => {
    clearToken();
    window.location.href = "index.html";
  });

  // Renderizar posts existentes
  async function renderPosts() {
    try {
      const res = await fetch(`${API_URL}/posts`);
      const posts = await res.json();

      postList.innerHTML = posts
        .map(
          (p) => `
        <a href="post.html?id=${p.id}" class="post">
          <p><strong>${p.author}</strong></p>
          <p>${p.content}</p>
          <small>${new Date(p.created_at).toLocaleString()}</small>
        </a>
      `
        )
        .join("");
    } catch (err) {
      console.error("Erro ao buscar posts:", err);
      postList.innerHTML = `<p>Erro ao carregar posts.</p>`;
    }
  }

  // Criar nova publicação
  postBtn.addEventListener("click", async () => {
    const content = postContent.value.trim();
    if (!content) return alert("Digite algo para postar!");

    try {
      const res = await fetch(`${API_URL}/posts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Erro ao criar post");
        return;
      }

      postContent.value = "";
      renderPosts();
    } catch (err) {
      console.error(err);
      alert("Erro de conexão com o servidor.");
    }
  });

  renderPosts();
}

// Editar usuário
if (document.getElementById("editForm")) {
  const token = getToken();
  if (!token) {
    window.location.href = "index.html";
  }

  async function loadUser() {
    const res = await fetch(API_URL + "/me", {
      headers: {
        Authorization: "Bearer " + token,
      },
    });
    const user = await res.json();
    if (!res.ok) {
      alert("Usuário não encontrado!");
      window.location.href = "index.html";
      return;
    }
    document.getElementById("editName").value = user.name;
    document.getElementById("editEmail").value = user.email;
  }

  document.getElementById("editForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("editName").value;
    const email = document.getElementById("editEmail").value;
    const password = document.getElementById("editPassword").value;

    const res = await fetch(`http://localhost:3000/users`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.message || data.error);
      return;
    }
    window.location.href = "blog.html";
  });

  document.getElementById("deleteBtn").addEventListener("click", async () => {
    if (!confirm("Tem certeza que deseja excluir este usuário?")) return;

    const res = await fetch(`http://localhost:3000/users`, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer " + token,
      },
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.message || data.error);
      return;
    }

    window.location.href = "index.html";
  });

  loadUser();
}

if (document.getElementById("post-page")) {
  const token = getToken();
  if (!token) {
    window.location.href = "index.html";
  }

  const author = document.getElementById("author");
  const content = document.getElementById("content");
  const date = document.getElementById("date");
  const commentsList = document.getElementById("comments-list");
  const commentBtn = document.getElementById("commentBtn");
  const commentContent = document.getElementById("commentContent");
  
  const params = new URLSearchParams(window.location.search);
  const postId = params.get("id");

  async function loadPost() {
    const res = await fetch(API_URL + "/posts/" + postId, {
      headers: {
        Authorization: "Bearer " + token,
      },
    });

    if (!res.ok) {
      alert("Erro");
      return;
    }

    const post = await res.json();
    author.textContent = post.author;
    content.textContent = post.content;
    date.textContent = new Date(post.created_at).toLocaleString();

    if (post.isOwner) {
      const postButtons = document.getElementsByClassName("post-buttons")[0];
      postButtons.style.display = "block";
      postButtons.querySelector("a").href = "edit-post.html?id=" + post.id;
    }
  }

  async function loadComments() {
    const res = await fetch(`${API_URL}/comments/${postId}`);
    if (!res.ok) {
      console.error("Erro ao carregar comentários");
      return;
    }

    const comments = await res.json();
    commentsList.innerHTML = comments.length
      ? comments
          .map(
            (c) => `
        <article class="comment">
          <p><strong>${c.author}</strong></p>
          <p>${c.content}</p>
          <small>${new Date(c.created_at).toLocaleString()}</small>
        </article>
      `
          )
          .join("")
      : "<p>Seja o primeiro a comentar!</p>";
  }

  commentBtn.addEventListener("click", async () => {
    const content = commentContent.value.trim();
    if (!content) return alert("Digite algo antes de enviar!");

    const res = await fetch(`${API_URL}/comments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
      body: JSON.stringify({ post_id: postId, content }),
    });

    if (!res.ok) {
      alert("Erro ao enviar comentário!");
      return;
    }

    commentContent.value = "";
    loadComments();
  });

  loadPost();
  loadComments();
}

if (document.getElementById("editPostForm")) {
  const token = getToken();
  if (!token) {
    window.location.href = "index.html";
  }

  const params = new URLSearchParams(window.location.search);
  const postId = params.get("id");

  async function loadPost() {
    const res = await fetch(API_URL + "/posts/" + postId, {
      headers: {
        Authorization: "Bearer " + token,
      },
    });
    const post = await res.json();
    if (!post.isOwner) {
      window.location.href = "blog.html";
    }
    if (!res.ok) {
      alert("Post não encontrado!");
      window.location.href = "blog.html";
      return;
    }
    document.getElementById("content").value = post.content;
  }

  document
    .getElementById("editPostForm")
    .addEventListener("submit", async (e) => {
      e.preventDefault();
      const content = document.getElementById("content").value;

      const res = await fetch(`http://localhost:3000/posts/${postId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.message || data.error);
        return;
      }
      window.location.href = "blog.html";
    });

  document.getElementById("deleteBtn").addEventListener("click", async () => {
    if (!confirm("Tem certeza que deseja excluir este post?")) return;

    const res = await fetch(`http://localhost:3000/posts/${postId}`, {
      method: "DELETE",
      headers: {
        Authorization: "Bearer " + token,
      },
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.message || data.error);
      return;
    }

    window.location.href = "blog.html";
  });

  loadPost();
}

const logoutBtn = document.getElementById("logoutBtn");
logoutBtn?.addEventListener("click", () => {
  clearToken();
  window.location.href = "index.html";
});
