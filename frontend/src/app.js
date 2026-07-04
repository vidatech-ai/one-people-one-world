const API = "https://opow-backend.onrender.com";

window.api = {
  register: (username, password, display_name) =>
    fetch(API + "/auth/register", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({username, password, display_name}) }).then(r => r.json()),
  login: (username, password) =>
    fetch(API + "/auth/login", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({username, password}) }).then(r => r.json()),
  createPost: (username, content, community) =>
    fetch(API + "/posts/", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({username, content, community}) }).then(r => r.json()),
  getPosts: (filters = {}) => { const p = new URLSearchParams(filters).toString(); return fetch(API + "/posts/" + (p ? "?" + p : "")).then(r => r.json()); },
  likePost: (post_id, username) =>
    fetch(API + `/posts/${post_id}/like`, { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({username}) }).then(r => r.json()),
  deletePost: (post_id, username) =>
    fetch(API + `/posts/${post_id}`, { method: "DELETE", headers: {"Content-Type": "application/json"}, body: JSON.stringify({username}) }).then(r => r.json()),
  getUser: (username) => fetch(API + `/users/${username}`).then(r => r.json()),
  listUsers: () => fetch(API + "/users/").then(r => r.json()),
  updateBio: (username, bio) =>
    fetch(API + `/users/${username}/bio`, { method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({username, bio}) }).then(r => r.json()),
  followUser: (target, username) =>
    fetch(API + `/users/${target}/follow`, { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({username}) }).then(r => r.json()),
  sendMessage: (from, to, content) =>
    fetch(API + "/messages/send", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({from, to, content}) }).then(r => r.json()),
  getConversation: (a, b) => fetch(API + `/messages/conversation?a=${a}&b=${b}`).then(r => r.json()),
  getInbox: (username) => fetch(API + `/messages/inbox/${username}`).then(r => r.json()),
  listCommunities: () => fetch(API + "/communities/").then(r => r.json()),
  createCommunity: (username, name, description) =>
    fetch(API + "/communities/", { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({username, name, description}) }).then(r => r.json()),
  joinCommunity: (community_id, username) =>
    fetch(API + `/communities/${community_id}/join`, { method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({username}) }).then(r => r.json()),
};


// ── State ──────────────────────────────────────────────
let currentUser = null;   // { username, display_name, id, bio }
let currentChat = null;   // username of active chat partner
let chatInterval = null;

