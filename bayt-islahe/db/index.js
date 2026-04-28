const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, '..', 'data');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data dir and files exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function readJSON(file) {
  if (!fs.existsSync(file)) return [];
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return []; }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// Initialize users if empty
function initUsers() {
  const users = readJSON(USERS_FILE);
  if (users.length === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    writeJSON(USERS_FILE, [{ id: 1, username: 'admin', password: hash, createdAt: new Date().toISOString() }]);
    console.log('✅ Default admin created: username=admin, password=admin123');
  }
}
initUsers();

// --- USER ---
const Users = {
  findByUsername(username) {
    return readJSON(USERS_FILE).find(u => u.username === username) || null;
  },
  updatePassword(id, newHash) {
    const users = readJSON(USERS_FILE);
    const idx = users.findIndex(u => u.id === id);
    if (idx > -1) { users[idx].password = newHash; writeJSON(USERS_FILE, users); }
  }
};

// --- POSTS ---
const Posts = {
  getAll({ status, category, search, limit, offset } = {}) {
    let posts = readJSON(POSTS_FILE);
    if (status) posts = posts.filter(p => p.status === status);
    if (category) posts = posts.filter(p => p.category === category);
    if (search) {
      const q = search.toLowerCase();
      posts = posts.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q)
      );
    }
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const total = posts.length;
    if (limit) posts = posts.slice(offset || 0, (offset || 0) + limit);
    return { posts, total };
  },

  getBySlug(slug) {
    return readJSON(POSTS_FILE).find(p => p.slug === slug) || null;
  },

  getById(id) {
    return readJSON(POSTS_FILE).find(p => p.id === id) || null;
  },

  create({ title, slug, content, category, status, metaDesc, excerpt }) {
    const posts = readJSON(POSTS_FILE);
    const id = Date.now();
    const post = {
      id, title, slug, content, category,
      status: status || 'draft',
      metaDesc: metaDesc || '',
      excerpt: excerpt || content.replace(/<[^>]+>/g, '').slice(0, 160),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    posts.push(post);
    writeJSON(POSTS_FILE, posts);
    return post;
  },

  update(id, { title, slug, content, category, status, metaDesc, excerpt }) {
    const posts = readJSON(POSTS_FILE);
    const idx = posts.findIndex(p => p.id === id);
    if (idx === -1) return null;
    posts[idx] = {
      ...posts[idx], title, slug, content, category,
      status: status || posts[idx].status,
      metaDesc: metaDesc || '',
      excerpt: excerpt || content.replace(/<[^>]+>/g, '').slice(0, 160),
      updatedAt: new Date().toISOString()
    };
    writeJSON(POSTS_FILE, posts);
    return posts[idx];
  },

  delete(id) {
    const posts = readJSON(POSTS_FILE);
    const filtered = posts.filter(p => p.id !== id);
    writeJSON(POSTS_FILE, filtered);
    return filtered.length < posts.length;
  },

  countByCategory() {
    const posts = readJSON(POSTS_FILE).filter(p => p.status === 'published');
    const counts = {};
    posts.forEach(p => { counts[p.category] = (counts[p.category] || 0) + 1; });
    return counts;
  },

  slugExists(slug, excludeId) {
    return readJSON(POSTS_FILE).some(p => p.slug === slug && p.id !== excludeId);
  }
};

module.exports = { Users, Posts };
