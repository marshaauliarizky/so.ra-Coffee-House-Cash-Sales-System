// ════════════════════════════════════════════
//   seedGenerator.js
//   Generates 2 months of realistic data
//   ~180 transactions/day average
// ════════════════════════════════════════════

const SEED_DATA = (() => {
  // ── HELPERS ──
  function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function weightedPick(arr, weights) {
    const total = weights.reduce((a,b) => a+b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i]; }
    return arr[arr.length-1];
  }
  function fmtDateID(d) {
    return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'});
  }
  function fmtFullID(d) {
    return d.toLocaleString('id-ID',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }

  // ── CHANNELS & PAYMENT WEIGHTS ──
  const channels  = ['Dine-in','GoFood','GrabFood','ShopeeFood'];
  const chWeights = [55, 25, 12, 8]; // Dine-in dominant
  const payments  = ['QRIS','Debit','Transfer'];
  const payWeights= [65, 25, 10];

  // ── POPULAR ITEMS by category ──
  // Popular coffee (Andalan + Klasik)
  const popularCoffee = [1,2,3,4,5,8,9,11,12,14,15];
  // Popular non-coffee
  const popularNC     = [24,25,26,27,28,29];
  // Popular frappe/frapp
  const popularFrappe = [17,18,19,20,21,22,23,34,35,36];
  // Popular slush
  const popularSlush  = [38,39,40];
  // Snacks
  const popularSnacks = [41,42,43,44,45,47,48,49];
  // Food
  const popularFood   = [50,51,52,53,54,55];

  // Weights for order composition
  const itemPools = [
    { pool: popularCoffee, weight: 50 },
    { pool: popularNC,     weight: 20 },
    { pool: popularFrappe, weight: 15 },
    { pool: popularSlush,  weight: 5  },
    { pool: popularSnacks, weight: 7  },
    { pool: popularFood,   weight: 3  },
  ];

  function randomItems() {
    const numItems = weightedPick([1,2,3,4],[45,35,15,5]);
    const items = [];
    const used = new Set();
    for (let i = 0; i < numItems; i++) {
      const poolEntry = weightedPick(itemPools, itemPools.map(p=>p.weight));
      const menuId = pick(poolEntry.pool);
      if (used.has(menuId)) { continue; }
      used.add(menuId);
      const m = menu.find(x => x.id === menuId);
      if (m) items.push({...m, qty: weightedPick([1,2,3],[70,25,5])});
    }
    if (items.length === 0) {
      const m = menu.find(x => x.id === pick(popularCoffee));
      items.push({...m, qty:1});
    }
    return items;
  }

  function tableOrRef(ch, i) {
    if (ch === 'Dine-in') return pick(['Table 1','Table 2','Table 3','Table 4','Table 5','Table 6','Walk-in','Counter']);
    if (ch === 'GoFood')  return `GoFood #GF-${String(i).padStart(4,'0')}`;
    if (ch === 'GrabFood') return `GrabFood #GR-${String(i).padStart(4,'0')}`;
    return `ShopeeFood #SF-${String(i).padStart(4,'0')}`;
  }

  // ── GENERATE TRANSACTIONS ──
  const transactions = [];
  let txId = 1;

  // 2 months = ~60 days back to yesterday
  for (let daysBack = 60; daysBack >= 0; daysBack--) {
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() - daysBack);
    const isWeekend = baseDate.getDay() === 0 || baseDate.getDay() === 6;
    const isToday = daysBack === 0;

    // ~180 tx/day; weekends busier; today partial
    let targetTx = isWeekend ? rnd(200, 240) : rnd(160, 200);
    if (isToday) targetTx = rnd(8, 18); // partial day

    // Spread across operating hours 07:00–21:00
    // Morning rush 07-10, lunch 11-13, afternoon 14-17, evening 18-21
    const hourWeights = [
      3,3,5,8,7,6,   // 07-12
      9,8,6,5,7,8,7,5,4  // 13-21
    ];
    const hours = [7,8,9,10,11,12,13,14,15,16,17,18,19,20,21];

    for (let t = 0; t < targetTx; t++) {
      const h = weightedPick(hours, hourWeights);
      const m = rnd(0, 59);
      const txDate = new Date(baseDate);
      txDate.setHours(h, m, rnd(0,59));

      const ch  = weightedPick(channels,  chWeights);
      const pay = weightedPick(payments,  payWeights);
      const items = randomItems();
      const total = items.reduce((s,i) => s + i.price * i.qty, 0);

      transactions.push({
        id:       txId++,
        fullTime: fmtFullID(txDate),
        date:     fmtDateID(txDate),
        _ts:      txDate.getTime(),
        customer: tableOrRef(ch, txId),
        channel:  ch,
        items,
        payment:  pay,
        total,
      });
    }
  }

  // Sort chronologically
  transactions.sort((a,b) => a._ts - b._ts);
  // Re-assign sequential IDs after sort
  transactions.forEach((t,i) => t.id = i+1);

  // ── GENERATE EXPENSES ──
  // Fixed costs monthly; Variable (COGS) daily
  const expenses = [];
  let expId = 1;

  function mkExp(daysBack, h, mi, cat, desc, amount, pay) {
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    d.setHours(h, mi, 0);
    return {
      id: expId++,
      fullTime: fmtFullID(d),
      date:     fmtDateID(d),
      _ts:      d.getTime(),
      category: cat, description: desc, amount, payment: pay
    };
  }

  for (let daysBack = 60; daysBack >= 0; daysBack--) {
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    const dom = d.getDate(); // day of month
    const isToday = daysBack === 0;

    // ── Daily COGS ──
    if (!isToday) {
      // Coffee beans & ingredients
      expenses.push(mkExp(daysBack, 7, 30, 'Cost of Goods Sold',
        'Coffee beans, milk, syrups — daily stock', rnd(350000,500000), 'Transfer'));
      // Packaging (cups, straws, bags)
      expenses.push(mkExp(daysBack, 8, 0, 'Cost of Goods Sold',
        'Cups, straws, lids, paper bags', rnd(80000,140000), 'Cash'));
      // Food ingredients (random days)
      if (rnd(1,3) <= 2) {
        expenses.push(mkExp(daysBack, 8, 30, 'Cost of Goods Sold',
          'Food ingredients — waffle, cheesecake, snacks', rnd(100000,200000), 'Cash'));
      }
    } else {
      // Today partial COGS
      expenses.push(mkExp(0, 7, 30, 'Cost of Goods Sold',
        'Coffee beans, milk, syrups — daily stock', rnd(350000,500000), 'Transfer'));
      expenses.push(mkExp(0, 8, 0, 'Cost of Goods Sold',
        'Cups, straws, lids, paper bags', rnd(80000,120000), 'Cash'));
    }

    // ── Weekly Salary (every 7 days) ──
    if (dom === 1 || dom === 8 || dom === 15 || dom === 22) {
      expenses.push(mkExp(daysBack, 9, 0, 'Salary Expense',
        'Weekly salary — 2 barista + 1 cashier staff', 2100000, 'Transfer'));
    }

    // ── Monthly Rent (1st of month) ──
    if (dom === 1) {
      expenses.push(mkExp(daysBack, 9, 30, 'Rent Expense',
        'Monthly rent — Ruko Citywalk Sudirman', 8500000, 'Transfer'));
    }

    // ── Monthly Utilities ──
    if (dom === 5) {
      expenses.push(mkExp(daysBack, 10, 0, 'Utilities Expense',
        'Monthly electricity bill PLN', rnd(800000,1100000), 'Transfer'));
    }
    if (dom === 5) {
      expenses.push(mkExp(daysBack, 10, 30, 'Utilities Expense',
        'WiFi & streaming — IndiHome monthly', 350000, 'Transfer'));
    }
    // Water bill every month
    if (dom === 10) {
      expenses.push(mkExp(daysBack, 11, 0, 'Utilities Expense',
        'Water utility bill PDAM', rnd(150000,250000), 'Transfer'));
    }

    // ── Marketing (GrabFood/GoFood boosts, random weeks) ──
    if (dom === 3 || dom === 17) {
      expenses.push(mkExp(daysBack, 11, 0, 'Marketing Expense',
        'GoFood & GrabFood promotion campaign', rnd(200000,350000), 'Transfer'));
    }
    if (dom === 10 || dom === 24) {
      expenses.push(mkExp(daysBack, 11, 30, 'Marketing Expense',
        'Social media ads & influencer content', rnd(150000,300000), 'Transfer'));
    }

    // ── Maintenance (occasional) ──
    if (dom === 15) {
      expenses.push(mkExp(daysBack, 14, 0, 'Maintenance Expense',
        'Espresso machine service & cleaning', rnd(200000,400000), 'Cash'));
    }
    if (dom === 28) {
      expenses.push(mkExp(daysBack, 15, 0, 'Maintenance Expense',
        'AC servicing & equipment check', rnd(150000,300000), 'Cash'));
    }
  }

  // Sort expenses chronologically
  expenses.sort((a,b) => a._ts - b._ts);
  expenses.forEach((e,i) => e.id = i+1);

  return { transactions, expenses };
})();

// Expose as globals
const SEED_TRANSACTIONS = SEED_DATA.transactions;
const SEED_EXPENSES     = SEED_DATA.expenses;
