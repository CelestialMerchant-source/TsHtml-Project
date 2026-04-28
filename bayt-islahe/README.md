# Bayt Islahe — بيت الإصلاح

An Islamic blog built with Node.js, featuring a clean editorial design with full admin panel.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Seed sample posts (optional)
node seed.js

# 3. Start the server
npm start
```

Then open: **http://localhost:3000**
Admin panel: **http://localhost:3000/admin/login**
Default login: `admin` / `admin123`

---

## Project Structure

```
bayt-islahe/
├── app.js              # Main server entry point
├── seed.js             # Sample data seeder
├── .env                # Environment variables
├── data/
│   ├── posts.json      # All blog posts (auto-created)
│   └── users.json      # Admin users (auto-created)
├── db/
│   └── index.js        # Database layer (JSON file DB)
├── routes/
│   ├── public.js       # Public blog routes
│   └── admin.js        # Admin panel routes
├── views/
│   ├── public/         # Public HTML templates
│   │   ├── index.html
│   │   ├── category.html
│   │   ├── post.html
│   │   ├── search.html
│   │   └── 404.html
│   └── admin/          # Admin HTML templates
│       ├── login.html
│       ├── dashboard.html
│       ├── posts.html
│       ├── post-form.html
│       └── settings.html
└── public/
    └── css/
        ├── style.css   # Public blog styles
        └── admin.css   # Admin panel styles
```

## Features

- Public blog with 5 Islamic categories
- Markdown post editor with live preview slug
- Draft / Publish status workflow
- Slug-based URLs
- SEO meta tags per post
- Category filtering
- Full-text search
- Mobile responsive design
- Admin login with session auth
- Password change from settings
- Related posts on post pages
