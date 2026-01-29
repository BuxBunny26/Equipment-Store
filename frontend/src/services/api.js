import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

// For direct file access (window.open), we need the full URL
const getFullApiUrl = () => {
    if (process.env.REACT_APP_API_URL) {
        return process.env.REACT_APP_API_URL;
    }
    // In development, the backend runs on port 5000
    return 'http://localhost:5000/api';
};

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const message = error.response?.data?.error?.message || error.message || 'An error occurred';
        return Promise.reject(new Error(message));
    }
);

// Categories
export const categoriesApi = {
    getAll: () => api.get('/categories'),
    getById: (id) => api.get(`/categories/${id}`),
    create: (data) => api.post('/categories', data),
    update: (id, data) => api.put(`/categories/${id}`, data),
};

// Subcategories
export const subcategoriesApi = {
    getAll: (categoryId) => api.get('/subcategories', { params: { category_id: categoryId } }),
    getById: (id) => api.get(`/subcategories/${id}`),
    create: (data) => api.post('/subcategories', data),
    update: (id, data) => api.put(`/subcategories/${id}`, data),
};

// Locations
export const locationsApi = {
    getAll: (activeOnly = true) => api.get('/locations', { params: { active_only: activeOnly } }),
    getById: (id) => api.get(`/locations/${id}`),
    create: (data) => api.post('/locations', data),
    update: (id, data) => api.put(`/locations/${id}`, data),
};

// Personnel
export const personnelApi = {
    getAll: (activeOnly = true, search = '') => 
        api.get('/personnel', { params: { active_only: activeOnly, search } }),
    getById: (id) => api.get(`/personnel/${id}`),
    create: (data) => api.post('/personnel', data),
    update: (id, data) => api.put(`/personnel/${id}`, data),
};

// Equipment
export const equipmentApi = {
    getAll: (params = {}) => api.get('/equipment', { params }),
    getById: (id) => api.get(`/equipment/${id}`),
    getByCode: (equipmentId) => api.get(`/equipment/by-code/${equipmentId}`),
    create: (data) => api.post('/equipment', data),
    update: (id, data) => api.put(`/equipment/${id}`, data),
    getHistory: (id, limit = 50) => api.get(`/equipment/${id}/history`, { params: { limit } }),
};

