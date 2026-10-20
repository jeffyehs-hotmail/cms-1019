import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { authGuard, loginGuard } from './core/auth/auth.guard';
import { AuthService } from './core/auth/auth.service';

/** Home: the first page in the menu the user can see (系統管理 Admin is for the Admin role only). */
const home = () => (inject(AuthService).isAdmin() ? 'app-roles' : 'featured-promo-items');

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [loginGuard],
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    // Everything else requires a token (authGuard redirects to /login).
    path: '',
    canActivateChild: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: home },
      {
        path: 'app-users',
        loadComponent: () =>
          import('./features/app-users/app-user-list/app-user-list').then((m) => m.AppUserList),
      },
      {
        path: 'app-users/new',
        loadComponent: () =>
          import('./features/app-users/app-user-form/app-user-form').then((m) => m.AppUserForm),
      },
      {
        path: 'app-users/:id',
        loadComponent: () =>
          import('./features/app-users/app-user-detail/app-user-detail').then((m) => m.AppUserDetail),
      },
      {
        path: 'app-users/:id/edit',
        loadComponent: () =>
          import('./features/app-users/app-user-form/app-user-form').then((m) => m.AppUserForm),
      },
      {
        path: 'app-roles',
        loadComponent: () =>
          import('./features/app-roles/app-role-list/app-role-list').then((m) => m.AppRoleList),
      },
      {
        path: 'app-roles/new',
        loadComponent: () =>
          import('./features/app-roles/app-role-form/app-role-form').then((m) => m.AppRoleForm),
      },
      {
        path: 'app-roles/:id',
        loadComponent: () =>
          import('./features/app-roles/app-role-detail/app-role-detail').then((m) => m.AppRoleDetail),
      },
      {
        path: 'app-roles/:id/edit',
        loadComponent: () =>
          import('./features/app-roles/app-role-form/app-role-form').then((m) => m.AppRoleForm),
      },
      {
        path: 'publish-statuses',
        loadComponent: () =>
          import('./features/publish-statuses/publish-status-list/publish-status-list').then((m) => m.PublishStatusList),
      },
      {
        path: 'publish-statuses/new',
        loadComponent: () =>
          import('./features/publish-statuses/publish-status-form/publish-status-form').then((m) => m.PublishStatusForm),
      },
      {
        path: 'publish-statuses/:id',
        loadComponent: () =>
          import('./features/publish-statuses/publish-status-detail/publish-status-detail').then(
            (m) => m.PublishStatusDetail,
          ),
      },
      {
        path: 'publish-statuses/:id/edit',
        loadComponent: () =>
          import('./features/publish-statuses/publish-status-form/publish-status-form').then((m) => m.PublishStatusForm),
      },
      {
        path: 'partners',
        loadComponent: () => import('./features/partners/partner-list/partner-list').then((m) => m.PartnerList),
      },
      {
        path: 'partners/new',
        loadComponent: () => import('./features/partners/partner-form/partner-form').then((m) => m.PartnerForm),
      },
      {
        path: 'partners/:id',
        loadComponent: () => import('./features/partners/partner-detail/partner-detail').then((m) => m.PartnerDetail),
      },
      {
        path: 'partners/:id/edit',
        loadComponent: () => import('./features/partners/partner-form/partner-form').then((m) => m.PartnerForm),
      },
      {
        path: 'course-groups',
        loadComponent: () =>
          import('./features/course-groups/course-group-list/course-group-list').then((m) => m.CourseGroupList),
      },
      {
        path: 'course-groups/new',
        loadComponent: () =>
          import('./features/course-groups/course-group-form/course-group-form').then((m) => m.CourseGroupForm),
      },
      {
        path: 'course-groups/:id',
        loadComponent: () =>
          import('./features/course-groups/course-group-detail/course-group-detail').then((m) => m.CourseGroupDetail),
      },
      {
        path: 'course-groups/:id/edit',
        loadComponent: () =>
          import('./features/course-groups/course-group-form/course-group-form').then((m) => m.CourseGroupForm),
      },
      {
        path: 'courses',
        loadComponent: () => import('./features/courses/course-list/course-list').then((m) => m.CourseList),
      },
      {
        path: 'courses/new',
        loadComponent: () => import('./features/courses/course-form/course-form').then((m) => m.CourseForm),
      },
      {
        path: 'courses/:id',
        loadComponent: () => import('./features/courses/course-detail/course-detail').then((m) => m.CourseDetail),
      },
      {
        path: 'courses/:id/edit',
        loadComponent: () => import('./features/courses/course-form/course-form').then((m) => m.CourseForm),
      },
      {
        path: 'featured-promo-items',
        loadComponent: () =>
          import('./features/featured-promo-items/featured-promo-item-list/featured-promo-item-list').then(
            (m) => m.FeaturedPromoItemList,
          ),
      },
      {
        path: 'agent-token-usages',
        loadComponent: () =>
          import('./features/agent-token-usages/agent-token-usage-report/agent-token-usage-report').then(
            (m) => m.AgentTokenUsageReport,
          ),
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile').then((m) => m.Profile),
      },
      { path: '**', redirectTo: home },
    ],
  },
];
