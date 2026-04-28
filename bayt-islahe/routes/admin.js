const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const slugify = require('slugify');
const { Users, Posts } = require('../db');
const fs = require('fs');
const path = require('path');

const CATEGORIES = ['Quran', 'Hadith', "Do's and Don'ts", 'Prophetic Medicine', 'Natural Medicine'];

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) return next();
  res.redirect('/admin/login');
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// --- LOGIN ---
router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/admin/dashboard');
  const html = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'login.html'), 'utf8');
  res.send(html.replace('{{error}}', req.query.error ? '<div class="alert alert-error">Invalid username or password.</div>' : ''));
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = Users.findByUsername(username);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.redirect('/admin/login?error=1');
  }
  req.session.userId = user.id;
  req.session.username = user.username;
  res.redirect('/admin/dashboard');
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// --- DASHBOARD ---
router.get('/dashboard', requireAuth, (req, res) => {
  const { posts: allPosts, total: totalPosts } = Posts.getAll({});
  const { posts: published } = Posts.getAll({ status: 'published' });
  const { posts: drafts } = Posts.getAll({ status: 'draft' });
  const catCounts = Posts.countByCategory();

  const recentHtml = allPosts.slice(0, 10).map(p => `
    <tr>
      <td><a href="/post/${escHtml(p.slug)}" target="_blank" class="post-link">${escHtml(p.title)}</a></td>
      <td><span class="cat-badge-sm">${escHtml(p.category)}</span></td>
      <td><span class="status-badge status-badge--${p.status}">${p.status}</span></td>
      <td>${new Date(p.updatedAt).toLocaleDateString('en-GB')}</td>
      <td>
        <a href="/admin/posts/edit/${p.id}" class="btn-sm btn-edit">Edit</a>
        <form method="POST" action="/admin/posts/delete/${p.id}" style="display:inline" onsubmit="return confirm('Delete this post?')">
          <button type="submit" class="btn-sm btn-delete">Delete</button>
        </form>
      </td>
    </tr>`).join('');

  const catStatsHtml = CATEGORIES.map(c => `
    <div class="cat-stat">
      <span class="cat-stat__name">${c}</span>
      <span class="cat-stat__count">${catCounts[c] || 0}</span>
    </div>`).join('');

  const html = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'dashboard.html'), 'utf8');
  res.send(html
    .replace(/\{\{username\}\}/g, escHtml(req.session.username))
    .replace('{{totalPosts}}', totalPosts)
    .replace('{{publishedCount}}', published.length)
    .replace('{{draftCount}}', drafts.length)
    .replace('{{recentPosts}}', recentHtml)
    .replace('{{catStats}}', catStatsHtml)
  );
});

// --- ALL POSTS ---
router.get('/posts', requireAuth, (req, res) => {
  const statusFilter = req.query.status || '';
  const catFilter = req.query.category || '';
  const searchFilter = req.query.search || '';
  const { posts } = Posts.getAll({ status: statusFilter || undefined, category: catFilter || undefined, search: searchFilter || undefined });

  const catOptions = ['', ...CATEGORIES].map(c =>
    `<option value="${escHtml(c)}" ${catFilter === c ? 'selected' : ''}>${c || 'All Categories'}</option>`
  ).join('');

  const statusOptions = ['', 'published', 'draft'].map(s =>
    `<option value="${s}" ${statusFilter === s ? 'selected' : ''}>${s || 'All Status'}</option>`
  ).join('');

  const rowsHtml = posts.length ? posts.map(p => `
    <tr>
      <td><a href="/post/${escHtml(p.slug)}" target="_blank" class="post-link">${escHtml(p.title)}</a></td>
      <td><span class="cat-badge-sm">${escHtml(p.category)}</span></td>
      <td><span class="status-badge status-badge--${p.status}">${p.status}</span></td>
      <td>${new Date(p.createdAt).toLocaleDateString('en-GB')}</td>
      <td>
        <a href="/admin/posts/edit/${p.id}" class="btn-sm btn-edit">Edit</a>
        <form method="POST" action="/admin/posts/delete/${p.id}" style="display:inline" onsubmit="return confirm('Delete?')">
          <button type="submit" class="btn-sm btn-delete">Delete</button>
        </form>
      </td>
    </tr>`).join('')
    : '<tr><td colspan="5" class="no-data">No posts found.</td></tr>';

  const html = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'posts.html'), 'utf8');
  res.send(html
    .replace(/\{\{username\}\}/g, escHtml(req.session.username))
    .replace('{{catOptions}}', catOptions)
    .replace('{{statusOptions}}', statusOptions)
    .replace('{{searchVal}}', escHtml(searchFilter))
    .replace('{{postsRows}}', rowsHtml)
    .replace('{{postCount}}', posts.length)
  );
});

