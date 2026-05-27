function NotificationsModal({
  notifications,
  onClose,
  onOpenNotification,
}) {
  return (
    <div className="modal-overlay">
      <div className="modal notifications-modal">
        <div className="modal-header">
          <div>
            <h2>Notificaciones</h2>

            <p>
              Eventos recientes del sistema
            </p>
          </div>

          <button onClick={onClose}>
            ×
          </button>
        </div>

        <div className="notifications-list">
          {notifications.length > 0 ? (
            notifications.map(
              (notification) => (
                <div
                  key={notification.id}
                  className={`notification-card ${
                    !notification.isRead
                      ? "notification-unread"
                      : ""
                  }`}
                  onClick={() =>
                    onOpenNotification(
                      notification
                    )
                  }
                >
                  <div className="notification-top">
                    <strong>
                      {
                        notification.title
                      }
                    </strong>

                    {!notification.isRead && (
                      <span className="notification-dot" />
                    )}
                  </div>

                  <p>
                    {
                      notification.message
                    }
                  </p>

                  <span className="notification-date">
                    {
                      notification.createdAt
                    }
                  </span>
                </div>
              )
            )
          ) : (
            <div className="empty-box">
              No hay notificaciones
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default NotificationsModal;