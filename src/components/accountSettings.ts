export type AccountSettingsSection =
  | 'menu'
  | 'profile'
  | 'subscription'
  | 'appearance'
  | 'notifications'
  | 'ranking'
  | 'rating-tips'

export const SETTINGS_SECTION_TITLES: Record<AccountSettingsSection, string> = {
  menu: 'Settings',
  profile: 'Edit profile',
  subscription: 'Manage subscription',
  appearance: 'Appearance',
  notifications: 'Notification settings',
  ranking: 'Ranking preference',
  'rating-tips': 'Rating tips',
}