// Movements
export const movementsApi = {
    getAll: (params = {}) => api.get('/movements', { params }),
    create: (data, photoFile) => {
        if (photoFile) {
            const formData = new FormData();
            Object.keys(data).forEach(key => {
                if (data[key] !== undefined && data[key] !== null) {
                    formData.append(key, data[key]);
                }
            });
            formData.append('photo', photoFile);
            return api.post('/movements', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        }
        return api.post('/movements', data);
    },
    handover: (data) => api.post('/movements/handover', data),
    getPhotoUrl: (movementId) => `${getFullApiUrl()}/movements/photo/${movementId}`,
};

// Reports
export const reportsApi = {
    getDashboard: () => api.get('/reports/dashboard'),
    getCheckedOut: () => api.get('/reports/checked-out'),
    getOverdue: () => api.get('/reports/overdue'),
    getAvailable: (categoryId) => api.get('/reports/available', { params: { category_id: categoryId } }),
    getLowStock: () => api.get('/reports/low-stock'),
    getConsumables: () => api.get('/reports/consumables'),
    getByCategory: () => api.get('/reports/by-category'),
    getByLocation: () => api.get('/reports/by-location'),
    getMovementHistory: (params) => api.get('/reports/movement-history', { params }),
    getUsageStats: (params) => api.get('/reports/usage-stats', { params }),
};

// Customers
export const customersApi = {
    getAll: (params = {}) => api.get('/customers', { params }),
    getById: (id) => api.get(`/customers/${id}`),
    create: (data) => api.post('/customers', data),
    update: (id, data) => api.put(`/customers/${id}`, data),
    getStats: () => api.get('/customers/stats/summary'),
};

// Calibration
export const calibrationApi = {
    // Get all equipment calibration status
    getStatus: (params = {}) => api.get('/calibration/status', { params }),
    
    // Get equipment due for calibration
    getDue: () => api.get('/calibration/due'),
    
    // Get calibration summary (counts by status)
    getSummary: () => api.get('/calibration/summary'),
    
    // Get calibration history for specific equipment
    getHistory: (equipmentId) => api.get(`/calibration/history/${equipmentId}`),
    
    // Add new calibration record (with optional certificate file)
    create: (data, certificateFile) => {
        const formData = new FormData();
        Object.keys(data).forEach(key => {
            if (data[key] !== undefined && data[key] !== null) {
                formData.append(key, data[key]);
            }
        });
        if (certificateFile) {
            formData.append('certificate', certificateFile);
        }
        return api.post('/calibration', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    
    // Update calibration record
    update: (id, data, certificateFile) => {
        const formData = new FormData();
        Object.keys(data).forEach(key => {
            if (data[key] !== undefined && data[key] !== null) {
                formData.append(key, data[key]);
            }
        });
        if (certificateFile) {
            formData.append('certificate', certificateFile);
        }
        return api.put(`/calibration/${id}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    
    // Delete calibration record
    delete: (id) => api.delete(`/calibration/${id}`),
    
    // Get certificate file URL (for viewing in browser) - uses full URL for window.open
    getCertificateUrl: (recordId) => `${getFullApiUrl()}/calibration/certificate/${recordId}`,
    
    // Get certificate download URL - uses full URL for window.open
    getDownloadUrl: (recordId) => `${getFullApiUrl()}/calibration/certificate/${recordId}/download`,
};

// Reservations
export const reservationsApi = {
    getAll: (params = {}) => api.get('/reservations', { params }),
    getCalendar: (start, end) => api.get('/reservations/calendar', { params: { start, end } }),
    checkAvailability: (equipmentId, startDate, endDate, excludeId) => 
        api.get('/reservations/check-availability', { 
            params: { equipment_id: equipmentId, start_date: startDate, end_date: endDate, exclude_id: excludeId } 
        }),
    getSummary: () => api.get('/reservations/summary'),
    create: (data) => api.post('/reservations', data),
    update: (id, data) => api.put(`/reservations/${id}`, data),
    updateStatus: (id, status, approvedBy) => 
        api.patch(`/reservations/${id}/status`, { status, approved_by: approvedBy }),
    delete: (id) => api.delete(`/reservations/${id}`),
};

// Maintenance
export const maintenanceApi = {
    getTypes: () => api.get('/maintenance/types'),
    getAll: (params = {}) => api.get('/maintenance', { params }),
    getForEquipment: (equipmentId) => api.get(`/maintenance/equipment/${equipmentId}`),
    getDue: (days = 30) => api.get('/maintenance/due', { params: { days } }),
    getSummary: () => api.get('/maintenance/summary'),
    create: (data) => api.post('/maintenance', data),
    update: (id, data) => api.put(`/maintenance/${id}`, data),
    complete: (id, data) => api.patch(`/maintenance/${id}/complete`, data),
    delete: (id) => api.delete(`/maintenance/${id}`),
};

// Audit Log
export const auditApi = {
    getAll: (params = {}) => api.get('/audit', { params }),
    getForRecord: (tableName, recordId) => api.get(`/audit/${tableName}/${recordId}`),
    getSummary: (days = 30) => api.get('/audit/summary/stats', { params: { days } }),
};

// Notifications
export const notificationsApi = {
    getAll: (params = {}) => api.get('/notifications', { params }),
    getUnreadCount: (userId) => api.get('/notifications/unread-count', { params: { user_id: userId } }),
    markAsRead: (id) => api.patch(`/notifications/${id}/read`),
    markAllAsRead: (userId) => api.patch('/notifications/mark-all-read', { user_id: userId }),
    delete: (id) => api.delete(`/notifications/${id}`),
    generate: () => api.post('/notifications/generate'),
    getSettings: (userId) => api.get(`/notifications/settings/${userId}`),
    updateSettings: (userId, data) => api.put(`/notifications/settings/${userId}`, data),
};

// Exports
export const exportsApi = {
    getEquipmentUrl: (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return `${getFullApiUrl()}/exports/equipment${queryString ? '?' + queryString : ''}`;
    },
    getMovementsUrl: (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return `${getFullApiUrl()}/exports/movements${queryString ? '?' + queryString : ''}`;
    },
    getCalibrationUrl: (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return `${getFullApiUrl()}/exports/calibration${queryString ? '?' + queryString : ''}`;
    },
    getCheckedOutUrl: () => `${getFullApiUrl()}/exports/checked-out`,
    getMaintenanceUrl: (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return `${getFullApiUrl()}/exports/maintenance${queryString ? '?' + queryString : ''}`;
    },
    getAuditUrl: (params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        return `${getFullApiUrl()}/exports/audit${queryString ? '?' + queryString : ''}`;
    },
    getCustomerEquipmentUrl: (customerId) => {
        const params = customerId ? `?customer_id=${customerId}` : '';
        return `${getFullApiUrl()}/exports/customer-equipment${params}`;
    },
};

// Users & Roles
export const usersApi = {
    getRoles: () => api.get('/users/roles'),
    getAll: (params = {}) => api.get('/users', { params }),
    getById: (id) => api.get(`/users/${id}`),
    create: (data) => api.post('/users', data),
    update: (id, data) => api.put(`/users/${id}`, data),
    updateRole: (id, roleId) => api.patch(`/users/${id}/role`, { role_id: roleId }),
    updateStatus: (id, isActive) => api.patch(`/users/${id}/status`, { is_active: isActive }),
    delete: (id) => api.delete(`/users/${id}`),
    getPermissions: (id) => api.get(`/users/${id}/permissions`),
    createRole: (data) => api.post('/users/roles', data),
    updateRole: (id, data) => api.put(`/users/roles/${id}`, data),
    deleteRole: (id) => api.delete(`/users/roles/${id}`),
};

// Equipment Images
export const equipmentImagesApi = {
    getAll: (equipmentId) => api.get(`/equipment-images/${equipmentId}`),
    getImageUrl: (imageId) => `${getFullApiUrl()}/equipment-images/file/${imageId}`,
    getPrimary: (equipmentId) => api.get(`/equipment-images/${equipmentId}/primary`),
    upload: (equipmentId, file, caption, isPrimary, uploadedBy) => {
        const formData = new FormData();
        formData.append('image', file);
        if (caption) formData.append('caption', caption);
        if (isPrimary) formData.append('is_primary', isPrimary);
        if (uploadedBy) formData.append('uploaded_by', uploadedBy);
        return api.post(`/equipment-images/${equipmentId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    uploadMultiple: (equipmentId, files, uploadedBy) => {
        const formData = new FormData();
        files.forEach(file => formData.append('images', file));
        if (uploadedBy) formData.append('uploaded_by', uploadedBy);
        return api.post(`/equipment-images/${equipmentId}/multiple`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
    },
    update: (imageId, data) => api.put(`/equipment-images/${imageId}`, data),
    setPrimary: (imageId) => api.patch(`/equipment-images/${imageId}/primary`),
    reorder: (equipmentId, imageIds) => 
        api.patch(`/equipment-images/${equipmentId}/reorder`, { imageIds }),
    delete: (imageId) => api.delete(`/equipment-images/${imageId}`),
};

export default api;
