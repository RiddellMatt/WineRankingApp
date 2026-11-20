import { legalDocHref, onLegalDocClick, type LegalDoc } from '../lib/legalDocs'

export function LegalDocLink({ file, children }: { file: LegalDoc; children: string }) {
  return (
    <a href={legalDocHref(file)} onClick={(event) => onLegalDocClick(event, file)}>
      {children}
    </a>
  )
}
