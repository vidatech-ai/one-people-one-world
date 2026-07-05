const API = "https://opow-backend.onrender.com";

window.api = {
  register: (username, password, display_name, role) =>
    fetch(API+"/auth/register",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password,display_name,role})}).then(r=>r.json()),
  login: (username, password) =>
    fetch(API+"/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})}).then(r=>r.json()),
  createPost: (username, content, community) =>
    fetch(API+"/posts/",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,content,community})}).then(r=>r.json()),
  getPosts: (filters={}) => { const p=new URLSearchParams(filters).toString(); return fetch(API+"/posts/"+(p?"?"+p:"")).then(r=>r.json()); },
  likePost: (post_id, username) =>
    fetch(API+`/posts/${post_id}/like`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username})}).then(r=>r.json()),
  deletePost: (post_id, username) =>
    fetch(API+`/posts/${post_id}`,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({username})}).then(r=>r.json()),
  getUser: (username) => fetch(API+`/users/${username}`).then(r=>r.json()),
  updateBio: (username, bio) =>
    fetch(API+`/users/${username}/bio`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,bio})}).then(r=>r.json()),
  followUser: (target, username) =>
    fetch(API+`/users/${target}/follow`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username})}).then(r=>r.json()),
  sendMessage: (from, to, content) =>
    fetch(API+"/messages/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({from,to,content})}).then(r=>r.json()),
  getConversation: (a, b) => fetch(API+`/messages/conversation?a=${a}&b=${b}`).then(r=>r.json()),
  getInbox: (username) => fetch(API+`/messages/inbox/${username}`).then(r=>r.json()),
  listCommunities: () => fetch(API+"/communities/").then(r=>r.json()),
  createCommunity: (username,name,description) =>
    fetch(API+"/communities/",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,name,description})}).then(r=>r.json()),
  joinCommunity: (community_id, username) =>
    fetch(API+`/communities/${community_id}/join`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username})}).then(r=>r.json()),
};

// ── State ──
let currentUser = null;
let currentChat = null;
let chatInterval = null;
let selectedRole = null;
let selectedType = null;
let selectedImageData = null;

// ── Helpers ──
const el  = id => document.getElementById(id);
const val = id => el(id).value.trim();
const err = (id, msg) => { const e = el(id); if(e) e.textContent = msg; };

