const API = "http://127.0.0.1:5000";

async function post(url, body) {
  const res = await fetch(API + url, { method: "POST",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}
async function get(url)       { return (await fetch(API + url)).json(); }
async function put(url, body) {
  const res = await fetch(API + url, { method: "PUT",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}
async function del(url, body) {
  const res = await fetch(API + url, { method: "DELETE",
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

window.api = {
  register:        (username, password, display_name) => post("/auth/register", { username, password, display_name }),
  login:           (username, password)               => post("/auth/login",    { username, password }),
  createPost:      (username, content, community)     => post("/posts/",        { username, content, community }),
  getPosts:        (filters = {}) => { const p = new URLSearchParams(filters).toString(); return get("/posts/" + (p ? "?" + p : "")); },
  likePost:        (post_id, username)                => post(`/posts/${post_id}/like`, { username }),
  deletePost:      (post_id, username)                => del(`/posts/${post_id}`,       { username }),
  getUser:         (username)                         => get(`/users/${username}`),
  listUsers:       ()                                 => get("/users/"),
  updateBio:       (username, bio)                    => put(`/users/${username}/bio`,  { username, bio }),
  followUser:      (target, username)                 => post(`/users/${target}/follow`, { username }),
  sendMessage:     (from, to, content)                => post("/messages/send",          { from, to, content }),
  getConversation: (a, b)                             => get(`/messages/conversation?a=${a}&b=${b}`),
  getInbox:        (username)                         => get(`/messages/inbox/${username}`),
  listCommunities: ()                                 => get("/communities/"),
  createCommunity: (username, name, description)      => post("/communities/",           { username, name, description }),
  joinCommunity:   (community_id, username)           => post(`/communities/${community_id}/join`, { username }),
};