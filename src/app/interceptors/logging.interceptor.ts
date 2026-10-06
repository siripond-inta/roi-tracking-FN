// src/app/interceptors/logging.interceptor.ts
// Interceptor: พ่น console log ทุกครั้งที่มีการเรียก API ออกจาก Angular (ครอบคลุมทุก service
// โดยอัตโนมัติ เพราะ HttpClient ทุกที่วิ่งผ่าน pipeline เดียวกัน — ไม่ต้องแก้ทีละไฟล์)
// ช่วย debug: ดูได้ว่าเรียก endpoint ไหน, method อะไร, ใช้เวลาเท่าไหร่, สำเร็จ/error

import { isDevMode } from '@angular/core';
import { HttpErrorResponse, HttpEventType, HttpInterceptorFn } from '@angular/common/http';
import { tap } from 'rxjs/operators';

const METHOD_COLOR: Record<string, string> = {
  GET: '#0d6efd',
  POST: '#198754',
  PUT: '#fd7e14',
  PATCH: '#fd7e14',
  DELETE: '#dc3545',
};

// ฟิลด์ที่ห้ามพิมพ์ลง console เด็ดขาด (รหัสผ่าน / token) — console เปิดดูได้ทุกคนที่ใช้เครื่องนั้น
// และส่วนขยายของเบราว์เซอร์อ่านได้ จึงซ่อนค่าก่อน log
const SENSITIVE_KEYS = /pass(word)?|token|secret/i;

export function redactSensitive(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (value && typeof value === 'object' && !(value instanceof Blob) && !(value instanceof FormData)) {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k,
        SENSITIVE_KEYS.test(k) ? '***' : redactSensitive(v),
      ])
    );
  }
  return value;
}

export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  // log เฉพาะตอน dev — production build ไม่พ่นข้อมูล request/response ลง console
  if (!isDevMode()) return next(req);
  const startedAt = performance.now();
  const color = METHOD_COLOR[req.method] ?? '#6c757d';

  console.log(
    `%c→ API ${req.method} ${req.urlWithParams}`,
    `color:${color};font-weight:bold`,
    redactSensitive(req.body ?? '')
  );

  return next(req).pipe(
    tap({
      next: (event) => {
        // สนใจแค่ event ที่เป็น Response จริงๆ (ไม่เอา progress event ระหว่างอัปโหลด/ดาวน์โหลด)
        if (event.type === HttpEventType.Response) {
          const ms = Math.round(performance.now() - startedAt);
          console.log(
            `%c← API ${req.method} ${req.urlWithParams} — ${event.status} (${ms}ms)`,
            `color:${color};font-weight:bold`,
            redactSensitive(event.body)
          );
        }
      },
      error: (err: HttpErrorResponse) => {
        const ms = Math.round(performance.now() - startedAt);
        console.error(
          `%c✕ API ${req.method} ${req.urlWithParams} — ${err.status} (${ms}ms)`,
          'color:#dc3545;font-weight:bold',
          err.error ?? err.message
        );
      },
    })
  );
};