// ── Helpers ─────────────────────────────────────────────
function initials(name) {
  return (name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function timeAgo(ts) {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60)    return "just now";
  if (diff < 3600)  return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

function err(id, msg) { document.getElementById(id).textContent = msg; }
function val(id)      { return document.getElementById(id).value.trim(); }
function el(id)       { return document.getElementById(id); }

// ── Auth ────────────────────────────────────────────────
function switchTab(tab) {
  el("tab-login").style.display    = tab === "login"    ? "" : "none";
  el("tab-register").style.display = tab === "register" ? "" : "none";
  document.querySelectorAll(".auth-tab").forEach((t, i) => {
    t.classList.toggle("active", (i === 0) === (tab === "login"));
  });
}

async function doLogin() {
  err("login-err", "");
  const username = val("login-user");
  const password = val("login-pass");
  if (!username || !password) return err("login-err", "Fill in all fields.");

  const res = await window.api.login(username, password);
  if (res.error) return err("login-err", res.error);
  startSession(res);
}

async function doRegister() {
  err("reg-err", "");
  const display_name = val("reg-display");
  const username     = val("reg-user");
  const password     = val("reg-pass");
  if (!username || !password) return err("reg-err", "Fill in all fields.");

  const res = await window.api.register(username, password, display_name);
  if (res.error) return err("reg-err", res.error);

  // Auto-login after register
  const login = await window.api.login(username, password);
  if (login.error) return err("reg-err", login.error);
  startSession(login);
}

function startSession(user) {
  currentUser = user;
  el("auth-page").style.display = "none";
  el("app").style.display       = "flex";

  el("sidebar-name").textContent = user.display_name || user.username;
  el("sidebar-user").textContent = "@" + user.username;
  el("status-user").textContent  = "Logged in as " + user.username;

  showPage("feed");
  checkApi();
  setInterval(checkApi, 10000);
}

// ── Navigation ──────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  el("page-" + name).classList.add("active");
  el("nav-" + name).classList.add("active");

  if (name === "feed")        loadFeed();
  if (name === "communities") loadCommunities();
  if (name === "messages")    loadInbox();
  if (name === "profile")     loadProfile();

  // Stop chat polling when leaving messages
  if (name !== "messages" && chatInterval) {
    clearInterval(chatInterval);
    chatInterval = null;
  }
}

// ── Feed ────────────────────────────────────────────────
function updateCharCount() {
  const len = el("post-input").value.length;
  el("char-count").textContent = len + " / 500";
  el("char-count").style.color = len > 450 ? "#fa3e3e" : "#65676b";
}

async function submitPost() {
  const content = el("post-input").value.trim();
  if (!content) return;
  const res = await window.api.createPost(currentUser.username, content);
  if (res.error) return alert(res.error);
  el("post-input").value = "";
  updateCharCount();
  loadFeed();
}

async function loadFeed() {
  const posts = await window.api.getPosts();
  if (!Array.isArray(posts)) return;
  const list = el("feed-list");
  list.innerHTML = "";
  if (!posts.length) { list.innerHTML = '<div class="empty">No posts yet. Be the first! 🌍</div>'; return; }
  posts.forEach(p => list.appendChild(buildPostCard(p)));
}

function buildPostCard(p) {
  const isMe = currentUser && p.username === currentUser.username;
  const liked = currentUser && p.likes.includes(currentUser.username);
  const div = document.createElement("div");
  div.className = "card";
  div.innerHTML = `
    <div class="post-header">
      <div class="avatar">${initials(p.display_name || p.username)}</div>
      <div class="post-meta">
        <div class="name">${p.display_name || p.username}</div>
        <div class="time">@${p.username} · ${timeAgo(p.timestamp)}</div>
      </div>
    </div>
    <div class="post-body">${escapeHtml(p.content)}</div>
    <div class="post-actions">
      <button class="btn btn-sm btn-outline ${liked ? "liked" : ""}"
        onclick="toggleLike('${p.id}', this)">
        ❤️ ${p.likes.length}
      </button>
      <button class="btn btn-sm btn-outline"
        onclick="openChat('${p.username}')">💬 Message</button>
      ${isMe ? `<button class="btn btn-sm btn-danger" onclick="removePost('${p.id}', this)">🗑 Delete</button>` : ""}
    </div>`;
  return div;
}

async function toggleLike(postId, btn) {
  if (!currentUser) return;
  const res = await window.api.likePost(postId, currentUser.username);
  if (res.error) return;
  btn.className = "btn btn-sm btn-outline" + (res.liked ? " liked" : "");
  btn.textContent = "❤️ " + res.count;
}

async function removePost(postId, btn) {
  if (!confirm("Delete this post?")) return;
  await window.api.deletePost(postId, currentUser.username);
  loadFeed();
  loadProfile();
}

// ── Communities ─────────────────────────────────────────
async function loadCommunities() {
  const list = await window.api.listCommunities();
  const el_  = el("community-list");
  el_.innerHTML = "";
  if (!list.length) { el_.innerHTML = '<div class="empty">No communities yet. Create the first one!</div>'; return; }
  list.forEach(c => {
    const div = document.createElement("div");
    const joined = c.members.includes(currentUser.username);
    div.className = "community-card";
    div.innerHTML = `
      <div class="community-name">🏘 ${escapeHtml(c.name)}</div>
      <div class="community-desc">${escapeHtml(c.description || "No description")}</div>
      <div class="community-meta">👥 ${c.members.length} members · Created by @${c.creator}</div>
      <div style="margin-top:10px">
        <button class="btn btn-sm ${joined ? "btn-outline" : "btn-primary"}"
          onclick="joinCommunity('${c.id}', this)">
          ${joined ? "Leave" : "Join"}
        </button>
      </div>`;
    el_.appendChild(div);
  });
}

async function createCommunity() {
  err("com-err", "");
  const name = val("com-name");
  const desc = val("com-desc");
  if (!name) return err("com-err", "Name required.");
  const res = await window.api.createCommunity(currentUser.username, name, desc);
  if (res.error) return err("com-err", res.error);
  el("com-name").value = "";
  el("com-desc").value = "";
  loadCommunities();
}

async function joinCommunity(id, btn) {
  const res = await window.api.joinCommunity(id, currentUser.username);
  btn.textContent = res.joined ? "Leave" : "Join";
  btn.className   = "btn btn-sm " + (res.joined ? "btn-outline" : "btn-primary");
}

// ── Messages ─────────────────────────────────────────────
async function loadInbox() {
  const contacts = await window.api.getInbox(currentUser.username);
  renderContacts(contacts);
}

function renderContacts(contacts) {
  const list = el("contact-list-items");
  list.innerHTML = "";
  if (!contacts.length) { list.innerHTML = '<div style="font-size:13px;color:#65676b;padding:8px">No messages yet</div>'; }
  contacts.forEach(c => {
    const div = document.createElement("div");
    div.className = "contact-item" + (c === currentChat ? " active" : "");
    div.textContent = "@" + c;
    div.onclick = () => openChat(c);
    list.appendChild(div);
  });
}

function openChat(username) {
  if (username === currentUser.username) return;
  currentChat = username;
  showPage("messages");
  el("chat-with").textContent  = "Chat with @" + username;
  el("msg-input-row").style.display = "flex";
  loadMessages();
  if (chatInterval) clearInterval(chatInterval);
  chatInterval = setInterval(loadMessages, 3000);
  // Highlight active contact
  document.querySelectorAll(".contact-item").forEach(i => {
    i.classList.toggle("active", i.textContent === "@" + username);
  });
}

async function loadMessages() {
  if (!currentChat) return;
  const msgs = await window.api.getConversation(currentUser.username, currentChat);
  const box  = el("chat-messages");
  box.innerHTML = "";
  msgs.forEach(m => {
    const div = document.createElement("div");
    div.className = "msg-bubble " + (m.from === currentUser.username ? "sent" : "recv");
    div.textContent = m.content;
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
}

function startChat() {
  const target = val("new-chat-user");
  if (!target) return;
  el("new-chat-user").value = "";
  openChat(target);
}

async function sendMsg() {
  const content = el("msg-input").value.trim();
  if (!content || !currentChat) return;
  const res = await window.api.sendMessage(currentUser.username, currentChat, content);
  if (res.error) return alert(res.error);
  el("msg-input").value = "";
  loadMessages();
  loadInbox();
}

function msgEnter(e) {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
}

// ── Profile ──────────────────────────────────────────────
async function loadProfile() {
  const user  = await window.api.getUser(currentUser.username);
  const posts = await window.api.getPosts({ username: currentUser.username });

  el("profile-avatar").textContent   = initials(user.display_name || user.username);
  el("profile-display").textContent  = user.display_name || user.username;
  el("profile-username").textContent = "@" + user.username;
  el("profile-posts").textContent    = Array.isArray(posts) ? posts.length : 0;
  el("profile-followers").textContent = user.followers;
  el("profile-following").textContent = user.following;

  if (!el("bio-input").value) el("bio-input").value = user.bio || "";

  const list = el("profile-posts-list");
  list.innerHTML = "";
  if (Array.isArray(posts) && posts.length) {
    posts.forEach(p => list.appendChild(buildPostCard(p)));
  } else {
    list.innerHTML = '<div class="empty">You haven\'t posted yet.</div>';
  }
}

async function saveBio() {
  const bio = el("bio-input").value.trim();
  const res = await window.api.updateBio(currentUser.username, bio);
  if (res.error) return;
  el("bio-msg").textContent = "Bio saved ✓";
  setTimeout(() => el("bio-msg").textContent = "", 2000);
}

// ── API status ───────────────────────────────────────────
async function checkApi() {
  try {
    const res = await fetch("https://opow-backend.onrender.com/users/");
    if (res.ok) {
      el("api-dot").className   = "dot green";
      el("api-status").textContent = "Backend connected";
    } else { throw new Error(); }
  } catch {
    el("api-dot").className   = "dot red";
    el("api-status").textContent = "Backend offline — run: python run.py";
  }
}

// ── Security ─────────────────────────────────────────────
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Init ─────────────────────────────────────────────────
checkApi();
