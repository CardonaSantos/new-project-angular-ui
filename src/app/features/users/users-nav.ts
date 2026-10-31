
import {Component,inject} from '@angular/core';
import {RouterLink,RouterLinkActive} from '@angular/router';
import {UsersAccess} from './data-access/users-access';
@Component({
 selector:'gc-users-nav',imports:[RouterLink,RouterLinkActive],
 template:`
 <nav class="gc-u-tabs" aria-label="Usuarios y personal">
  @if(access.canRead()){<a routerLink="/users/staff" routerLinkActive="active"
    ariaCurrentWhenActive="page" [routerLinkActiveOptions]="{exact:false}">Usuarios</a>}
  @if(access.canGlobal('roles.read')){<a routerLink="/users/roles" routerLinkActive="active"
    ariaCurrentWhenActive="page" [routerLinkActiveOptions]="{exact:false}">Roles y permisos</a>}
  @if(access.canGlobal('users.reports.read')){<a routerLink="/users/reports" routerLinkActive="active"
    ariaCurrentWhenActive="page">Resumen</a>}
 </nav>`,
 styleUrl:'./users.scss'
})
export class GcUsersNav{protected readonly access=inject(UsersAccess)}
