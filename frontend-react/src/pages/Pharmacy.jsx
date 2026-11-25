import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  App,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
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
  EyeOutlined,
  InboxOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import PageHeader from '../components/PageHeader'
import StatusTag from '../components/StatusTag'
import { dateTime, initials, money, number, today } from '../lib/format'

const LOW_STOCK = 100

export default function Pharmacy() {
  const { hasPermission } = useAuth()
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') === 'stock' ? 'stock' : 'queue')
  const [search, setSearch] = useState('')
  const [detailId, setDetailId] = useState(null)
  const [adjustTarget, setAdjustTarget] = useState(null)
  const [adjustForm] = Form.useForm()
  const [busy, setBusy] = useState(null)

  const queueQ = useQuery({
    queryKey: ['pharmacy-queue', today()],
    queryFn: async () => (await api.get('/pharmacy/queue', { params: { date: today() } })).data.data,
    refetchInterval: 30_000,
  })
  const medicinesQ = useQuery({
    queryKey: ['medicines-pharmacy'],
    queryFn: async () => (await api.get('/medicines', { params: { per_page: 300, is_active: 1 } })).data.data,
  })
  const detailQ = useQuery({
    queryKey: ['rx-detail-pharmacy', detailId],
    queryFn: async () => (await api.get(`/prescriptions/${detailId}`)).data.data,
    enabled: Boolean(detailId),
  })

  const rows = queueQ.data || []
  const submitted = rows.filter((row) => row.status === 'SUBMITTED')
  const processing = rows.filter((row) => row.status === 'PROCESSING')
  const dispensed = rows.filter((row) => row.status === 'DISPENSED')
  const lowStock = (medicinesQ.data || []).filter((m) => Number(m.stock) < LOW_STOCK)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['pharmacy-queue'] })
    queryClient.invalidateQueries({ queryKey: ['medicines-pharmacy'] })
    if (detailId) queryClient.invalidateQueries({ queryKey: ['rx-detail-pharmacy', detailId] })
  }

  const process = async (row) => {
    setBusy(row.id)
    try {
      await api.post(`/prescriptions/${row.id}/process`)
      message.success(`Resep ${row.prescription_no} mulai disiapkan`)
      refresh()
    } catch (error) {
      message.error(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }

  const dispense = (row) => {
    modal.confirm({
      title: 'Serahkan obat ke pasien?',
      icon: <MedicineBoxOutlined style={{ color: '#0f8b8d' }} />,
      content: `Stok obat untuk resep ${row.prescription_no} akan dikurangi dan tagihan pasien diperbarui.`,
      okText: 'Serahkan Obat',
      cancelText: 'Batal',
      onOk: async () => {
        setBusy(row.id)
        try {
          await api.post(`/prescriptions/${row.id}/dispense`)
          message.success('Obat diserahkan dan stok diperbarui')
          refresh()
          if (detailId) setDetailId(null)
        } catch (error) {
          message.error(errorMessage(error))
        } finally {
          setBusy(null)
        }
      },
    })
  }

  const openAdjust = (medicine) => {
    setAdjustTarget(medicine)
    adjustForm.setFieldsValue({ qty_change: 0, reason: '' })
  }

  const submitAdjust = async () => {
    try {
      const values = await adjustForm.validateFields()
      await api.post(`/medicines/${adjustTarget.id}/stock-adjust`, values)
      message.success(`Stok ${adjustTarget.name} diperbarui`)
      setAdjustTarget(null)
      refresh()
    } catch (error) {
      if (error?.errorFields) return
      message.error(errorMessage(error))
    }
  }

  const queueColumns = [
    { title: 'Resep', dataIndex: 'prescription_no', render: (v) => <strong>{v}</strong> },
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
    { title: 'Item', dataIndex: 'item_count', width: 70, render: (v) => <Tag>{v} obat</Tag> },
    { title: 'Status', dataIndex: 'status', width: 130, render: (v) => <StatusTag type="rx" status={v} /> },
    { title: 'Dibuat', dataIndex: 'created_at', responsive: ['xl'], render: (v) => dateTime(v) },
    {
      title: 'Aksi',
      key: 'action',
      width: 170,
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="Detail resep"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setDetailId(row.id)} /></Tooltip>
          {row.status === 'SUBMITTED' && (
            <Button size="small" type="primary" loading={busy === row.id} onClick={() => process(row)}>Proses</Button>
          )}
          {row.status === 'PROCESSING' && (
            <Button size="small" type="primary" icon={<CheckCircleOutlined />} loading={busy === row.id} onClick={() => dispense(row)}>Serahkan</Button>
          )}
        </Space>
      ),
    },
  ]

  const stockColumns = [
    { title: 'Kode', dataIndex: 'code', width: 100, render: (v) => <strong>{v}</strong> },
    { title: 'Nama Obat', dataIndex: 'name', render: (v, r) => <div><strong>{v}</strong><div className="muted" style={{ fontSize: 11.5 }}>{r.category || 'Umum'} · {r.unit}</div></div> },
    { title: 'Harga', dataIndex: 'price', align: 'right', render: (v) => money(v) },
    {
      title: 'Stok',
      dataIndex: 'stock',
      align: 'center',
      width: 120,
      sorter: (a, b) => Number(a.stock) - Number(b.stock),
      render: (value) => (
        <Tag color={Number(value) < LOW_STOCK ? 'red' : Number(value) < 300 ? 'orange' : 'green'}>
          {number(value)} unit
        </Tag>
      ),
    },
    {
      title: '',
      key: 'action',
      width: 90,
      render: (_, row) => hasPermission('medicine.view') && (
        <Button size="small" icon={<PlusOutlined />} onClick={() => openAdjust(row)}>Stok</Button>
      ),
    },
  ]

  const filteredStock = useMemo(() => {
    const q = search.toLowerCase()
    return (medicinesQ.data || []).filter((m) => !q || m.name.toLowerCase().includes(q) || m.code.toLowerCase().includes(q))
  }, [medicinesQ.data, search])

  return (
    <div>
      <PageHeader
        eyebrow="Farmasi"
        title="Farmasi & Resep"
        subtitle="Proses resep masuk, serahkan obat dengan pengurangan stok otomatis, dan pantau ketersediaan."
        extra={(
          <Space>
            <Button icon={<ReloadOutlined />} onClick={refresh}>Muat ulang</Button>
            {lowStock.length > 0 && <Tag color="red" icon={<WarningOutlined />}>{lowStock.length} stok menipis</Tag>}
          </Space>
        )}
      />

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <div className="stat-card tone-blue">
          <div className="stat-top"><div className="stat-icon"><InboxOutlined /></div></div>
          <div className="stat-label">Resep baru</div>
          <div className="stat-value">{submitted.length}</div>
          <div className="stat-hint">Menunggu diproses</div>
        </div>
        <div className="stat-card tone-amber">
          <div className="stat-top"><div className="stat-icon"><MedicineBoxOutlined /></div></div>
          <div className="stat-label">Sedang disiapkan</div>
          <div className="stat-value">{processing.length}</div>
          <div className="stat-hint">Siap diserahkan</div>
        </div>
        <div className="stat-card tone-green">
          <div className="stat-top"><div className="stat-icon"><CheckCircleOutlined /></div></div>
          <div className="stat-label">Diserahkan hari ini</div>
          <div className="stat-value">{dispensed.length}</div>
          <div className="stat-hint">Stok sudah terpotong</div>
        </div>
        <div className="stat-card tone-rose">
          <div className="stat-top"><div className="stat-icon"><WarningOutlined /></div></div>
          <div className="stat-label">Stok menipis</div>
          <div className="stat-value">{lowStock.length}</div>
          <div className="stat-hint">Di bawah {LOW_STOCK} unit</div>
        </div>
      </div>

      <div className="panel">
        <Tabs
          activeKey={tab}
          onChange={(key) => { setTab(key); setParams(key === 'stock' ? { tab: 'stock' } : {}) }}
          items={[
            {
              key: 'queue',
              label: <span><InboxOutlined /> Antrean Resep</span>,
              children: (
                <>
                  <div className="table-toolbar">
                    <div className="table-toolbar-left">
                      <Tag bordered={false} color="cyan">{rows.length} resep hari ini</Tag>
                    </div>
                    <div className="table-toolbar-right">
                      <Button size="small" onClick={() => queueQ.refetch()} icon={<ReloadOutlined />}>Refresh</Button>
                    </div>
                  </div>
                  <Table
                    rowKey="id"
                    columns={queueColumns}
                    dataSource={rows}
                    loading={queueQ.isLoading}
                    pagination={{ pageSize: 10, showSizeChanger: false }}
                    scroll={{ x: 900 }}
                    locale={{ emptyText: 'Belum ada resep masuk' }}
                  />
                </>
              ),
            },
            {
              key: 'stock',
              label: <span><MedicineBoxOutlined /> Stok Obat</span>,
              children: (
                <>
                  <div className="table-toolbar">
                    <div className="table-toolbar-left">
                      <Input
                        allowClear
                        prefix={<SearchOutlined />}
                        placeholder="Cari nama atau kode obat…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ width: 300, maxWidth: '100%' }}
                      />
                    </div>
                    <div className="table-toolbar-right">
                      <Tag bordered={false} color="cyan">{filteredStock.length} obat aktif</Tag>
                    </div>
                  </div>
                  <Table
                    rowKey="id"
                    columns={stockColumns}
                    dataSource={filteredStock}
                    loading={medicinesQ.isLoading}
                    pagination={{ pageSize: 12, showSizeChanger: false }}
                    scroll={{ x: 720 }}
                  />
                </>
              ),
            },
            {
              key: 'done',
              label: <span><CheckCircleOutlined /> Selesai</span>,
              children: (
                <Table
                  rowKey="id"
                  columns={queueColumns.filter((c) => c.key !== 'action')}
                  dataSource={dispensed}
                  loading={queueQ.isLoading}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                  scroll={{ x: 800 }}
                  locale={{ emptyText: 'Belum ada resep diserahkan hari ini' }}
                />
              ),
            },
          ]}
        />
      </div>

      <Drawer
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        width={560}
        title="Detail Resep"
        extra={detailQ.data?.status === 'PROCESSING' && (
          <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => dispense(detailQ.data)}>Serahkan Obat</Button>
        )}
      >
        {detailQ.isLoading ? <Skeleton active /> : detailQ.data && (
          <>
            <div className="detail-hero" style={{ padding: 14 }}>
              <div style={{ flex: 1 }}>
                <h3>{detailQ.data.prescription_no}</h3>
                <p>{detailQ.data.patient_name} · {detailQ.data.mrn} · {detailQ.data.poli_name}</p>
                <p>Dokter: {detailQ.data.doctor_name}</p>
              </div>
              <StatusTag type="rx" status={detailQ.data.status} />
            </div>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={detailQ.data.items || []}
              columns={[
                { title: 'Obat', dataIndex: 'name', render: (v, r) => <div><strong>{v}</strong><div className="muted" style={{ fontSize: 11 }}>Stok tersedia: {r.stock} {r.unit}</div></div> },
                { title: 'Qty', dataIndex: 'qty', width: 60 },
                { title: 'Dosis', dataIndex: 'dose', render: (v, r) => v ? `${v} · ${r.frequency || ''}` : '-' },
                { title: 'Subtotal', key: 'subtotal', align: 'right', render: (_, r) => money(Number(r.qty) * Number(r.unit_price)) },
              ]}
            />
            {detailQ.data.notes && <div className="soft-card" style={{ marginTop: 12 }}><span className="tiny-label">Catatan</span><div>{detailQ.data.notes}</div></div>}
            {detailQ.data.status === 'SUBMITTED' && (
              <Button type="primary" block style={{ marginTop: 14 }} onClick={() => process(detailQ.data)}>
                Proses Resep
              </Button>
            )}
          </>
        )}
      </Drawer>

      <Modal
        open={Boolean(adjustTarget)}
        title={`Penyesuaian Stok — ${adjustTarget?.name || ''}`}
        onCancel={() => setAdjustTarget(null)}
        onOk={submitAdjust}
        okText="Simpan Penyesuaian"
        cancelText="Batal"
      >
        <p className="muted">Stok saat ini: <strong>{adjustTarget?.stock} {adjustTarget?.unit}</strong>. Gunakan angka negatif untuk mengurangi stok.</p>
        <Form form={adjustForm} layout="vertical">
          <Form.Item name="qty_change" label="Perubahan Stok" rules={[{ required: true, message: 'Isi perubahan stok' }]}>
            <InputNumber style={{ width: '100%' }} placeholder="Contoh: 100 atau -20" />
          </Form.Item>
          <Form.Item name="reason" label="Alasan" rules={[{ required: true, message: 'Alasan wajib diisi' }]}>
            <Input.TextArea rows={3} placeholder="Contoh: penerimaan barang, koreksi stok opname…" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
