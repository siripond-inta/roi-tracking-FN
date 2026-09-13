import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Project } from '../../models/roi-tracking-model';
import { ProjectService } from '../../services/project.service';
import { ToastService } from '../../services/toast.service';
import { timeout, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

@Component({
  selector: 'app-community',
  standalone: true,
  imports: [RouterLink, RouterModule, CommonModule, FormsModule],
  templateUrl: './community.html',
  styleUrl: './community.css',
})
export class Community implements OnInit {
  projectList: Project[] = [];
  searchTerm: string = '';
  isLoading = false;

  constructor(
    private projectService: ProjectService,
    private toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadProjects();
  }

  // โหลดโปรเจกต์ public ของผู้ใช้คนอื่นที่แชร์ไว้ให้ดู
  loadProjects(): void {
    this.isLoading = true;
    this.projectService.getCommunityProjects().pipe(
      timeout(10000),
      catchError(err => {
        console.error('Error loading community projects:', err);
        this.toastService.error('ไม่สามารถโหลดโปรเจกต์ของชุมชนได้ กรุณาตรวจสอบ server');
        this.isLoading = false;
        return of([]);
      })
    ).subscribe({
      next: (projects) => {
        this.projectList = projects as Project[];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading community projects:', err);
        this.toastService.error('ไม่สามารถโหลดโปรเจกต์ของชุมชนได้ กรุณาลองใหม่อีกครั้ง');
        this.isLoading = false;
      }
    });
  }

  get filteredProjects(): Project[] {
    if (!this.searchTerm.trim()) return this.projectList;
    const term = this.searchTerm.toLowerCase();
    return this.projectList.filter(p =>
      p.project_name.toLowerCase().includes(term) ||
      (p.owner_name ?? '').toLowerCase().includes(term)
    );
  }

  // โปรเจกต์ที่มี Actual แล้ว → ไปหน้า actual-report, ถ้ายังไม่มี → estimated-report (read-only สำหรับผู้ชม)
  reportRoute(prj: Project): any[] {
    return prj.status === 'Actual'
      ? ['/user/actual-report', prj.project_id]
      : ['/user/estimated-report', prj.project_id];
  }
}
