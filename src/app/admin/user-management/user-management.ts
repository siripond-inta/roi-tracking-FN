import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-user-management',
  imports: [CommonModule],
  templateUrl: './user-management.html',
  styleUrl: './user-management.css',
})
export class UserManagement {
  users = [
    { name: 'Alice Johnson', email: 'alice@example.com', role: 'Admin', selected: false, lastLoginDate: '2024-10-01', monthsAgo: 8 },
    { name: 'Bob Smith', email: 'bob@example.com', role: 'User', selected: false, lastLoginDate: '2024-09-15', monthsAgo: 9 },
    { name: 'Carol White', email: 'carol@example.com', role: 'User', selected: true, lastLoginDate: '2024-08-20', monthsAgo: 10 },
    { name: 'David Lee', email: 'david@example.com', role: 'User', selected: true, lastLoginDate: '2024-07-30', monthsAgo: 11 },
  ];
}

