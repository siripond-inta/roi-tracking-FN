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
import {
  LedgerRow,
  blankRow,
  categoriesForSource,
  findCategory,
  isQtyBased,
  monthCount,
  monthlyValue,
  periodLabel,
  periodOptions,
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
    hint: 'กรอกยอดเงินที่ได้รับต่อเดือน เช่น ยอดขายหรือค่าบริการที่เพิ่มขึ้นจากโครงการ',
    addLabel: 'เพิ่มรายได้โดยตรง',
  },
  indirect: {
    title: 'ผลประโยชน์ทางอ้อม',
    subtitle: 'Indirect Benefit',
    icon: 'bi-lightning-charge-fill',
    tone: 'indirect',
    hint: 'เลือกประเภทผลประโยชน์ แล้วกรอกปริมาณที่ลดได้ต่อเดือนกับอัตราต่อหน่วยขององค์กร ระบบคูณเป็นมูลค่าให้อัตโนมัติ',
    addLabel: 'เพิ่มผลประโยชน์ทางอ้อม',
  },
  cost: {
    title: 'ต้นทุน',
    subtitle: 'Costs',
    icon: 'bi-arrow-down-circle-fill',
    tone: 'cost',
    hint: 'เงินลงทุนเริ่มต้น ค่าดำเนินงาน และค่าบริหารจัดการ (กรอกเป็นยอดต่อเดือน)',
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
  @Input() counted = true;
  @Input() phaseLabel = '';
  @Output() changed = new EventEmitter<void>();

  get meta(): SectionMeta {
    return SECTION_META[this.source];
  }

  get options(): Category[] {
    return categoriesForSource(this.categories, this.source);
  }

  get periods(): number[] {
    return periodOptions(this.durationMonths);
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

  monthly(row: LedgerRow): number {
    return monthlyValue(row, this.categories);
  }

  months(row: LedgerRow): number {
    return monthCount(row);
  }

  total(row: LedgerRow): number {
    return rowTotal(row, this.categories);
  }

  get sectionTotal(): number {
    return sumRows(this.rows, this.categories);
  }

  share(row: LedgerRow): number {
    const total = this.sectionTotal;
    const v = this.total(row);
    return total > 0 && v > 0 ? Math.min(100, (v / total) * 100) : 0;
  }

  onFromChange(row: LedgerRow): void {
    if (Number(row.period_to) < Number(row.period_from)) row.period_to = row.period_from;
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
    this.changed.emit();
  }

  add(): void {
    this.rows.push(blankRow(this.options[0]?.category_id || '', this.durationMonths));
    this.changed.emit();
  }

  remove(index: number): void {
    this.rows.splice(index, 1);
    this.changed.emit();
  }
}

// ─── ตารางแสดงรายการของหนึ่งส่วน (โหมดดูผล / รายงาน PDF) ─────────────────────
@Component({
  selector: 'app-ledger-section-view',
  imports: [CommonModule],
  templateUrl: './ledger-section-view.html',
  styleUrl: './ledger-sections.css',
})
export class LedgerSectionView {
  @Input({ required: true }) source!: BenefitSource;
  @Input() rows: LedgerRow[] = [];
  @Input() categories: Category[] = [];
  @Input() counted = true;
  @Input() phaseLabel = '';

  get meta(): SectionMeta {
    return SECTION_META[this.source];
  }

  categoryName(row: LedgerRow): string {
    return findCategory(this.categories, row.category_id)?.category_name || row.category_id;
  }

  categoryOf(row: LedgerRow): Category | undefined {
    return findCategory(this.categories, row.category_id);
  }

  period(row: LedgerRow): string {
    return periodLabel(row);
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

  hasQty(row: LedgerRow): boolean {
    return row.unit_qty != null && row.unit_cost != null;
  }

  get sectionTotal(): number {
    return sumRows(this.rows, this.categories);
  }

  // มูลค่าต่อเดือน × 12 — มูลค่าเทียบเป็นรายปีของผลประโยชน์ทางอ้อมแต่ละรายการ
  annual(row: LedgerRow): number {
    return this.monthly(row) * 12;
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
