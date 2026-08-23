import apiClient, { USE_MOCK_DATA } from './apiClient';
import { Notification } from '../types';
import { mockNotifications } from '../mock/data';

export const notificationService = {
  async getNotifications(): Promise<Notification[]> {
    if (USE_MOCK_DATA) {
      return Promise.resolve(mockNotifications);
    }
    const response = await apiClient.get('/notifications');
    return response.data;
  },

  async markAsRead(notificationId: string): Promise<void> {
    if (USE_MOCK_DATA) {
      const notification = mockNotifications.find(n => n.id === notificationId);
      if (notification) {
        notification.isRead = true;
      }
      return Promise.resolve();
    }
    await apiClient.post(`/notifications/${notificationId}/read`);
  },

  async markAllAsRead(): Promise<void> {
    if (USE_MOCK_DATA) {
      mockNotifications.forEach(n => {
        n.isRead = true;
      });
      return Promise.resolve();
    }
    await apiClient.post('/notifications/read-all');
  }
};
