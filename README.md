# TransLogix — Transport Billing App

A full-stack web application for small transport operators to manage trips, track client balances, record payments, generate invoices, and visualise business analytics — all from a single, mobile-friendly dashboard.

---

## Table of Contents

1. [Use Case](#use-case)
2. [Key Features](#key-features)
3. [Tech Stack](#tech-stack)
4. [Project Structure](#project-structure)
5. [Getting Started](#getting-started)
6. [Environment Variables](#environment-variables)
7. [Seeding Demo Data](#seeding-demo-data)
8. [Usage Guide](#usage-guide)
9. [API Reference](#api-reference)
10. [Data Models](#data-models)
11. [Authentication](#authentication)
12. [File Uploads (Cloudinary)](#file-uploads-cloudinary)
13. [Deployment](#deployment)
14. [Known Limitations](#known-limitations)

---

## Use Case

TransLogix is built for **independent transport operators and small taxi/cab businesses** in the UK who:

- Drive regular routes for a fixed group of clients (commuters, carehome residents, corporate accounts)
- Need to track who owes money and how much, without spreadsheets
- Want to send professional invoices as PDFs directly from the browser
- Receive payment via bank transfer, cash, or Revolut and need a simple ledger
- Work with both individual paying passengers ("direct" clients) and organisations that pay in bulk ("partner" clients — e.g. Amazon, NHS carehomes)

The entire system is designed around one operator, one login, real data.

---

## Key Features

### Dashboard (Analytics)
- **5 KPI cards**: Total trips, total billed, total received, still to collect, and payment collection rate
- **10 numbered metrics**: Average trip value, average debt per client, largest outstanding debt, cleared clients %, trips today, average payment size, direct revenue, partner revenue, top route, unique routes used
- **Interactive Chart.js charts**:
  - Billed vs Received bar chart (daily / weekly / monthly bucketing depending on period)
  - Payment methods doughnut chart (Cash / Bank Transfer / Revolut split by amount)
  - Still to collect horizontal bar chart per client
  - Trips by route bar chart
  - Client split doughnut (Direct vs Partner)
  - Collection rate SVG ring with live percentage
- **Period selector**: 7 days, 30 days, 90 days, or All time
- **Unpaid clients list**: Highest balance first, with direct WhatsApp message links

### Trips
- Log trips with date, origin, destination, route variant (Morning / Afternoon / Evening), number of people, parking charges, other expenses, and notes
- Two payment models:
  - **Direct**: Charge is split equally among selected individual clients; each client's balance is incremented automatically
  - **Partner**: Entire charge goes to a business/partner account
- Swap origin ↔ destination button
- Custom place entry (adds to your Places list permanently)
- Ledger view with delete (reverses balance automatically)

### Payments
- Record payments from direct or partner clients
- Payment methods: Bank Transfer, Cash, Revolut
- **Third-party payer**: Mark when someone else paid on a client's behalf (e.g. a family member), with the payer's name stored
- **Proof of payment upload**: Drag-and-drop or click-to-browse; supports images (JPG, PNG) and PDFs (max 5 MB); image thumbnail preview before upload; uploaded to Cloudinary
- **Proof lightbox**: Click "View" on any payment row to see the proof image in a full-screen modal, or open PDF in a new tab
- Deleting a payment reverses the client balance automatically
- Ledger shows the last 80 payments, most recent first

### Clients
- Add individual clients with name, WhatsApp number, postcode, organisation, and client type (direct / partner)
- **Import contacts** on Android via the Contact Picker API; VCF file upload fallback for iOS
- Each client has a live running `amountOwed` balance — automatically updated when trips are logged or payments received
- Mark client as paid (zeroes their balance)
- Delete clients
- **Send payment request via WhatsApp**: Taps into `wa.me/` deep links with a pre-filled message showing their balance and your bank details

### Invoice Generator
- Select any individual client and a date range
- Enter an optional previous opening balance
- Add unlimited **adjustments** (extras or deductions) with custom labels and amounts
- **Live preview** renders a full HTML invoice inside the browser — no server round-trip for the PDF
- **Print to PDF**: Uses `window.print()` with print CSS that hides the UI and shows only the invoice — works natively in every browser's "Save as PDF" option
- Invoice shows: business header, client details, itemised trips table, payments received table, adjustments, and a final balance due

### Settings
- Business / trading name
- Business address (used on invoices)
- Bank name, account number, sort code (used in WhatsApp payment request messages)
- WhatsApp Business number

### Places
- Managed list of route places (Coventry, Oxford, Birmingham, etc.)
- Auto-seeded with 7 UK Midlands defaults on first run
- Add new places inline from the Trips form

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Web framework | Express 5 |
| Database | MongoDB (Mongoose 8) |
| Auth | Passport.js (Local + Google OAuth 2.0) |
| Sessions | express-session + connect-mongo (7-day TTL) |
| Password hashing | bcryptjs |
| File uploads | Multer 2 + multer-storage-cloudinary |
| Cloud storage | Cloudinary (payment proof images/PDFs) |
| Frontend | Vanilla JavaScript (no framework) |
| Charts | Chart.js 4.4.4 (CDN) |
| CSS | Custom design system (CSS custom properties, mobile-first) |
| Dev server | nodemon |

---

## Project Structure

```
transport-billing-app/
├── server/
│   ├── index.js                  # Express app entry point
│   ├── middleware/
│   │   └── requireAuth.js        # Session auth guard for API routes
│   ├── models/
│   │   ├── User.js
│   │   ├── IndividualClient.js
│   │   ├── BusinessClient.js
│   │   ├── Trip.js
│   │   ├── Payment.js
│   │   ├── Settings.js
│   │   ├── Place.js
│   │   ├── Worker.js
│   │   └── Route.js
│   └── routes/
│       ├── auth.js               # Login, signup, logout, Google OAuth
│       ├── trips.js
│       ├── payments.js           # Includes Cloudinary proof upload
│       ├── individualClients.js
│       ├── businessClients.js
│       ├── invoice.js
│       ├── settings.js
│       ├── places.js
│       ├── workers.js
│       └── routes.js
├── public/
│   ├── css/
│   │   └── style.css             # Full design system
│   ├── js/
│   │   ├── ui.js                 # Parallax FX + hamburger nav
│   │   ├── auth-guard.js         # Redirects unauthenticated users
│   │   ├── dashboard.js          # Analytics + Chart.js
│   │   ├── trips.js
│   │   ├── payments.js           # Includes drag-and-drop proof + lightbox
│   │   ├── clients.js
│   │   ├── invoice.js
│   │   ├── settings.js
│   │   └── login.js
│   └── pages/
│       ├── index.html            # Analytics dashboard
│       ├── trips.html
│       ├── payments.html
│       ├── clients.html
│       ├── invoice.html
│       ├── settings.html
│       └── login.html
├── seed.js                       # Demo data seeder
├── .env                          # Environment config (not committed)
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites
- Node.js 18 or higher
- A MongoDB database (MongoDB Atlas free tier works)
- A Cloudinary account (free tier — for proof of payment uploads)

### 1. Clone the repo

```bash
git clone https://github.com/anandhu-bhaskar/TransLogix-Cab-Ledger.git
cd TransLogix-Cab-Ledger
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Copy the example below into a `.env` file at the project root:

```env
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/
MONGODB_DB_NAME=translogix
SESSION_SECRET=change-me-to-a-long-random-string
CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name

# Optional — only needed if you want Google sign-in
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
```

### 4. Start the development server

```bash
npm run dev
```

The app runs at `http://localhost:3000`. Sign up for an account on the login page.

### 5. (Optional) Seed demo data

```bash
npm run seed
```

This creates a demo user and populates 40 trips, 20 payments, and 12 clients across January–April 2026.

**Demo credentials after seeding:**
```
Email:    demo@translogix.com
Password: Demo@1234
```

> **Warning:** The seeder deletes all existing users except the demo user, and clears all trip/payment/client data. Only run it on a fresh or test database.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB connection string |
| `MONGODB_DB_NAME` | No | Database name (defaults to the one in the URI) |
| `SESSION_SECRET` | Yes | Secret key for signing session cookies |
| `CLOUDINARY_URL` | Yes | Full Cloudinary URL — enables proof of payment uploads |
| `PORT` | No | HTTP port (default: 3000) |
| `GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |

---

## Seeding Demo Data

The `seed.js` script is idempotent for the demo user:

- Creates `demo@translogix.com` if it doesn't exist, otherwise keeps it
- Deletes all other user accounts
- Clears: Workers, Routes, Trips, BusinessClients, IndividualClients, Payments, Settings, Places
- Seeds:
  - 7 UK Midlands places
  - 12 individual clients (10 direct, 2 partner)
  - 3 business clients (Amazon Logistics, Carehome Coventry, Carehome Oxford)
  - 40 trips across January–April 2026
  - 20 payments
  - Settings for "TransLogix Transport" with Monzo bank details
- Calculates and writes `amountOwed` correctly for all clients

---

## Usage Guide

### Logging in
Navigate to `/pages/login.html`. Sign up with email + password, or use Google OAuth if configured. The session lasts 7 days.

### Recording a trip
1. Go to **Trips** → the form is on the right panel
2. Set the date, choose origin and destination (or type a new place)
3. Optionally set a variant (Morning / Afternoon / Evening)
4. Choose **Direct** (individual clients pay) or **Partner** (organisation pays)
5. For Direct: select one or more clients — the total is split equally between them
6. For Partner: select the business client
7. Optionally add parking charges, other expenses, or notes
8. Click **Save trip** — client balances update instantly

### Recording a payment
1. Go to **Payments**
2. Select **Direct** or **Partner** client type, then pick the client
3. Enter amount, date, and payment method
4. Optionally upload proof (drag a file onto the drop zone or click to browse)
5. If someone else paid on behalf (e.g. a family member), check "Someone else paid on behalf" and enter their name
6. Click **Save payment** — the client's balance decreases immediately

### Viewing proof of payment
- In the Payments ledger, rows with uploaded proof show a **View** (image) or **PDF** button
- **View**: Opens the image in a full-screen lightbox modal within the page
- **PDF**: Opens a modal with a link to open the PDF in a new tab

### Generating an invoice
1. Go to **Invoice**
2. Select the client and set the date range
3. Optionally enter a previous balance (e.g. from last month's unpaid invoice)
4. Add any extras (fuel surcharge, parking) or deductions (loyalty discount) as adjustments
5. Click **Preview invoice** — a formatted invoice renders on the right
6. Click **Print / Save PDF** — your browser's print dialog opens; select "Save as PDF" as the destination

### Sending a WhatsApp payment request
1. Go to **Clients**
2. Find the client in the list
3. Click the green **WhatsApp** button — it opens WhatsApp (web or app) with a pre-written message showing their outstanding balance and your bank details

### Checking analytics
1. Go to **Dashboard**
2. Use the period buttons (7d / 30d / 90d / All) to filter all charts and metrics
3. Hover over chart bars/slices for exact values
4. The "Unpaid clients" panel shows who owes the most right now

---

## API Reference

All API routes are prefixed with `/api` and require an authenticated session cookie. Returns `401` if unauthenticated.

---

### Auth routes (no auth required)

| Method | Path | Description |
|---|---|---|
| `GET` | `/auth/me` | Returns current session user or `{ user: null }` |
| `POST` | `/auth/signup` | Create account: `{ name, email, password }` |
| `POST` | `/auth/login` | Login: `{ email, password }` |
| `POST` | `/auth/logout` | Destroys session |
| `GET` | `/auth/google` | Redirect to Google OAuth consent |
| `GET` | `/auth/google/callback` | Google OAuth callback — redirects to dashboard |

---

### Trips

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/trips` | List all trips. Query: `?from=YYYY-MM-DD&to=YYYY-MM-DD&paymentMethod=direct\|partner` |
| `POST` | `/api/trips` | Create a trip (see body below) |
| `DELETE` | `/api/trips/:id` | Delete trip and reverse client balance side-effects |

**POST /api/trips body:**
```json
{
  "date": "2026-04-14",
  "origin": "Coventry",
  "destination": "Oxford",
  "variant": "Morning",
  "paymentMethod": "direct",
  "payerClientIds": ["<IndividualClient _id>"],
  "totalAmount": 36,
  "numberOfPeople": 3,
  "parkingCharges": 0,
  "otherExpenses": 0,
  "notes": "",
  "workerIds": [],
  "customWorkerNames": [],
  "unspecifiedWorkers": false
}
```
For `paymentMethod: "partner"`, replace `payerClientIds` with `"partnerClientId": "<BusinessClient _id>"`.

---

### Payments

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/payments` | List all payments, most recent first |
| `POST` | `/api/payments` | Record a payment (`multipart/form-data`) |
| `DELETE` | `/api/payments/:id` | Delete payment and reverse client balance |

**POST /api/payments fields (multipart/form-data):**

| Field | Type | Required | Notes |
|---|---|---|---|
| `payerName` | string | Yes | Display name of the client |
| `amount` | number | Yes | Must be > 0 |
| `date` | string | Yes | ISO date string |
| `method` | string | Yes | `Bank Transfer`, `Cash`, or `Revolut` |
| `linkedType` | string | Yes | `direct` or `partner` |
| `individualClientId` | string | Yes* | Required for `direct`; also for `partner` (new flow) |
| `thirdPartyPayer` | boolean | No | `"true"` if someone else paid |
| `paidByName` | string | No | Name of actual payer (third-party) |
| `proof` | file | No | Image (JPG/PNG) or PDF — uploaded to Cloudinary |

---

### Individual Clients

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/individual-clients` | List clients. Query: `?status=unpaid\|paid` |
| `POST` | `/api/individual-clients` | Create client |
| `PUT` | `/api/individual-clients/:id/status` | Update status: `{ "status": "paid" \| "unpaid" }` |
| `DELETE` | `/api/individual-clients/:id` | Delete client |

**POST body:**
```json
{
  "name": "Reshma Patel",
  "whatsappNumber": "447911100001",
  "postcode": "CV1 2AB",
  "clientType": "direct",
  "organisation": "Ocado",
  "carehomeLocation": ""
}
```

---

### Business Clients

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/business-clients` | List all business clients |
| `POST` | `/api/business-clients` | Create: `{ "name": "Amazon Logistics" }` |
| `DELETE` | `/api/business-clients/:id` | Delete |

---

### Invoice

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/invoice/data` | Fetch structured billing data for a client + date range |

**POST /api/invoice/data body:**
```json
{
  "individualClientId": "<_id>",
  "from": "2026-01-01",
  "to": "2026-03-31",
  "previousBalance": 0
}
```

**Response:**
```json
{
  "client": { "name": "...", "organisation": "...", "postcode": "..." },
  "trips": [
    { "date": "...", "origin": "...", "destination": "...", "route": "Coventry → Oxford", "variant": "Morning", "people": 3, "amount": 12.00 }
  ],
  "payments": [
    { "date": "...", "method": "Cash", "payerName": "...", "paidByName": null, "amount": 20 }
  ],
  "previousBalance": 0
}
```

---

### Settings

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/settings` | Get settings (auto-creates defaults if none exist) |
| `PUT` | `/api/settings` | Update settings |

**PUT body (all fields optional):**
```json
{
  "businessName": "TransLogix Transport",
  "businessAddress": "12 Warwick Road\nCoventry CV1 2EY",
  "bankName": "Monzo",
  "accountNumber": "12345678",
  "sortCode": "04-00-04",
  "whatsappBusinessNumber": "447700000000"
}
```

---

### Places

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/places` | List all places (seeds defaults if empty) |
| `POST` | `/api/places` | Add a place: `{ "name": "Warwick" }` (case-insensitive dedup) |

---

### Health

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Returns `{ "ok": true }` — used for uptime monitoring |

---

## Data Models

### User
```
name          String (required)
email         String (unique)
password      String (bcrypt hash, optional — absent for Google accounts)
googleId      String (optional)
avatar        String (URL)
```

### IndividualClient
```
name              String (required, unique)
whatsappNumber    String
postcode          String
amountOwed        Number (live running balance — updated by trips/payments)
status            "unpaid" | "paid"
clientType        "direct" | "partner"
organisation      String
carehomeLocation  "Oxford" | "Coventry" | "Stratford" | ""
```

### BusinessClient
```
name            String (required, unique)
runningBalance  Number
```

### Trip
```
date              Date (required)
origin            String
destination       String
variant           String ("Morning" | "Afternoon" | "Evening" | "")
paymentMethod     "direct" | "partner" (required)
payers            [{ client: IndividualClient._id, amount: Number }]
businessClient    BusinessClient._id
workers           [Worker._id]
customWorkerNames [String]
unspecifiedWorkers Boolean
numberOfPeople    Number
parkingCharges    Number
otherExpenses     Number
totalAmount       Number (required)
amountPerPerson   Number
notes             String
```

### Payment
```
payerName        String (required)
amount           Number (required)
date             Date (required)
method           "Bank Transfer" | "Cash" | "Revolut"
linkedType       "direct" | "partner"
individualClient IndividualClient._id
businessClient   BusinessClient._id
thirdPartyPayer  Boolean
paidByName       String
proof            { url, publicId, originalFilename, resourceType, format }
```

### Settings (singleton)
```
businessName           String
businessAddress        String
bankName               String
accountNumber          String
sortCode               String
whatsappBusinessNumber String
```

### Place
```
name  String (required, unique, case-insensitive index)
```

---

## Authentication

### Session-based
- Login creates a 7-day server-side session stored in MongoDB (via `connect-mongo`)
- The session cookie (`connect.sid`) is sent with every request
- All `/api/*` routes (except `/auth/*` and `/api/health`) are protected by `requireAuth` middleware which returns `401` if no valid session exists
- The frontend `auth-guard.js` script checks `/auth/me` on every page load and redirects to `/pages/login.html` if unauthenticated

### Google OAuth (optional)
1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the "Google+ API" or "Google Identity"
3. Create OAuth 2.0 credentials; set the redirect URI to `http://localhost:3000/auth/google/callback` (and your production URL)
4. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to `.env`
5. If a Google account email matches an existing local account, they are merged automatically

---

## File Uploads (Cloudinary)

Payment proof files are uploaded directly to Cloudinary via the server (not client-side).

**Setup:**
1. Create a free [Cloudinary](https://cloudinary.com) account
2. Copy your **Cloudinary URL** from the dashboard (format: `cloudinary://API_KEY:API_SECRET@CLOUD_NAME`)
3. Add it to `.env` as `CLOUDINARY_URL`

**How it works:**
- `multer` receives the file from the `multipart/form-data` POST
- `multer-storage-cloudinary` streams it directly to Cloudinary under the folder `transport-billing/proofs`
- Images are stored as `image` resource type; PDFs as `raw`
- The returned Cloudinary URL and public ID are stored in `Payment.proof`

**Frontend behaviour:**
- Drop zone accepts `image/*` and `application/pdf` up to 5 MB
- Images show a live thumbnail preview before upload
- After save, a **View** button appears in the ledger row — clicking opens the image in a full-screen lightbox (modal) without leaving the page
- PDFs show a modal with an "Open PDF" link

---

## Deployment

### Render.com (recommended)

1. Push your code to GitHub
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repo
4. Set:
   - **Build command**: `npm install`
   - **Start command**: `npm start`
5. Add all environment variables from the table above under **Environment**
6. Deploy — Render provides a free HTTPS URL

### Self-hosted / VPS

```bash
npm install
NODE_ENV=production npm start
```

Run behind a reverse proxy (nginx/Caddy) with SSL. Use a process manager like `pm2`:

```bash
npm install -g pm2
pm2 start server/index.js --name translogix
pm2 save
```

### Not compatible with
- **Netlify** — requires a persistent Node.js process; Netlify only supports static sites and serverless functions
- **Vercel** — same reason; Express sessions and MongoDB connections don't fit the serverless model cleanly

---

## Known Limitations

- **Single-user by design**: All data belongs to the one logged-in operator. There is no multi-tenancy or role-based access.
- **No real-time sync**: If you have two browser tabs open, the second tab won't auto-refresh when changes are made in the first. Use the Refresh buttons.
- **Cloudinary required for proof uploads**: If `CLOUDINARY_URL` is not set, the payment upload will fail silently on the server. Payments without a proof file still work fine.
- **Invoice is client-rendered**: The PDF is generated via `window.print()` — it uses the browser's built-in renderer. Appearance may vary slightly between browsers.
- **`amountOwed` can go negative**: If payments exceed billed trips (e.g. a client overpays), the balance will show as a negative number rather than a credit. This is intentional for simplicity but should be interpreted as "client is in credit".
- **Carehome location enum**: The `carehomeLocation` field on IndividualClient is currently limited to `Oxford`, `Coventry`, and `Stratford`. To add more, update the enum in `server/models/IndividualClient.js`.
