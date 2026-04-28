require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: process.env.SESSION_SECRET || 'bayt-islahe-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
}));

// View engine
app.set('view engine', 'html');
app.engine('html', (filePath, options, callback) => {
  fs.readFile(filePath, (err, content) => {
    if (err) return callback(err);
    let rendered = content.toString();
    // Simple template engine: replace {{key}} and {{{key}}}
    const replace = (str, data) => {
      // Triple braces = raw HTML
      str = str.replace(/\{\{\{(\w+)\}\}\}/g, (_, k) => data[k] !== undefined ? data[k] : '');
      // Double braces = escaped
      str = str.replace(/\{\{(\w+)\}\}/g, (_, k) => {
        if (data[k] === undefined) return '';
        return String(data[k]).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      });
      return str;
    };
    rendered = replace(rendered, options);
    return callback(null, rendered);
  });
});
app.set('views', path.join(__dirname, 'views'));

// Routes
app.use('/', require('./routes/public'));
app.use('/admin', require('./routes/admin'));

// 404
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'views/public/404.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n✅ Bayt Islahe is running at http://localhost:${PORT}`);
  console.log(`📖 Admin panel: http://localhost:${PORT}/admin/login`);
  console.log(`🔑 Default login: admin / admin123\n`);
});
