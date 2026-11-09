import { Capacitor } from '@capacitor/core'
import { TabBar, type Tab } from '@capawesome/capacitor-tab-bar'

export type NativeTabId = 'cellar' | 'friends' | 'scan' | 'insights' | 'account'

const SELECTED_GOLD = '#E8B04B'

let visible = false
let listenerReady = false
let onSelectHandler: ((id: NativeTabId) => void) | null = null

export function isNativeIosTabBar(): boolean {
  return Capacitor.getPlatform() === 'ios'
}

export function setNativeTabBarSelectHandler(handler: ((id: NativeTabId) => void) | null): void {
  onSelectHandler = handler
}

function buildTabs(signedIn: boolean, pro: boolean): Tab[] {
  const tabs: Tab[] = [{ id: 'cellar', title: 'Cellar', systemImage: 'list.bullet' }]
  if (signedIn) {
    tabs.push({
      id: 'friends',
      title: 'Social',
      systemImage: 'bubble.left.and.bubble.right.fill',
    })
  }
  tabs.push(
    { id: 'scan', title: 'Add', systemImage: 'plus.circle.fill' },
    {
      id: 'insights',
      title: 'Stats',
      systemImage: 'chart.bar.fill',
      badge: pro ? undefined : 'PRO',
    },
    { id: 'account', title: 'Profile', systemImage: 'person.fill' },
  )
  return tabs
}

function pickSelected(tabs: Tab[], selected: NativeTabId): string {
  return tabs.some((t) => t.id === selected) ? selected : 'cellar'
}

async function ensureListener(): Promise<void> {
  if (!isNativeIosTabBar() || listenerReady) return
  await TabBar.addListener('tabSelected', (event) => {
    onSelectHandler?.(event.id as NativeTabId)
  })
  listenerReady = true
}

export async function hideNativeTabBar(): Promise<void> {
  if (!isNativeIosTabBar()) return
  document.documentElement.classList.remove('native-ios-tab-bar')
  visible = false
  try {
    await TabBar.hide()
  } catch {
    // Web / unimplemented.
  }
}

/** Show or refresh the system UITabBar (Liquid Glass on iOS 26+). Call after splash hide. */
export async function syncNativeTabBar(options: {
  signedIn: boolean
  pro: boolean
  selected: NativeTabId
}): Promise<void> {
  if (!isNativeIosTabBar()) return

  await ensureListener()
  document.documentElement.classList.add('native-ios-tab-bar')

  const tabs = buildTabs(options.signedIn, options.pro)
  const selectedTabId = pickSelected(tabs, options.selected)

  try {
    await TabBar.setColors({ selectedColor: SELECTED_GOLD })
    await TabBar.setTabs({ tabs, selectedTabId })
    if (!visible) {
      await TabBar.show()
      visible = true
    }
  } catch (err) {
    console.warn('Native tab bar unavailable', err)
    document.documentElement.classList.remove('native-ios-tab-bar')
  }
}

/** Keep native selection in sync when the web app changes tabs programmatically. */
export async function selectNativeTab(id: NativeTabId): Promise<void> {
  if (!isNativeIosTabBar() || !visible) return
  try {
    await TabBar.selectTabById({ id })
  } catch {
    // Ignore sync errors.
  }
}
