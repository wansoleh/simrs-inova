import { Tag } from 'antd'
import { INVOICE_STATUS, LAB_STATUS, RX_STATUS, VISIT_STATUS } from '../lib/constants'

const MAPS = {
  visit: VISIT_STATUS,
  invoice: INVOICE_STATUS,
  rx: RX_STATUS,
  lab: LAB_STATUS,
}

export default function StatusTag({ type = 'visit', status, size = 'default' }) {
  const map = MAPS[type] || VISIT_STATUS
  const item = map[status] || { label: status || '-', color: 'default' }
  return (
    <Tag
      color={item.color}
      bordered={false}
      style={{ borderRadius: 999, fontWeight: 600, paddingInline: size === 'small' ? 8 : 10 }}
    >
      {item.label}
    </Tag>
  )
}
