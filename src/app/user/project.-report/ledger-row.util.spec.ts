// QA: ตรรกะของแถวในฟอร์มกรอกผลประโยชน์/ต้นทุน (ใช้ร่วมกันหน้า Estimated/Actual Report)
import { describe, expect, it } from 'vitest';
import {
  LedgerRow, blankRow, groupLedgers, isFilled, monthCount, monthlyValue, periodOptions,
  rowTotal, sourceOfGroup, splitBySource, sumRows, toLedgerInput,
} from './ledger-row.util';
import { comparePlan, isRoiWorthwhile, planComparisonClass } from './shared/plan-compare';
import { BahtPipe } from './shared/baht.pipe';
import { PctPipe } from './shared/pct.pipe';
import { redactSensitive } from '../../interceptors/logging.interceptor';

const cats: any[] = [
  { category_id: 'INV001', category_name: 'ลงทุน', category_group: 'INV', is_inflow: 0 },
  { category_id: 'REV001', category_name: 'รายได้', category_group: 'REV', is_inflow: 1 },
  { category_id: 'BEN001', category_name: 'ลดเวลา', category_group: 'BEN', is_inflow: 1, unit_label: 'ชม.', rate_label: 'บาท' },
  { category_id: 'REVOTH', category_name: 'อื่นๆ', category_group: 'REV', is_inflow: 1, allow_custom_name: 1 },
];
const r = (o: Partial<LedgerRow>): LedgerRow => ({ ...blankRow('INV001', 12), ...o });

describe('ledger-row.util', () => {
  it('sourceOfGroup แยก direct / indirect / cost', () => {
    expect(sourceOfGroup('REV')).toBe('direct');
    expect(sourceOfGroup('BEN')).toBe('indirect');
    expect(sourceOfGroup('OPC')).toBe('cost');
    expect(sourceOfGroup(undefined, true)).toBe('direct');
  });

  it('มูลค่าแถว: ยอด × จำนวนเดือน, หมวดปริมาณ = qty × rate × เดือน', () => {
    expect(rowTotal(r({ total_value: 1000, period_from: 2, period_to: 4 }), cats)).toBe(3000);
    const ben = r({ category_id: 'BEN001', unit_qty: 80, unit_cost: 250, period_from: 2, period_to: 12 });
    expect(monthlyValue(ben, cats)).toBe(20000);
    expect(rowTotal(ben, cats)).toBe(220000);
    expect(monthCount({ period_from: 5, period_to: 3 })).toBe(0);
  });

  it('sumRows รวมทุกแถว', () => {
    expect(sumRows([r({ total_value: 10, period_from: 1, period_to: 2 }), r({ total_value: 5, period_from: 3, period_to: 3 })], cats)).toBe(25);
  });

  it('toLedgerInput: แถวเดือนเดียว (repeat=false) ส่ง period_to = period_from', () => {
    const input = toLedgerInput(r({ total_value: 500, period_from: 3, period_to: 9, repeat: false }), cats);
    expect(input.period_from).toBe(3);
    expect(input.period_to).toBe(3);
  });

  it('toLedgerInput: หมวดปริมาณส่ง qty/rate ไม่ส่ง total_value, หมวดอื่นๆ ตัดช่องว่างชื่อ', () => {
    const ben = toLedgerInput(r({ category_id: 'BEN001', unit_qty: 2, unit_cost: 3 }), cats);
    expect([ben.unit_qty, ben.unit_cost, ben.total_value]).toEqual([2, 3, null]);
    expect(toLedgerInput(r({ category_id: 'REVOTH', custom_name: '  ค่าโฆษณา ', total_value: 1 }), cats).custom_name).toBe('ค่าโฆษณา');
    expect(toLedgerInput(r({ custom_name: 'x', total_value: 1 }), cats).custom_name).toBeNull();
  });

  it('isFilled: แถวว่างไม่ส่ง แต่แถวที่กรอกปริมาณช่องเดียวยังส่งให้ backend เตือน', () => {
    expect(isFilled(r({ total_value: 0 }), cats)).toBe(false);
    expect(isFilled(r({ total_value: 1 }), cats)).toBe(true);
    expect(isFilled(r({ category_id: 'BEN001', unit_qty: 5, unit_cost: null }), cats)).toBe(true);
  });

  it('isFilled: ค่าติดลบต้องถูกส่งไปให้ backend ปฏิเสธ ไม่ถูกตัดทิ้งเงียบๆ', () => {
    expect(isFilled(r({ total_value: -5000 }), cats)).toBe(true);
    expect(isFilled(r({ category_id: 'BEN001', unit_qty: -1, unit_cost: 100 }), cats)).toBe(true);
  });

  it('groupLedgers รวมแถวรายเดือนที่ต่อเนื่องและค่าเท่ากันกลับเป็นช่วงเดือน', () => {
    const led = (p: number, v: number, extra: any = {}) =>
      ({ category_id: 'INV001', period_index: p, total_value: v, note: '', unit_qty: null, unit_cost: null, ...extra }) as any;
    const rows = groupLedgers([led(1, 100), led(2, 100), led(3, 100), led(5, 100), led(4, 200)]);
    expect(rows.map((x) => [x.period_from, x.period_to, x.total_value])).toEqual([
      [1, 3, 100], [4, 4, 200], [5, 5, 100],
    ]);
    const ben = groupLedgers([1, 2].map((p) => led(p, 500, { category_id: 'BEN001', unit_qty: 5, unit_cost: 100 })));
    expect(ben).toHaveLength(1);
    expect([ben[0].unit_qty, ben[0].unit_cost, ben[0].total_value]).toEqual([5, 100, null]);
  });

  it('splitBySource จัดแถวเข้ากลุ่มตามหมวด', () => {
    const s = splitBySource([r({}), r({ category_id: 'REV001' }), r({ category_id: 'BEN001' })], cats);
    expect([s.cost.length, s.direct.length, s.indirect.length]).toEqual([1, 1, 1]);
  });

  it('periodOptions ใช้ 12 เดือนเมื่อไม่ระบุระยะเวลา', () => {
    expect(periodOptions(undefined)).toHaveLength(12);
    expect(periodOptions(3)).toEqual([1, 2, 3]);
  });
});

