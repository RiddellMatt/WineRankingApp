import { isNativeApp } from './platform'

export type WineCardShareAction = 'share' | 'save'

/** On native, ask whether to open the share sheet or save directly to Photos. Web goes straight to share/download. */
export async function pickWineCardShareAction(): Promise<WineCardShareAction | null> {
  if (!isNativeApp()) return 'share'

  const { ActionSheet, ActionSheetButtonStyle } = await import('@capacitor/action-sheet')
  const result = await ActionSheet.showActions({
    title: 'Wine card',
    message: 'Share or save your rating card as an image.',
    options: [
      { title: 'Share…' },
      { title: 'Save to Photos' },
      { title: 'Cancel', style: ActionSheetButtonStyle.Cancel },
    ],
  })

  if (result.canceled || result.index < 0) return null
  if (result.index === 1) return 'save'
  if (result.index === 0) return 'share'
  return null
}
