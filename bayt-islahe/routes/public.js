const express = require('express');
const router = express.Router();
const { Posts } = require('../db');
const { marked } = require('marked');
const fs = require('fs');
const path = require('path');

const CATEGORIES = ['Quran', 'Hadith', "Do's and Don'ts", 'Prophetic Medicine', 'Natural Medicine'];
const SITE_NAME = 'Bayt Islahe';
const SITE_DESC = 'A home for Islamic knowledge — Quran, Hadith, and prophetic wisdom for everyday life.';

function renderPage(res, template, data = {}) {
  const filePath = path.join(__dirname, '..', 'views', 'public', template + '.html');
  let html = fs.readFileSync(filePath, 'utf8');
  // Inject layout variables
  data.siteName = SITE_NAME;
  data.siteDesc = SITE_DESC;
  data.categories = CATEGORIES;
  // Replace all {{key}} and {{{key}}}
  html = html.replace(/\{\{\{(\w+)\}\}\}/g, (_, k) => data[k] !== undefined ? data[k] : '');
  html = html.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    if (data[k] === undefined) return '';
    if (typeof data[k] === 'object') return '';
    return String(data[k]).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  });
  res.send(html);
}

// Home
router.get('/', (req, res) => {
  const { posts } = Posts.getAll({ status: 'published', limit: 9 });
  const featured = posts[0] || null;
  const rest = posts.slice(1);
  const catCounts = Posts.countByCategory();

  const featuredHtml = featured ? buildPostCard(featured, true) : '';
  const gridHtml = rest.map(p => buildPostCard(p)).join('');
  const catHtml = CATEGORIES.map(c => `
    <a href="/category/${encodeURIComponent(c)}" class="cat-pill">
      <span class="cat-icon">${catIcon(c)}</span>
      <span>${c}</span>
      <span class="cat-count">${catCounts[c] || 0}</span>
    </a>`).join('');

  const html = fs.readFileSync(path.join(__dirname, '..', 'views', 'public', 'index.html'), 'utf8');
  res.send(html
    .replace('{{siteName}}', SITE_NAME)
    .replace('{{siteDesc}}', SITE_DESC)
    .replace('{{featuredPost}}', featuredHtml)
    .replace('{{postGrid}}', gridHtml)
    .replace('{{categoryNav}}', catHtml)
  );
});

// Category page
router.get('/category/:cat', (req, res) => {
  const cat = decodeURIComponent(req.params.cat);
  if (!CATEGORIES.includes(cat)) return res.status(404).redirect('/');
  const page = parseInt(req.query.page) || 1;
  const limit = 9;
  const { posts, total } = Posts.getAll({ status: 'published', category: cat, limit, offset: (page-1)*limit });
  const totalPages = Math.ceil(total / limit);

  const gridHtml = posts.length
    ? posts.map(p => buildPostCard(p)).join('')
    : '<p class="no-posts">No posts in this category yet.</p>';
  const paginationHtml = buildPagination(page, totalPages, `/category/${encodeURIComponent(cat)}`);

  const html = fs.readFileSync(path.join(__dirname, '..', 'views', 'public', 'category.html'), 'utf8');
  res.send(html
    .replace(/\{\{siteName\}\}/g, SITE_NAME)
    .replace(/\{\{category\}\}/g, cat)
    .replace(/\{\{catIcon\}\}/g, catIcon(cat))
    .replace(/\{\{postCount\}\}/g, total)
    .replace('{{postGrid}}', gridHtml)
    .replace('{{pagination}}', paginationHtml)
  );
});

// Single post
router.get('/post/:slug', (req, res) => {
  const post = Posts.getBySlug(req.params.slug);
  if (!post || post.status !== 'published') return res.status(404).redirect('/');

  const { posts: related } = Posts.getAll({ status: 'published', category: post.category, limit: 4 });
  const relFiltered = related.filter(p => p.id !== post.id).slice(0, 3);

  const contentHtml = marked.parse(post.content || '');
  const relHtml = relFiltered.map(p => buildPostCard(p, false, true)).join('');
  const formattedDate = new Date(post.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const html = fs.readFileSync(path.join(__dirname, '..', 'views', 'public', 'post.html'), 'utf8');
  res.send(html
    .replace(/\{\{siteName\}\}/g, SITE_NAME)
    .replace(/\{\{title\}\}/g, escHtml(post.title))
    .replace(/\{\{metaDesc\}\}/g, escHtml(post.metaDesc || post.excerpt))
    .replace(/\{\{category\}\}/g, escHtml(post.category))
    .replace(/\{\{catIcon\}\}/g, catIcon(post.category))
    .replace(/\{\{date\}\}/g, formattedDate)
    .replace('{{{content}}}', contentHtml)
    .replace('{{relatedPosts}}', relHtml)
  );
});

// Search
router.get('/search', (req, res) => {
  const q = req.query.q || '';
  const { posts } = q ? Posts.getAll({ status: 'published', search: q }) : { posts: [] };
  const gridHtml = posts.map(p => buildPostCard(p)).join('') || '<p class="no-posts">No results found.</p>';

  const html = fs.readFileSync(path.join(__dirname, '..', 'views', 'public', 'search.html'), 'utf8');
  res.send(html
    .replace(/\{\{siteName\}\}/g, SITE_NAME)
    .replace(/\{\{query\}\}/g, escHtml(q))
    .replace(/\{\{resultCount\}\}/g, posts.length)
    .replace('{{postGrid}}', gridHtml)
  );
});

// --- Helpers ---
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function catIcon(cat) {
  const icons = {
    'Quran': '📖', 'Hadith': '📜', "Do's and Don'ts": '✅',
    'Prophetic Medicine': '🌿', 'Natural Medicine': '🍃'
  };
  return icons[cat] || '📌';
}

function buildPostCard(post, featured = false, small = false) {
  const date = new Date(post.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const excerpt = post.excerpt || post.content.replace(/<[^>]+>/g, '').slice(0, 120);
  return `
    <article class="post-card${featured ? ' post-card--featured' : ''}${small ? ' post-card--small' : ''}">
      <div class="post-card__meta">
        <span class="cat-badge cat-badge--${slugCat(post.category)}">${catIcon(post.category)} ${escHtml(post.category)}</span>
        <span class="post-card__date">${date}</span>
      </div>
      <h${featured ? '2' : '3'} class="post-card__title">
        <a href="/post/${encodeURIComponent(post.slug)}">${escHtml(post.title)}</a>
      </h${featured ? '2' : '3'}>
      ${!small ? `<p class="post-card__excerpt">${escHtml(excerpt)}</p>` : ''}
      <a href="/post/${encodeURIComponent(post.slug)}" class="post-card__link">Read more →</a>
    </article>`;
}

function slugCat(cat) {
  return cat.toLowerCase().replace(/[^a-z0-9]/g, '-');
}

function buildPagination(current, total, base) {
  if (total <= 1) return '';
  let html = '<nav class="pagination">';
  if (current > 1) html += `<a href="${base}?page=${current-1}" class="page-btn">← Prev</a>`;
  for (let i = 1; i <= total; i++) {
    html += `<a href="${base}?page=${i}" class="page-btn${i === current ? ' active' : ''}">${i}</a>`;
  }
  if (current < total) html += `<a href="${base}?page=${current+1}" class="page-btn">Next →</a>`;
  html += '</nav>';
  return html;
}

module.exports = router;
