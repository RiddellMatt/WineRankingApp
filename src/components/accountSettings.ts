export type AccountSettingsSection =
  | 'menu'
  | 'profile'
  | 'subscription'
  | 'appearance'
  | 'notifications'

export const SETTINGS_SECTION_TITLES: Record<AccountSettingsSection, string> = {
  menu: 'Settings',
  profile: 'Edit profile',
  subscription: 'Manage subscription',
  appearance: 'App appearance',
  notifications: 'Notification settings',
}