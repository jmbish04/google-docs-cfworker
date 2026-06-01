// Google API Client Service for Cloudflare Workers
// Provides a lightweight abstraction over Google APIs using fetch

export interface GoogleApiClientConfig {
  accessToken: string;
}

export class GoogleApiClient {
  private accessToken: string;
  private baseUrls = {
    docs: 'https://docs.googleapis.com',
    drive: 'https://www.googleapis.com/drive/v3',
    sheets: 'https://sheets.googleapis.com/v4',
  };

  constructor(config: GoogleApiClientConfig) {
    this.accessToken = config.accessToken;
  }

  private getHeaders(contentType: string = 'application/json'): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': contentType,
    };
  }

  /**
   * Google Docs API Methods
   */
  async docs_get(documentId: string, fields?: string): Promise<any> {
    const url = new URL(`${this.baseUrls.docs}/v1/documents/${documentId}`);
    if (fields) {
      url.searchParams.set('fields', fields);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `Failed to get document: ${response.statusText}`);
    }

    return response.json();
  }

  async docs_batchUpdate(documentId: string, requests: any[]): Promise<any> {
    const response = await fetch(`${this.baseUrls.docs}/v1/documents/${documentId}:batchUpdate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ requests }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `Batch update failed: ${response.statusText}`);
    }

    return response.json();
  }

  async docs_create(title?: string): Promise<any> {
    const response = await fetch(`${this.baseUrls.docs}/v1/documents`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ title: title || 'Untitled Document' }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `Document creation failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Google Drive API Methods
   */
  async drive_list(query?: {
    q?: string;
    pageSize?: number;
    pageToken?: string;
    fields?: string;
    orderBy?: string;
  }): Promise<any> {
    const url = new URL(`${this.baseUrls.drive}/files`);

    if (query?.q) url.searchParams.set('q', query.q);
    if (query?.pageSize) url.searchParams.set('pageSize', query.pageSize.toString());
    if (query?.pageToken) url.searchParams.set('pageToken', query.pageToken);
    if (query?.fields) url.searchParams.set('fields', query.fields);
    if (query?.orderBy) url.searchParams.set('orderBy', query.orderBy);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `Failed to list files: ${response.statusText}`);
    }

    return response.json();
  }

  async drive_get(fileId: string, fields?: string): Promise<any> {
    const url = new URL(`${this.baseUrls.drive}/files/${fileId}`);
    if (fields) {
      url.searchParams.set('fields', fields);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `Failed to get file: ${response.statusText}`);
    }

    return response.json();
  }

  async drive_create(metadata: any): Promise<any> {
    const response = await fetch(`${this.baseUrls.drive}/files`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(metadata),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `Failed to create file: ${response.statusText}`);
    }

    return response.json();
  }

  async drive_update(fileId: string, metadata: any, queryParams?: Record<string, string>): Promise<any> {
    const url = new URL(`${this.baseUrls.drive}/files/${fileId}`);

    // Add query parameters if provided (e.g., addParents, removeParents)
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(metadata),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `Failed to update file: ${response.statusText}`);
    }

    return response.json();
  }

  async drive_delete(fileId: string): Promise<void> {
    const response = await fetch(`${this.baseUrls.drive}/files/${fileId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `Failed to delete file: ${response.statusText}`);
    }
  }

  /**
   * Google Sheets API Methods
   */
  async sheets_get(spreadsheetId: string, ranges?: string[], fields?: string): Promise<any> {
    const url = new URL(`${this.baseUrls.sheets}/spreadsheets/${spreadsheetId}`);

    if (ranges && ranges.length > 0) {
      ranges.forEach(range => url.searchParams.append('ranges', range));
    }
    if (fields) {
      url.searchParams.set('fields', fields);
    }

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `Failed to get spreadsheet: ${response.statusText}`);
    }

    return response.json();
  }

  async sheets_getValues(spreadsheetId: string, range: string): Promise<any> {
    const response = await fetch(
      `${this.baseUrls.sheets}/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
      {
        method: 'GET',
        headers: this.getHeaders(),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `Failed to get values: ${response.statusText}`);
    }

    return response.json();
  }

  async sheets_updateValues(
    spreadsheetId: string,
    range: string,
    values: any[][],
    valueInputOption: 'RAW' | 'USER_ENTERED' = 'USER_ENTERED'
  ): Promise<any> {
    const response = await fetch(
      `${this.baseUrls.sheets}/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=${valueInputOption}`,
      {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ values }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `Failed to update values: ${response.statusText}`);
    }

    return response.json();
  }

  async sheets_batchUpdate(spreadsheetId: string, requests: any[]): Promise<any> {
    const response = await fetch(
      `${this.baseUrls.sheets}/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ requests }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `Batch update failed: ${response.statusText}`);
    }

    return response.json();
  }

  async sheets_create(title: string): Promise<any> {
    const response = await fetch(`${this.baseUrls.sheets}/spreadsheets`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        properties: {
          title,
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `Failed to create spreadsheet: ${response.statusText}`);
    }

    return response.json();
  }

  async sheets_appendValues(
    spreadsheetId: string,
    range: string,
    values: any[][],
    valueInputOption: 'RAW' | 'USER_ENTERED' = 'USER_ENTERED'
  ): Promise<any> {
    const response = await fetch(
      `${this.baseUrls.sheets}/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=${valueInputOption}`,
      {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ values }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `Failed to append values: ${response.statusText}`);
    }

    return response.json();
  }
}
