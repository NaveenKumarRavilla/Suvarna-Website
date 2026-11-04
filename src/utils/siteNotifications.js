const STORAGE_KEY = 'suvarna_site_notifications';
const CHANGE_EVENT = 'suvarna:site-notifications';

export function readSiteNotifications() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveSiteNotifications(notifications) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch {
    return;
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

export function addSiteNotification(notification) {
  const nextNotification = {
    ...notification,
    id: `site-notification-${Date.now()}-${Math.round(Math.random() * 9999)}`,
    createdAt: new Date().toISOString(),
    read: false,
  };
  saveSiteNotifications([nextNotification, ...readSiteNotifications()].slice(0, 100));
  return nextNotification;
}

export function markSiteNotificationRead(id) {
  saveSiteNotifications(readSiteNotifications().map((notification) => (
    notification.id === id ? { ...notification, read: true } : notification
  )));
}

export function markAllSiteNotificationsRead(ids) {
  const selectedIds = new Set(ids);
  saveSiteNotifications(readSiteNotifications().map((notification) => (
    selectedIds.has(notification.id) ? { ...notification, read: true } : notification
  )));
}