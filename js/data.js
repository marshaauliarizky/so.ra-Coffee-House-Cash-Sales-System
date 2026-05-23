// ════════════════════════════════════════════
//   data.js — Real Menu 
// ════════════════════════════════════════════

// Real menu categories from bé.ka menu board
const cats = ['Andalan', 'Klasik', 'Frappe', 'Bukan Kopi', 'Frappucino', 'Slush', 'Cemilan', 'Makanan'];

const menu = [
  // ── ANDALAN (Signature) ──
  { id:1,  name:'Kopi Susu Béka',         cat:'Andalan',   price:27000 },
  { id:2,  name:'Kopi Susu Aren',          cat:'Andalan',   price:22000 },
  { id:3,  name:'Kopi Susu Manis',         cat:'Andalan',   price:22000 },
  { id:4,  name:'Kopi Susu Choco Crunch',  cat:'Andalan',   price:28000 },
  { id:5,  name:'Kopi Susu Pandan',        cat:'Andalan',   price:28000 },
  { id:6,  name:'Kopiteh Lemon',           cat:'Andalan',   price:28000 },
  { id:7,  name:'Orange Americano',        cat:'Andalan',   price:28000 },

  // ── KLASIK ──
  { id:8,  name:'Americano',               cat:'Klasik',    price:27000 },
  { id:9,  name:'Cafe Latte',              cat:'Klasik',    price:30000 },
  { id:10, name:'Cafe Latte (Beka Capp)',  cat:'Klasik',    price:30000 },
  { id:11, name:'Cappucino',               cat:'Klasik',    price:30000 },
  { id:12, name:'Flat White',             cat:'Klasik',    price:35000 },
  { id:13, name:'Piccolo',                cat:'Klasik',    price:30000 },
  { id:14, name:'Affogato',               cat:'Klasik',    price:32000 },
  { id:15, name:'Caramel Macchiato',      cat:'Klasik',    price:32000 },
  { id:16, name:'Espresso',              cat:'Klasik',    price:20000 },

  // ── FRAPPE ──
  { id:17, name:'Vanilla Frappe',         cat:'Frappe',    price:32000 },
  { id:18, name:'Hazelnut Frappe',        cat:'Frappe',    price:32000 },
  { id:19, name:'Chocolate Frappe',       cat:'Frappe',    price:32000 },
  { id:20, name:'Caramel Frappe',         cat:'Frappe',    price:39000 },
  { id:21, name:'Matcha Frappe',          cat:'Frappe',    price:39000 },
  { id:22, name:'Matcha Oreo Frappe',     cat:'Frappe',    price:45000 },
  { id:23, name:'Oreo Frappe',            cat:'Frappe',    price:32000 },

  // ── BUKAN KOPI (Non-Coffee) ──
  { id:24, name:'Coklat',                 cat:'Bukan Kopi',price:30000 },
  { id:25, name:'Matcha',                 cat:'Bukan Kopi',price:28000 },
  { id:26, name:'Blueberry Latte',        cat:'Bukan Kopi',price:28000 },
  { id:27, name:'Strawberry Latte',       cat:'Bukan Kopi',price:25000 },
  { id:28, name:'Earl Grey Milk Tea',     cat:'Bukan Kopi',price:25000 },
  { id:29, name:'Creamy Sunset',          cat:'Bukan Kopi',price:30000 },
  { id:30, name:'Summer Berry',           cat:'Bukan Kopi',price:34000 },
  { id:31, name:'Choco Berry',            cat:'Bukan Kopi',price:34000 },
  { id:32, name:'Milk Brown',             cat:'Bukan Kopi',price:20000 },
  { id:33, name:'Teh Klasik',             cat:'Bukan Kopi',price:18000 },

  // ── FRAPPUCINO ──
  { id:34, name:'Double Chips Frapp',     cat:'Frappucino', price:37000 },
  { id:35, name:'Caramel Chips Frapp',    cat:'Frappucino', price:32000 },
  { id:36, name:'Aren Frapp',             cat:'Frappucino', price:32000 },
  { id:37, name:'Caramel Chips Frapp 2',  cat:'Frappucino', price:37000 },

  // ── SLUSH ──
  { id:38, name:'Greentea Lemon',         cat:'Slush',      price:32000 },
  { id:39, name:'Greentea Strawberry',    cat:'Slush',      price:32000 },
  { id:40, name:'Greentea Blueberry',     cat:'Slush',      price:32000 },

  // ── CEMILAN (Snacks/Desserts) ──
  { id:41, name:'Pannacota',              cat:'Cemilan',    price:25000 },
  { id:42, name:'Tiramisu',               cat:'Cemilan',    price:25000 },
  { id:43, name:'Burnt Cheesecake',       cat:'Cemilan',    price:35000 },
  { id:44, name:'Cheesecake',             cat:'Cemilan',    price:30000 },
  { id:45, name:'Brownies',              cat:'Cemilan',    price:20000 },
  { id:46, name:'Donut Labu',            cat:'Cemilan',    price:8000  },
  { id:47, name:'Waffle',                cat:'Cemilan',    price:20000 },
  { id:48, name:'Sunday Waffle',         cat:'Cemilan',    price:20000 },
  { id:49, name:'French Fries',          cat:'Cemilan',    price:25000 },

  // ── MAKANAN (Food) ──
  { id:50, name:'Singkong Goreng',        cat:'Makanan',    price:25000 },
  { id:51, name:'Chicken Karage',         cat:'Makanan',    price:25000 },
  { id:52, name:'Nasi Goreng Ayam',       cat:'Makanan',    price:30000 },
  { id:53, name:'Nasi Goreng Hijau Teri', cat:'Makanan',    price:30000 },
  { id:54, name:'Nasi Ayam Karage',       cat:'Makanan',    price:30000 },
  { id:55, name:'Nasi Ayam Suwir Kremes', cat:'Makanan',    price:32000 },
];

