import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert,
  App,
  Button,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Skeleton,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'antd'
import {
  CreditCardOutlined,
  DollarOutlined,
  EyeOutlined,
  FilePdfOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SearchOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { api, errorMessage, openPdf, uuid } from '../api/client'
import PageHeader from '../components/PageHeader'
import StatusTag from '../components/StatusTag'
import { date, dateTime, initials, money, today } from '../lib/format'
import { PAYMENT_METHODS } from '../lib/constants'

const STATUS_OPTIONS = [
  { value: '', label: 'Semua status' },
  { value: 'UNPAID', label: 'Belum bayar' },
  { value: 'PARTIAL', label: 'Sebagian' },
  { value: 'PAID', label: 'Lunas' },
]

export default function Cashier() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [status, setStatus] = useState(params.get('status') || '')
  const [search, setSearch] = useState('')
  const [range, setRange] = useState(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [detailId, setDetailId] = useState(params.get('invoice') ? Number(params.get('invoice')) : null)
  const [payOpen, setPayOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [idemKey, setIdemKey] = useState('')
  const [paying, setPaying] = useState(false)
  const [payForm] = Form.useForm()
  const [adjustForm] = Form.useForm()

  useEffect(() => {
    const invoice = params.get('invoice')
    if (invoice) setDetailId(Number(invoice))
  }, [params])

  const listQ = useQuery({
    queryKey: ['invoices', page, perPage, status, search, range?.from, range?.to],
    queryFn: async () => {
      const { data } = await api.get('/invoices', {
        params: {
          page,
          per_page: perPage,
          status: status || undefined,
          q: search || undefined,
          date_from: range?.from ? range.from.format('YYYY-MM-DD') : undefined,
          date_to: range?.to ? range.to.format('YYYY-MM-DD') : undefined,
        },
      })
      return { rows: data.data, meta: data.meta }
    },
  })
  const summaryQ = useQuery({
    queryKey: ['cashier-summary', today()],
    queryFn: async () => (await api.get('/invoices', { params: { date_from: today(), date_to: today(), per_page: 200 } })).data.data,
    refetchInterval: 30_000,
  })
  const detailQ = useQuery({
    queryKey: ['invoice-detail', detailId],
    queryFn: async () => (await api.get(`/invoices/${detailId}`)).data.data,
    enabled: Boolean(detailId),
  })

  const detail = detailQ.data
  const remaining = detail ? Math.max(Number(detail.total) - Number(detail.paid_total), 0) : 0

  const summary = useMemo(() => {
    const rows = summaryQ.data || []
    return {
      count: rows.length,
      total: rows.reduce((sum, row) => sum + Number(row.total), 0),
      paid: rows.reduce((sum, row) => sum + Number(row.paid_total), 0),
      outstanding: rows.reduce((sum, row) => sum + Math.max(Number(row.total) - Number(row.paid_total), 0), 0),
    }
  }, [summaryQ.data])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['invoices'] })
    queryClient.invalidateQueries({ queryKey: ['cashier-summary'] })
    if (detailId) queryClient.invalidateQueries({ queryKey: ['invoice-detail', detailId] })
  }

  const openDetail = (id) => {
    setDetailId(id)
    const next = new URLSearchParams(params)
    next.set('invoice', id)
    setParams(next)
  }

  const closeDetail = () => {
    setDetailId(null)
    const next = new URLSearchParams(params)
    next.delete('invoice')
    setParams(next)
  }

  const openPay = () => {
    setPayOpen(true)
    setIdemKey(uuid())
    payForm.setFieldsValue({ method: 'CASH', amount: remaining })
  }

  const pay = async () => {
    try {
      const values = await payForm.validateFields()
      setPaying(true)
      const response = await api.post(`/invoices/${detailId}/payments`, values, {
        headers: { 'Idempotency-Key': idemKey },
      })
      const replay = String(response.headers['idempotent-replay']) === 'true'
      message.success(replay ? 'Pembayaran sudah tercatat sebelumnya (idempoten)' : 'Pembayaran berhasil')
      setPayOpen(false)
      refresh()
    } catch (error) {
      if (error?.errorFields) return
      message.error(errorMessage(error))
    } finally {
      setPaying(false)
    }
  }

  const openAdjust = () => {
    setAdjustOpen(true)
    adjustForm.setFieldsValue({ amount: 0, reason: '', description: 'Penyesuaian tagihan' })
  }

  const submitAdjust = async () => {
    try {
      const values = await adjustForm.validateFields()
      await api.post(`/invoices/${detailId}/adjustments`, values)
      message.success('Penyesuaian tagihan tersimpan')
      setAdjustOpen(false)
      refresh()
    } catch (error) {
      if (error?.errorFields) return
      message.error(errorMessage(error))
    }
  }

  const print = async (path) => {
    try {
      await openPdf(path)
    } catch (error) {
      message.error(errorMessage(error, 'Gagal membuka PDF'))
    }
  }

  const columns = [
    { title: 'Invoice', dataIndex: 'invoice_no', render: (v) => <strong>{v}</strong> },
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
    { title: 'Tanggal', dataIndex: 'visit_date', responsive: ['lg'], render: (v) => date(v) },
    { title: 'Total', dataIndex: 'total', align: 'right', render: (v) => money(v) },
    {
      title: 'Dibayar',
      dataIndex: 'paid_total',
      align: 'right',
      responsive: ['lg'],
      render: (v) => <span className={Number(v) > 0 ? 'success-text' : 'muted'}>{money(v)}</span>,
    },
    { title: 'Status', dataIndex: 'status', width: 120, render: (v) => <StatusTag type="invoice" status={v} /> },
    {
      title: '',
      key: 'action',
      width: 90,
      render: (_, row) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => openDetail(row.id)}>Buka</Button>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Keuangan"
        title="Kasir & Billing"
        subtitle="Periksa rincian tagihan, proses pembayaran idempoten, dan cetak invoice atau kwitansi."
        extra={<Button icon={<ReloadOutlined />} onClick={refresh}>Muat ulang</Button>}
      />

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <div className="stat-card tone-blue">
          <div className="stat-top"><div className="stat-icon"><FilePdfOutlined /></div></div>
          <div className="stat-label">Invoice hari ini</div>
          <div className="stat-value">{summary.count}</div>
          <div className="stat-hint">Semua status</div>
        </div>
        <div className="stat-card tone-teal">
          <div className="stat-top"><div className="stat-icon"><DollarOutlined /></div></div>
          <div className="stat-label">Total tagihan</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{money(summary.total)}</div>
          <div className="stat-hint">Nilai invoice hari ini</div>
        </div>
        <div className="stat-card tone-green">
          <div className="stat-top"><div className="stat-icon"><WalletOutlined /></div></div>
          <div className="stat-label">Sudah dibayar</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{money(summary.paid)}</div>
          <div className="stat-hint">Pembayaran diterima</div>
        </div>
        <div className="stat-card tone-rose">
          <div className="stat-top"><div className="stat-icon"><CreditCardOutlined /></div></div>
          <div className="stat-label">Outstanding</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{money(summary.outstanding)}</div>
          <div className="stat-hint">Sisa tagihan</div>
        </div>
      </div>

      <div className="panel">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Cari invoice, nama, atau MRN…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 280 }}
            />
            <Select
              value={status}
              onChange={(value) => { setStatus(value); setPage(1) }}
              options={STATUS_OPTIONS}
              style={{ width: 160 }}
            />
            <DatePicker.RangePicker
              value={range}
              onChange={setRange}
              format="DD/MM/YYYY"
              allowClear
              placeholder={['Dari tanggal', 'Sampai tanggal']}
            />
          </div>
          <div className="table-toolbar-right">
            <Tag bordered={false} color="cyan">{listQ.data?.meta?.total ?? 0} invoice</Tag>
          </div>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={listQ.data?.rows || []}
          loading={listQ.isLoading}
          scroll={{ x: 940 }}
          pagination={{
            current: page,
            pageSize: perPage,
            total: listQ.data?.meta?.total || 0,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: (total) => `${total} invoice`,
            onChange: (nextPage, nextSize) => { setPage(nextPage); setPerPage(nextSize) },
          }}
        />
      </div>

      <Drawer
        open={Boolean(detailId)}
        onClose={closeDetail}
        width={760}
        title="Detail Invoice"
        extra={detail && (
          <Space>
            <Button icon={<PrinterOutlined />} onClick={() => print(`/invoices/${detail.id}/print`)}>Invoice</Button>
            {Number(detail.total) > Number(detail.paid_total) && (
              <Button type="primary" icon={<CreditCardOutlined />} onClick={openPay}>Bayar</Button>
            )}
            {detail.status === 'PAID' && (
              <Button icon={<FilePdfOutlined />} onClick={openAdjust}>Penyesuaian</Button>
            )}
          </Space>
        )}
      >
        {detailQ.isLoading ? <Skeleton active /> : detail && (
          <>
            <div className="detail-hero">
              <div className="patient-avatar">{initials(detail.patient_name)}</div>
              <div style={{ flex: 1 }}>
                <div className="flex-between">
                  <div>
                    <h3>{detail.invoice_no}</h3>
                    <p>{detail.patient_name} · {detail.mrn} · {date(detail.visit_date)}</p>
                    <p>{detail.poli_name} · {detail.doctor_name}</p>
                  </div>
                  <StatusTag type="invoice" status={detail.status} />
                </div>
              </div>
            </div>

            <div className="flex-between" style={{ marginBottom: 12 }}>
              <Tag color="cyan">{detail.visit_no}</Tag>
              <Tag color={detail.guarantor_type === 'UMUM' ? 'default' : 'blue'}>{detail.guarantor_type}</Tag>
            </div>

            <div className="section-title">Rincian Tagihan</div>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={detail.items || []}
              columns={[
                { title: 'Deskripsi', dataIndex: 'description' },
                { title: 'Qty', dataIndex: 'qty', width: 60 },
                { title: 'Harga', dataIndex: 'unit_price', align: 'right', render: (v) => money(v) },
                { title: 'Jumlah', dataIndex: 'amount', align: 'right', render: (v) => <strong>{money(v)}</strong> },
                { title: 'Status', dataIndex: 'status', width: 90, render: (v) => <Tag color={v === 'ACTIVE' ? 'green' : 'red'}>{v}</Tag> },
              ]}
            />

            <div className="total-box">
              <div>
                <div className="tiny-label">Total tagihan</div>
                <strong>{money(detail.total)}</strong>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="tiny-label">Sisa</div>
                <strong className={remaining > 0 ? 'danger-text' : 'success-text'}>{money(remaining)}</strong>
              </div>
            </div>

            <div className="section-title" style={{ marginTop: 18 }}>Riwayat Pembayaran</div>
            {(detail.payments || []).length === 0 ? (
              <div className="empty-card">Belum ada pembayaran</div>
            ) : (
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={detail.payments || []}
                columns={[
                  { title: 'No. Bayar', dataIndex: 'payment_no' },
                  { title: 'Metode', dataIndex: 'method', render: (v) => <Tag>{v}</Tag> },
                  { title: 'Nominal', dataIndex: 'amount', align: 'right', render: (v) => money(v) },
                  { title: 'Waktu', dataIndex: 'paid_at', render: (v) => dateTime(v) },
                  {
                    title: '',
                    key: 'print',
                    width: 60,
                    render: (_, row) => (
                      <Tooltip title="Cetak kwitansi">
                        <Button type="text" size="small" icon={<PrinterOutlined />} onClick={() => print(`/payments/${row.id}/receipt`)} />
                      </Tooltip>
                    ),
                  },
                ]}
              />
            )}

            {(detail.revisions || []).length > 0 && (
              <>
                <div className="section-title" style={{ marginTop: 18 }}>Riwayat Revisi</div>
                {detail.revisions.map((rev) => (
                  <div className="list-row" key={rev.id}>
                    <div>
                      <strong>Revisi #{rev.revision}</strong>
                      <span>{rev.reason || 'Penyesuaian'}</span>
                    </div>
                    <span className="muted">{dateTime(rev.created_at)}</span>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </Drawer>

      <Modal
        open={payOpen}
        title="Proses Pembayaran"
        onCancel={() => setPayOpen(false)}
        onOk={pay}
        okText="Bayar Sekarang"
        cancelText="Batal"
        confirmLoading={paying}
        width={520}
        destroyOnHidden
      >
        {detail && (
          <>
            <div className="soft-card" style={{ marginBottom: 16 }}>
              <div className="flex-between">
                <div>
                  <div className="tiny-label">Invoice</div>
                  <strong>{detail.invoice_no}</strong>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="tiny-label">Sisa tagihan</div>
                  <strong style={{ fontSize: 20 }}>{money(remaining)}</strong>
                </div>
              </div>
            </div>
            <Form form={payForm} layout="vertical">
              <Form.Item name="method" label="Metode Pembayaran" rules={[{ required: true }]}>
                <Select options={PAYMENT_METHODS} />
              </Form.Item>
              <Form.Item
                name="amount"
                label="Nominal"
                rules={[
                  { required: true, message: 'Nominal wajib diisi' },
                  {
                    validator: (_, value) => (Number(value) > 0 && Number(value) <= remaining + 0.001
                      ? Promise.resolve()
                      : Promise.reject(new Error(`Nominal harus antara 1 dan ${money(remaining)}`))),
                  },
                ]}
              >
                <InputNumber style={{ width: '100%' }} min={1} max={remaining} formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(value) => value.replace(/\D/g, '')} />
              </Form.Item>
              <div className="soft-card">
                <span className="tiny-label">Idempotency-Key</span>
                <div style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{idemKey}</div>
                <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>
                  Klik bayar dua kali dengan key yang sama tidak akan menggandakan pembayaran.
                </div>
              </div>
            </Form>
          </>
        )}
      </Modal>

      <Modal
        open={adjustOpen}
        title="Penyesuaian Tagihan"
        onCancel={() => setAdjustOpen(false)}
        onOk={submitAdjust}
        okText="Simpan Penyesuaian"
        cancelText="Batal"
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 14, borderRadius: 12 }}
          message="Gunakan nominal positif untuk menambah tagihan, negatif untuk mengurangi. Invoice harus sudah PAID."
        />
        <Form form={adjustForm} layout="vertical">
          <Form.Item name="amount" label="Nominal Penyesuaian" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} placeholder="Contoh: 50000 atau -10000" />
          </Form.Item>
          <Form.Item name="description" label="Deskripsi">
            <Input placeholder="Deskripsi item penyesuaian" />
          </Form.Item>
          <Form.Item name="reason" label="Alasan" rules={[{ required: true, message: 'Alasan wajib diisi' }]}>
            <Input.TextArea rows={3} placeholder="Alasan penyesuaian untuk audit" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
