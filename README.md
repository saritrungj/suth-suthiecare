# 🩺 Suthie Care

> Comprehensive clinic data management and health assessment system.
> Developed with a Client-Server architecture separating Frontend and Backend.
---

## 💻 Tech Stack

### Frontend — `app/`

| Category | Technology |
|---|---|
| **Framework** | React 19 (Create React App) |
| **Routing** | React Router DOM v7 |
| **Animation** | Framer Motion |
| **UI Components** | SweetAlert2, React Icons, FontAwesome |
| **Data Viz** | Recharts |
| **Calendar** | FullCalendar, React Datepicker, React Calendar |
| **Drag & Drop** | dnd-kit (core, sortable, modifiers) |
| **Image Crop** | React Easy Crop |
| **Color Picker** | React Color |
| **Export** | ExcelJS, FileSaver |
| **API / Real-time** | Axios, Socket.io Client |
| **CAPTCHA** | CloudFlare Captcha |
| **Testing** | Jest, React Testing Library |

### Backend — `server/`

| Category | Technology |
|---|---|
| **Runtime** | Node.js |
| **Framework** | Express.js 5 |
| **Database** | MySQL (mysql2 — connection pool) |
| **Caching** | Redis (ioredis), Node-Cache |
| **Real-time** | Socket.io |
| **Auth** | JWT (jsonwebtoken), Bcrypt.js |
| **Encryption** | AES-256-GCM (crypto), HMAC-SHA256, CryptoJS |
| **Security** | CORS, Express Rate Limit, Helmet-style trust proxy |
| **Notification** | Telegram Bot API |
| **HTTP Client** | Axios |
| **Compression** | compression |

---

## 🛠 Key Features

### 🌐 Public
- **Landing Page** — The main page of the system with clinic information and banners.
- **Online Assessment** — Fill out health assessments via securely encrypted links.
- **Assessment Results** — View results after completing an assessment.
- **History Search** — Search and review your own assessment history.

### 🔒 Admin (Login Required)
- **Dashboard** — Overview statistics dashboard with customizable graph widgets (Recharts).
- **Form Management** — Create/edit/duplicate assessments with a Drag & Drop Form Builder.
- **Case Management** — Continuous patient case tracking system, record keeping, PHQ graphs, Excel Export.
- **Risk Group Management** — Monitor cases with risk, filtering specifically for cases requiring special care.
- **Appointments** — Appointment system with calendar (FullCalendar) displayed monthly/weekly.
- **User Management** — Add/edit/delete user accounts in the system.
- **Roles & Permissions** — Set access permissions based on Role (Admin, Staff, ...).
- **Clinic Management** — Add/edit/reorder clinics.
- **Staff Management** — Record clinic staff information.
- **Banner Management** — Upload Landing page banner images with Drag & Drop reordering.
- **Data Entry Templates** — Create/edit templates for data entry by clinic type.

### 🔐 Security System
- **Data Encryption** — Personal data is encrypted with AES-256-GCM along with HMAC for searching.
- **Data Masking** — System for masking names, phone numbers, and Thai National ID numbers.
- **Thai Data Validation** — Validation for 13-digit Thai National ID and Thai phone numbers.
- **JWT Authentication** — Identity verification with Tokens along with Cross-tab Session Sync.
- **Rate Limiting** — Protection against Brute-force and DDoS attacks.
- **CAPTCHA** — Bot protection using hCaptcha.
- **Telegram Notifications** — Alerts for anomalies or important information via Telegram Bot.

---

## 🚀 Installation & Setup

### Prerequisites

- **Node.js** >= 18
- **MySQL** (Pre-created database)
- **Redis** (Optional but recommended for caching)

### 1. Clone the project

```bash
git clone (github URL)
cd suth-suthiecare
```

### 2. Backend Setup

```bash
cd server
npm install
```

Create a `.env` file in the `server/` directory:

```env
# Database
DB_HOST=localhost
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name

# Encryption
AES_KEY=your_64_char_hex_key_here
AES_SEARCH_KEY=your_search_key_min_32_chars

# Telegram Notification
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Server
PORT=5000
```

Start the server:

```bash
node index.js
# 🚀 Server started on port 5000
```

### 3. Frontend Setup

```bash
cd app
npm install
```

Create a `.env` file in the `app/` directory:

```env
REACT_APP_API_URL=http://localhost:5000/api
```

Start the app:

```bash
npm start
# Open browser at http://localhost:3000
```

---

## 🗂️ API Routes

| Prefix | Route File | Description |
|---|---|---|
| `/api` | `authRoutes.js` | Login, Token verification |
| `/api` | `formRoutes.js` | Form CRUD, Submit answers, View results |
| `/api` | `caseRoutes.js` | Case management, Appointments, History recording |
| `/api` | `userRoutes.js` | User CRUD |
| `/api` | `roleRoutes.js` | Role & Permissions CRUD |
| `/api` | `bannerRoutes.js` | Banner CRUD |
| `/api` | `dashboardRoutes.js` | Statistics, Graphs, Dashboard settings |
| `/api/clinics` | `clinicRoutes.js` | Clinic CRUD |
| `/api/staffs` | `staffRoutes.js` | Staff CRUD |

---

## 📄 License

This project is licensed under the **Apache License 2.0** — see the [LICENSE](./LICENSE) file for details.
