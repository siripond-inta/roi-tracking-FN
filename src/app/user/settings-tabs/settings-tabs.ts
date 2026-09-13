// src/app/user/settings-tabs/settings-tabs.ts
// Sub-navigation ของหน้า Settings/Security แบบ horizontal tabs — component เดียวใช้ร่วมกันทั้ง
// 2 หน้า (ก่อนหน้านี้แต่ละหน้า copy โค้ดเมนูแนวตั้งซ้ำกันเอง ทำให้ดูซ้อนกับ sidebar หลักด้านซ้าย
// และมี routerLink ที่ผิดคนละหน้ากันด้วย — component นี้แก้ทั้งสองปัญหาในที่เดียว)
import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-settings-tabs',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './settings-tabs.html',
  styleUrl: './settings-tabs.css',
})
export class SettingsTabs {}
