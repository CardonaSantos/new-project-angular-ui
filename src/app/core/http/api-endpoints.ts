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
  organization: {
    company: '/api/organization',
    capabilities: '/api/organization/capabilities',
    branches: '/api/branches',
    myAccess: '/api/branches/my-access',
    branchOptions: '/api/branches/options',
    branch: (id: string) => '/api/branches/' + segment(id),
    branchStatus: (id: string) => '/api/branches/' + segment(id) + '/status',
    branchConfig: (id: string) => '/api/branches/' + segment(id) + '/config',
    branchOverview: (id: string) => '/api/branches/' + segment(id) + '/overview',
    devices: '/api/devices',
    deviceOptions: '/api/devices/options',
    device: (id: string) => '/api/devices/' + segment(id),
    deviceStatus: (id: string) => '/api/devices/' + segment(id) + '/status',
  },
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