// --- NEW POST ---
router.get('/posts/new', requireAuth, (req, res) => {
  const catOptions = CATEGORIES.map(c =>
    `<option value="${escHtml(c)}">${c}</option>`).join('');
  const html = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'post-form.html'), 'utf8');
  res.send(html
    .replace(/\{\{username\}\}/g, escHtml(req.session.username))
    .replace('{{formTitle}}', 'New Post')
    .replace('{{formAction}}', 'new')
    .replace('{{titleVal}}', '')
    .replace('{{slugVal}}', '')
    .replace('{{contentVal}}', '')
    .replace('{{metaDescVal}}', '')
    .replace('{{catOptions}}', catOptions)
    .replace('{{isPublished}}', '')
    .replace('{{isDraft}}', 'selected')
    .replace('{{alert}}', '')
  );
});

router.post('/posts/new', requireAuth, (req, res) => {
  let { title, slug, content, category, status, metaDesc } = req.body;
  if (!title || !content || !category) {
    return res.redirect('/admin/posts/new?error=missing');
  }
  // Auto-generate slug if empty
  if (!slug) slug = slugify(title, { lower: true, strict: true });
  // Ensure unique slug
  let finalSlug = slug;
  let counter = 1;
  while (Posts.slugExists(finalSlug)) {
    finalSlug = `${slug}-${counter++}`;
  }
  Posts.create({ title, slug: finalSlug, content, category, status, metaDesc });
  res.redirect('/admin/posts?created=1');
});

// --- EDIT POST ---
router.get('/posts/edit/:id', requireAuth, (req, res) => {
  const post = Posts.getById(Number(req.params.id));
  if (!post) return res.redirect('/admin/posts');

  const catOptions = CATEGORIES.map(c =>
    `<option value="${escHtml(c)}" ${post.category === c ? 'selected' : ''}>${c}</option>`).join('');

  const html = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'post-form.html'), 'utf8');
  res.send(html
    .replace(/\{\{username\}\}/g, escHtml(req.session.username))
    .replace('{{formTitle}}', 'Edit Post')
    .replace('{{formAction}}', 'edit/' + post.id)
    .replace('{{titleVal}}', escHtml(post.title))
    .replace('{{slugVal}}', escHtml(post.slug))
    .replace('{{contentVal}}', escHtml(post.content))
    .replace('{{metaDescVal}}', escHtml(post.metaDesc || ''))
    .replace('{{catOptions}}', catOptions)
    .replace('{{isPublished}}', post.status === 'published' ? 'selected' : '')
    .replace('{{isDraft}}', post.status === 'draft' ? 'selected' : '')
    .replace('{{alert}}', req.query.saved ? '<div class="alert alert-success">Post saved successfully.</div>' : '')
  );
});

router.post('/posts/edit/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  let { title, slug, content, category, status, metaDesc } = req.body;
  if (!title || !content || !category) return res.redirect(`/admin/posts/edit/${id}?error=missing`);

  if (!slug) slug = slugify(title, { lower: true, strict: true });
  let finalSlug = slug;
  let counter = 1;
  while (Posts.slugExists(finalSlug, id)) {
    finalSlug = `${slug}-${counter++}`;
  }
  Posts.update(id, { title, slug: finalSlug, content, category, status, metaDesc });
  res.redirect(`/admin/posts/edit/${id}?saved=1`);
});

// --- DELETE POST ---
router.post('/posts/delete/:id', requireAuth, (req, res) => {
  Posts.delete(Number(req.params.id));
  res.redirect('/admin/posts?deleted=1');
});

// --- SETTINGS ---
router.get('/settings', requireAuth, (req, res) => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin', 'settings.html'), 'utf8');
  res.send(html
    .replace(/\{\{username\}\}/g, escHtml(req.session.username))
    .replace('{{alert}}', req.query.saved ? '<div class="alert alert-success">Password updated.</div>' : '')
  );
});

router.post('/settings', requireAuth, (req, res) => {
  const { currentPass, newPass, confirmPass } = req.body;
  const user = Users.findByUsername(req.session.username);
  if (!bcrypt.compareSync(currentPass, user.password)) {
    return res.redirect('/admin/settings?error=wrongpass');
  }
  if (newPass !== confirmPass || newPass.length < 6) {
    return res.redirect('/admin/settings?error=mismatch');
  }
  Users.updatePassword(user.id, bcrypt.hashSync(newPass, 10));
  res.redirect('/admin/settings?saved=1');
});

// Redirect /admin → /admin/dashboard
router.get('/', requireAuth, (req, res) => res.redirect('/admin/dashboard'));

module.exports = router;
