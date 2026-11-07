/** Build push title/body/deep link from a notifications row (mirrors client notificationMessage). */

export type PushNotificationType =
  | 'reaction'
  | 'friend_request'
  | 'friend_accepted'
  | 'friend_badge_unlock'
  | 'friend_journey_complete'

export interface PushMessage {
  title: string
  body: string
  deepLink: string
}

const SCHEME = 'com.northline.decanti'

const TIER_LABEL: Record<string, string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
  diamond: 'Diamond',
}

const REACTION_EMOJI: Record<string, string> = {
  cheers: '🥂',
  fire: '🔥',
  nice: '👏',
}

export function pushDeepLink(tab: 'feed' | 'manage'): string {
  return `${SCHEME}://friends?tab=${tab}`
}

export function shouldSendPushForType(
  type: PushNotificationType,
  prefs: Record<string, unknown> | null,
): boolean {
  if (!prefs || prefs.enabled === false) return false
  switch (type) {
    case 'friend_request':
      return prefs.friend_requests !== false
    case 'friend_accepted':
      return prefs.friend_accepted !== false
    case 'reaction':
      return prefs.reactions !== false
    case 'friend_badge_unlock':
    case 'friend_journey_complete':
      return prefs.friend_milestones === true
    default:
      return false
  }
}

export function buildPushMessage(input: {
  type: PushNotificationType
  payload: Record<string, unknown>
  actorName: string
}): PushMessage {
  const { type, payload, actorName } = input
  const title = 'Decanti'
  switch (type) {
    case 'reaction': {
      const emoji = REACTION_EMOJI[String(payload.reaction_type)] ?? '✨'
      const verb = payload.event_type === 'saved_to_try' ? 'want-to-try save' : 'wine log'
      const wine = String(payload.wine_name ?? 'a wine')
      return {
        title,
        body: `${actorName} reacted ${emoji} to your ${verb} — ${wine}`,
        deepLink: pushDeepLink('feed'),
      }
    }
    case 'friend_request':
      return {
        title,
        body: `${actorName} sent you a friend request`,
        deepLink: pushDeepLink('manage'),
      }
    case 'friend_accepted':
      return {
        title,
        body: `${actorName} accepted your friend request`,
        deepLink: pushDeepLink('manage'),
      }
    case 'friend_badge_unlock': {
      const icon = String(payload.badge_icon ?? '🏅')
      const tier = TIER_LABEL[String(payload.tier)] ?? String(payload.tier ?? '')
      const badgeTitle = String(payload.badge_title ?? 'Badge')
      return {
        title,
        body: `${actorName} earned ${icon} ${badgeTitle}${tier ? ` — ${tier}` : ''}`,
        deepLink: pushDeepLink('feed'),
      }
    }
    case 'friend_journey_complete': {
      const icon = String(payload.journey_icon ?? '🧭')
      const journeyTitle = String(payload.journey_title ?? 'a journey')
      return {
        title,
        body: `${actorName} completed ${icon} ${journeyTitle}`,
        deepLink: pushDeepLink('feed'),
      }
    }
    default:
      return { title, body: 'You have a new notification', deepLink: pushDeepLink('feed') }
  }
}
