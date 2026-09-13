import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsTabs } from '../../settings-tabs/settings-tabs';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-security',
  imports: [SettingsTabs, CommonModule, FormsModule],
  templateUrl: './security.html',
  styleUrl: './security.css',
})
export class Security {
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  isSaving = false;

  constructor(
    private authService: AuthService,
    private toastService: ToastService
  ) {}

  // คะแนนความแข็งแรงของรหัสผ่านใหม่ (0-3) — ใช้กับแถบสีและป้ายข้อความ
  get passwordStrength(): number {
    const p = this.newPassword;
    if (!p) return 0;
    let score = 0;
    if (p.length >= 8) score++;
    if (/[0-9]/.test(p) && /[a-zA-Z]/.test(p)) score++;
    if (/[^a-zA-Z0-9]/.test(p) || (/[a-z]/.test(p) && /[A-Z]/.test(p))) score++;
    return score;
  }

  get strengthLabel(): string {
    return ['Too Weak', 'Weak', 'Fair', 'Strong'][this.passwordStrength];
  }

  get strengthClass(): string {
    return ['text-danger', 'text-danger', 'text-warning', 'text-success'][this.passwordStrength];
  }

  get strengthBarClass(): string {
    return ['bg-danger', 'bg-danger', 'bg-warning', 'bg-success'][this.passwordStrength];
  }

  changePassword(): void {
    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.toastService.warning('กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }
    if (this.newPassword.length < 6) {
      this.toastService.warning('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.toastService.warning('รหัสผ่านใหม่และการยืนยันไม่ตรงกัน');
      return;
    }

    this.isSaving = true;
    this.authService.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: () => {
        this.isSaving = false;
        this.currentPassword = '';
        this.newPassword = '';
        this.confirmPassword = '';
        this.toastService.success('เปลี่ยนรหัสผ่านสำเร็จ');
      },
      error: (err) => {
        this.isSaving = false;
        this.toastService.error(err.error?.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
      }
    });
  }
}
