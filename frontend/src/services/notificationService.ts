import { Notification } from '../types';

export const notificationService = {
  async getNotifications(): Promise<Notification[]> {
    return [];
  },

  async markAsRead(id: string): Promise<void> {
    // Local operation
  },

  async markAllAsRead(): Promise<void> {
    // Local operation
  }
};
