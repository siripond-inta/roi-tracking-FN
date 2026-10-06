// src/app/user/project.-report/ledger-row.util.ts
// ตรรกะของ "หนึ่งรายการในฟอร์มบันทึกผลประโยชน์/ต้นทุน" ที่หน้า Estimated Report และ Actual Report
// ใช้ร่วมกัน
//
// หนึ่งรายการ = ค่าเดียวกันทุกเดือนในช่วง period_from..period_to เช่น "ลดเวลาทำงานได้ 80 ชม./เดือน
// × ฿250 ตั้งแต่เดือน 2 ถึง 12" — backend กระจายเป็นแถวรายเดือนเอง (รวมถึงวันที่และประเภท
// รายรับ/รายจ่าย) ตอนแสดงผลก็รวมแถวรายเดือนที่ต่อเนื่องและค่าเหมือนกันกลับเป็นรายการเดียว
//
// ไฟล์นี้คำนวณแค่ "มูลค่าของรายการที่กำลังกรอก" (ปริมาณ × อัตรา × จำนวนเดือน) ให้ผู้ใช้เห็นทันที
// ส่วน ROI / ระยะคืนทุน / การนับตามประเภทโครงการ มาจาก backend เท่านั้น

import { Category } from '../../services/category.service';
import { LedgerInput } from '../../services/project.service';
import { ProjectLedger } from '../../models/roi-tracking-model';
import { BenefitSource } from '../../services/analytics.service';

// ค่าตามแผน (Estimated) ของรายการเดียวกัน — ใช้เป็น placeholder ตอนกรอกผลจริง
export interface PlanValues {
  total_value: number | null;
  unit_qty: number | null;
  unit_cost: number | null;
  period_from: number;
  period_to: number;
}

export interface LedgerRow {
  category_id: string;
  custom_name: string;         // ชื่อรายการ เมื่อเลือกหมวด "อื่นๆ"
  period_from: number;
  period_to: number;
  repeat: boolean;             // true = ทุกเดือนในช่วง, false = เดือนเดียว (period_from = period_to)
  total_value: number | null;  // ยอดเงินต่อเดือน (หมวดรายได้โดยตรง/ต้นทุน)
  unit_qty: number | null;     // ประโยชน์ทางอ้อม: ปริมาณที่ลดได้ต่อเดือน (ชม./ชุด/ครั้ง)
  unit_cost: number | null;    // ประโยชน์ทางอ้อม: อัตราต่อหน่วย (บาท)
  note: string;
  plan?: PlanValues;           // มีเฉพาะตอนกรอกผลจริง — ไม่ถูกส่งไปบันทึก
}

export type LedgerRowsBySource = Record<BenefitSource, LedgerRow[]>;

export const SOURCE_ORDER: BenefitSource[] = ['direct', 'indirect', 'cost'];

export function sourceOfGroup(group: string | undefined, isInflow?: boolean): BenefitSource {
  if (group === 'REV') return 'direct';
  if (group === 'BEN') return 'indirect';
  if (group === 'INV' || group === 'OPC' || group === 'ADC') return 'cost';
  return isInflow ? 'direct' : 'cost';
}

export function categoriesForSource(categories: Category[], source: BenefitSource): Category[] {
  return categories.filter((c) => sourceOfGroup(c.category_group, c.is_inflow) === source);
}

// หมวดที่ตีมูลค่าจาก "ปริมาณ × อัตรา" (ประโยชน์ทางอ้อม) — ดูจากว่ามีชื่อหน่วยกำกับไว้ไหม
export function isQtyBased(category?: Category): boolean {
  return !!category?.unit_label && !!category?.rate_label;
}

export function findCategory(categories: Category[], categoryId: string): Category | undefined {
  return categories.find((c) => c.category_id === categoryId);
}

// ชื่อที่แสดงของรายการ: หมวด "อื่นๆ" ใช้ชื่อที่ผู้ใช้พิมพ์
export function rowName(row: Pick<LedgerRow, 'category_id' | 'custom_name'>, categories: Category[]): string {
  if (row.custom_name) return row.custom_name;
  return findCategory(categories, row.category_id)?.category_name || row.category_id;
}

function hasQtyInput(row: LedgerRow): boolean {
  return row.unit_qty != null || row.unit_cost != null;
}

