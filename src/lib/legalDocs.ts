import type { MouseEvent } from 'react'
import { isNativeApp } from './platform'
import { openExternalUrl } from './openUrl'

const PUBLISHED_SITE = 'https://decantiwine.com'

export type LegalDoc = 'privacy.html' | 'terms.html'

/** On iPhone the page opens in Safari, which can scroll and has a Done button. */
export function legalDocHref(file: LegalDoc): string {
  if (isNativeApp()) return `${PUBLISHED_SITE}/${file}`
  return `${import.meta.env.BASE_URL}${file}`
}

export function onLegalDocClick(event: MouseEvent<HTMLAnchorElement>, file: LegalDoc): void {
  if (!isNativeApp()) return
  event.preventDefault()
  void openExternalUrl(`${PUBLISHED_SITE}/${file}`)
}