// Account mapping for payment methods
const acctMap = {
  'QRIS':     'Cash — QRIS',
  'Debit':    'Cash — Debit Card',
  'Transfer': 'Cash — Bank Transfer',
};

// Badge color classes
const payColors = {
  'QRIS':     'bq',
  'Debit':    'bd',
  'Transfer': 'bt',
};

const chColors = {
  'Dine-in':   'ch-di',
  'GoFood':    'ch-gf',
  'GrabFood':  'ch-gr',
  'ShopeeFood':'ch-sh',
};

// Menu → ingredient BOM (per 1 serving) for inventory / COGS
const menuRecipes = {
  1:  [{ inv:'Coffee Beans', qty:0.02, unit:'kg' }, { inv:'Fresh Milk', qty:0.15, unit:'liter' }, { inv:'Sugar', qty:0.01, unit:'kg' }, { inv:'Cups (Hot)', qty:1, unit:'pcs' }],
  2:  [{ inv:'Coffee Beans', qty:0.02, unit:'kg' }, { inv:'Fresh Milk', qty:0.12, unit:'liter' }, { inv:'Cups (Hot)', qty:1, unit:'pcs' }],
  8:  [{ inv:'Coffee Beans', qty:0.02, unit:'kg' }, { inv:'Cups (Hot)', qty:1, unit:'pcs' }],
  9:  [{ inv:'Coffee Beans', qty:0.02, unit:'kg' }, { inv:'Fresh Milk', qty:0.18, unit:'liter' }, { inv:'Cups (Hot)', qty:1, unit:'pcs' }],
  17: [{ inv:'Coffee Beans', qty:0.015, unit:'kg' }, { inv:'Fresh Milk', qty:0.1, unit:'liter' }, { inv:'Whipped Cream', qty:0.1, unit:'can' }, { inv:'Cups (Cold)', qty:1, unit:'pcs' }],
  24: [{ inv:'Chocolate Powder', qty:0.03, unit:'kg' }, { inv:'Fresh Milk', qty:0.2, unit:'liter' }, { inv:'Cups (Hot)', qty:1, unit:'pcs' }],
  25: [{ inv:'Matcha Powder', qty:0.02, unit:'kg' }, { inv:'Fresh Milk', qty:0.2, unit:'liter' }, { inv:'Cups (Hot)', qty:1, unit:'pcs' }],
  43: [{ inv:'Sugar', qty:0.02, unit:'kg' }, { inv:'Paper Bags', qty:1, unit:'pcs' }],
  52: [{ inv:'Paper Bags', qty:1, unit:'pcs' }],
};

const DEFAULT_INV_UNIT_COST = 15000;

const INV_CATEGORY_HELP = {
  'Raw Material': 'Ingredients for drinks & food: coffee beans, fresh milk, sugar, syrups, chocolate/matcha powder, etc.',
  'Packaging': 'Serving & takeaway supplies: hot/cold cups, lids, paper bags, napkins, straws.',
  'Beverage Base': 'Pre-mixed or concentrated bases: bottled juices, tea concentrate, frappe bases.',
  'Other': 'Non-recipe items: cleaning supplies, utensils, equipment parts, misc. store supplies.',
};

// Expense account mapping
const expAcct = {
  'Cost of Goods Sold':    'Cost of Goods Sold',
  'Salary Expense':        'Salary Expense',
  'Rent Expense':          'Rent Expense',
  'Utilities Expense':     'Utilities Expense',
  'Marketing Expense':     'Marketing Expense',
  'Maintenance Expense':   'Maintenance & Equipment Expense',
  'Other Expense':         'Other Operating Expense'
};
