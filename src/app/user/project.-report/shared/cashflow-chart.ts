// กราฟ "เงินสะสม" รายเดือน — อ่านง่ายกว่าตารางตัวเลข: เส้นอยู่ใต้ศูนย์ = เงินที่ได้กลับมายังน้อยกว่า
// ที่จ่ายไป, เหนือศูนย์ = ได้กลับมามากกว่าแล้ว ตัวเลขทุกจุดมาจาก analytics ของ backend
import { Component, Input, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { MonthlyAnalytics } from '../../../services/analytics.service';
import { calendarMonth } from '../ledger-row.util';

@Component({
  selector: 'app-cashflow-chart',
  imports: [CommonModule, BaseChartDirective],
  providers: [provideCharts(withDefaultRegisterables())],
  styleUrl: '../report-shared.css',
  template: `
    <div class="chart-screen-only" [class.has-print-image]="printImage" [style.height.px]="height">
      <canvas baseChart type="line" [data]="data" [options]="options"></canvas>
    </div>
    <img *ngIf="printImage" class="chart-print-only" [src]="printImage" alt="เงินสะสมรายเดือน">
    <div class="d-flex flex-wrap gap-3 small text-muted mt-2 chart-legend-help">
      <span><span class="legend-swatch below"></span>ใต้เส้น 0 = เงินที่ได้กลับมายังน้อยกว่าที่จ่ายไป</span>
      <span><span class="legend-swatch above"></span>เหนือเส้น 0 = ได้กลับมามากกว่าที่จ่ายไปแล้ว</span>
    </div>
  `,
})
export class CashflowChart {
  @Input() monthly: MonthlyAnalytics[] = [];
  @Input() showActual = false;
  @Input() lastActualPeriod = 0;
  @Input() startDate: Date | string | undefined;
  @Input() height = 280;

  @ViewChild(BaseChartDirective) private chart?: BaseChartDirective;
  printImage = '';

  // canvas วาดใหม่ไม่ทันตอนเปลี่ยนเป็นหน้ากระดาษ — เรียกก่อนสั่งพิมพ์เพื่อใช้รูปแทน
  prepareForPrint(): void {
    this.printImage = this.chart?.chart?.toBase64Image() ?? '';
  }

  clearPrintImage(): void {
    this.printImage = '';
  }

  get data(): ChartConfiguration<'line'>['data'] {
    const labels = this.monthly.map((m) => `เดือน ${m.period} (${calendarMonth(this.startDate, m.period)})`);
    const planned = this.monthly.map((m) => m.estimated.cumulative);
    const datasets: ChartConfiguration<'line'>['data']['datasets'] = [
      {
        label: this.showActual ? 'ตามแผน' : 'เงินสะสม (ตามแผน)',
        data: planned,
        borderColor: this.showActual ? '#adb5bd' : '#198754',
        backgroundColor: this.showActual ? 'transparent' : 'rgba(25,135,84,.08)',
        borderDash: this.showActual ? [6, 4] : [],
        fill: !this.showActual,
        tension: 0.3,
        pointRadius: 2,
      },
    ];
    if (this.showActual) {
      datasets.push({
        label: 'เกิดขึ้นจริง',
        data: this.monthly.map((m) => (m.period <= this.lastActualPeriod ? m.actual.cumulative : null)),
        borderColor: '#198754',
        backgroundColor: 'rgba(25,135,84,.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        spanGaps: false,
      });
    }
    return { labels, datasets };
  }

  readonly options: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'bottom' },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = Number(ctx.parsed.y ?? 0);
            const text = `${v < 0 ? '-' : ''}฿${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
            return `${ctx.dataset.label}: ${text}`;
          },
        },
      },
    },
    scales: {
      y: {
        ticks: {
          callback: (v) => {
            const n = Number(v);
            const abs = Math.abs(n);
            const short = abs >= 1_000_000 ? `${(abs / 1_000_000).toFixed(1)}M` : abs >= 1000 ? `${Math.round(abs / 1000)}K` : `${abs}`;
            return `${n < 0 ? '-' : ''}฿${short}`;
          },
        },
        // เส้น 0 เข้มกว่าเส้นอื่น — เป็นเส้นแบ่ง "ยังไม่คืนทุน / คืนทุนแล้ว"
        grid: {
          color: (ctx) => (ctx.tick.value === 0 ? 'rgba(0,0,0,.45)' : 'rgba(0,0,0,.05)'),
          lineWidth: (ctx) => (ctx.tick.value === 0 ? 2 : 1),
        },
      },
      x: {
        title: { display: true, text: 'เดือนที่' },
        grid: { display: false },
        ticks: { maxRotation: 0, autoSkip: true, callback: (_v, i) => `${i + 1}` },
      },
    },
  };
}