// มูลค่าต่อเดือนของรายการ: หมวดแบบปริมาณคิดจาก qty × rate (ผู้ใช้ไม่ต้องคูณเอง)
// แถวเก่าที่บันทึกเป็นยอดเงินไว้ก่อนหมวดจะถูกตั้งหน่วย ไม่มี qty/rate — คงยอดเดิมไว้
export function monthlyValue(row: LedgerRow, categories: Category[]): number {
  if (isQtyBased(findCategory(categories, row.category_id)) && hasQtyInput(row)) {
    return (Number(row.unit_qty) || 0) * (Number(row.unit_cost) || 0);
  }
  return Number(row.total_value) || 0;
}

export function planMonthlyValue(plan: PlanValues): number {
  if (plan.unit_qty != null && plan.unit_cost != null) return plan.unit_qty * plan.unit_cost;
  return Number(plan.total_value) || 0;
}

export function monthCount(row: Pick<LedgerRow, 'period_from' | 'period_to'>): number {
  const from = Number(row.period_from) || 1;
  const to = Number(row.period_to) || from;
  return Math.max(0, to - from + 1);
}

export function rowTotal(row: LedgerRow, categories: Category[]): number {
  return monthlyValue(row, categories) * monthCount(row);
}

export function sumRows(rows: LedgerRow[], categories: Category[]): number {
  return rows.reduce((sum, r) => sum + rowTotal(r, categories), 0);
}

// รายชื่อเดือนสำหรับ dropdown — [1..durationMonths]
export function periodOptions(durationMonths: number | undefined): number[] {
  const count = Math.max(1, Number(durationMonths) || 12);
  return Array.from({ length: count }, (_, i) => i + 1);
}

// ชื่อเดือนตามปฏิทินของเดือนที่ N ของโครงการ เช่น "ธ.ค. 69" — ให้ผู้ใช้เห็นว่าเดือนที่ 3 คือเดือนไหน
const monthFormatter = new Intl.DateTimeFormat('th-TH', { month: 'short', year: '2-digit' });

export function calendarMonth(projectStart: Date | string | undefined, period: number): string {
  const start = projectStart ? new Date(projectStart) : new Date();
  const d = new Date(start.getFullYear(), start.getMonth() + (Math.max(1, period) - 1), 1);
  return monthFormatter.format(d);
}

// "เดือนที่ 3 (ธ.ค. 69)" หรือ "ทุกเดือน: เดือนที่ 2–12 (พ.ย. 69 – ก.ย. 70)"
export function periodLabel(row: Pick<LedgerRow, 'period_from' | 'period_to'>, projectStart?: Date | string): string {
  const from = Number(row.period_from) || 1;
  const to = Number(row.period_to) || from;
  if (from === to) {
    return `เดือนที่ ${from}` + (projectStart ? ` (${calendarMonth(projectStart, from)})` : '');
  }
  return `ทุกเดือน: เดือนที่ ${from}–${to}` +
    (projectStart ? ` (${calendarMonth(projectStart, from)} – ${calendarMonth(projectStart, to)})` : '');
}

export function blankRow(categoryId: string, durationMonths: number): LedgerRow {
  const months = Math.max(1, durationMonths);
  return {
    category_id: categoryId,
    custom_name: '',
    period_from: 1,
    period_to: months,
    repeat: months > 1,
    total_value: null,
    unit_qty: null,
    unit_cost: null,
    note: '',
  };
}

// คีย์ที่ใช้จับคู่ "รายการเดียวกัน" ระหว่างแผนกับผลจริง: หมวด + ชื่อรายการ (หมวด "อื่นๆ")
export function itemKey(row: Pick<LedgerRow, 'category_id' | 'custom_name'>): string {
  return `${row.category_id}|${row.custom_name || ''}`;
}

