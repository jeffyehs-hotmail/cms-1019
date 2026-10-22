import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

/** One RowAudit row of a record's history. `dateTime` is Taipei time without an offset, as stored. */
export interface RowAuditEntry {
  dateTime: string;
  userName: string;
  /** 'Insert' | 'Update' | 'Delete'. */
  actionType: string;
  actionDesc: string | null;
}

@Injectable({ providedIn: 'root' })
export class RowAuditService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/rowaudit`;

  /** History of one record (RowAudit.TableName + PrimaryKeyValues), newest first. */
  getHistory(tableName: string, pkid: string | number): Observable<RowAuditEntry[]> {
    const params = new HttpParams().set('tableName', tableName).set('pkid', String(pkid));
    return this.http.get<RowAuditEntry[]>(this.baseUrl, { params });
  }
}
