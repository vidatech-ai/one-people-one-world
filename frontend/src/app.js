const API = "https://opow-backend.onrender.com";

// ── API wrapper ──────────────────────────────────────────
const http = {
  post: (url, body) => fetch(API+url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).then(r=>r.json()),
  get:  (url) => fetch(API+url).then(r=>r.json()),
  put:  (url, body) => fetch(API+url,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).then(r=>r.json()),
  del:  (url, body) => fetch(API+url,{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).then(r=>r.json()),
};

window.api = {
  register:        (u,p,d,r)   => http.post("/auth/register",{username:u,password:p,display_name:d,role:r}),
  login:           (u,p)       => http.post("/auth/login",{username:u,password:p}),
  createPost:      (u,c,m,mt)  => http.post("/posts/",{username:u,content:c,media:m,media_type:mt}),
  getPosts:        (page=1,filters={}) => http.get("/posts/?page="+page+"&per_page=10"+(filters.username?"&username="+filters.username:"")),
  getPostMedia:    (id)        => http.get("/posts/"+id+"/media"),
  likePost:        (id,u)      => http.post("/posts/"+id+"/like",{username:u}),
  deletePost:      (id,u)      => http.del("/posts/"+id,{username:u}),
  getUser:         (u)         => http.get("/users/"+u),
  updateBio:       (u,b)       => http.put("/users/"+u+"/bio",{username:u,bio:b}),
  sendMessage:     (f,t,c)     => http.post("/messages/send",{from:f,to:t,content:c}),
  getConversation: (a,b)       => http.get("/messages/conversation?a="+a+"&b="+b),
  getInbox:        (u)         => http.get("/messages/inbox/"+u),
  listCommunities: ()          => http.get("/communities/"),
  createCommunity: (u,n,d)     => http.post("/communities/",{username:u,name:n,description:d}),
  joinCommunity:   (id,u)      => http.post("/communities/"+id+"/join",{username:u}),
};

// ── State ──────────────────────────────────────────────
let currentUser  = null;
let currentChat  = null;
let chatInterval = null;
let selectedRole = null;
let selectedType = null;
let mediaData    = null;   // base64 string
let mediaType    = null;   // "image" | "video"

// Infinite scroll state
let feedPage     = 1;
let feedLoading  = false;
let feedHasMore  = true;

// ── Helpers ──────────────────────────────────────────────
const el  = id => document.getElementById(id);
const val = id => (el(id)||{value:""}).value.trim();
const err = (id,msg) => { const e=el(id); if(e) e.textContent=msg; };
const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
const ini = n => (n||"?").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

function timeAgo(ts) {
  const d = Math.floor(Date.now()/1000)-ts;
  if(d<60)    return "just now";
  if(d<3600)  return Math.floor(d/60)+"m ago";
  if(d<86400) return Math.floor(d/3600)+"h ago";
  return Math.floor(d/86400)+"d ago";
}

// Block right-click on images/videos
document.addEventListener("contextmenu", e=>{
  if(e.target.tagName==="IMG"||e.target.tagName==="VIDEO") e.preventDefault();
}, true);

// Block keyboard shortcuts for saving
document.addEventListener("keydown", e=>{
  if((e.ctrlKey||e.metaKey) && ["s","u"].includes(e.key.toLowerCase())) e.preventDefault();
});

// ── Landing ──────────────────────────────────────────────
function scrollToAuth(tab) {
  switchTab(tab);
  el("auth-anchor").scrollIntoView({behavior:"smooth"});
}

function switchTab(tab) {
  el("tab-login").style.display    = tab==="login"    ? "" : "none";
  el("tab-register").style.display = tab==="register" ? "" : "none";
  el("tab-login-btn").classList.toggle("active",    tab==="login");
  el("tab-register-btn").classList.toggle("active", tab==="register");
}

function pickRole(role) {
  selectedRole = role;
  el("role-rich").className = "role-btn"+(role==="rich"?" pick-rich":"");
  el("role-poor").className = "role-btn"+(role==="poor"?" pick-poor":"");
}

// ── Auth ──────────────────────────────────────────────
async function doLogin() {
  err("login-err","");
  const u=val("login-user"), p=val("login-pass");
  if(!u||!p) return err("login-err","Fill in both fields.");
  const res = await window.api.login(u,p);
  if(res.error) return err("login-err",res.error);
  startSession(res);
}

async function doRegister() {
  err("reg-err","");
  const d=val("reg-display"), u=val("reg-user"), p=val("reg-pass");
  if(!u||!p) return err("reg-err","Fill in all fields.");
  if(!selectedRole) return err("reg-err","Please choose your role.");
  const res = await window.api.register(u,p,d,selectedRole);
  if(res.error) return err("reg-err",res.error);
  const login = await window.api.login(u,p);
  if(login.error) return err("reg-err",login.error);
  startSession(login);
}

function startSession(user) {
  currentUser = user;
  el("landing").style.display = "none";
  el("app").style.display     = "flex";

  const r = user.role||"poor";
  const avCls = r==="rich"?"av av-rich":"av av-poor";
  [el("nav-av"),el("cav")].forEach(e=>{ if(e){e.className=avCls;e.textContent=ini(user.display_name||user.username);} });
  el("nav-rb").className   = "rbadge "+(r==="rich"?"rb-rich":"rb-poor");
  el("nav-rb").textContent = r==="rich"?"Giver":"Receiver";
  el("clbl").textContent   = r==="rich"?"What can you offer the world today?":"Share your situation — someone is ready to help.";
  el("status-user").textContent = "@"+user.username+" · "+(r==="rich"?"Giver":"Receiver");

  setupInfiniteScroll();
  showPage("feed");
  checkApi();
  setInterval(checkApi, 15000);
}

// ── Navigation ──────────────────────────────────────────
function showPage(name) {
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
  el("page-"+name).classList.add("active");
  el("nav-"+name).classList.add("active");
  if(name==="feed")        resetAndLoadFeed();
  if(name==="communities") loadCommunities();
  if(name==="messages")    loadInbox();
  if(name==="profile")     loadProfile();
  if(name!=="messages"&&chatInterval){ clearInterval(chatInterval); chatInterval=null; }
}

// ── Infinite Scroll ─────────────────────────────────────
function setupInfiniteScroll() {
  const scroll = el("main-scroll");
  scroll.addEventListener("scroll", ()=>{
    const active = document.querySelector(".page.active");
    if(!active||active.id!=="page-feed") return;
    const bottom = scroll.scrollTop + scroll.clientHeight >= scroll.scrollHeight - 200;
    if(bottom && !feedLoading && feedHasMore) loadMorePosts();
  });
}

function resetAndLoadFeed() {
  feedPage    = 1;
  feedHasMore = true;
  feedLoading = false;
  el("feed-list").innerHTML = "";
  el("no-more").style.display = "none";
  loadMorePosts();
}

async function loadMorePosts() {
  if(feedLoading || !feedHasMore) return;
  feedLoading = true;
  el("load-more-wrap").style.display = "block";

  const data = await window.api.getPosts(feedPage);
  el("load-more-wrap").style.display = "none";

  if(!data || !Array.isArray(data.posts)) { feedLoading=false; return; }

  const list = el("feed-list");

  if(feedPage===1 && data.posts.length===0) {
    list.innerHTML = '<div class="empty"><span class="ei">🌱</span>The world is waiting for the first story.<br>Be brave. Share yours.</div>';
    feedLoading = false;
    return;
  }

  data.posts.forEach(p => list.appendChild(buildCard(p)));

  feedHasMore = data.has_more;
  if(!feedHasMore) el("no-more").style.display = "block";
  feedPage++;
  feedLoading = false;
}

// ── Media handling ─────────────────────────────────────
function handleMedia(input) {
  const file = input.files[0];
  if(!file) return;

  const isVideo = file.type.startsWith("video/");
  const isImage = file.type.startsWith("image/");
  if(!isVideo && !isImage) return alert("Please choose an image or video file.");

  el("media-name").textContent = file.name + " (" + (file.size/1024/1024).toFixed(1) + " MB)";

  // Show progress
  el("prog-bar").style.display = "block";
  el("prog-fill").style.width  = "0%";

  const reader = new FileReader();
  reader.onprogress = e => {
    if(e.loaded && e.total) {
      el("prog-fill").style.width = Math.round(e.loaded/e.total*100)+"%";
    }
  };
  reader.onload = e => {
    el("prog-fill").style.width = "100%";
    setTimeout(()=>el("prog-bar").style.display="none", 500);

    mediaData = e.target.result;
    mediaType = isVideo ? "video" : "image";

    if(isImage) {
      el("img-prev").src = mediaData;
      el("img-prev").style.display = "block";
      el("vid-prev").style.display = "none";
    } else {
      el("vid-prev").src = mediaData;
      el("vid-prev").style.display = "block";
      el("img-prev").style.display = "none";
    }
  };
  reader.readAsDataURL(file);
}

// ── Compose ────────────────────────────────────────────
function selType(type) {
  selectedType = type;
  el("pt-offer").className = "ptbtn"+(type==="offer"?" pt-offer":"");
  el("pt-need").className  = "ptbtn"+(type==="need" ?" pt-need" :"");
  el("post-input").placeholder = type==="offer"
    ? "What skill, resource or support can you offer? Be specific."
    : "Describe your situation honestly. What do you need? How urgent is it?";
}

function updateCC() {
  const l = el("post-input").value.length;
  el("char-ct").textContent = l+" / 500";
  el("char-ct").style.color = l>450?"#b71c1c":"var(--muted)";
}

async function submitPost() {
  const content = el("post-input").value.trim();
  if(!content && !mediaData) return alert("Write something or add a photo/video.");

  const prefix = selectedType==="offer"?"🤝 OFFERING: ":selectedType==="need"?"🙏 NEEDS HELP: ":"";
  const fullContent = prefix + content;

  const btn = event.target;
  btn.disabled = true;
  btn.textContent = "Posting…";

  const res = await window.api.createPost(currentUser.username, fullContent, mediaData, mediaType);

  btn.disabled = false;
  btn.textContent = "Share with the world";

  if(res.error) return alert(res.error);

  // Reset
  el("post-input").value = "";
  updateCC();
  selectedType = null;
  mediaData = null;
  mediaType = null;
  el("pt-offer").className = "ptbtn";
  el("pt-need").className  = "ptbtn";
  el("img-prev").style.display = "none";
  el("vid-prev").style.display = "none";
  el("media-name").textContent = "";
  el("media-file").value = "";

  resetAndLoadFeed();
}

// ── Post cards ─────────────────────────────────────────
function buildCard(p) {
  const isMe  = currentUser && p.username===currentUser.username;
  const liked = currentUser && p.likes.includes(currentUser.username);

  let type="", text=p.content;
  if(text.startsWith("🤝 OFFERING: "))       { type="offer"; text=text.slice(13); }
  else if(text.startsWith("🙏 NEEDS HELP: ")) { type="need";  text=text.slice(16); }

  const badge = type==="offer"
    ? '<span class="pbadge pb-offer">🤝 Offering Help</span>'
    : type==="need"
    ? '<span class="pbadge pb-need">🙏 Needs Help</span>'
    : '';

  const div = document.createElement("div");
  div.className = "post-card";
  div.dataset.postId = p.id;

  div.innerHTML = `
    ${badge}
    <div class="phdr">
      <div class="av ${p.role==='rich'?'av-rich':'av-poor'}">${ini(p.display_name||p.username)}</div>
      <div>
        <div class="pname">${esc(p.display_name||p.username)}</div>
        <div class="ptime">@${esc(p.username)} · ${timeAgo(p.timestamp)}</div>
      </div>
    </div>
    <div class="pbody">${esc(text)}</div>
    <div class="media-placeholder" id="media-${p.id}"></div>
    <div class="pactions">
      <button class="btn btn-sm btn-outline ${liked?"liked":""}" onclick="toggleLike('${p.id}',this)">❤️ ${p.likes.length}</button>
      <button class="btn btn-sm btn-green"  onclick="openChat('${esc(p.username)}')">💬 Reach out</button>
      ${isMe?`<button class="btn btn-sm btn-danger" onclick="delPost('${p.id}')">Delete</button>`:""}
    </div>`;

  // Lazy-load media
  if(p.has_media !== false) {
    loadPostMedia(p.id);
  }

  // Block drag/save
  div.addEventListener("dragstart", e=>e.preventDefault());
  return div;
}

async function loadPostMedia(postId) {
  const placeholder = el("media-"+postId);
  if(!placeholder) return;

  try {
    const data = await window.api.getPostMedia(postId);
    if(!data.media) return;

    const wrap = document.createElement("div");
    wrap.className = "media-wrap";

    if(data.media_type==="video") {
      const vid = document.createElement("video");
      vid.src = data.media;
      vid.controls = true;
      vid.playsInline = true;
      vid.preload = "metadata";
      vid.style.pointerEvents = "auto";
      // Block right-click
      vid.addEventListener("contextmenu", e=>e.preventDefault());
      wrap.appendChild(vid);
    } else {
      const img = document.createElement("img");
      img.src = data.media;
      img.alt = "Post image";
      img.draggable = false;
      img.addEventListener("contextmenu", e=>e.preventDefault());
      img.addEventListener("dragstart",   e=>e.preventDefault());
      // Invisible guard
      const guard = document.createElement("div");
      guard.className = "media-guard";
      guard.addEventListener("contextmenu", e=>e.preventDefault());
      wrap.appendChild(img);
      wrap.appendChild(guard);
    }

    placeholder.replaceWith(wrap);
  } catch(e) {
    // No media or error — just remove placeholder
    if(placeholder) placeholder.remove();
  }
}

async function toggleLike(postId, btn) {
  if(!currentUser) return;
  const res = await window.api.likePost(postId, currentUser.username);
  if(res.error) return;
  btn.className = "btn btn-sm btn-outline"+(res.liked?" liked":"");
  btn.textContent = "❤️ "+res.count;
}

async function delPost(postId) {
  if(!confirm("Delete this post?")) return;
  await window.api.deletePost(postId, currentUser.username);
  const card = document.querySelector(`[data-post-id="${postId}"]`);
  if(card) card.remove();
}

// ── Communities ─────────────────────────────────────────
async function loadCommunities() {
  const list = await window.api.listCommunities();
  const el_  = el("community-list");
  el_.innerHTML = "";
  if(!Array.isArray(list)||!list.length) {
    el_.innerHTML='<div class="empty"><span class="ei">🏘️</span>No communities yet.<br>Start one around a cause you care about.</div>';
    return;
  }
  list.forEach(c=>{
    const div    = document.createElement("div");
    const joined = c.members.includes(currentUser.username);
    div.className = "com-card";
    div.innerHTML = `
      <div>
        <div class="cname">🏘 ${esc(c.name)}</div>
        <div class="cdesc">${esc(c.description||"No description.")}</div>
        <div class="cmeta">👥 ${c.members.length} member${c.members.length!==1?"s":""} · by @${esc(c.creator)}</div>
      </div>
      <button class="btn btn-sm ${joined?"btn-outline":"btn-green"}" onclick="joinCommunity('${c.id}',this)">
        ${joined?"Leave":"Join"}
      </button>`;
    el_.appendChild(div);
  });
}

async function createCommunity() {
  err("com-err","");
  const name=val("com-name"), desc=val("com-desc");
  if(!name) return err("com-err","Give your community a name.");
  const res = await window.api.createCommunity(currentUser.username,name,desc);
  if(res.error) return err("com-err",res.error);
  el("com-name").value=el("com-desc").value="";
  loadCommunities();
}

async function joinCommunity(id,btn) {
  const res = await window.api.joinCommunity(id,currentUser.username);
  btn.textContent = res.joined?"Leave":"Join";
  btn.className   = "btn btn-sm "+(res.joined?"btn-outline":"btn-green");
}

// ── Messages ────────────────────────────────────────────
async function loadInbox() {
  const contacts = await window.api.getInbox(currentUser.username);
  const list = el("contact-list");
  list.innerHTML="";
  if(!Array.isArray(contacts)||!contacts.length) {
    list.innerHTML='<div style="font-size:12px;color:var(--muted);padding:8px">No conversations yet</div>';
    return;
  }
  contacts.forEach(c=>{
    const div=document.createElement("div");
    div.className="ci"+(c===currentChat?" active":"");
    div.textContent="@"+c;
    div.onclick=()=>openChat(c);
    list.appendChild(div);
  });
}

function openChat(username) {
  if(!currentUser||username===currentUser.username) return;
  currentChat=username;
  showPage("messages");
  el("chat-with").textContent="Conversation with @"+username;
  el("msg-row").style.display="flex";
  loadMessages();
  if(chatInterval) clearInterval(chatInterval);
  chatInterval=setInterval(loadMessages,3000);
  document.querySelectorAll(".ci").forEach(i=>i.classList.toggle("active",i.textContent==="@"+username));
}

async function loadMessages() {
  if(!currentChat) return;
  const msgs = await window.api.getConversation(currentUser.username,currentChat);
  const box  = el("chat-msgs");
  box.innerHTML="";
  if(!Array.isArray(msgs)) return;
  msgs.forEach(m=>{
    const div=document.createElement("div");
    div.className="bubble "+(m.from===currentUser.username?"sent":"recv");
    div.textContent=m.content;
    box.appendChild(div);
  });
  box.scrollTop=box.scrollHeight;
}

function startChat() {
  const t=val("nch-user");
  if(!t) return;
  el("nch-user").value="";
  openChat(t);
}

async function sendMsg() {
  const content=el("msg-input").value.trim();
  if(!content||!currentChat) return;
  const res=await window.api.sendMessage(currentUser.username,currentChat,content);
  if(res.error) return alert(res.error);
  el("msg-input").value="";
  loadMessages();
  loadInbox();
}

function msgEnter(e) {
  if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); sendMsg(); }
}

