import { Notification } from '../../contexts/NotificationContext'

interface NotificationContainerProps {
  notifications: Notification[]
}

export default function NotificationContainer({ notifications }: NotificationContainerProps) {
  if (notifications.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {notifications.map((notification) => (
        <NotificationItem key={notification.id} notification={notification} />
      ))}
    </div>
  )
}

interface NotificationItemProps {
  notification: Notification
}

function NotificationItem({ notification }: NotificationItemProps) {
  const typeStyles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }

  const iconStyles = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  }

  return (
    <div className={`max-w-sm w-full shadow-lg rounded-lg border p-4 ${typeStyles[notification.type]}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <span className="text-lg">{iconStyles[notification.type]}</span>
        </div>
        <div className="ml-3 w-0 flex-1">
          <p className="text-sm font-medium">{notification.title}</p>
          {notification.message && (
            <p className="mt-1 text-sm opacity-80">{notification.message}</p>
          )}
          {notification.action && (
            <div className="mt-2">
              <button
                onClick={notification.action.onClick}
                className="text-sm underline hover:no-underline"
              >
                {notification.action.label}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
