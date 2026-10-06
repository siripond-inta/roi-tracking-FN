// ส่วนประกอบที่หน้า Estimated Report และ Actual Report ใช้ร่วมกัน:
//   LedgerSectionEditor — ฟอร์มกรอกรายการของหนึ่งส่วน (รายได้โดยตรง / ประโยชน์ทางอ้อม / ต้นทุน)
//   LedgerSectionView   — ตารางแสดงรายการของหนึ่งส่วน (ส่วนประโยชน์ทางอ้อมแสดงตารางแจกแจง
//                         ปริมาณ × อัตรา ที่ใช้ในรายงาน PDF ด้วย)
//   BenefitSummary      — สรุปองค์ประกอบของผลประโยชน์ตามประเภทโครงการ

import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Category } from '../../../services/category.service';
import { BenefitSource, PhaseSummary } from '../../../services/analytics.service';
import { BahtPipe } from './baht.pipe';
import {
  LedgerRow,
  blankRow,
  calendarMonth,
  categoriesForSource,
  findCategory,
  isQtyBased,
  monthCount,
  monthlyValue,
  periodLabel,
  periodOptions,
  planMonthlyValue,
  itemKey,
  rowName,
  rowTotal,
  sumRows,
} from '../ledger-row.util';

interface SectionMeta {
  title: string;
  subtitle: string;
  icon: string;
  tone: 'direct' | 'indirect' | 'cost';
  hint: string;
  addLabel: string;
}

export const SECTION_META: Record<BenefitSource, SectionMeta> = {
  direct: {
    title: 'รายได้โดยตรง',
    subtitle: 'Direct Revenue',
    icon: 'bi-cash-coin',
    tone: 'direct',
    hint: 'เงินที่ได้รับเพิ่มจากโครงการ เช่น ยอดขายหรือค่าบริการ — กรอกเป็นยอดต่อเดือน',
    addLabel: 'เพิ่มรายได้โดยตรง',
  },
  indirect: {
    title: 'ผลประโยชน์ทางอ้อม',
    subtitle: 'Indirect Benefit',
    icon: 'bi-lightning-charge-fill',
    tone: 'indirect',
    hint: 'สิ่งที่ประหยัดได้ เช่น เวลาทำงานหรือค่าเอกสารที่ลดลง — กรอกปริมาณต่อเดือนกับอัตราขององค์กร ระบบคิดเป็นเงินให้',
    addLabel: 'เพิ่มผลประโยชน์ทางอ้อม',
  },
  cost: {
    title: 'ต้นทุน',
    subtitle: 'Costs',
    icon: 'bi-arrow-down-circle-fill',
    tone: 'cost',
    hint: 'เงินลงทุนครั้งแรก ค่าดำเนินงาน และค่าบริหารจัดการ',
    addLabel: 'เพิ่มต้นทุน',
  },
};

// ─── ฟอร์มกรอกรายการของหนึ่งส่วน ──────────────────────────────────────────────
@Component({
  selector: 'app-ledger-section-editor',
  imports: [CommonModule, FormsModule],
  templateUrl: './ledger-section-editor.html',
  styleUrl: './ledger-sections.css',
})
export class LedgerSectionEditor {
  @Input({ required: true }) source!: BenefitSource;
  @Input() rows: LedgerRow[] = [];
  @Input() categories: Category[] = [];
  @Input() durationMonths = 12;
  @Input() startDate: Date | string | undefined;
  @Input() counted = true;
  @Input() phaseLabel = '';
  @Output() changed = new EventEmitter<void>();

  get meta(): SectionMeta {
    return SECTION_META[this.source];
  }

  get options(): Category[] {
    return categoriesForSource(this.categories, this.source);
  }

  // หมวดปกติขึ้นก่อน หมวด "อื่นๆ" ไว้ท้ายสุด
  get sortedOptions(): Category[] {
    return [...this.options].sort((a, b) => Number(a.allow_custom_name) - Number(b.allow_custom_name));
  }

