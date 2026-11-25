import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  DatePicker,
  Segmented,
  Skeleton,
  Space,
  Table,
  Tag,
} from 'antd'
import {
  DownloadOutlined,
  DollarOutlined,
  ExperimentOutlined,
  ReloadOutlined,
  RiseOutlined,
  TeamOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { nodeApi, errorMessage } from '../api/client'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import StatusTag from '../components/StatusTag'
import { BarChart, DonutChart, TrendChart } from '../components/Charts'
import { date, money, number } from '../lib/format'

const DONUT_COLORS = {
  PAID: '#16a34a',
  PARTIAL: '#f59e0b',
  UNPAID: '#e11d48',
  CANCELLED: '#94a3b8',
  REFUND: '#7c3aed',
}

const DETAIL_COLUMNS = {
  visits: [
    { title: 'Tanggal', dataIndex: 'visit_date', render: (v) => date(v) },
    { title: 'No. Kunjungan', dataIndex: 'visit_no', render: (v) => <strong>{v}</strong> },
    { title: 'Pasien', dataIndex: 'patient_name' },
    { title: 'MRN', dataIndex: 'mrn' },
    { title: 'Dokter', dataIndex: 'doctor_name', responsive: ['lg'] },
    { title: 'Poli', dataIndex: 'poli_name' },
    { title: 'Status', dataIndex: 'status', render: (v) => <StatusTag type="visit" status={v} /> },
    { title: 'Total', dataIndex: 'total', align: 'right', render: (v) => money(v) },
    { title: 'Dibayar', dataIndex: 'paid_total', align: 'right', render: (v) => money(v) },
  ],
  revenue: [
    { title: 'Invoice', dataIndex: 'invoice_no', render: (v) => <strong>{v}</strong> },
    { title: 'Tanggal', dataIndex: 'visit_date', render: (v) => date(v) },
    { title: 'Poli', dataIndex: 'poli_name' },
    { title: 'Status', dataIndex: 'status', render: (v) => <StatusTag type="invoice" status={v} /> },
    { title: 'Total', dataIndex: 'total', align: 'right', render: (v) => money(v) },
    { title: 'Dibayar', dataIndex: 'paid_total', align: 'right', render: (v) => money(v) },
    { title: 'Sisa', dataIndex: 'outstanding', align: 'right', render: (v) => <span className={Number(v) > 0 ? 'danger-text' : 'muted'}>{money(v)}</span> },
  ],
  procedures: [
    { title: 'Tanggal', dataIndex: 'visit_date', render: (v) => date(v) },
    { title: 'Poli', dataIndex: 'poli_name' },
    { title: 'Tindakan', dataIndex: 'procedure_name', render: (v) => <strong>{v}</strong> },
    { title: 'Qty', dataIndex: 'qty', width: 70 },
    { title: 'Harga', dataIndex: 'unit_price', align: 'right', render: (v) => money(v) },
    { title: 'Jumlah', dataIndex: 'amount', align: 'right', render: (v) => money(v) },
  ],
}

export default function Reports() {
  const { message } = App.useApp()
  const [range, setRange] = useState([dayjs().subtract(29, 'day'), dayjs()])
  const [detailType, setDetailType] = useState('visits')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)

  const from = range?.[0]?.format('YYYY-MM-DD')
  const to = range?.[1]?.format('YYYY-MM-DD')

  const summaryQ = useQuery({
    queryKey: ['report-summary', from, to],
    queryFn: async () => (await nodeApi.get('/dashboard/summary', { params: { from, to } })).data.data,
  })
  const revenueQ = useQuery({
    queryKey: ['report-revenue', from, to],
    queryFn: async () => (await nodeApi.get('/dashboard/revenue', { params: { from, to } })).data.data,
  })
  const poliQ = useQuery({
    queryKey: ['report-poli', from, to],
    queryFn: async () => (await nodeApi.get('/dashboard/visits-by-poli', { params: { from, to } })).data.data,
  })
  const procedureQ = useQuery({
    queryKey: ['report-procedures', from, to],
    queryFn: async () => (await nodeApi.get('/dashboard/procedures', { params: { from, to } })).data.data,
  })
  const paymentQ = useQuery({
    queryKey: ['report-payment'],
    queryFn: async () => (await nodeApi.get('/dashboard/payment-status')).data.data,
  })
  const medicineQ = useQuery({
    queryKey: ['report-medicine', from, to],
    queryFn: async () => (await nodeApi.get('/dashboard/medicine-usage', { params: { from, to } })).data.data,
  })
  const detailQ = useQuery({
    queryKey: ['report-details', detailType, from, to, page, perPage],
    queryFn: async () => {
      const { data } = await nodeApi.get('/dashboard/details', {
        params: { type: detailType, from, to, page, per_page: perPage },
      })
      return { rows: data.data, meta: data.meta }
    },
  })

  const trend = useMemo(
    () => (revenueQ.data || []).map((row) => ({ label: dayjs(row.visit_date).format('DD/MM'), value: Number(row.collected) })),
    [revenueQ.data],
  )
  const poliData = useMemo(
    () => (poliQ.data || []).map((row) => ({ label: row.poli_name, value: Number(row.visits) })),
    [poliQ.data],
  )
  const donut = useMemo(
    () => (paymentQ.data || []).map((row) => ({
      label: row.status,
      value: Number(row.invoice_count),
      color: DONUT_COLORS[row.status] || '#94a3b8',
    })),
    [paymentQ.data],
  )

  const exportCsv = async (type) => {
    try {
      const response = await nodeApi.get('/dashboard/export', {
        params: { type, from, to },
        responseType: 'blob',
      })
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = `laporan-${type}-${from}-${to}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 30_000)
      message.success('CSV berhasil diunduh')
    } catch (error) {
      message.error(errorMessage(error, 'Gagal mengunduh CSV'))
    }
  }

  const error = summaryQ.isError || revenueQ.isError || poliQ.isError

  return (
    <div>
      <PageHeader
        eyebrow="Analitik"
        title="Laporan Operasional"
        subtitle="Ringkasan kunjungan, pendapatan, tindakan, dan pemakaian obat dari layanan reporting Node."
        extra={(
          <Space wrap>
            <DatePicker.RangePicker value={range} onChange={setRange} format="DD/MM/YYYY" allowClear={false} />
            <Button icon={<ReloadOutlined />} onClick={() => { summaryQ.refetch(); revenueQ.refetch(); poliQ.refetch(); procedureQ.refetch(); medicineQ.refetch() }}>
              Muat ulang
            </Button>
          </Space>
        )}
      />

      {error && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16, borderRadius: 14 }}
          message="Layanan reporting Node tidak dapat dihubungi"
          description="Pastikan service Node berjalan dan proxy /svc benar."
          action={<Button size="small" onClick={() => summaryQ.refetch()}>Coba lagi</Button>}
        />
      )}

      <div className="stat-grid">
        <StatCard icon={<TeamOutlined />} label="Kunjungan" value={number(summaryQ.data?.visits)} hint={`${number(summaryQ.data?.paid_visits)} lunas`} tone="teal" />
        <StatCard icon={<DollarOutlined />} label="Tagihan" value={money(summaryQ.data?.billed)} hint="Total invoice periode" tone="blue" />
        <StatCard icon={<WalletOutlined />} label="Diterima" value={money(summaryQ.data?.collected)} hint="Pembayaran masuk" tone="green" />
        <StatCard icon={<RiseOutlined />} label="Outstanding" value={money(summaryQ.data?.outstanding)} hint="Belum dibayar" tone="rose" />
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Tren pendapatan</h3>
              <p>Pembayaran diterima per hari</p>
            </div>
            <Button size="small" icon={<DownloadOutlined />} onClick={() => exportCsv('revenue')}>CSV</Button>
          </div>
          {revenueQ.isLoading ? <Skeleton active /> : <TrendChart data={trend} />}
        </div>
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Status invoice</h3>
              <p>Distribusi seluruh invoice</p>
            </div>
          </div>
          {paymentQ.isLoading ? <Skeleton active /> : <DonutChart data={donut} totalLabel="Invoice" />}
        </div>
      </div>

      <div className="dashboard-grid equal">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Kunjungan per poli</h3>
              <p>Periode terpilih</p>
            </div>
            <Button size="small" icon={<DownloadOutlined />} onClick={() => exportCsv('visits')}>CSV</Button>
          </div>
          {poliQ.isLoading ? <Skeleton active /> : <BarChart data={poliData} height={220} />}
        </div>
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Tindakan teratas</h3>
              <p>Berdasarkan nilai</p>
            </div>
            <ExperimentOutlined style={{ color: 'var(--brand)', fontSize: 18 }} />
          </div>
          <Table
            rowKey="procedure_name"
            size="small"
            pagination={false}
            loading={procedureQ.isLoading}
            dataSource={procedureQ.data || []}
            columns={[
              { title: 'Tindakan', dataIndex: 'procedure_name' },
              { title: 'Qty', dataIndex: 'qty', width: 70, align: 'center' },
              { title: 'Nilai', dataIndex: 'amount', align: 'right', render: (v) => money(v) },
            ]}
          />
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <div>
            <h3>Pemakaian obat</h3>
            <p>Obat dari resep yang sudah diserahkan</p>
          </div>
        </div>
        <Table
          rowKey="medicine_name"
          size="small"
          loading={medicineQ.isLoading}
          pagination={false}
          dataSource={medicineQ.data || []}
          scroll={{ x: 640 }}
          columns={[
            { title: 'Obat', dataIndex: 'medicine_name', render: (v, r) => <strong>{v} <span className="muted">({r.unit})</span></strong> },
            { title: 'Qty', dataIndex: 'qty', width: 90, align: 'center', render: (v) => <Tag color="cyan">{number(v)}</Tag> },
            { title: 'Nilai', dataIndex: 'revenue', align: 'right', render: (v) => money(v) },
          ]}
        />
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <div>
            <h3>Detail laporan</h3>
            <p>Data mentah sesuai periode</p>
          </div>
          <Segmented
            value={detailType}
            onChange={(value) => { setDetailType(value); setPage(1) }}
            options={[
              { label: 'Kunjungan', value: 'visits' },
              { label: 'Pendapatan', value: 'revenue' },
              { label: 'Tindakan', value: 'procedures' },
            ]}
          />
        </div>
        <Table
          rowKey={(row) => `${detailType}-${row.visit_no || row.invoice_no || row.visit_id}-${row.procedure_name || ''}`}
          size="small"
          loading={detailQ.isLoading}
          dataSource={detailQ.data?.rows || []}
          columns={DETAIL_COLUMNS[detailType]}
          scroll={{ x: 980 }}
          pagination={{
            current: page,
            pageSize: perPage,
            total: detailQ.data?.meta?.total || 0,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            onChange: (nextPage, nextSize) => { setPage(nextPage); setPerPage(nextSize) },
            showTotal: (total) => `${total} baris`,
          }}
        />
      </div>
    </div>
  )
}
