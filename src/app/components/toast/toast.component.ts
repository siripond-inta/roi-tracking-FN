// src/app/components/toast/toast.component.ts
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast.component.html',
  styleUrl: './toast.component.css'
})
export class ToastComponent {
  // inject ผ่าน constructor เพื่อให้ template เข้าถึงได้
  constructor(public toastService: ToastService) {}
}
