import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert,
  App,
  Button,
  DatePicker,
  Drawer,
  Empty,
  Input,
  Select,
  Skeleton,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
} from 'antd'
import {
  CheckCircleOutlined,
  ExperimentOutlined,
  EyeOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  SyncOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { nodeApi, errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import PageHeader from '../components/PageHeader'
import StatusTag from '../components/StatusTag'
import { date, dateTime, initials, money, today } from '../lib/format'

const FLAGS = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'Tinggi' },
  { value: 'LOW', label: 'Rendah' },
  { value: 'CRITICAL', label: 'Kritis' },
]

function ResultRow({ item, onSaved, canWrite }) {
  const { message } = App.useApp()
  const [value, setValue] = useState(item.result_value || '')
  const [unit, setUnit] = useState(item.unit || item.result_unit || '')
  const [refRange, setRefRange] = useState(item.ref_range || item.result_ref_range || '')
  const [flag, setFlag] = useState(item.flag || item.result_flag || 'NORMAL')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const done = item.status === 'DONE'

  const save = async () => {
    if (!value.trim()) {
      message.warning('Isi hasil pemeriksaan terlebih dahulu')
      return
    }
    setSaving(true)
    try {
      const { data } = await nodeApi.post(`/lab/orders/${item.lab_order_id}/results`, {
        lab_order_item_id: item.id,
        result_value: value,
        unit,
        ref_range: refRange,
        flag,
        notes,
      })
      message.success(data.message || 'Hasil tersimpan')
      onSaved()
    } catch (error) {
      message.error(errorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="soft-card" style={{ marginBottom: 10 }}>
      <div className="flex-between" style={{ marginBottom: 8 }}>
        <div>
          <strong>{item.test_name}</strong>
          <div className="muted" style={{ fontSize: 11.5 }}>{item.test_code} · {item.unit || item.result_unit || '-'} · Rujukan {item.ref_range || item.result_ref_range || '-'}</div>
        </div>
        <Tag color={done ? 'green' : 'blue'}>{done ? 'Selesai' : 'Menunggu'}</Tag>
      </div>
      {done ? (
        <div className="flex-between">
          <div>
            <span className="tiny-label">Hasil</span>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{item.result_value} <span className="muted" style={{ fontSize: 12 }}>{item.unit || item.result_unit}</span></div>
          </div>
          <Tag color={item.flag === 'NORMAL' ? 'green' : item.flag === 'CRITICAL' ? 'red' : 'orange'}>{item.flag || 'NORMAL'}</Tag>
        </div>
      ) : canWrite ? (
        <div className="exam-form-grid">
          <div>
            <span className="tiny-label">Hasil</span>
            <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Nilai hasil" />
          </div>
          <div>
            <span className="tiny-label">Satuan</span>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="mg/dL" />
          </div>
          <div>
            <span className="tiny-label">Nilai Rujukan</span>
            <Input value={refRange} onChange={(e) => setRefRange(e.target.value)} placeholder="13–17" />
          </div>
          <div>
            <span className="tiny-label">Flag</span>
            <Select value={flag} onChange={setFlag} options={FLAGS} style={{ width: '100%' }} />
          </div>
          <div className="full">
            <span className="tiny-label">Catatan</span>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan hasil (opsional)" />
          </div>
          <div className="full">
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>Simpan Hasil</Button>
          </div>
        </div>
      ) : (
        <div className="muted">Menunggu petugas laboratorium mengisi hasil.</div>
      )}
    </div>
  )
}

export default function Lab() {
  const { hasPermission } = useAuth()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState('')
  const [orderDate, setOrderDate] = useState(dayjs(today()))
  const [detailId, setDetailId] = useState(params.get('order') ? Number(params.get('order')) : null)
  const canWrite = hasPermission('lab.result.write')

  useEffect(() => {
    const order = params.get('order')
    if (order) setDetailId(Number(order))
  }, [params])

  const ordersQ = useQuery({
    queryKey: ['lab-orders', status, orderDate?.format('YYYY-MM-DD')],
    queryFn: async () => (await nodeApi.get('/lab/orders', {
      params: { status: status || undefined, date: orderDate ? orderDate.format('YYYY-MM-DD') : undefined },
    })).data.data,
    refetchInterval: 30_000,
  })
  const detailQ = useQuery({
    queryKey: ['lab-order-detail', detailId],
    queryFn: async () => (await nodeApi.get(`/lab/orders/${detailId}`)).data.data,
    enabled: Boolean(detailId),
  })

  const rows = ordersQ.data || []
  const counts = useMemo(() => ({
    total: rows.length,
    waiting: rows.filter((r) => r.status === 'ORDERED').length,
    partial: rows.filter((r) => r.status === 'RESULT_PARTIAL').length,
    done: rows.filter((r) => r.status === 'DONE').length,
  }), [rows])

  const filtered = useMemo(() => {
    if (!status) return rows
    return rows.filter((row) => row.status === status)
  }, [rows, status])

  const closeDetail = () => {
    setDetailId(null)
    const next = new URLSearchParams(params)
    next.delete('order')
    setParams(next)
  }

  const columns = [
    { title: 'Order', dataIndex: 'order_no', render: (v) => <strong>{v}</strong> },
    {
      title: 'Pasien',
      dataIndex: 'patient_name',
      render: (_, row) => (
        <div className="patient-cell">
          <div className="patient-avatar">{initials(row.patient_name)}</div>
          <div>
            <strong>{row.patient_name}</strong>
            <span>{row.mrn} · {row.poli_name}</span>
          </div>
        </div>
      ),
    },
    { title: 'Dokter', dataIndex: 'doctor_name', responsive: ['lg'] },
    {
      title: 'Item',
      key: 'items',
      width: 100,
      render: (_, row) => <Tag>{row.items?.length || 0} tes</Tag>,
    },
    { title: 'Status', dataIndex: 'status', width: 130, render: (v) => <StatusTag type="lab" status={v} /> },
    { title: 'Dibuat', dataIndex: 'created_at', responsive: ['xl'], render: (v) => dateTime(v) },
    {
      title: '',
      key: 'action',
      width: 80,
      render: (_, row) => (
        <Tooltip title="Buka order">
          <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setDetailId(row.id)} />
        </Tooltip>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Penunjang Medis"
        title="Laboratorium"
        subtitle="Order dari dokter, input hasil, dan sinkronisasi otomatis ke rekam medis melalui layanan Node."
        extra={(
          <Space wrap>
            <DatePicker
              value={orderDate}
              onChange={setOrderDate}
              format="DD/MM/YYYY"
              allowClear
              placeholder="Semua tanggal"
            />
            <Button icon={<ReloadOutlined />} onClick={() => ordersQ.refetch()}>Muat ulang</Button>
          </Space>
        )}
      />

      {ordersQ.isError && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16, borderRadius: 14 }}
          message="Layanan laboratorium Node tidak dapat dihubungi"
          description="Pastikan service Node berjalan dan proxy /svc mengarah ke port yang benar."
          action={<Button size="small" onClick={() => ordersQ.refetch()}>Coba lagi</Button>}
        />
      )}

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <div className="stat-card tone-blue">
          <div className="stat-top"><div className="stat-icon"><ExperimentOutlined /></div></div>
          <div className="stat-label">Total order</div>
          <div className="stat-value">{counts.total}</div>
          <div className="stat-hint">Sesuai filter tanggal</div>
        </div>
        <div className="stat-card tone-amber">
          <div className="stat-top"><div className="stat-icon"><SyncOutlined /></div></div>
          <div className="stat-label">Menunggu hasil</div>
          <div className="stat-value">{counts.waiting}</div>
          <div className="stat-hint">Belum ada hasil</div>
        </div>
        <div className="stat-card tone-violet">
          <div className="stat-top"><div className="stat-icon"><SearchOutlined /></div></div>
          <div className="stat-label">Hasil sebagian</div>
          <div className="stat-value">{counts.partial}</div>
          <div className="stat-hint">Sebagian item selesai</div>
        </div>
        <div className="stat-card tone-green">
          <div className="stat-top"><div className="stat-icon"><CheckCircleOutlined /></div></div>
          <div className="stat-label">Selesai</div>
          <div className="stat-value">{counts.done}</div>
          <div className="stat-hint">Semua hasil terisi</div>
        </div>
      </div>

      <div className="panel">
        <Tabs
          activeKey={status || 'all'}
          onChange={(key) => setStatus(key === 'all' ? '' : key)}
          items={[
            { key: 'all', label: `Semua (${counts.total})` },
            { key: 'ORDERED', label: `Menunggu (${counts.waiting})` },
            { key: 'RESULT_PARTIAL', label: `Sebagian (${counts.partial})` },
            { key: 'DONE', label: `Selesai (${counts.done})` },
          ]}
        />
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={ordersQ.isLoading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 900 }}
          locale={{ emptyText: 'Tidak ada order laboratorium pada filter ini' }}
        />
      </div>

      <Drawer
        open={Boolean(detailId)}
        onClose={closeDetail}
        width={640}
        title="Detail Order Laboratorium"
        extra={detailQ.data && <StatusTag type="lab" status={detailQ.data.status} />}
      >
        {detailQ.isLoading ? <Skeleton active /> : detailQ.data ? (
          <>
            <div className="detail-hero" style={{ padding: 14 }}>
              <div style={{ flex: 1 }}>
                <h3>{detailQ.data.patient_name}</h3>
                <p>{detailQ.data.mrn} · {detailQ.data.poli_name} · {date(detailQ.data.visit_date)}</p>
                <p>Order {detailQ.data.order_no} · Dokter {detailQ.data.doctor_name}</p>
              </div>
            </div>
            {detailQ.data.notes && <Alert type="info" showIcon message={detailQ.data.notes} style={{ marginBottom: 12 }} />}
            {(detailQ.data.items || []).map((item) => (
              <ResultRow
                key={item.id}
                item={{ ...item, lab_order_id: detailQ.data.id }}
                canWrite={canWrite}
                onSaved={() => {
                  queryClient.invalidateQueries({ queryKey: ['lab-order-detail', detailId] })
                  queryClient.invalidateQueries({ queryKey: ['lab-orders'] })
                }}
              />
            ))}
            {!detailQ.data.items?.length && <Empty description="Tidak ada item pemeriksaan" />}
            <div className="soft-card" style={{ marginTop: 12 }}>
              <div className="flex-between">
                <div>
                  <span className="tiny-label">Total order</span>
                  <div style={{ fontWeight: 800 }}>{money((detailQ.data.items || []).reduce((sum, item) => sum + Number(item.unit_price || 0), 0))}</div>
                </div>
                <Tag color="cyan">Terintegrasi ke Yii</Tag>
              </div>
            </div>
          </>
        ) : <Empty description="Order tidak ditemukan" />}
      </Drawer>
    </div>
  )
}
