/**
 * Real-Time Notification Center Component
 * Live alerts, webhooks, and notification preferences
 */

'use client'

import { useState, useEffect } from 'react'
import { Bell, Mail, MessageSquare, Smartphone, Settings, Check, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'

interface Notification {
  id: string
  type: 'sale' | 'price-drop' | 'goal' | 'tax' | 'alert' | 'system'
  title: string
  message: string
  timestamp: Date
  read: boolean
  priority: 'low' | 'medium' | 'high' | 'urgent'
  actionUrl?: string
}

interface NotificationPreferences {
  email: {
    enabled: boolean
    sales: boolean
    priceAlerts: boolean
    goals: boolean
    taxDeadlines: boolean
    weeklyReports: boolean
  }
  push: {
    enabled: boolean
    sales: boolean
    priceAlerts: boolean
    goals: boolean
    taxDeadlines: boolean
  }
  sms: {
    enabled: boolean
    urgentOnly: boolean
  }
}

interface NotificationCenterProps {
  className?: string
}

export function NotificationCenter({ className }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'sale',
      title: 'New Sale',
      message: 'Nike Air Max 90 sold for £125.00 on StockX',
      timestamp: new Date(Date.now() - 1000 * 60 * 15), // 15 mins ago
      read: false,
      priority: 'medium'
    },
    {
      id: '2',
      type: 'goal',
      title: 'Monthly Goal Achieved!',
      message: 'You\'ve hit your £5,000 monthly revenue goal',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      read: false,
      priority: 'high'
    },
    {
      id: '3',
      type: 'tax',
      title: 'VAT Return Due Soon',
      message: 'VAT return for Q4 2024 due in 7 days',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      read: true,
      priority: 'urgent'
    },
    {
      id: '4',
      type: 'price-drop',
      title: 'Price Alert',
      message: 'Yeezy Boost 350 market price dropped 15%',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
      read: true,
      priority: 'low'
    }
  ])

  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email: {
      enabled: true,
      sales: true,
      priceAlerts: true,
      goals: true,
      taxDeadlines: true,
      weeklyReports: true
    },
    push: {
      enabled: true,
      sales: true,
      priceAlerts: false,
      goals: true,
      taxDeadlines: true
    },
    sms: {
      enabled: false,
      urgentOnly: true
    }
  })

  const [showSettings, setShowSettings] = useState(false)

  const markAsRead = (id: string) => {
    setNotifications(notifications.map(n =>
      n.id === id ? { ...n, read: true } : n
    ))
  }

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })))
  }

  const deleteNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id))
  }

  const unreadCount = notifications.filter(n => !n.read).length

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'sale': return '💰'
      case 'price-drop': return '📉'
      case 'goal': return '🎯'
      case 'tax': return '📋'
      case 'alert': return '⚠️'
      case 'system': return '⚙️'
    }
  }

  const getTimeAgo = (timestamp: Date) => {
    const seconds = Math.floor((Date.now() - timestamp.getTime()) / 1000)
    if (seconds < 60) return 'Just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  return (
    <div className={cn('bg-elev-1 border border-border rounded-xl p-5', className)}>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Bell className="h-5 w-5 text-accent" />
            {unreadCount > 0 && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] font-bold">
                {unreadCount}
              </div>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-fg">Notifications</h3>
            <p className="text-sm text-muted mt-0.5">Stay updated with real-time alerts</p>
          </div>
        </div>
        <div className="flex gap-2">
          {unreadCount > 0 && (
            <Button
              onClick={markAllAsRead}
              size="sm"
              variant="outline"
              className="border-border/30"
            >
              <Check className="h-4 w-4 mr-2" />
              Mark all read
            </Button>
          )}
          <Button
            onClick={() => setShowSettings(!showSettings)}
            size="sm"
            className="bg-accent/20 text-fg hover:bg-accent/30"
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="mb-5 p-4 bg-elev-0 rounded-lg border border-border/30">
          <div className="text-sm font-semibold text-fg mb-4">Notification Preferences</div>

          {/* Email Notifications */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-accent" />
                <div className="text-sm font-semibold text-fg">Email Notifications</div>
              </div>
              <input
                type="checkbox"
                checked={preferences.email.enabled}
                onChange={(e) => setPreferences({
                  ...preferences,
                  email: { ...preferences.email, enabled: e.target.checked }
                })}
                className="rounded"
              />
            </div>
            {preferences.email.enabled && (
              <div className="ml-6 space-y-2">
                <label className="flex items-center justify-between text-xs cursor-pointer">
                  <span className="text-muted">Sales notifications</span>
                  <input
                    type="checkbox"
                    checked={preferences.email.sales}
                    onChange={(e) => setPreferences({
                      ...preferences,
                      email: { ...preferences.email, sales: e.target.checked }
                    })}
                    className="rounded"
                  />
                </label>
                <label className="flex items-center justify-between text-xs cursor-pointer">
                  <span className="text-muted">Price alerts</span>
                  <input
                    type="checkbox"
                    checked={preferences.email.priceAlerts}
                    onChange={(e) => setPreferences({
                      ...preferences,
                      email: { ...preferences.email, priceAlerts: e.target.checked }
                    })}
                    className="rounded"
                  />
                </label>
                <label className="flex items-center justify-between text-xs cursor-pointer">
                  <span className="text-muted">Goal achievements</span>
                  <input
                    type="checkbox"
                    checked={preferences.email.goals}
                    onChange={(e) => setPreferences({
                      ...preferences,
                      email: { ...preferences.email, goals: e.target.checked }
                    })}
                    className="rounded"
                  />
                </label>
                <label className="flex items-center justify-between text-xs cursor-pointer">
                  <span className="text-muted">Tax deadlines</span>
                  <input
                    type="checkbox"
                    checked={preferences.email.taxDeadlines}
                    onChange={(e) => setPreferences({
                      ...preferences,
                      email: { ...preferences.email, taxDeadlines: e.target.checked }
                    })}
                    className="rounded"
                  />
                </label>
                <label className="flex items-center justify-between text-xs cursor-pointer">
                  <span className="text-muted">Weekly performance reports</span>
                  <input
                    type="checkbox"
                    checked={preferences.email.weeklyReports}
                    onChange={(e) => setPreferences({
                      ...preferences,
                      email: { ...preferences.email, weeklyReports: e.target.checked }
                    })}
                    className="rounded"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Push Notifications */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-accent" />
                <div className="text-sm font-semibold text-fg">Push Notifications</div>
              </div>
              <input
                type="checkbox"
                checked={preferences.push.enabled}
                onChange={(e) => setPreferences({
                  ...preferences,
                  push: { ...preferences.push, enabled: e.target.checked }
                })}
                className="rounded"
              />
            </div>
            {preferences.push.enabled && (
              <div className="ml-6 space-y-2">
                <label className="flex items-center justify-between text-xs cursor-pointer">
                  <span className="text-muted">Sales notifications</span>
                  <input
                    type="checkbox"
                    checked={preferences.push.sales}
                    onChange={(e) => setPreferences({
                      ...preferences,
                      push: { ...preferences.push, sales: e.target.checked }
                    })}
                    className="rounded"
                  />
                </label>
                <label className="flex items-center justify-between text-xs cursor-pointer">
                  <span className="text-muted">Price alerts</span>
                  <input
                    type="checkbox"
                    checked={preferences.push.priceAlerts}
                    onChange={(e) => setPreferences({
                      ...preferences,
                      push: { ...preferences.push, priceAlerts: e.target.checked }
                    })}
                    className="rounded"
                  />
                </label>
                <label className="flex items-center justify-between text-xs cursor-pointer">
                  <span className="text-muted">Goal achievements</span>
                  <input
                    type="checkbox"
                    checked={preferences.push.goals}
                    onChange={(e) => setPreferences({
                      ...preferences,
                      push: { ...preferences.push, goals: e.target.checked }
                    })}
                    className="rounded"
                  />
                </label>
                <label className="flex items-center justify-between text-xs cursor-pointer">
                  <span className="text-muted">Tax deadlines</span>
                  <input
                    type="checkbox"
                    checked={preferences.push.taxDeadlines}
                    onChange={(e) => setPreferences({
                      ...preferences,
                      push: { ...preferences.push, taxDeadlines: e.target.checked }
                    })}
                    className="rounded"
                  />
                </label>
              </div>
            )}
          </div>

          {/* SMS Notifications */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-accent" />
                <div className="text-sm font-semibold text-fg">SMS Notifications</div>
              </div>
              <input
                type="checkbox"
                checked={preferences.sms.enabled}
                onChange={(e) => setPreferences({
                  ...preferences,
                  sms: { ...preferences.sms, enabled: e.target.checked }
                })}
                className="rounded"
              />
            </div>
            {preferences.sms.enabled && (
              <div className="ml-6">
                <label className="flex items-center justify-between text-xs cursor-pointer">
                  <span className="text-muted">Urgent notifications only</span>
                  <input
                    type="checkbox"
                    checked={preferences.sms.urgentOnly}
                    onChange={(e) => setPreferences({
                      ...preferences,
                      sms: { ...preferences.sms, urgentOnly: e.target.checked }
                    })}
                    className="rounded"
                  />
                </label>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-2">
        {notifications.length > 0 ? (
          notifications.map((notification) => (
            <div
              key={notification.id}
              className={cn(
                'p-4 rounded-lg border transition-all',
                !notification.read ? 'bg-accent/5 border-accent/30' : 'bg-elev-0 border-border/30',
                notification.priority === 'urgent' && 'border-red-400/30'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{getNotificationIcon(notification.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-fg">{notification.title}</div>
                      {!notification.read && (
                        <div className="w-2 h-2 rounded-full bg-accent"></div>
                      )}
                      {notification.priority === 'urgent' && (
                        <div className="px-2 py-0.5 bg-red-500/10 text-red-400 text-xs rounded font-semibold uppercase">
                          Urgent
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-dim">{getTimeAgo(notification.timestamp)}</div>
                  </div>
                  <div className="text-xs text-muted mb-3">{notification.message}</div>
                  <div className="flex gap-2">
                    {!notification.read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="text-xs text-accent hover:underline"
                      >
                        Mark as read
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notification.id)}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Delete
                    </button>
                    {notification.actionUrl && (
                      <button className="text-xs text-blue-400 hover:underline">
                        View details →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-8">
            <div className="text-dim text-sm mb-2">No notifications</div>
            <div className="text-xs text-muted">You're all caught up!</div>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="mt-5 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-400">
        <strong>Real-Time Updates:</strong> Notifications are delivered instantly via webhooks. Configure your preferences above to control what you receive.
      </div>
    </div>
  )
}
