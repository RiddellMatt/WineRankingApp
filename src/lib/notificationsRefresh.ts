export const NOTIFICATIONS_REFRESH_EVENT = 'decanti:notifications-refresh'

export function requestNotificationsRefresh(): void {
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_REFRESH_EVENT))
}
