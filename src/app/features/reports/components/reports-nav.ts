import {Component} from '@angular/core';
import {RouterLink,RouterLinkActive} from '@angular/router';
@Component({
 selector:'gc-reports-nav',
 imports:[RouterLink,RouterLinkActive],
 template:`<nav class="rep-nav" aria-label="Secciones de reportes">
  <a routerLink="/workspace" routerLinkActive="rep-nav-active" [routerLinkActiveOptions]="{exact:true}">Panel operativo</a>
  <a routerLink="/reports" routerLinkActive="rep-nav-active" [routerLinkActiveOptions]="{exact:true}">Analítica</a>
 </nav>`
})
export class GcReportsNav{}
