import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { gcApiAuthInterceptor, gcApiErrorInterceptor, gcApiRefreshInterceptor } from './core/http/gc-api.interceptors';
import { TitleStrategy, provideRouter } from '@angular/router';
import { provideFormlyCore } from '@ngx-formly/core';
import { withFormlyMaterial } from '@ngx-formly/material';
import { routes } from './app.routes';
import { GcTitleStrategy } from './core/branding/gc-title-strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: TitleStrategy, useClass: GcTitleStrategy },
    provideHttpClient(withInterceptors([
      gcApiErrorInterceptor,
      gcApiAuthInterceptor,
      gcApiRefreshInterceptor,
    ])),
    provideFormlyCore(withFormlyMaterial()),
  ],
};
