// ข้อมูลที่กำลังกรอกในโหมดแก้ไขของหน้า Estimated/Actual Report (ใช้ร่วมกันทั้งสองหน้า)
// ทุกครั้งที่แก้ไข จะส่งรายการไปให้ backend คำนวณผลลัพธ์ (ROI, ระยะคืนทุน ฯลฯ) แบบยังไม่บันทึก
// ตัวเลขบนการ์ดสรุประหว่างกรอกจึงมาจากสูตรเดียวกับรายงานจริง ไม่ได้คำนวณซ้ำใน frontend

import { Subject, Subscription, of } from 'rxjs';
import { catchError, debounceTime, switchMap, tap } from 'rxjs/operators';
import { AnalyticsService, ProjectAnalytics } from '../../services/analytics.service';
import { Category } from '../../services/category.service';
import { LedgerInput } from '../../services/project.service';
import { LedgerRowsBySource, SOURCE_ORDER, isFilled, toLedgerInput } from './ledger-row.util';

export class LedgerDraft {
  rows: LedgerRowsBySource = { direct: [], indirect: [], cost: [] };
  preview?: ProjectAnalytics;
  previewError = '';
  previewLoading = false;

  private changes = new Subject<void>();
  private sub: Subscription;

  constructor(
    analyticsService: AnalyticsService,
    projectId: number,
    phase: 'Estimated' | 'Actual',
    private categories: () => Category[]
  ) {
    this.sub = this.changes
      .pipe(
        tap(() => (this.previewLoading = true)),
        debounceTime(350),
        switchMap(() =>
          analyticsService.previewProjectAnalytics(projectId, phase, this.inputs()).pipe(
            catchError((err) => {
              this.previewError = err?.error?.message || 'คำนวณผลลัพธ์ไม่สำเร็จ';
              return of(null);
            })
          )
        )
      )
      .subscribe((result) => {
        this.previewLoading = false;
        if (result) {
          this.preview = result;
          this.previewError = '';
        }
      });
  }

  load(rows: LedgerRowsBySource): void {
    this.rows = rows;
    this.preview = undefined;
    this.previewError = '';
    this.changed();
  }

  changed(): void {
    this.changes.next();
  }

  // รายการที่จะส่งไปบันทึก — ตัดแถวว่างทิ้ง
  inputs(): LedgerInput[] {
    const cats = this.categories();
    return SOURCE_ORDER.flatMap((s) => this.rows[s])
      .filter((r) => isFilled(r, cats))
      .map((r) => toLedgerInput(r, cats));
  }

  destroy(): void {
    this.sub.unsubscribe();
  }
}
