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

export interface LedgerRow {
  category_id: string;
  period_from: number;
  period_to: number;
  total_value: number | null;  // ยอดเงินต่อเดือน (หมวดรายได้โดยตรง/ต้นทุน)
  unit_qty: number | null;     // ประโยชน์ทางอ้อม: ปริมาณที่ลดได้ต่อเดือน (ชม./ชุด/ครั้ง)
  unit_cost: number | null;    // ประโยชน์ทางอ้อม: อัตราต่อหน่วย (บาท)
  note: string;
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

export function monthCount(row: LedgerRow): number {
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

export function periodLabel(row: Pick<LedgerRow, 'period_from' | 'period_to'>): string {
  return row.period_from === row.period_to
    ? `เดือนที่ ${row.period_from}`
    : `เดือนที่ ${row.period_from}–${row.period_to}`;
}

export function blankRow(categoryId: string, durationMonths: number): LedgerRow {
  return {
    category_id: categoryId,
    period_from: 1,
    period_to: Math.max(1, durationMonths),
    total_value: null,
    unit_qty: null,
    unit_cost: null,
    note: '',
  };
}

// รวมแถวรายเดือนจาก database กลับเป็นรายการแบบช่วงเดือน: หมวด/หมายเหตุ/ปริมาณ/อัตรา/ยอดเดียวกัน
// และเดือนต่อเนื่องกัน → รายการเดียว
export function groupLedgers(ledgers: ProjectLedger[]): LedgerRow[] {
  const key = (l: ProjectLedger) =>
    [l.category_id, l.note || '', l.unit_qty ?? '', l.unit_cost ?? '', Number(l.total_value)].join('|');

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
      continue;
    }
    const qtyBased = l.unit_qty != null && l.unit_cost != null;
    rows.push({
      category_id: String(l.category_id),
      period_from: period,
      period_to: period,
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

// แปลงรายการในฟอร์มเป็น payload ของ API — ส่งเฉพาะข้อมูลที่ผู้ใช้กรอก backend คำนวณ/ตรวจที่เหลือ
export function toLedgerInput(row: LedgerRow, categories: Category[]): LedgerInput {
  const qty = isQtyBased(findCategory(categories, row.category_id)) && hasQtyInput(row);
  return {
    category_id: row.category_id,
    period_from: Number(row.period_from) || 1,
    period_to: Number(row.period_to) || Number(row.period_from) || 1,
    unit_qty: qty ? (row.unit_qty ?? null) : null,
    unit_cost: qty ? (row.unit_cost ?? null) : null,
    total_value: qty ? null : Number(row.total_value) || 0,
    note: row.note || '',
  };
}

// รายการที่มีข้อมูลจริง — แถวว่าง (ยอด 0 และไม่ได้กรอกปริมาณ/อัตรา) ไม่ต้องส่งไปบันทึก
// แต่แถวที่กรอกปริมาณหรืออัตราไว้แค่ช่องเดียวต้องส่งไป ให้ backend แจ้งว่ากรอกไม่ครบ
export function isFilled(row: LedgerRow, categories: Category[]): boolean {
  if (!row.category_id) return false;
  if (isQtyBased(findCategory(categories, row.category_id)) && hasQtyInput(row)) {
    return (Number(row.unit_qty) || 0) > 0 || (Number(row.unit_cost) || 0) > 0;
  }
  return (Number(row.total_value) || 0) > 0;
}
