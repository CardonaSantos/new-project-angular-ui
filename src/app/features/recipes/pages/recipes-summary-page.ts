import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { RecipesApi } from '../data-access/recipes.api';
import { RecipesAccess } from '../data-access/recipes-access';
import { GcRecipesNav } from '../recipes-nav';
import { gcErrorMessage } from '../../../core/http/api-error';
import type { RecipeCoverage } from '../data-access/recipes.models';

@Component({
  selector: 'gc-recipes-summary-page',
  imports: [RouterLink, GcRecipesNav],
  template: `<main class="rec-page">
    <gc-recipes-nav />
    <section class="rec-card">
      <div class="rec-top">
        <h2>Resumen de recetas</h2>
        <a class="rec-button rec-primary" routerLink="/recipes/list">Ver recetas</a>
      </div>
      @if (loading()) {
        <p class="rec-muted" role="status">Consultando recetas…</p>
      }
      @if (error()) {
        <p class="rec-alert" role="alert">
          {{ error() }} <button type="button" (click)="load()">Reintentar</button>
        </p>
      }
      @if (data(); as report) {
        <div class="rec-metrics">
          <div class="rec-metric">
            <strong>{{ report.total }}</strong
            ><span>Recetas registradas</span>
          </div>
          <div class="rec-metric">
            <strong>{{ report.publicadas }}</strong
            ><span>Con fórmula publicada</span>
          </div>
          <div class="rec-metric">
            <strong>{{ report.recetasVenta }}</strong
            ><span>Para productos de la carta</span>
          </div>
          <div class="rec-metric">
            <strong>{{ report.recetasProduccion }}</strong
            ><span>Para preparaciones</span>
          </div>
          <div class="rec-metric">
            <strong>{{ report.variantesSinRecetaPublicada }}</strong
            ><span>Presentaciones pendientes de receta</span>
          </div>
        </div>
      }
    </section>
    <section class="rec-card">
      <div class="rec-top">
        <h2>Productos que necesitan receta</h2>
        <span class="rec-muted">Presentaciones de la carta</span>
      </div>
      <div class="rec-filters">
        <label class="rec-field"
          >Buscar producto
          <span class="rec-search-inline">
            <input
              [value]="search()"
              maxlength="120"
              (input)="search.set($any($event.target).value)"
              (keydown.enter)="$event.preventDefault(); apply()"
            />
            <button type="button" (click)="apply()">Buscar</button>
          </span>
        </label>
      </div>
      @if (data(); as r) {
        <div class="rec-table-wrap">
          <table class="rec-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Presentación</th>
                <th>Situación</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (item of r.pendientes.data; track item.id) {
                <tr>
                  <td>{{ item.producto.nombre }}</td>
                  <td>{{ item.nombre }}</td>
                  <td>Sin receta publicada</td>
                  <td>
                    @if (access.canManage()) {
                      <a
                        class="rec-link"
                        routerLink="/recipes/list/new"
                        [queryParams]="{ varianteId: item.id }"
                        [attr.aria-label]="
                          'Crear receta para ' + item.producto.nombre + ' ' + item.nombre
                        "
                        >Crear receta</a
                      >
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4">No hay presentaciones pendientes con estos filtros.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="rec-top rec-muted">
          <span
            >{{ r.pendientes.meta.total }} pendientes · Página {{ page() }} de
            {{ r.pendientes.meta.totalPages || 1 }}</span
          >
          <div class="rec-actions">
            <button type="button" [disabled]="page() <= 1" (click)="changePage(-1)">
              Anterior
            </button>
            <button
              type="button"
              [disabled]="page() >= r.pendientes.meta.totalPages"
              (click)="changePage(1)"
            >
              Siguiente
            </button>
          </div>
        </div>
      }
    </section>
  </main>`,
  styleUrl: '../recipes.scss',
})
export class GcRecipesSummaryPage implements OnInit {
  protected readonly access = inject(RecipesAccess);
  private readonly api = inject(RecipesApi);
  protected readonly data = signal<RecipeCoverage | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly page = signal(1);
  ngOnInit() {
    void this.load();
  }
  protected apply() {
    this.page.set(1);
    void this.load();
  }
  protected changePage(delta: number) {
    this.page.update((x) => Math.max(1, x + delta));
    void this.load();
  }
  protected async load() {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.data.set(
        await firstValueFrom(
          this.api.coverage({
            search: this.search().trim(),
            page: this.page(),
            limit: 20,
          }),
        ),
      );
    } catch (error) {
      this.error.set(gcErrorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
