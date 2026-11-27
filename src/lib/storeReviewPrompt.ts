/** Ask after a few rated bottles, or the first time a journey seal is earned. Once. */
export const STORE_REVIEW_RATED_COUNT = 3

export function shouldRequestStoreReview(input: {
  ratedCount: number
  journeyCompleted: boolean
  alreadyAsked: boolean
}): boolean {
  if (input.alreadyAsked) return false
  return input.journeyCompleted || input.ratedCount >= STORE_REVIEW_RATED_COUNT
}
