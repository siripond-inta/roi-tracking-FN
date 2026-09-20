// src/app/models/roi-tracking-model.ts
// ── Interfaces เท่านั้น — ไม่มี Mock Data ──────────────────────────────────
// ข้อมูลทั้งหมดดึงจาก Backend API ผ่าน ProjectService และ AuthService

export interface User {
  user_id: number;
  email: string;
  password_hash?: string;
  full_name: string;
  role: 'admin' | 'project_owner' | 'viewer';
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
  project_type?: string;
  custom_project_type?: string;  // ค่า text จาก "อื่นๆ"
  duration_months: number;
  initial_budget: number;
  target_roi_percent?: number | null; // เป้าหมาย ROI (%) ใช้ตัดสินสถานะคุ้มค่า/ไม่คุ้มค่า
  is_public?: boolean;           // สาธารณะ = true, ส่วนตัว = false
  created_at: Date;
  status?: 'Estimated' | 'Actual';
  owner_name?: string;           // ชื่อเจ้าของโปรเจกต์ — ใช้แสดงในหน้า Community
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
  period_index: number;          // งวด/เดือนที่ของรายการ (1..duration_months)
  type_id: number;               // 1 = Expense, 2 = Revenue
  category_id: string;
  category_name?: string;        // JOIN จาก categories.category_name
  category_group?: 'INV' | 'OPC' | 'ADC' | 'BEN';
  type_name?: string;            // JOIN จาก entry_types.type_name
  is_inflow?: boolean;
  unit_qty?: number | null;      // ประโยชน์ทางอ้อม: ปริมาณที่ลดได้ (ชม./ชุด/ครั้ง)
  unit_cost?: number | null;     // ประโยชน์ทางอ้อม: อัตราต่อหน่วย
  total_value: number;           // ยอดเงินรวม (= unit_qty × unit_cost ถ้าเป็นแบบปริมาณ)
  transaction_date: Date;
  note: string;
  created_at: Date;
}