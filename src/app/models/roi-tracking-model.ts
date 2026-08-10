// src/app/models/roi-tracking-model.ts

export interface User {
  user_id: number;
  email: string;
  password_hash?: string;
  full_name: string;
  role: 'admin' | 'user';
  created_at: Date;
}

export interface ProjectType {
  type_id: number;
  type_name: string;
  description: string;
}

export interface EntryType {
  type_id: number;
  type_name: string;
  description: string;
}

export interface Project {
  project_id: number;
  user_id: number;
  project_name: string;
  project_type_id: number;
  duration_months: number;
  initial_budget: number;
  created_at: Date;
  status?: 'Estimated' | 'Actual';
}

export interface Category {
  category_id: string;
  category_name: string;
  type_id: number;
}

export interface ProjectLedger {
  ledger_id: number;
  project_id: number;
  phase: string;
  type_id: number; // 1 = Expense, 2 = Revenue
  category_id: string;
  category_name?: string;
  type_name?: string;
  amount_base: number;
  unit_qty: number;
  unit_cost: number;
  total_value: number;
  transaction_date: Date;
  note: string;
  created_at: Date;
}

// --- MOCK DATA ---

export const MOCK_ENTRY_TYPES: EntryType[] = [
  { type_id: 1, type_name: 'Expense', description: 'Project Costs and Expenses' },
  { type_id: 2, type_name: 'Revenue', description: 'Project Returns and Revenues' }
];

// แก้ไข: ลบ entry project_id: 101 ที่ซ้ำออก (เดิมมี 2 rows ให้ project เดียว)
// โปรเจกต์ 101 มีข้อมูล Actual แล้ว (ใน MOCK_LEDGER) จึงตั้ง status เป็น 'Actual'
export const MOCK_PROJECTS: Project[] = [
  {
    project_id: 101,
    user_id: 1,
    project_name: 'E-Commerce Platform Expansion',
    project_type_id: 1,
    duration_months: 12,
    initial_budget: 500000.00,
    created_at: new Date('2026-04-01'),
    status: 'Actual' // มีข้อมูลจริงแล้ว (ledger_id >= 100 ใน MOCK_LEDGER)
  },
  {
    project_id: 102,
    user_id: 1,
    project_name: 'AI Customer Service Chatbot',
    project_type_id: 1,
    duration_months: 6,
    initial_budget: 150000.00,
    created_at: new Date('2026-04-15'),
    status: 'Estimated'
  },
  {
    project_id: 103,
    user_id: 1,
    project_name: 'Social Media Marketing Campaign',
    project_type_id: 1,
    duration_months: 3,
    initial_budget: 200000.00,
    created_at: new Date('2026-04-20'),
    status: 'Estimated'
  },
];

export const MOCK_CATEGORIES: Category[] = [
  { category_id: 'CAT001', category_name: 'Hardware', type_id: 1 },
  { category_id: 'CAT002', category_name: 'Labor', type_id: 1 },
  { category_id: 'CAT003', category_name: 'Software License', type_id: 1 },
  { category_id: 'REV001', category_name: 'Sales Revenue', type_id: 2 },
  { category_id: 'REV002', category_name: 'Cost Savings', type_id: 2 }
];

export const MOCK_LEDGER: ProjectLedger[] = [
  // --- Project 101: Estimated Ledger (ledger_id < 100) ---
  {
    ledger_id: 1,
    project_id: 101,
    phase: 'Implementation',
    type_id: 1, // Expense
    category_id: 'CAT002',
    amount_base: 150000,
    unit_qty: 1,
    unit_cost: 150000,
    total_value: 150000,
    transaction_date: new Date('2026-04-10'),
    note: 'Software License & API',
    created_at: new Date()
  },
  {
    ledger_id: 2,
    project_id: 101,
    phase: 'Operation',
    type_id: 2, // Revenue
    category_id: 'REV001',
    amount_base: 4500000,
    unit_qty: 1,
    unit_cost: 4500000,
    total_value: 4500000,
    transaction_date: new Date('2026-06-01'),
    note: 'Q1 Sales Projection',
    created_at: new Date()
  },

  // --- Project 101: Actual Ledger (ledger_id >= 100) ---
  {
    ledger_id: 101,
    project_id: 101,
    phase: 'Implementation',
    type_id: 1, // Expense จริง
    category_id: 'CAT002',
    amount_base: 175000,
    unit_qty: 1,
    unit_cost: 175000,
    total_value: 175000,
    transaction_date: new Date('2026-04-12'),
    note: '(Actual) Final Invoice from Vendor',
    created_at: new Date()
  },
  {
    ledger_id: 102,
    project_id: 101,
    phase: 'Operation',
    type_id: 2, // Revenue จริง
    category_id: 'REV001',
    amount_base: 4000000,
    unit_qty: 1,
    unit_cost: 4000000,
    total_value: 4000000,
    transaction_date: new Date('2026-06-15'),
    note: '(Actual) Q1 Realized Sales',
    created_at: new Date()
  },

  // --- Project 102 (AI Chatbot) ---
  {
    ledger_id: 3,
    project_id: 102,
    phase: 'Implementation',
    type_id: 1,
    category_id: 'CAT003',
    amount_base: 50000,
    unit_qty: 1,
    unit_cost: 50000,
    total_value: 50000,
    transaction_date: new Date('2026-04-20'),
    note: 'Server Cost & GPU',
    created_at: new Date()
  },
  {
    ledger_id: 4,
    project_id: 102,
    phase: 'Operation',
    type_id: 2,
    category_id: 'REV002',
    amount_base: 120000,
    unit_qty: 1,
    unit_cost: 120000,
    total_value: 120000,
    transaction_date: new Date('2026-05-15'),
    note: 'Cost saved from support reduction',
    created_at: new Date()
  },

  // --- Project 103 (Marketing) ---
  {
    ledger_id: 5,
    project_id: 103,
    phase: 'Launch',
    type_id: 1,
    category_id: 'CAT001',
    amount_base: 80000,
    unit_qty: 1,
    unit_cost: 80000,
    total_value: 80000,
    transaction_date: new Date('2026-04-25'),
    note: 'Influencer Hiring',
    created_at: new Date()
  },
  {
    ledger_id: 6,
    project_id: 103,
    phase: 'Operation',
    type_id: 2,
    category_id: 'REV001',
    amount_base: 300000,
    unit_qty: 1,
    unit_cost: 300000,
    total_value: 300000,
    transaction_date: new Date('2026-05-20'),
    note: 'Direct Sales from Ads',
    created_at: new Date()
  }
];