// รวมแถวรายเดือนจาก database กลับเป็นรายการแบบช่วงเดือน: หมวด/ชื่อ/หมายเหตุ/ปริมาณ/อัตรา/ยอด
// เดียวกัน และเดือนต่อเนื่องกัน → รายการเดียว
export function groupLedgers(ledgers: ProjectLedger[]): LedgerRow[] {
  const key = (l: ProjectLedger) =>
    [l.category_id, l.custom_name || '', l.note || '', l.unit_qty ?? '', l.unit_cost ?? '', Number(l.total_value)].join('|');

  const sorted = [...ledgers].sort(
    (a, b) => key(a).localeCompare(key(b)) || Number(a.period_index) - Number(b.period_index)
  );

  const rows: LedgerRow[] = [];
  let lastKey = '';
  for (const l of sorted) {
    const period = Number(l.period_index) || 1;
    const k = key(l);
    const prev = rows[rows.length - 1];
    if (prev && k === lastKey && period === prev.period_to + 1) {
      prev.period_to = period;
      prev.repeat = true;
      continue;
    }
    const qtyBased = l.unit_qty != null && l.unit_cost != null;
    rows.push({
      category_id: String(l.category_id),
      custom_name: l.custom_name || '',
      period_from: period,
      period_to: period,
      repeat: false,
      total_value: qtyBased ? null : Number(l.total_value) || 0,
      unit_qty: qtyBased ? Number(l.unit_qty) : null,
      unit_cost: qtyBased ? Number(l.unit_cost) : null,
      note: l.note || '',
    });
    lastKey = k;
  }

  // เรียงตามเดือนเริ่ม แล้วตามหมวด ให้อ่านตามลำดับเวลา
  return rows.sort(
    (a, b) => a.period_from - b.period_from || a.category_id.localeCompare(b.category_id)
  );
}

export function splitBySource(rows: LedgerRow[], categories: Category[]): LedgerRowsBySource {
  const out: LedgerRowsBySource = { direct: [], indirect: [], cost: [] };
  for (const r of rows) {
    const c = findCategory(categories, r.category_id);
    out[sourceOfGroup(c?.category_group, c?.is_inflow)].push(r);
  }
  return out;
}

export function toPlan(row: LedgerRow): PlanValues {
  return {
    total_value: row.total_value,
    unit_qty: row.unit_qty,
    unit_cost: row.unit_cost,
    period_from: row.period_from,
    period_to: row.period_to,
  };
}

// แปลงรายการในฟอร์มเป็น payload ของ API — ส่งเฉพาะข้อมูลที่ผู้ใช้กรอก backend คำนวณ/ตรวจที่เหลือ
export function toLedgerInput(row: LedgerRow, categories: Category[]): LedgerInput {
  const category = findCategory(categories, row.category_id);
  const qty = isQtyBased(category) && hasQtyInput(row);
  const from = Number(row.period_from) || 1;
  return {
    category_id: row.category_id,
    custom_name: category?.allow_custom_name ? (row.custom_name || '').trim() : null,
    period_from: from,
    period_to: row.repeat ? Number(row.period_to) || from : from,
    unit_qty: qty ? (row.unit_qty ?? null) : null,
    unit_cost: qty ? (row.unit_cost ?? null) : null,
    total_value: qty ? null : Number(row.total_value) || 0,
    note: row.note || '',
  };
}

// รายการที่มีข้อมูลจริง — แถวว่าง (ยอด 0 และไม่ได้กรอกปริมาณ/อัตรา) ไม่ต้องส่งไปบันทึก
// แต่แถวที่กรอกปริมาณหรืออัตราไว้แค่ช่องเดียวต้องส่งไป ให้ backend แจ้งว่ากรอกไม่ครบ
// ค่าติดลบก็ต้องส่งไป ให้ backend แจ้งว่าไม่ถูกต้อง (เดิมถูกตัดทิ้งเงียบๆ แล้วรายการหายตอนบันทึก)
export function isFilled(row: LedgerRow, categories: Category[]): boolean {
  if (!row.category_id) return false;
  if (isQtyBased(findCategory(categories, row.category_id)) && hasQtyInput(row)) {
    return (Number(row.unit_qty) || 0) !== 0 || (Number(row.unit_cost) || 0) !== 0;
  }
  return (Number(row.total_value) || 0) !== 0;
}

// แถวที่มีค่าติดลบ — ใช้ไฮไลต์ช่องกรอกให้ผู้ใช้เห็นทันที
export function hasNegative(row: LedgerRow): boolean {
  return [row.total_value, row.unit_qty, row.unit_cost].some((v) => v != null && Number(v) < 0);
}
