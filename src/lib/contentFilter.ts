/** Keep the pattern in sync with private.reject_blocked_phrase in the safety migration. */
const BLOCKED_PHRASES = [
  'kill yourself',
  'nigger',
  'nigga',
  'faggot',
  'retard',
  'cunt',
  'bitch',
  'fuck',
  'shit',
  'porn',
  'kys',
]

export const CONTENT_REJECTED_MESSAGE = "That text isn't allowed. Change it and try again."

const BLOCKED_PATTERN = new RegExp(
  `\\b(?:${BLOCKED_PHRASES.map((phrase) =>
    phrase
      .split(/\s+/)
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('\\s+'),
  ).join('|')})\\b`,
  'i',
)

export function containsBlockedPhrase(value: string): boolean {
  return BLOCKED_PATTERN.test(value)
}

export function assertCleanText(value: string): void {
  if (containsBlockedPhrase(value)) {
    throw new Error(CONTENT_REJECTED_MESSAGE)
  }
}
