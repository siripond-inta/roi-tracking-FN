// Unit test ของ component ที่ใช้ในหน้ารายงาน: การ์ด KPI และตารางรายการ
import { TestBed } from '@angular/core/testing';
import { KpiCards } from './kpi-cards';
import { LedgerSectionView } from './ledger-sections';
import { Category } from '../../../services/category.service';
import { PhaseSummary } from '../../../services/analytics.service';
import { LedgerRow } from '../ledger-row.util';

const summary: PhaseSummary = {
  totalRevenue: 1086000,
  totalExpense: 661000,
  netProfit: 425000,
  roi: 64.296,
  paybackMonths: 7.3,
  directRevenue: 780000,
  indirectBenefit: 306000,
  indirectMonthlyAverage: 25500,
  indirectAnnualized: 306000,
  excludedBenefit: 0,
} as PhaseSummary;

const categories: Category[] = [
  { category_id: 'BEN001', category_name: 'การลดเวลาทำงานของบุคลากร', category_group: 'BEN', type_id: 2, type_name: 'รายรับ',
    is_inflow: true, unit_label: 'ชม./เดือน', rate_label: 'บาท/ชม.', allow_custom_name: false },
  { category_id: 'OPCOTH', category_name: 'ต้นทุนดำเนินงานอื่นๆ (ระบุเอง)', category_group: 'OPC', type_id: 1, type_name: 'รายจ่าย',
    is_inflow: false, unit_label: null, rate_label: null, allow_custom_name: true },
];

const row = (over: Partial<LedgerRow>): LedgerRow => ({
  category_id: 'BEN001', custom_name: '', period_from: 1, period_to: 1, repeat: false,
  total_value: null, unit_qty: null, unit_cost: null, note: '', ...over,
});

describe('KpiCards', () => {
  function render(target: number | null, worthwhile: boolean | null) {
    const fixture = TestBed.createComponent(KpiCards);
    fixture.componentRef.setInput('summary', summary);
    fixture.componentRef.setInput('label', 'ตามแผน');
    fixture.componentRef.setInput('targetRoi', target);
    fixture.componentRef.setInput('worthwhile', worthwhile);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
  }

  it('UT-KPI-01 แสดง ROI ระยะคืนทุน และจำนวนเงิน เป็นตัวเลขอย่างเดียว ไม่มีสูตร', () => {
    const text = render(30, true);
    expect(text).toContain('64.3%');
    expect(text).toContain('7.3 เดือน');
    expect(text).toContain('฿425,000');
    expect(text).toContain('฿661,000');
    expect(text).not.toContain('÷');
  });

  it('UT-KPI-02 แสดงความคุ้มค่าเทียบเป้า', () => {
    expect(render(30, true)).toContain('คุ้มค่า');
    expect(render(80, false)).toContain('ไม่คุ้มค่า');
    expect(render(null, null)).toContain('ยังไม่ตั้งเป้า');
  });
});

describe('LedgerSectionView', () => {
  function render(rows: LedgerRow[], source: 'indirect' | 'cost', summarize = false) {
    const fixture = TestBed.createComponent(LedgerSectionView);
    fixture.componentRef.setInput('source', source);
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('categories', categories);
    fixture.componentRef.setInput('startDate', '2026-01-10');
    fixture.componentRef.setInput('summarize', summarize);
    fixture.detectChanges();
    return fixture;
  }

  it('UT-VIEW-01 ตารางผลประโยชน์ทางอ้อมแจกแจง ปริมาณ × อัตรา มูลค่าต่อเดือน และเทียบรายปี', () => {
    const fixture = render([row({ period_from: 2, period_to: 6, repeat: true, unit_qty: 20, unit_cost: 250 })], 'indirect');
    const text = (fixture.nativeElement as HTMLElement).textContent!.replace(/\s+/g, ' ');
    expect(text).toContain('การลดเวลาทำงานของบุคลากร');
    expect(text).toContain('฿5,000');   // 20 × 250 ต่อเดือน
    expect(text).toContain('฿60,000');  // เทียบรายปี
    expect(text).toContain('฿25,000');  // 5 เดือน
  });

  it('UT-VIEW-02 หมวด "อื่นๆ" แสดงชื่อที่ผู้ใช้ระบุ', () => {
    const fixture = render([row({ category_id: 'OPCOTH', custom_name: 'ค่าโฆษณา', total_value: 1000 })], 'cost');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('ค่าโฆษณา');
  });

  it('UT-VIEW-03 summarize รวมรายการเดียวกันหลายเดือนเป็นแถวเดียว พร้อมค่าเฉลี่ย', () => {
    const rows = [
      row({ period_from: 1, period_to: 1, unit_qty: 10, unit_cost: 250 }),
      row({ period_from: 2, period_to: 2, unit_qty: 30, unit_cost: 250 }),
    ];
    const view = render(rows, 'indirect', true).componentInstance;
    expect(view.displayRows).toHaveLength(1);
    expect(view.displayRows[0].total).toBe(10000);
    expect(view.displayRows[0].monthly).toBe(5000);
    expect(view.displayRows[0].averaged).toBe(true);
  });
});
