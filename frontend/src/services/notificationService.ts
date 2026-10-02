import { Notification } from '../types';
import { repositoryService } from './repositoryService';

const STORAGE_KEY = 'flowforge_read_notifications';

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // Ignore storage quota errors
  }
}

export const notificationService = {
  async getNotifications(): Promise<Notification[]> {
    try {
      const repos = await repositoryService.getRepositories();
      const readIds = getReadIds();
      const notifs: Notification[] = [];

      repos.forEach((repo) => {
        if (repo.lastWorkflowStatus === 'failed') {
          const id = `notif-fail-${repo.id}`;
          notifs.push({
            id,
            type: 'failure',
            title: `Build Failure in ${repo.name}`,
            message: `Latest GitHub Actions workflow run failed. Review failure logs and trigger diagnostics.`,
            repoId: repo.id,
            repoName: repo.name,
            isRead: readIds.has(id),
            createdAt: repo.lastUpdated || new Date().toISOString(),
          });
        }
        if (repo.openDiscussionsCount > 0) {
          const id = `notif-disc-${repo.id}`;
          notifs.push({
            id,
            type: 'mention',
            title: `Open Discussions in ${repo.name}`,
            message: `${repo.openDiscussionsCount} active discussion thread(s) pending review.`,
            repoId: repo.id,
            repoName: repo.name,
            isRead: readIds.has(id),
            createdAt: repo.lastUpdated || new Date().toISOString(),
          });
        }
      });

      return notifs;
    } catch {
      return [];
    }
  },

  async markAsRead(id: string): Promise<void> {
    const readIds = getReadIds();
    readIds.add(id);
    saveReadIds(readIds);
  },

  async markAllAsRead(): Promise<void> {
    const notifs = await this.getNotifications();
    const readIds = getReadIds();
    notifs.forEach((n) => readIds.add(n.id));
    saveReadIds(readIds);
  }
};
