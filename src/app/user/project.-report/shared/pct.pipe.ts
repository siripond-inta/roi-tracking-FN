// แสดงเปอร์เซ็นต์ เช่น ROI: 64.29 → "64.3%", null → "—" (ไม่มีต้นทุน จึงคำนวณ ROI ไม่ได้)
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'pct' })
export class PctPipe implements PipeTransform {
  transform(value: number | null | undefined, minDigits = 1, maxDigits = 1): string {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    return (
      Number(value).toLocaleString('en-US', { minimumFractionDigits: minDigits, maximumFractionDigits: maxDigits }) + '%'
    );
  }
}
