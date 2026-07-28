export interface HealthResponse {
  database: 'up' | 'down';
  status: 'ok' | 'error';
  timestamp: string;
}
