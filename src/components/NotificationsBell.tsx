import { useCallback, useEffect, useRef, useState } from 'react'
import { Avatar } from './Avatar'
import { friendDisplayLabel } from '../lib/friendsDb'
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  formatNotificationTime,
  markAllNotificationsRead,
  markNotificationRead,
  notificationFriendsTab,
  notificationMessage,
  type AppNotification,
} from '../lib/notificationsDb'

interface Props {
  enabled: boolean
  onNavigateFriends: (tab: 'feed' | 'manage' | 'passport') => void
}

export function NotificationsBell({ enabled, onNavigateFriends }: Props) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const refresh = useCallback(async () => {
    if (!enabled) return
    try {
      const [list, count] = await Promise.all([
        fetchNotifications(),
        fetchUnreadNotificationCount(),
      ])
      setItems(list)
      setUnread(count)
    } catch {
      // ignore — table may not exist yet
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    refresh()
    const interval = window.setInterval(refresh, 60_000)
    const onFocus = () => refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
    }
  }, [enabled, refresh])

  useEffect(() => {
    if (!open || !enabled) return
    setLoading(true)
    refresh().finally(() => setLoading(false))
  }, [open, enabled, refresh])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (panelRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!enabled) return null

  async function handleOpen() {
    setOpen((prev) => !prev)
  }

  async function handleSelect(item: AppNotification) {
    if (!item.readAt) {
      try {
        await markNotificationRead(item.id)
        setItems((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)),
        )
        setUnread((prev) => Math.max(0, prev - 1))
      } catch {
        // continue navigation
      }
    }
    setOpen(false)
    onNavigateFriends(notificationFriendsTab(item))
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead()
      setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })))
      setUnread(0)
    } catch {
      // ignore
    }
  }

  return (
    <div className="notifications-bell">
      <button
        ref={buttonRef}
        type="button"
        className="notifications-trigger"
        aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={handleOpen}
      >
        <span className="notifications-trigger-icon" aria-hidden="true">
          🔔
        </span>
        {unread > 0 && (
          <span className="notifications-badge">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div ref={panelRef} className="notifications-panel" role="dialog" aria-label="Notifications">
          <div className="notifications-panel-header">
            <h2>Notifications</h2>
            {unread > 0 && (
              <button type="button" className="link-btn" onClick={handleMarkAllRead}>
                Mark all read
              </button>
            )}
          </div>

          {loading && items.length === 0 ? (
            <p className="notifications-empty">Loading…</p>
          ) : items.length === 0 ? (
            <p className="notifications-empty">No notifications yet.</p>
          ) : (
            <ul className="notifications-list">
              {items.map((item) => {
                const name = item.actor ? friendDisplayLabel(item.actor, 'Someone') : 'Someone'
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`notifications-item ${item.readAt ? 'read' : 'unread'}`}
                      onClick={() => handleSelect(item)}
                    >
                      {item.actor && (
                        <Avatar
                          displayName={name}
                          email={item.actor.email}
                          avatarUrl={item.actor.avatarUrl}
                          seed={item.actor.id}
                          size="sm"
                        />
                      )}
                      <span className="notifications-item-copy">
                        <span className="notifications-item-message">
                          {notificationMessage(item)}
                        </span>
                        <span className="notifications-item-time">
                          {formatNotificationTime(item.createdAt)}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
