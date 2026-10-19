import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';

export interface NavItem {
  label: string;
  icon: string;
  route: string;
}

export interface NavGroup {
  label: string;
  icon: string;
  items: NavItem[];
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastModule, ConfirmDialogModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly collapsed = signal(false);

  protected readonly navGroups: NavGroup[] = [
    {
      label: '系統管理 Admin',
      icon: 'pi pi-shield',
      items: [{ label: '角色 AppRole', icon: 'pi pi-id-card', route: '/app-roles' }],
    },
  ];

  /** Expanded nav groups, keyed by label. All open by default. */
  protected readonly openGroups = signal(new Set(this.navGroups.map((g) => g.label)));

  protected toggleGroup(label: string): void {
    this.openGroups.update((set) => {
      const next = new Set(set);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  protected toggleSidebar(): void {
    this.collapsed.update((v) => !v);
  }
}