  get periods(): number[] {
    return periodOptions(this.durationMonths);
  }

  monthName(period: number): string {
    return calendarMonth(this.startDate, period);
  }

  periodsFrom(from: number): number[] {
    return this.periods.filter((p) => p >= (Number(from) || 1));
  }

  categoryOf(row: LedgerRow): Category | undefined {
    return findCategory(this.categories, row.category_id);
  }

  isQtyRow(row: LedgerRow): boolean {
    return isQtyBased(this.categoryOf(row));
  }

  isCustom(row: LedgerRow): boolean {
    return !!this.categoryOf(row)?.allow_custom_name;
  }

  monthly(row: LedgerRow): number {
    return monthlyValue(row, this.categories);
  }

  months(row: LedgerRow): number {
    return monthCount(row);
  }

  total(row: LedgerRow): number {
    return rowTotal(row, this.categories);
  }

  planMonthly(row: LedgerRow): number {
    return row.plan ? planMonthlyValue(row.plan) : 0;
  }

  planPeriod(row: LedgerRow): string {
    return row.plan ? periodLabel(row.plan) : '';
  }

  // ข้อความ placeholder จากค่าตามแผน — ให้เห็นว่าตอนวางแผนกรอกไว้เท่าไร
  placeholder(value: number | null | undefined): string {
    return value != null ? `แผน ${Number(value).toLocaleString('th-TH')}` : '0';
  }

  get sectionTotal(): number {
    return sumRows(this.rows, this.categories);
  }

  share(row: LedgerRow): number {
    const total = this.sectionTotal;
    const v = this.total(row);
    return total > 0 && v > 0 ? Math.min(100, (v / total) * 100) : 0;
  }

  // ─── ช่วงเวลา: ครั้งเดียว (เดือนเดียว) หรือ ทุกเดือนในช่วง ───────────────────────
  setRepeat(row: LedgerRow, repeat: boolean): void {
    row.repeat = repeat;
    if (!repeat) {
      row.period_to = row.period_from;
    } else if (row.period_to <= row.period_from) {
      row.period_to = Math.max(row.period_from, this.durationMonths);
    }
    this.changed.emit();
  }

  onFromChange(row: LedgerRow): void {
    if (!row.repeat || Number(row.period_to) < Number(row.period_from)) row.period_to = row.period_from;
    this.changed.emit();
  }

  // เปลี่ยนหมวดแล้วรูปแบบการกรอกอาจเปลี่ยน (ยอดเงิน ↔ ปริมาณ × อัตรา) — ย้ายมูลค่าเดิมไปด้วย
  // ผู้ใช้จะได้ไม่เสียตัวเลขที่กรอกไว้เพราะเผลอเลือกหมวดผิดแล้วเลือกกลับ
  onCategoryChange(row: LedgerRow): void {
    if (!this.isQtyRow(row) && (row.unit_qty != null || row.unit_cost != null)) {
      row.total_value = (Number(row.unit_qty) || 0) * (Number(row.unit_cost) || 0) || null;
      row.unit_qty = null;
      row.unit_cost = null;
    }
    if (!this.isCustom(row)) row.custom_name = '';
    this.changed.emit();
  }

  // ใช้ตัวเลขตามแผนเป็นค่าเริ่มต้น แล้วค่อยแก้ส่วนที่ต่างจากแผน
  usePlan(row: LedgerRow): void {
    if (!row.plan) return;
    row.total_value = row.plan.total_value;
    row.unit_qty = row.plan.unit_qty;
    row.unit_cost = row.plan.unit_cost;
    this.changed.emit();
  }

  add(): void {
    const first = this.sortedOptions[0];
    this.rows.push(blankRow(first?.category_id || '', this.durationMonths));
    this.changed.emit();
  }

  remove(index: number): void {
    this.rows.splice(index, 1);
    this.changed.emit();
  }
}

