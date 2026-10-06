// แสดงจำนวนเงินเป็นบาท: 1234.5 → "฿1,235", -353000 → "-฿353,000" (แทน "฿-353,000" ที่อ่านยาก)
// compact = true ย่อหลักใหญ่ให้สั้นลง เช่น 1,250,000 → "฿1.25M" (ใช้ในการ์ด/กราฟที่ที่แคบ)
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'baht' })
export class BahtPipe implements PipeTransform {
  transform(value: number | null | undefined, compact = false): string {
    if (value == null || !Number.isFinite(Number(value))) return '-';
    const v = Number(value);
    const sign = v < 0 ? '-' : '';
    const abs = Math.abs(v);
    if (compact && abs >= 1_000_000) return `${sign}฿${trim(abs / 1_000_000)}M`;
    if (compact && abs >= 10_000) return `${sign}฿${trim(abs / 1_000)}K`;
    return `${sign}฿${Math.round(abs).toLocaleString('en-US')}`;
  }
}

// ตัดศูนย์ท้ายเฉพาะหลังจุดทศนิยม (1.50 → 1.5, 2.00 → 2) — ห้ามตัดศูนย์ของจำนวนเต็ม (380 ต้องเป็น 380)
function trim(n: number): string {
  const text = n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2);
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}
