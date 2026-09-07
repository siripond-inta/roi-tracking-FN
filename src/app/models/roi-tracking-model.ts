// src/app/models/roi-tracking-model.ts
// ── Interfaces เท่านั้น — ไม่มี Mock Data ──────────────────────────────────
// ข้อมูลทั้งหมดดึงจาก Backend API ผ่าน ProjectService และ AuthService

export interface User {
  user_id: number;
  email: string;
  password_hash?: string; // optional เพราะ Backend ไม่ส่ง field นี้กลับมา
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
  project_type?: string;      // JOIN จาก project_types.type_name
  duration_months: number;
  initial_budget: number;
  created_at: Date;
  status?: 'Estimated' | 'Actual'; // คำนวณจาก project_ledger.phase ใน SQL
}

export interface Category {
  category_id: string;
  category_name: string;
  type_id: number;
}

export interface ProjectLedger {
  ledger_id: number;
  project_id: number;
  phase: 'Estimated' | 'Actual'; // ต้องเป็นหนึ่งในสองค่านี้เท่านั้น
  type_id: number;               // 1 = Expense, 2 = Revenue
  category_id: string;
  category_name?: string;        // JOIN จาก categories.category_name
  type_name?: string;            // JOIN จาก entry_types.type_name
  total_value: number;           // ยอดเงินรวม
  transaction_date: Date;
  note: string;
  created_at: Date;
}