// ─── ตารางแสดงรายการของหนึ่งส่วน (โหมดดูผล / รายงาน PDF) ─────────────────────
// หนึ่งแถวที่แสดง — summarize = true รวมรายการเดียวกันหลายเดือนเป็นแถวเดียว (ผลจริงมักต่างกัน
// ทุกเดือน ถ้าแสดงทีละเดือนตารางจะยาวมากจนอ่านไม่ไหว)
export interface DisplayRow {
  name: string;
  group: string | null;   // ชื่อหมวด "อื่นๆ" กำกับใต้ชื่อที่ผู้ใช้พิมพ์
  note: string;
  period: string;
  months: number;
  monthly: number;        // มูลค่าต่อเดือน (ถ้ารวมหลายเดือน = ค่าเฉลี่ย)
  qty: number | null;
  rate: number | null;
  unitLabel: string | null;
  rateLabel: string | null;
  total: number;
  averaged: boolean;
}

@Component({
  selector: 'app-ledger-section-view',
  imports: [CommonModule, BahtPipe],
  templateUrl: './ledger-section-view.html',
  styleUrl: './ledger-sections.css',
})
export class LedgerSectionView {
  @Input({ required: true }) source!: BenefitSource;
  @Input() rows: LedgerRow[] = [];
  @Input() categories: Category[] = [];
  @Input() startDate: Date | string | undefined;
  @Input() counted = true;
  @Input() phaseLabel = '';
  @Input() summarize = false;

  get meta(): SectionMeta {
    return SECTION_META[this.source];
  }

  get displayRows(): DisplayRow[] {
    const groups = new Map<string, LedgerRow[]>();
    this.rows.forEach((r, i) => {
      const key = this.summarize ? itemKey(r) : String(i);
      groups.set(key, [...(groups.get(key) ?? []), r]);
    });
    return [...groups.values()].map((list) => this.toDisplay(list));
  }

  private toDisplay(list: LedgerRow[]): DisplayRow {
    const first = list[0];
    const category = findCategory(this.categories, first.category_id);
    const months = list.reduce((n, r) => n + monthCount(r), 0);
    const total = list.reduce((n, r) => n + rowTotal(r, this.categories), 0);
    const withQty = list.every((r) => r.unit_qty != null && r.unit_cost != null);
    const rates = new Set(list.map((r) => Number(r.unit_cost)));
    const from = Math.min(...list.map((r) => r.period_from));
    const to = Math.max(...list.map((r) => r.period_to));
    return {
      name: rowName(first, this.categories),
      group: first.custom_name ? category?.category_name ?? null : null,
      note: first.note,
      period: list.length === 1
        ? periodLabel(first, this.startDate)
        : `เดือนที่ ${from}–${to} (${calendarMonth(this.startDate, from)} – ${calendarMonth(this.startDate, to)}) · ${months} เดือน`,
      months,
      monthly: months > 0 ? total / months : 0,
      qty: withQty ? list.reduce((n, r) => n + Number(r.unit_qty) * monthCount(r), 0) / Math.max(1, months) : null,
      rate: withQty ? (rates.size === 1 ? Number(first.unit_cost) : null) : null,
      unitLabel: category?.unit_label ?? null,
      rateLabel: category?.rate_label ?? null,
      total,
      averaged: list.length > 1,
    };
  }

  get sectionTotal(): number {
    return sumRows(this.rows, this.categories);
  }
}

// ─── สรุปองค์ประกอบของผลประโยชน์ ───────────────────────────────────────────────
@Component({
  selector: 'app-benefit-summary',
  imports: [CommonModule],
  templateUrl: './benefit-summary.html',
  styleUrl: './ledger-sections.css',
})
export class BenefitSummary {
  @Input() summary?: PhaseSummary;
  @Input() counted: { direct: boolean; indirect: boolean } = { direct: true, indirect: true };
  @Input() projectType: string | null | undefined = '';
  @Input() phaseLabel = '';

  share(value: number): number {
    const total = this.summary?.totalRevenue ?? 0;
    return total > 0 ? (value / total) * 100 : 0;
  }
}
