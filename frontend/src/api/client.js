/**
 * RidersOS API Client
 * Replaces the Base44 SDK (@base44/sdk)
 * 
 * This provides the same interface as base44.entities and base44.auth
 * so minimal changes are needed in the existing codebase.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Token management
let authToken = localStorage.getItem('authToken');

export const setToken = (token) => {
  authToken = token;
  if (token) {
    localStorage.setItem('authToken', token);
  } else {
    localStorage.removeItem('authToken');
  }
};

export const getToken = () => authToken;

// Base fetch function with auth headers
const fetchAPI = async (endpoint, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw { status: response.status, ...error };
  }

  return response.json();
};

// File upload helper
const uploadFile = async (endpoint, file) => {
  const formData = new FormData();
  formData.append('file', file);

  const headers = {};
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Upload failed' }));
    throw { status: response.status, ...error };
  }

  return response.json();
};

// ============================================
// AUTH API (replaces base44.auth)
// ============================================
export const auth = {
  async me() {
    return fetchAPI('/auth/me');
  },

  async updateMe(data) {
    return fetchAPI('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async login(email, password) {
    const result = await fetchAPI('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (result.token) {
      setToken(result.token);
    }
    return result;
  },

  async register(email, password, firstName, lastName) {
    const result = await fetchAPI('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, firstName, lastName }),
    });
    if (result.token) {
      setToken(result.token);
    }
    return result;
  },

  async loginWithGoogle(googleToken, profile) {
    const result = await fetchAPI('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ googleToken, profile }),
    });
    if (result.token) {
      setToken(result.token);
    }
    return result;
  },

  logout(redirectUrl) {
    setToken(null);
    if (redirectUrl) {
      window.location.href = redirectUrl;
    }
  },

  redirectToLogin(returnUrl) {
    // Store return URL for after login
    if (returnUrl) {
      sessionStorage.setItem('returnUrl', returnUrl);
    }
    window.location.href = '/login';
  },

  isAuthenticated() {
    return !!authToken;
  }
};

// ============================================
// ENTITY FACTORY (replaces base44.entities)
// ============================================
const createEntityAPI = (entityName, basePath) => ({
  async list() {
    return fetchAPI(basePath);
  },

  async filter(criteria = {}) {
    const params = new URLSearchParams();
    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value);
      }
    });
    const queryString = params.toString();
    return fetchAPI(`${basePath}${queryString ? `?${queryString}` : ''}`);
  },

  async get(id) {
    return fetchAPI(`${basePath}/${id}`);
  },

  async create(data) {
    return fetchAPI(basePath, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id, data) {
    return fetchAPI(`${basePath}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(id) {
    return fetchAPI(`${basePath}/${id}`, {
      method: 'DELETE',
    });
  },
});

// ============================================
// ENTITIES (replaces base44.entities.*)
// ============================================
export const entities = {
  User: createEntityAPI('User', '/users'),
  
  Horse: {
    ...createEntityAPI('Horse', '/horses'),
  },
  
  HorseEvent: {
    ...createEntityAPI('HorseEvent', '/horses/events'),
    async filter(criteria) {
      if (criteria.horse_id) {
        return fetchAPI(`/horses/${criteria.horse_id}/events`);
      }
      return fetchAPI('/horses/events');
    },
    async create(data) {
      return fetchAPI('/horses/events', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
  },
  
  Stable: {
    ...createEntityAPI('Stable', '/stables'),
  },
  
  StableEvent: {
    async list(stableId) {
      return fetchAPI(`/stables/${stableId}/events`);
    },
    async create(stableId, data) {
      return fetchAPI(`/stables/${stableId}/events`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    async update(id, data) {
      return fetchAPI(`/stables/events/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    async delete(id) {
      return fetchAPI(`/stables/events/${id}`, {
        method: 'DELETE',
      });
    },
  },
  
  TrainingSession: createEntityAPI('TrainingSession', '/sessions'),
  
  Competition: createEntityAPI('Competition', '/competitions'),
  
  BillingRate: {
    ...createEntityAPI('BillingRate', '/billing/rates'),
    async filter(criteria) {
      const params = new URLSearchParams();
      if (criteria.trainer_email) {
        params.append('trainer_email', criteria.trainer_email);
      }
      return fetchAPI(`/billing/rates?${params.toString()}`);
    },
    async create(data) {
      return fetchAPI('/billing/rates', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    async bulkUpdate(rates) {
      return fetchAPI('/billing/rates', {
        method: 'PUT',
        body: JSON.stringify(rates),
      });
    },
  },
  
  MonthlyBillingSummary: {
    ...createEntityAPI('MonthlyBillingSummary', '/billing/summaries'),
    async filter(criteria) {
      const params = new URLSearchParams();
      Object.entries(criteria).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      return fetchAPI(`/billing/summaries?${params.toString()}`);
    },
  },
  
  Notification: {
    ...createEntityAPI('Notification', '/notifications'),
    async markAsRead(id) {
      return fetchAPI(`/notifications/${id}/read`, { method: 'PATCH' });
    },
    async markAllAsRead() {
      return fetchAPI('/notifications/mark-all-read', { method: 'POST' });
    },
    async getUnreadCount() {
      return fetchAPI('/notifications/unread-count');
    },
  },
  
  NotificationPreference: {
    async list() {
      return fetchAPI('/notifications/preferences');
    },
    async update(data) {
      return fetchAPI('/notifications/preferences', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    },
    async bulkUpdate(preferences) {
      return fetchAPI('/notifications/preferences/bulk', {
        method: 'PUT',
        body: JSON.stringify(preferences),
      });
    },
  },
  
  UserConnection: createEntityAPI('UserConnection', '/connections'),
  
  GuardianMinor: {
    async list() {
      return fetchAPI('/connections/guardians');
    },
    async filter(criteria) {
      const params = new URLSearchParams();
      Object.entries(criteria).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
      return fetchAPI(`/connections/guardians?${params.toString()}`);
    },
    async create(data) {
      return fetchAPI('/connections/guardians', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    async update(id, data) {
      return fetchAPI(`/connections/guardians/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    async delete(id) {
      return fetchAPI(`/connections/guardians/${id}`, {
        method: 'DELETE',
      });
    },
  },
  
  ContactMessage: createEntityAPI('ContactMessage', '/contact'),
};

// ============================================
// INTEGRATIONS (replaces base44.integrations)
// ============================================
export const integrations = {
  Core: {
    async UploadFile({ file }) {
      return uploadFile('/uploads', file);
    },
    async UploadMultipleFiles(files) {
      const formData = new FormData();
      files.forEach((file, index) => {
        formData.append(`file${index}`, file);
      });

      const headers = {};
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`${API_URL}/uploads/multiple`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        throw await response.json();
      }

      return response.json();
    },
  },
};

// ============================================
// USERS API (replaces base44.users)
// ============================================
export const users = {
  async inviteUser(email, role = 'user') {
    // In the self-hosted version, we don't send invites
    // Just return success - the user will be created when they sign up
    console.log(`User invite requested for ${email} with role ${role}`);
    return { success: true, email };
  }
};

// ============================================
// APP LOGS API (replaces base44.appLogs)
// ============================================
export const appLogs = {
  async logUserInApp(pageName) {
    // Analytics logging - not implemented in self-hosted version
    // Could be extended to log to your own analytics service
    return { success: true };
  }
};

// ============================================
// MAIN EXPORT (drop-in replacement for base44)
// ============================================
export const base44 = {
  auth,
  entities,
  integrations,
  users,
  appLogs,
};

export default base44;
