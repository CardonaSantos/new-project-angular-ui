import { API_ENDPOINTS } from './api-endpoints';

describe('API endpoint registry', () => {
  it('keeps the server prefix and encodes identifier paths', () => {
    expect(API_ENDPOINTS.auth.login).toBe('/api/auth/login');
    expect(API_ENDPOINTS.orders.detail('a/b c')).toBe('/api/orders/a%2Fb%20c');
  });
});
