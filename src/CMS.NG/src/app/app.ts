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
      items: [
        { label: '使用者 AppUser', icon: 'pi pi-user', route: '/app-users' },
        { label: '角色 AppRole', icon: 'pi pi-id-card', route: '/app-roles' },
        { label: '發布狀態 PublishStatus', icon: 'pi pi-flag', route: '/publish-statuses' },
        { label: 'Token 用量 AgentTokenUsage', icon: 'pi pi-chart-bar', route: '/agent-token-usages' },
      ],
    },
    {
      label: '首頁 Home',
      icon: 'pi pi-home',
      items: [{ label: '上稿作業 FeaturedPromoItem', icon: 'pi pi-megaphone', route: '/featured-promo-items' }],
    },
    {
      label: '課程管理 Course',
      icon: 'pi pi-book',
      items: [
        { label: '原廠 Partner', icon: 'pi pi-building', route: '/partners' },
        { label: '課程群組 CourseGroup', icon: 'pi pi-sitemap', route: '/course-groups' },
        { label: '課程 Course', icon: 'pi pi-book', route: '/courses' },
      ],
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