describe('plan-compare', () => {
  it('ต่างกันไม่ถึง tolerance = เท่ากับแผน', () => {
    expect(comparePlan(10.04, 10, 0.05)).toBe('equal');
    expect(comparePlan(10.06, 10, 0.05)).toBe('above');
    expect(comparePlan(9, 10)).toBe('below');
  });
  it('ต้นทุนสูงกว่าแผน = สีแดง, ROI สูงกว่าแผน = สีเขียว', () => {
    expect(planComparisonClass('above', false)).toContain('danger');
    expect(planComparisonClass('above', true)).toContain('success');
  });
});

describe('isRoiWorthwhile', () => {
  it('ไม่ตั้งเป้า = null, ROI เท่าเป้า = คุ้มค่า, ไม่มีต้นทุนแต่มีผลประโยชน์ = คุ้มค่า', () => {
    expect(isRoiWorthwhile({ roi: 50, totalRevenue: 1 }, null)).toBeNull();
    expect(isRoiWorthwhile({ roi: 30, totalRevenue: 1 }, 30)).toBe(true);
    expect(isRoiWorthwhile({ roi: 29.9, totalRevenue: 1 }, 30)).toBe(false);
    expect(isRoiWorthwhile({ roi: null, totalRevenue: 100 }, 30)).toBe(true);
    expect(isRoiWorthwhile({ roi: null, totalRevenue: 0 }, 30)).toBeNull();
  });
});

describe('PctPipe', () => {
  const pipe = new PctPipe();
  it('null → "—" และปัดทศนิยม', () => {
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(64.2965)).toBe('64.3%');
    expect(pipe.transform(-6.76)).toBe('-6.8%');
    expect(pipe.transform(64, 0, 1)).toBe('64%');
  });
});

describe('logging interceptor redactSensitive', () => {
  it('ซ่อนรหัสผ่านและ token ก่อน log ลง console', () => {
    expect(redactSensitive({ email: 'a@b.c', password: 'Passw0rd!' })).toEqual({ email: 'a@b.c', password: '***' });
    expect(redactSensitive({ current_password: 'x', new_password: 'y' })).toEqual({ current_password: '***', new_password: '***' });
    expect(redactSensitive({ token: 'eyJ', user: { email: 'a' } })).toEqual({ token: '***', user: { email: 'a' } });
    expect(redactSensitive('text')).toBe('text');
  });
});

describe('BahtPipe (เพิ่มเติม)', () => {
  const pipe = new BahtPipe();
  it('ค่าลบ / ทศนิยม / ย่อ', () => {
    expect(pipe.transform(-353000)).toBe('-฿353,000');
    expect(pipe.transform(1234.5)).toBe('฿1,235');
    expect(pipe.transform(1_250_000, true)).toBe('฿1.25M');
    expect(pipe.transform(380_000, true)).toBe('฿380K');
    expect(pipe.transform(null)).toBe('-');
  });
});
