// src/app/services/toast.service.ts
// Toast Notification Service — แทนที่ alert() ด้วย UI ที่สวยงามกว่า

import { Injectable, signal } from '@angular/core';

// Interface กำหนดรูปแบบของ Toast แต่ละอัน
export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  icon: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  // signal() เก็บ array ของ toast ที่กำลังแสดงอยู่
  toasts = signal<Toast[]>([]);
  private nextId = 0;

  // แสดง Toast และลบออกอัตโนมัติหลัง 3 วินาที
  private show(message: string, type: Toast['type'], icon: string): void {
    const id = this.nextId++;
    // เพิ่ม toast ใหม่เข้า array โดย spread [...] array เดิม
    this.toasts.update(list => [...list, { id, message, type, icon }]);
    // setTimeout: ลบออกอัตโนมัติหลัง 3 วินาที
    setTimeout(() => this.remove(id), 3000);
  }

  success(message: string): void { this.show(message, 'success', 'bi-check-circle-fill'); }
  error(message: string): void   { this.show(message, 'error',   'bi-x-circle-fill'); }
  warning(message: string): void { this.show(message, 'warning', 'bi-exclamation-triangle-fill'); }
  info(message: string): void    { this.show(message, 'info',    'bi-info-circle-fill'); }

  // ลบ toast ที่ระบุ id
  remove(id: number): void {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }
}
