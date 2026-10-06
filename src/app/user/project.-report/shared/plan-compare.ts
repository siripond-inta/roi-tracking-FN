// เทียบผลจริงกับแผน แล้วบอกเป็นคำกลางๆ: "ต่ำกว่าแผน / เท่ากับแผน / สูงกว่าแผน"
// สีบอกว่าดีหรือไม่ดี — ผลประโยชน์/ROI สูงกว่าแผน = ดี (เขียว), ต้นทุนสูงกว่าแผน = ไม่ดี (แดง)

export type PlanComparison = 'below' | 'equal' | 'above';

export const PLAN_COMPARISON_LABELS: Record<PlanComparison, string> = {
  below: 'ต่ำกว่าแผน',
  equal: 'เท่ากับแผน',
  above: 'สูงกว่าแผน',
};

const PLAN_COMPARISON_ICONS: Record<PlanComparison, string> = {
  below: 'bi-arrow-down',
  equal: 'bi-dash',
  above: 'bi-arrow-up',
};

// tolerance: ต่างกันไม่เกินค่านี้ถือว่าเท่ากับแผน (เงินปัดเป็นบาท, ROI ปัดตามทศนิยมที่แสดง)
export function comparePlan(actual: number, plan: number, tolerance = 0.5): PlanComparison {
  const diff = Number(actual) - Number(plan);
  if (Math.abs(diff) < tolerance) return 'equal';
  return diff > 0 ? 'above' : 'below';
}

export function planComparisonLabel(result: PlanComparison): string {
  return PLAN_COMPARISON_LABELS[result];
}

export function planComparisonIcon(result: PlanComparison): string {
  return PLAN_COMPARISON_ICONS[result];
}

// ความคุ้มค่าเทียบเป้า ROI (ใช้ในหน้า Estimated ที่เทียบกับแผนเสมอ) — กติกาเดียวกับ backend:
// ไม่ตั้งเป้า = null, ROI คำนวณไม่ได้ (ไม่มีต้นทุน) แต่มีผลประโยชน์ = คุ้มค่า, ไม่มีอะไรเลย = null
export function isRoiWorthwhile(
  summary: { roi: number | null; totalRevenue: number } | undefined,
  targetRoi: number | null
): boolean | null {
  if (targetRoi == null || !summary) return null;
  if (summary.roi == null) return summary.totalRevenue > 0 ? true : null;
  return summary.roi >= targetRoi;
}

// คลาสสีของ badge: higherIsBetter = false สำหรับต้นทุน (ใช้มากกว่าแผนคือไม่ดี)
export function planComparisonClass(result: PlanComparison, higherIsBetter = true): string {
  if (result === 'equal') return 'bg-secondary-subtle text-secondary-emphasis';
  const good = (result === 'above') === higherIsBetter;
  return good ? 'bg-success-subtle text-success' : 'bg-danger-subtle text-danger';
}
