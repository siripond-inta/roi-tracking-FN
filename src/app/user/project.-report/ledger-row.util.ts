// src/app/user/project.-report/ledger-row.util.ts
// ตรรกะของ "หนึ่งแถวในฟอร์มบันทึกรายรับ/รายจ่าย" ที่หน้า Estimated Report และ Actual Report
// ใช้ร่วมกัน — ต้องคำนวณเหมือนกันเป๊ะทั้งสองหน้า ไม่งั้นตัวเลขที่บันทึกจะไม่ตรงกัน

import { Category } from '../../services/category.service';

export interface LedgerRow {
  ledger_id?: number;
  category_id: string;
  period_index: number;        // FR03-2: งวด/เดือนที่ของรายการ (1..duration_months)
  total_value: number | null;  // ยอดเงิน (กรอกตรงๆ) — ถ้าเป็นหมวดแบบปริมาณจะคำนวณจาก qty × rate
  unit_qty: number | null;     // FR03-4: ปริมาณที่ลดได้ (ชม./ชุด/ครั้ง)
  unit_cost: number | null;    // FR03-4: อัตราต่อหน่วย
  note: string;
  type_id: number;             // 1=รายจ่าย, 2=รายรับ
}

// หมวดหมู่ที่ตีมูลค่าจาก "ปริมาณ × อัตรา" (ประโยชน์ทางอ้อม) — ดูจากว่ามีชื่อหน่วยกำกับไว้ไหม
export function isQtyBased(category?: Category): boolean {
  return !!category?.unit_label && !!category?.rate_label;
}

export function findCategory(categories: Category[], categoryId: string): Category | undefined {
  return categories.find((c) => c.category_id === categoryId);
}

// ยอดของแถว: หมวดแบบปริมาณคิดจาก qty × rate เสมอ (ผู้ใช้ไม่ต้องคูณเอง) นอกนั้นใช้ยอดที่กรอก
export function rowTotal(row: LedgerRow, categories: Category[]): number {
  const category = findCategory(categories, row.category_id);
  if (isQtyBased(category)) {
    const qty = Number(row.unit_qty) || 0;
    const cost = Number(row.unit_cost) || 0;
    // แถวที่บันทึกเป็นยอดเงินตรงๆ ไว้ก่อนที่หมวดนี้จะถูกเปลี่ยนเป็นแบบ "ปริมาณ × อัตรา"
    // จะไม่มี qty/rate ติดมาด้วย — ถ้าคิดเป็น 0 × 0 ยอดเดิมจะหายไปทันทีที่กดบันทึก
    // จึงคงยอดเดิมไว้จนกว่าผู้ใช้จะกรอกปริมาณหรืออัตราเอง
    if (qty === 0 && cost === 0) return Number(row.total_value) || 0;
    return qty * cost;
  }
  return Number(row.total_value) || 0;
}

export function sumRows(rows: LedgerRow[], categories: Category[]): number {
  return rows.reduce((sum, r) => sum + rowTotal(r, categories), 0);
}

// FR03-2: วันที่ของรายการอิงจากงวดที่เลือก (เดือนเริ่มโครงการ + งวด - 1) — ผู้ใช้เลือกแค่เดือน
// ไม่ต้องกรอกวันที่เอง ทำให้วันที่กับงวดตรงกันเสมอ
export function periodToDate(projectCreatedAt: Date | string | undefined, period: number): string {
  const start = projectCreatedAt ? new Date(projectCreatedAt) : new Date();
  const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 15));
  d.setUTCMonth(d.getUTCMonth() + (Math.max(1, period) - 1));
  return d.toISOString().split('T')[0];
}

// รายชื่องวดสำหรับ dropdown — [1..durationMonths]
export function periodOptions(durationMonths: number | undefined): number[] {
  const count = Math.max(1, Number(durationMonths) || 12);
  return Array.from({ length: count }, (_, i) => i + 1);
}

// แปลงแถวในฟอร์มเป็น payload ที่ส่งให้ API (คำนวณ total ให้เรียบร้อยก่อนส่ง)
export function toPayload(row: LedgerRow, categories: Category[], projectCreatedAt: Date | string | undefined) {
  const category = findCategory(categories, row.category_id);
  // ส่ง qty/rate ไปเฉพาะเมื่อผู้ใช้กรอกจริง — แถวที่ยังถือยอดเงินแบบเดิมอยู่ (ดู rowTotal)
  // ต้องไม่ถูกบันทึกทับเป็น 0 × 0 ไม่งั้นยอดจะหายตอนเปิดแก้ไขรอบถัดไป
  const hasQtyInput = isQtyBased(category) && (Number(row.unit_qty) > 0 || Number(row.unit_cost) > 0);
  return {
    period_index: row.period_index,
    type_id: row.type_id,
    category_id: row.category_id,
    unit_qty: hasQtyInput ? Number(row.unit_qty) || 0 : null,
    unit_cost: hasQtyInput ? Number(row.unit_cost) || 0 : null,
    total_value: rowTotal(row, categories),
    note: row.note || '',
    transaction_date: periodToDate(projectCreatedAt, row.period_index),
  };
}
