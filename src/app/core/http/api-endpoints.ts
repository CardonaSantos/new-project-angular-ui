const segment = (id: string) => encodeURIComponent(id);

/** Known routes from the Gastro Core /api checkpoint. DTOs must be checked against Swagger. */
export const API_ENDPOINTS = {
  auth: {
    login: '/api/auth/login',
    me: '/api/auth/me',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout',
    logoutAll: '/api/auth/logout-all',
    password: '/api/auth/password',
    capabilities: '/api/auth/capabilities',
  },
  organization: { branches: '/api/branches', myAccess: '/api/branches/my-access' },
  inventory: {
    articles: '/api/inventory/articles',
    stock: '/api/inventory/stock',
  },
  orders: {
    list: '/api/orders',
    detail: (id: string) => '/api/orders/' + segment(id),
    send: (id: string) => '/api/orders/' + segment(id) + '/send',
  },
  kitchen: {
    tickets: '/api/kitchen/tickets',
    changes: '/api/kitchen/changes',
  },
} as const;