// ── Profile ─────────────────────────────────────────────
async function loadProfile() {
  const user  = await window.api.getUser(currentUser.username);
  const posts = await window.api.getPosts(1,{username:currentUser.username});

  const r = currentUser.role||"poor";
  el("pav").className   = "pav "+(r==="rich"?"av-rich":"av-poor");
  el("pav").textContent = ini(user.display_name||user.username);
  el("pname").textContent   = user.display_name||user.username;
  el("phandle").textContent = "@"+user.username+" · "+(r==="rich"?"Giver":"Receiver");
  el("pp").textContent = posts.total||0;
  el("pf").textContent = user.followers;
  if(!el("bio-input").value) el("bio-input").value=user.bio||"";

  const list=el("prof-posts-list");
  list.innerHTML="";
  if(Array.isArray(posts.posts)&&posts.posts.length) {
    posts.posts.forEach(p=>list.appendChild(buildCard(p)));
  } else {
    list.innerHTML='<div class="empty"><span class="ei">✍️</span>You haven\'t posted yet.</div>';
  }
}

async function saveBio() {
  const bio=el("bio-input").value.trim();
  const res=await window.api.updateBio(currentUser.username,bio);
  if(res.error) return;
  el("bio-msg").textContent="Saved ✓";
  setTimeout(()=>el("bio-msg").textContent="",2500);
}

// ── API status ───────────────────────────────────────────
async function checkApi() {
  try {
    const res=await fetch(API+"/users/");
    if(res.ok){ el("api-dot").style.background="#4caf50"; el("api-status").textContent="Connected"; }
    else throw 0;
  } catch {
    el("api-dot").style.background="#b71c1c";
    el("api-status").textContent="Backend offline";
  }
}

checkApi();
