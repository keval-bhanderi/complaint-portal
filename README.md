# Community Complaint Portal

A full-stack civic complaint management system built with Express.js, MongoDB, and vanilla JS.

## Features

- **Citizen** — Submit complaints with photos and map location, track status, upvote issues
- **Authority** — View and manage all complaints, update statuses, email notifications sent automatically
- **Admin** — Full user management, role assignment, activate/deactivate accounts
- **Map view** — All complaints plotted as color-coded pins
- **Timeline** — Every status change logged with notes and timestamps

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Express.js, Node.js |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcryptjs |
| Email | Nodemailer (Gmail) |
| Photos | Cloudinary + Multer |
| Maps | Google Maps JS API |
| Frontend | Vanilla HTML/CSS/JS |

## Project Structure

```
complaint-portal/
├── server.js              ← Entry point
├── config/
│   └── cloudinary.js      ← Cloudinary + Multer setup
├── middleware/
│   └── auth.js            ← JWT verify + role check
├── models/
│   ├── User.js            ← User schema
│   └── Complaint.js       ← Complaint schema with timeline
├── routes/
│   ├── auth.js
│   ├── complaints.js
│   ├── users.js
│   └── dashboard.js
├── controllers/
│   ├── authController.js
│   ├── complaintController.js
│   ├── userController.js
│   └── dashboardController.js
├── utils/
│   └── mailer.js          ← Email templates
└── public/                ← Frontend
    ├── index.html
    ├── css/style.css
    └── js/
        ├── api.js          ← Fetch wrapper
        └── app.js          ← UI logic
```

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```
Fill in `.env` with your credentials (see comments in file).

### 3. Get your credentials

**MongoDB Atlas** (free)
- Sign up at https://mongodb.com/atlas
- Create a free M0 cluster
- Connect → Drivers → copy the URI

**Gmail App Password**
- Google Account → Security → 2-Step Verification → App Passwords
- Generate one for "Mail" — use the 16-char code as `MAIL_PASS`

**Google Maps API**
- https://console.cloud.google.com
- Enable: Maps JavaScript API, Places API, Geocoding API
- Create API key → replace `GOOGLE_MAPS_API_KEY` in `public/index.html` too

**Cloudinary** (free tier)
- https://cloudinary.com → Dashboard → copy cloud name, API key, secret

### 4. Run
```bash
npm run dev
```

Open http://localhost:5000

### 5. Create your first admin
Register normally, then in MongoDB Atlas → Browse Collections → users → find your document → change `role` to `"admin"`.

## API Reference

### Auth
| Method | Route | Access |
|--------|-------|--------|
| POST | /api/auth/register | Public |
| POST | /api/auth/login | Public |
| GET | /api/auth/me | Logged in |

### Complaints
| Method | Route | Access |
|--------|-------|--------|
| GET | /api/complaints | Logged in |
| POST | /api/complaints | Citizen+ |
| GET | /api/complaints/map | Logged in |
| GET | /api/complaints/:id | Logged in |
| PATCH | /api/complaints/:id/status | Authority+ |
| PATCH | /api/complaints/:id/upvote | Logged in |
| DELETE | /api/complaints/:id | Owner / Admin |

### Dashboard
| Method | Route | Access |
|--------|-------|--------|
| GET | /api/dashboard/stats | Authority+ |
| GET | /api/dashboard/map-data | Authority+ |

### Users (Admin only)
| Method | Route |
|--------|-------|
| GET | /api/users |
| PATCH | /api/users/:id/role |
| PATCH | /api/users/:id/toggle |

## Deploy to Render (free)

1. Push to GitHub
2. New Web Service at https://render.com
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add all `.env` variables in Render's Environment tab
6. Done — live URL provided automatically
