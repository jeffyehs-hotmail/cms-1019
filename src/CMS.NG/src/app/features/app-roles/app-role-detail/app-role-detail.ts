import { Component, OnInit, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MessageService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { ChipModule } from 'primeng/chip';
import { AppRole } from '../app-role.model';
import { AppRoleService } from '../app-role.service';

@Component({
  selector: 'app-app-role-detail',
  imports: [RouterLink, ButtonModule, ChipModule],
  templateUrl: './app-role-detail.html',
})
export class AppRoleDetail implements OnInit {
  private readonly service = inject(AppRoleService);
  private readonly router = inject(Router);
  private readonly messages = inject(MessageService);

  /** Route param `:id` (AppRole.pkid). */
  readonly id = input.required<string>();

  readonly role = signal<AppRole | null>(null);
  readonly notFound = signal(false);

  ngOnInit(): void {
    this.service.getById(Number(this.id())).subscribe({
      next: (role) => this.role.set(role),
      error: (err) => {
        this.notFound.set(true);
        if (err?.status !== 404) {
          this.messages.add({ severity: 'error', summary: '錯誤', detail: '無法載入角色資料' });
        }
      },
    });
  }

  back(): void {
    this.router.navigate(['/app-roles']);
  }

  edit(): void {
    this.router.navigate(['/app-roles', this.id(), 'edit']);
  }
}
