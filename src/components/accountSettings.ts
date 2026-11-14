export type AccountSettingsSection =
  | 'menu'
  | 'profile'
  | 'subscription'
  | 'appearance'
  | 'notifications'
  | 'ranking'

export const SETTINGS_SECTION_TITLES: Record<AccountSettingsSection, string> = {
  menu: 'Settings',
  profile: 'Edit profile',
  subscription: 'Manage subscription',
  appearance: 'Appearance',
  notifications: 'Notification settings',
  ranking: 'Ranking',
}