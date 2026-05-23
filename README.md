# bé.ka Coffee & Space — AIS
## Sales & Cash Information System
### AIS Final Project 2026 | Putri · Marsya · Natharina

---

## 📁 File Structure
```
beka-pos-v3/
├── index.html              ← Main app (open this in browser)
├── css/
│   └── style.css           ← All styling
├── js/
│   ├── data.js             ← Real bé.ka menu (55 items) + constants
│   ├── seedGenerator.js    ← 2-month realistic data (~180 tx/day)
│   ├── firebase.js         ← Firebase Firestore integration
│   └── app.js              ← All application logic
└── README.md
```

---

## 🚀 Quick Start (Local — No Firebase)
1. Extract ZIP
2. Open `index.html` in any browser
3. Done! Runs fully offline with 2 months of seed data

---

## 🔥 Firebase Setup (Cloud — For Live Demo)

### Step 1: Create Firebase Project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project** → name it `beka-coffee-ais`
3. Disable Google Analytics (optional) → Create project

### Step 2: Enable Firestore
1. In sidebar: **Build → Firestore Database**
2. Click **Create database**
3. Choose **Start in test mode** (allows open read/write for 30 days)
4. Select region: `asia-southeast2 (Jakarta)`

### Step 3: Get Config
1. In sidebar: **Project Settings** (gear icon)
2. Scroll to **Your apps** → click `</>` (Web)
3. Register app → copy the `firebaseConfig` object

### Step 4: Paste Config
Open `js/firebase.js` and replace:
```javascript
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",          // ← replace
  authDomain:        "YOUR_PROJECT_ID...",    // ← replace
  projectId:         "YOUR_PROJECT_ID",       // ← replace
  storageBucket:     "...",                   // ← replace
  messagingSenderId: "...",                   // ← replace
  appId:             "..."                    // ← replace
};
```

### Step 5: First Run — Seed Data Upload
1. Open `index.html` in browser
2. App detects empty Firestore → automatically uploads 2 months of data
3. Status bar turns green: **"Firebase Connected"**
4. Share the live URL with your lecturer!

---

## ☁️ Deploy to Vercel (Free)
1. Push folder to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import repo
3. Deploy (no build config needed — it's static HTML)
4. Share the `*.vercel.app` URL

## ☁️ Deploy to Netlify (Free)
1. Go to [netlify.com](https://netlify.com) → Add new site → Deploy manually
2. Drag and drop the `beka-pos-v3` folder
3. Done — get a `*.netlify.app` URL instantly

---

## 📊 System Features

| Module | Description |
|--------|-------------|
| **Dashboard** | Revenue, expenses, net profit, 7-day trend, top menu |
| **Sales Entry** | POS interface with real bé.ka menu, 4 channels, 3 payments |
| **Transaction Log** | Filter by date/channel/payment, export CSV |
| **Expense Entry** | COGS + fixed costs, auto journal preview |
| **Expense Log** | Filter by category/date, export CSV |
| **Cash Book** | Running balance, all inflows + outflows |
| **Reconciliation** | Compare system vs bank statement |
| **General Journal** | Double-entry bookkeeping, all transactions |
| **Daily Sales Report** | Per-day summary, channel breakdown, export |
| **Financial Report** | Full Income Statement: Revenue → COGS → Gross Profit → OpEx → Net Profit |

---

## 🧾 Accounting Logic
- **Sales:** Dr Cash-[QRIS/Debit/Transfer] | Cr Sales Revenue
- **COGS:** Dr Cost of Goods Sold | Cr Cash
- **Salary:** Dr Salary Expense | Cr Cash/Transfer
- **Rent:** Dr Rent Expense | Cr Cash/Transfer
- **Utilities:** Dr Utilities Expense | Cr Cash/Transfer

---

## 🍽️ Menu Categories (55 items)
- **Andalan** — Signature drinks (Kopi Susu Béka, Aren, etc.)
- **Klasik** — Classic coffee (Americano, Latte, Cappuccino, etc.)
- **Frappe** — Blended frappes (Vanilla, Matcha, Oreo, etc.)
- **Bukan Kopi** — Non-coffee (Matcha, Coklat, Earl Grey, etc.)
- **Frappucino** — Frappuccino variants
- **Slush** — Greentea slushes
- **Cemilan** — Desserts & snacks (Cheesecake, Brownies, Waffle, etc.)
- **Makanan** — Rice & food (Nasi Goreng, Chicken Karage, etc.)