function initials(name) {
  return (name||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
}

function timeAgo(ts) {
  const d = Math.floor(Date.now()/1000) - ts;
  if(d < 60)    return "just now";
  if(d < 3600)  return Math.floor(d/60)+"m ago";
  if(d < 86400) return Math.floor(d/3600)+"h ago";
  return Math.floor(d/86400)+"d ago";
}

function escHtml(s) {
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// Prevent right-click saving on images
document.addEventListener("contextmenu", e => {
  if(e.target.tagName === "IMG") e.preventDefault();
}, true);

// ── Landing ──
function scrollToAuth(tab) {
  switchTab(tab);
  el("auth-anchor").scrollIntoView({ behavior: "smooth" });
}

function switchTab(tab) {
  el("tab-login").style.display    = tab==="login"    ? "" : "none";
  el("tab-register").style.display = tab==="register" ? "" : "none";
  el("tab-login-btn").classList.toggle("active",    tab==="login");
  el("tab-register-btn").classList.toggle("active", tab==="register");
}

// ── Role picker ──
function pickRole(role) {
  selectedRole = role;
  el("role-rich").className = "role-btn" + (role==="rich" ? " pick-rich" : "");
  el("role-poor").className = "role-btn" + (role==="poor" ? " pick-poor" : "");
}

// ── Auth ──
async function doLogin() {
  err("login-err","");
  const username = val("login-user");
  const password = val("login-pass");
  if(!username||!password) return err("login-err","Please fill in both fields.");
  const res = await window.api.login(username, password);
  if(res.error) return err("login-err", res.error);
  startSession(res);
}

async function doRegister() {
  err("reg-err","");
  const display_name = val("reg-display");
  const username     = val("reg-user");
  const password     = val("reg-pass");
  if(!username||!password) return err("reg-err","Please fill in all fields.");
  if(!selectedRole) return err("reg-err","Please choose your role — giver or receiver.");
  const res = await window.api.register(username, password, display_name, selectedRole);
  if(res.error) return err("reg-err", res.error);
  const login = await window.api.login(username, password);
  if(login.error) return err("reg-err", login.error);
  startSession(login);
}

function startSession(user) {
  currentUser = user;
  el("landing").style.display = "none";
  el("app").style.display     = "flex";

  const role = user.role || "poor";
  const avClass = role === "rich" ? "av av-rich" : "av av-poor";
  el("nav-av").className   = avClass;
  el("nav-av").textContent = initials(user.display_name||user.username);

  el("nav-role-badge").className   = "role-badge " + (role==="rich" ? "rb-rich" : "rb-poor");
  el("nav-role-badge").textContent = role==="rich" ? "Giver" : "Receiver";

  el("compose-av").className   = avClass;
  el("compose-av").textContent = initials(user.display_name||user.username);

  el("compose-hint").textContent = role==="rich"
    ? "What can you offer the world today?"
    : "Share your situation — someone is ready to help.";

  el("status-user").textContent = "@"+user.username+" · "+(role==="rich"?"Giver":"Receiver");

  showPage("feed");
  checkApi();
  setInterval(checkApi, 15000);
}

// ── Navigation ──
function showPage(name) {
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
  el("page-"+name).classList.add("active");
  el("nav-"+name).classList.add("active");
  if(name==="feed")        loadFeed();
  if(name==="communities") loadCommunities();
  if(name==="messages")    loadInbox();
  if(name==="profile")     loadProfile();
  if(name!=="messages" && chatInterval) { clearInterval(chatInterval); chatInterval=null; }
}

// ── Compose ──
function selType(type) {
  selectedType = type;
  el("pt-offer").className = "pt-btn" + (type==="offer" ? " pt-offer" : "");
  el("pt-need").className  = "pt-btn" + (type==="need"  ? " pt-need"  : "");
  el("post-input").placeholder = type==="offer"
    ? "What skill, resource, or support can you offer? Be specific."
    : "Describe your situation honestly. What do you need? How bad is it?";
}

function updateCC() {
  const len = el("post-input").value.length;
  el("char-ct").textContent = len+" / 500";
  el("char-ct").style.color = len>450 ? "#b71c1c" : "var(--muted)";
}

// ── Image handling ──
function previewImg(input) {
  const file = input.files[0];
  if(!file) return;
  if(file.size > 5*1024*1024) { alert("Image must be under 5MB."); return; }
  const reader = new FileReader();
  reader.onload = e => {
    selectedImageData = e.target.result;
    const prev = el("img-preview-el");
    prev.src = selectedImageData;
    prev.style.display = "block";
    el("img-name").textContent = file.name;
  };
  reader.readAsDataURL(file);
}

async function submitPost() {
  const content = el("post-input").value.trim();
  if(!content) return;

  const prefix = selectedType==="offer" ? "🤝 OFFERING: "
               : selectedType==="need"  ? "🙏 NEEDS HELP: "
               : "";

  let fullContent = prefix + content;

  // Embed image as base64 marker if present
  if(selectedImageData) {
    fullContent += "\n[IMG]" + selectedImageData + "[/IMG]";
  }

  if(fullContent.length > 100000) {
    return alert("Post too large. Try a smaller image.");
  }

  const res = await window.api.createPost(currentUser.username, fullContent);
  if(res.error) return alert(res.error);

  el("post-input").value = "";
  updateCC();
  selectedType = null;
  selectedImageData = null;
  el("pt-offer").className = "pt-btn";
  el("pt-need").className  = "pt-btn";
  el("img-preview-el").style.display = "none";
  el("img-preview-el").src = "";
  el("img-name").textContent = "";
  el("img-file").value = "";

  loadFeed();
}

// ── Feed ──
async function loadFeed() {
  const posts = await window.api.getPosts();
  if(!Array.isArray(posts)) return;
  const list = el("feed-list");
  list.innerHTML = "";
  if(!posts.length) {
    list.innerHTML = '<div class="empty"><span class="ei">🌱</span>The world is waiting for the first story.<br>Be brave. Share yours.</div>';
    return;
  }
  posts.forEach(p => list.appendChild(buildCard(p)));
}

function parsePost(content) {
  let type = null;
  let text = content;
  let img  = null;

  if(content.startsWith("🤝 OFFERING: "))       { type="offer"; text=content.slice(13); }
  else if(content.startsWith("🙏 NEEDS HELP: ")) { type="need";  text=content.slice(16); }

  const imgMatch = text.match(/\[IMG\]([\s\S]*?)\[\/IMG\]/);
  if(imgMatch) {
    img  = imgMatch[1];
    text = text.replace(/\[IMG\][\s\S]*?\[\/IMG\]/, "").trim();
  }
  return { type, text, img };
}

function buildCard(p) {
  const isMe  = currentUser && p.username===currentUser.username;
  const liked = currentUser && p.likes.includes(currentUser.username);
  const { type, text, img } = parsePost(p.content);

  const div = document.createElement("div");
  div.className = "post-card";

  const badge = type==="offer"
    ? '<span class="ptype-badge pb-offer">🤝 Offering Help</span>'
    : type==="need"
    ? '<span class="ptype-badge pb-need">🙏 Needs Help</span>'
    : '';

  const imgHtml = img ? `
    <div class="post-img-wrap">
      <img src="${img}" alt="post image" draggable="false" oncontextmenu="return false"/>
      <div class="protect-overlay" oncontextmenu="return false"></div>
    </div>` : '';

  div.innerHTML = `
    ${badge}
    <div class="post-hdr">
      <div class="av ${p.role==='rich'?'av-rich':'av-poor'}">${initials(p.display_name||p.username)}</div>
      <div>
        <div class="post-name">${escHtml(p.display_name||p.username)}</div>
        <div class="post-time">@${escHtml(p.username)} · ${timeAgo(p.timestamp)}</div>
      </div>
    </div>
    ${imgHtml}
    <div class="post-body">${escHtml(text)}</div>
    <div class="post-actions">
      <button class="btn btn-sm btn-outline ${liked?"liked":""}" onclick="toggleLike('${p.id}',this)">❤️ ${p.likes.length}</button>
      <button class="btn btn-sm btn-green"  onclick="openChat('${escHtml(p.username)}')">💬 Reach out</button>
      ${isMe ? `<button class="btn btn-sm btn-danger" onclick="delPost('${p.id}')">Delete</button>` : ""}
    </div>`;

  // Disable drag on the image we just added
  div.querySelectorAll("img").forEach(i => {
    i.addEventListener("dragstart", e => e.preventDefault());
    i.addEventListener("contextmenu", e => e.preventDefault());
  });

  return div;
}

async function toggleLike(postId, btn) {
  if(!currentUser) return;
  const res = await window.api.likePost(postId, currentUser.username);
  if(res.error) return;
  btn.className = "btn btn-sm btn-outline" + (res.liked?" liked":"");
  btn.textContent = "❤️ "+res.count;
}

async function delPost(postId) {
  if(!confirm("Delete this post?")) return;
  await window.api.deletePost(postId, currentUser.username);
  loadFeed();
}

// ── Communities ──
async function loadCommunities() {
  const list = await window.api.listCommunities();
  const el_  = el("community-list");
  el_.innerHTML = "";
  if(!Array.isArray(list)||!list.length) {
    el_.innerHTML = '<div class="empty"><span class="ei">🏘️</span>No communities yet.<br>Start one — bring people together around a cause.</div>';
    return;
  }
  list.forEach(c => {
    const div    = document.createElement("div");
    const joined = c.members.includes(currentUser.username);
    div.className = "com-card";
    div.innerHTML = `
      <div>
        <div class="com-name">🏘 ${escHtml(c.name)}</div>
        <div class="com-desc">${escHtml(c.description||"No description.")}</div>
        <div class="com-meta">👥 ${c.members.length} member${c.members.length!==1?"s":""} · by @${escHtml(c.creator)}</div>
      </div>
      <button class="btn btn-sm ${joined?"btn-outline":"btn-green"}" onclick="joinCommunity('${c.id}',this)">
        ${joined?"Leave":"Join"}
      </button>`;
    el_.appendChild(div);
  });
}

async function createCommunity() {
  err("com-err","");
  const name = val("com-name"), desc = val("com-desc");
  if(!name) return err("com-err","Please give your community a name.");
  const res = await window.api.createCommunity(currentUser.username, name, desc);
  if(res.error) return err("com-err", res.error);
  el("com-name").value = "";
  el("com-desc").value = "";
  loadCommunities();
}

async function joinCommunity(id, btn) {
  const res = await window.api.joinCommunity(id, currentUser.username);
  btn.textContent = res.joined ? "Leave" : "Join";
  btn.className   = "btn btn-sm " + (res.joined ? "btn-outline" : "btn-green");
}

// ── Messages ──
async function loadInbox() {
  const contacts = await window.api.getInbox(currentUser.username);
  const list = el("contact-list");
  list.innerHTML = "";
  if(!Array.isArray(contacts)||!contacts.length) {
    list.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px">No conversations yet</div>';
    return;
  }
  contacts.forEach(c => {
    const div = document.createElement("div");
    div.className = "contact-item" + (c===currentChat?" active":"");
    div.textContent = "@"+c;
    div.onclick = () => openChat(c);
    list.appendChild(div);
  });
}

function openChat(username) {
  if(!currentUser||username===currentUser.username) return;
  currentChat = username;
  showPage("messages");
  el("chat-with").textContent = "Conversation with @"+username;
  el("msg-row").style.display = "flex";
  loadMessages();
  if(chatInterval) clearInterval(chatInterval);
  chatInterval = setInterval(loadMessages, 3000);
  document.querySelectorAll(".contact-item").forEach(i => {
    i.classList.toggle("active", i.textContent==="@"+username);
  });
}

async function loadMessages() {
  if(!currentChat) return;
  const msgs = await window.api.getConversation(currentUser.username, currentChat);
  const box  = el("chat-msgs");
  box.innerHTML = "";
  if(!Array.isArray(msgs)) return;
  msgs.forEach(m => {
    const div = document.createElement("div");
    div.className = "bubble " + (m.from===currentUser.username ? "sent" : "recv");
    div.textContent = m.content;
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
}

function startChat() {
  const t = val("new-chat-user");
  if(!t) return;
  el("new-chat-user").value = "";
  openChat(t);
}

async function sendMsg() {
  const content = el("msg-input").value.trim();
  if(!content||!currentChat) return;
  const res = await window.api.sendMessage(currentUser.username, currentChat, content);
  if(res.error) return alert(res.error);
  el("msg-input").value = "";
  loadMessages();
  loadInbox();
}

function msgEnter(e) {
  if(e.key==="Enter"&&!e.shiftKey) { e.preventDefault(); sendMsg(); }
}

// ── Profile ──
async function loadProfile() {
  const user  = await window.api.getUser(currentUser.username);
  const posts = await window.api.getPosts({ username: currentUser.username });

  const role = currentUser.role || "poor";
  el("prof-av").className   = "prof-av " + (role==="rich"?"av-rich":"av-poor");
  el("prof-av").textContent = initials(user.display_name||user.username);
  el("prof-name").textContent    = user.display_name||user.username;
  el("prof-handle").textContent  = "@"+user.username+" · "+(role==="rich"?"Giver":"Receiver");
  el("prof-posts").textContent   = Array.isArray(posts) ? posts.length : 0;
  el("prof-followers").textContent = user.followers;
  el("prof-following").textContent = user.following;
  if(!el("bio-input").value) el("bio-input").value = user.bio||"";

  const list = el("prof-posts-list");
  list.innerHTML = "";
  if(Array.isArray(posts)&&posts.length) {
    posts.forEach(p => list.appendChild(buildCard(p)));
  } else {
    list.innerHTML = '<div class="empty"><span class="ei">✍️</span>You haven\'t posted yet.<br>Your story could change someone\'s life today.</div>';
  }
}

async function saveBio() {
  const bio = el("bio-input").value.trim();
  const res = await window.api.updateBio(currentUser.username, bio);
  if(res.error) return;
  el("bio-msg").textContent = "Saved ✓";
  setTimeout(()=>el("bio-msg").textContent="", 2500);
}

// ── API status ──
async function checkApi() {
  try {
    const res = await fetch(API+"/users/");
    if(res.ok) { el("api-dot").style.background="#4caf50"; el("api-status").textContent="Connected"; }
    else throw 0;
  } catch {
    el("api-dot").style.background="#b71c1c";
    el("api-status").textContent="Backend offline";
  }
}

checkApi();