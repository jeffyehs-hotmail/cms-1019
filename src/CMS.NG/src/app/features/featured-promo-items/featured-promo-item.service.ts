import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';
import { FeaturedPromoItem, FeaturedPromoItemQuery, FeaturedPromoItemRequest } from './featured-promo-item.model';

@Injectable({ providedIn: 'root' })
export class FeaturedPromoItemService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/featured-promo-items`;

  /** Items of the Monday–Sunday week containing `query.weekOf`. */
  query(query: FeaturedPromoItemQuery): Observable<FeaturedPromoItem[]> {
    return this.http.post<FeaturedPromoItem[]>(`${this.baseUrl}/query`, query);
  }

  getById(pkid: number): Observable<FeaturedPromoItem> {
    return this.http.get<FeaturedPromoItem>(`${this.baseUrl}/${pkid}`);
  }

  create(request: FeaturedPromoItemRequest): Observable<FeaturedPromoItem> {
    return this.http.post<FeaturedPromoItem>(this.baseUrl, request);
  }

  update(request: FeaturedPromoItemRequest): Observable<FeaturedPromoItem> {
    return this.http.put<FeaturedPromoItem>(this.baseUrl, request);
  }

  delete(pkid: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${pkid}`);
  }

  /** "−": slot n → n−1, swapping with the item there. */
  moveUp(pkid: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${pkid}/move-up`, null);
  }

  /** "+": slot n → n+1, swapping with the item there. */
  moveDown(pkid: number): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${pkid}/move-down`, null);
  }
}
