import {
  BellOutlined,
  CheckCircleTwoTone,
  ExclamationCircleTwoTone,
  InfoCircleTwoTone,
  WarningTwoTone,
} from '@ant-design/icons'
import { Badge, Button, Empty, Flex, List, Popover, Typography } from 'antd'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useApiMutation, useNotifications } from '../api/hooks'
import type { Notification } from '../api/types'

dayjs.extend(relativeTime)

const ICONS = {
  info: <InfoCircleTwoTone />,
  success: <CheckCircleTwoTone twoToneColor="#52c41a" />,
  warning: <WarningTwoTone twoToneColor="#faad14" />,
  error: <ExclamationCircleTwoTone twoToneColor="#ff4d4f" />,
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const { data } = useNotifications()
  const notifications = data?.results ?? []
  const unread = notifications.filter((n) => !n.is_read).length

  const markAll = useApiMutation(() => api.post('/notifications/mark_all_read/'))
  const markOne = useApiMutation((id: string) => api.patch(`/notifications/${id}/`, { is_read: true }))

  const openNotification = (n: Notification) => {
    if (!n.is_read) markOne.mutate(n.id)
    if (n.link) navigate(n.link)
    setOpen(false)
  }

  const content = (
    <div style={{ width: 340, maxHeight: 420, overflowY: 'auto' }}>
      <Flex justify="space-between" align="center" style={{ marginBottom: 8 }}>
        <Typography.Text strong>Notifications</Typography.Text>
        <Button type="link" size="small" disabled={!unread} onClick={() => markAll.mutate(undefined)}>
          Mark all read
        </Button>
      </Flex>
      {notifications.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="You're all caught up" />
      ) : (
        <List
          dataSource={notifications}
          renderItem={(n) => (
            <List.Item
              onClick={() => openNotification(n)}
              style={{ cursor: 'pointer', opacity: n.is_read ? 0.6 : 1, padding: '10px 4px' }}
            >
              <List.Item.Meta
                avatar={ICONS[n.level]}
                title={<span style={{ fontWeight: n.is_read ? 400 : 600 }}>{n.title}</span>}
                description={
                  <>
                    <div>{n.message}</div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(n.created_at).fromNow()}
                    </Typography.Text>
                  </>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  )

  return (
    <Popover content={content} trigger="click" open={open} onOpenChange={setOpen} placement="bottomRight">
      <Badge count={unread} size="small">
        <Button shape="circle" icon={<BellOutlined />} />
      </Badge>
    </Popover>
  )
}
