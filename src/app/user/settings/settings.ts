import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsTabs } from '../settings-tabs/settings-tabs';
import { AuthService } from '../../services/auth.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-settings',
  imports: [SettingsTabs, FormsModule, CommonModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings {
  fullName = '';
  email = '';
  currentPassword = '';
  isSaving = false;

  constructor(
    public authService: AuthService,
    private toastService: ToastService
  ) {
    const user = this.authService.currentUser();
    this.fullName = user?.fullName || '';
    this.email = user?.email || '';
  }

  get emailChanged(): boolean {
    return this.email.trim() !== (this.authService.currentUser()?.email || '');
  }

  saveProfile(): void {
    if (!this.fullName.trim()) {
      this.toastService.warning('กรุณากรอกชื่อ');
      return;
    }
    if (this.emailChanged && !this.currentPassword) {
      this.toastService.warning('กรุณากรอกรหัสผ่านปัจจุบันเพื่อยืนยันการเปลี่ยนอีเมล');
      return;
    }

    this.isSaving = true;
    this.authService.updateProfile(this.fullName.trim(), this.email.trim(), this.currentPassword || undefined)
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.currentPassword = '';
          this.toastService.success('บันทึกข้อมูลโปรไฟล์สำเร็จ');
        },
        error: (err) => {
          this.isSaving = false;
          this.toastService.error(err.error?.message || 'บันทึกไม่สำเร็จ');
        }
      });
  }

  resetForm(): void {
    const user = this.authService.currentUser();
    this.fullName = user?.fullName || '';
    this.email = user?.email || '';
    this.currentPassword = '';
  }
}
