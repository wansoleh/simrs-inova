import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Skeleton, Table, Tag, Tooltip } from 'antd'
import {
  ArrowRightOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  ReloadOutlined,
  RiseOutlined,
  TeamOutlined,
  UserAddOutlined,
  WalletOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { nodeApi, api } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import StatCard from '../components/StatCard'
import StatusTag from '../components/StatusTag'
import { BarChart, DonutChart, TrendChart } from '../components/Charts'
import { date, greeting, initials, money, number, today } from '../lib/format'

const DONUT_COLORS = {
  PAID: '#16a34a',
  PARTIAL: '#f59e0b',
  UNPAID: '#e11d48',
  CANCELLED: '#94a3b8',
  REFUND: '#7c3aed',
}

const STAT_ANIMATION_DELAY = 0.1;

export default function Dashboard() {
  const { user, hasPermission } = useAuth()
  const navigate = useNavigate()
  const day = today()
  const from = dayjs().subtract(6, 'day').format('YYYY-MM-DD')

  const summaryQ = useQuery({
    queryKey: ['node-summary', day],
    queryFn: async () => (await nodeApi.get('/dashboard/summary', { params: { from: day, to: day } })).data.data,
  })
  const revenueQ = useQuery({
    queryKey: ['node-revenue', from, day],
    queryFn: async () => (await nodeApi.get('/dashboard/revenue', { params: { from, to: day } })).data.data,
  })
  const poliQ = useQuery({
    queryKey: ['node-poli', from, day],
    queryFn: async () => (await nodeApi.get('/dashboard/visits-by-poli', { params: { from, to: day } })).data.data,
  })
  const paymentQ = useQuery({
    queryKey: ['node-payment-status'],
    queryFn: async () => (await nodeApi.get('/dashboard/payment-status')).data.data,
  })
  const procedureQ = useQuery({
    queryKey: ['node-procedures', from, day],
    queryFn: async () => (await nodeApi.get('/dashboard/procedures', { params: { from, to: day } })).data.data,
  })

  const boardQ = useQuery({
    queryKey: ['queue-board', day],
    queryFn: async () => (await api.get('/queues/board', { params: { date: day } })).data.data,
    enabled: hasPermission('master.view'),
  })
  const invoiceQ = useQuery({
    queryKey: ['dashboard-invoices', day],
    queryFn: async () => (await api.get('/invoices', { params: { per_page: 6, date_from: day, date_to: day } })).data.data,
    enabled: hasPermission('billing.read'),
  })

  const summary = summaryQ.data
  const board = boardQ.data
  const waitingCount = board?.waiting?.length ?? 0
  const inExamCount = board?.in_exam?.length ?? 0
  const paidShare = summary?.billed ? Math.round((Number(summary.collected) / Number(summary.billed)) * 100) : 0

  const trend = useMemo(
    () => (revenueQ.data || []).map((row) => ({ label: dayjs(row.visit_date).format('DD/MM'), value: Number(row.collected) })),
    [revenueQ.data],
  )
  const poliData = useMemo(
    () => (poliQ.data || []).slice(0, 8).map((row) => ({ label: row.poli_name, value: Number(row.visits) })),
    [poliQ.data],
  )
  const donutData = useMemo(
    () => (paymentQ.data || []).map((row) => ({
      label: row.status,
      value: Number(row.invoice_count),
      color: DONUT_COLORS[row.status] || '#94a3b8',
    })),
    [paymentQ.data],
  )

  const quickActions = () => {
    const role = user?.role
    if (role === 'dokter') {
      return (
        <>
          <Button type="primary" icon={<ExperimentOutlined />} onClick={() => navigate('/app/doctor-queue')}>Antrean Saya</Button>
          <Button icon={<TeamOutlined />} onClick={() => navigate('/app/patients')}>Cari Pasien</Button>
        </>
      )
    }
    if (role === 'farmasi') {
      return (
        <>
          <Button type="primary" icon={<MedicineBoxOutlined />} onClick={() => navigate('/app/pharmacy')}>Antrean Resep</Button>
          <Button icon={<ReloadOutlined />} onClick={() => navigate('/app/pharmacy?tab=stock')}>Cek Stok</Button>
        </>
      )
    }
    if (role === 'lab') {
      return (
        <>
          <Button type="primary" icon={<ExperimentOutlined />} onClick={() => navigate('/app/lab')}>Order Laboratorium</Button>
          <Button icon={<FileTextOutlined />} onClick={() => navigate('/app/lab?tab=done')}>Hasil Selesai</Button>
        </>
      )
    }
    if (role === 'kasir') {
      return (
        <>
          <Button type="primary" icon={<WalletOutlined />} onClick={() => navigate('/app/cashier')}>Proses Pembayaran</Button>
          <Button icon={<DollarOutlined />} onClick={() => navigate('/app/cashier?status=UNPAID')}>Tagihan Terbuka</Button>
        </>
      )
    }
    return (
      <>
        <Button type="primary" icon={<UserAddOutlined />} onClick={() => navigate('/app/registration')}>Daftarkan Pasien</Button>
        <Button icon={<TeamOutlined />} onClick={() => navigate('/app/patients')}>Data Pasien</Button>
      </>
    )
  }

  const queueColumns = [
    {
      title: 'Antrean',
      dataIndex: 'queue_no',
      width: 82,
      render: (value) => <span className="queue-number">{String(value).padStart(2, '0')}</span>,
    },
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
    { title: 'Status', dataIndex: 'status', width: 130, render: (value) => <StatusTag type="visit" status={value} /> },
    {
      title: '',
      key: 'action',
      width: 110,
      render: (_, row) => (
        <Button
          type="link"
          size="small"
          onClick={() => navigate(`/app/exam/${row.id}`)}
          disabled={!['REGISTERED', 'WAITING', 'IN_EXAM'].includes(row.status)}
        >
          {row.status === 'IN_EXAM' ? 'Lanjutkan' : 'Periksa'}
        </Button>
      ),
    },
  ]

  const invoiceColumns = [
    { title: 'Invoice', dataIndex: 'invoice_no', render: (v) => <strong>{v}</strong> },
    { title: 'Pasien', dataIndex: 'patient_name' },
    {
      title: 'Total',
      dataIndex: 'total',
      align: 'right',
      render: (value) => money(value),
    },
    { title: 'Status', dataIndex: 'status', width: 120, render: (value) => <StatusTag type="invoice" status={value} /> },
    {
      title: '',
      key: 'action',
      width: 74,
      render: (_, row) => (
        <Tooltip title="Buka kasir">
          <Button type="text" size="small" icon={<ArrowRightOutlined />} onClick={() => navigate(`/app/cashier?invoice=${row.id}`)} />
        </Tooltip>
      ),
    },
  ]

  return (
    <div>
      <section className="hero-card">
        <div className="hero-grid">
          <div className="hero-copy">
            <span className="hero-badge"><CalendarOutlined /> {dayjs().format('dddd, DD MMMM YYYY')}</span>
            <h2>{greeting()}, {user?.full_name?.split(',')[0]}.</h2>
            <p>
              {waitingCount > 0
                ? `Ada ${waitingCount} pasien menunggu dan ${inExamCount} sedang diperiksa. Pastikan alur pelayanan tetap lancar.`
                : 'Belum ada pasien menunggu saat ini. Gunakan waktu untuk meninjau laporan dan kesiapan layanan.'}
            </p>
            <div className="hero-actions">{quickActions()}</div>
          </div>
          <div className="hero-meta">
            <div><span>Pasien</span><strong>{number(summary?.patients)}</strong></div>
            <div><span>Poli aktif</span><strong>{number(summary?.polis)}</strong></div>
            <div><span>Collection rate</span><strong>{paidShare}%</strong></div>
          </div>
        </div>
      </section>

      {summaryQ.isError && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16, borderRadius: 14 }}
          message="Layanan analitik Node belum dapat dihubungi"
          description="Dashboard tetap menampilkan data yang tersedia. Pastikan service Node berjalan dan konfigurasi proxy benar."
          action={<Button size="small" onClick={() => { summaryQ.refetch(); revenueQ.refetch(); poliQ.refetch() }}>Coba lagi</Button>}
        />
      )}

      <div className="stat-grid">
        {summaryQ.isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div className="stat-card" key={i}><Skeleton active paragraph={{ rows: 1 }} /></div>
          ))
        ) : (
          <>
            <StatCard
              icon={<TeamOutlined />}
              label="Kunjungan hari ini"
              value={number(summary?.visits)}
              hint={`${number(summary?.paid_visits)} kunjungan sudah lunas`}
              tone="teal"
              trend={{ text: 'Hari ini' }}
            />
            <StatCard
              icon={<ClockCircleOutlined />}
              label="Menunggu pemeriksaan"
              value={number(waitingCount)}
              hint={`${inExamCount} pasien sedang diperiksa`}
              tone="amber"
            />
            <StatCard
              icon={<DollarOutlined />}
              label="Pendapatan diterima"
              value={money(summary?.collected)}
              hint={`Tagihan ${money(summary?.billed)}`}
              tone="green"
            />
            <StatCard
              icon={<WalletOutlined />}
              label="Outstanding"
              value={money(summary?.outstanding)}
              hint="Sisa tagihan yang belum dibayar"
              tone="rose"
            />
          </>
        )}
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Arus pendapatan 7 hari</h3>
              <p>Pembayaran diterima per hari</p>
            </div>
            <Tag bordered={false} color="cyan"><RiseOutlined /> Tren</Tag>
          </div>
          {revenueQ.isLoading ? <Skeleton active /> : <TrendChart data={trend} />}
        </div>
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Status pembayaran</h3>
              <p>Distribusi invoice saat ini</p>
            </div>
          </div>
          {paymentQ.isLoading ? <Skeleton active /> : <DonutChart data={donutData} totalLabel="Invoice" />}
        </div>
      </div>

      <div className="dashboard-grid equal">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Kunjungan per poli</h3>
              <p>7 hari terakhir</p>
            </div>
          </div>
          {poliQ.isLoading ? <Skeleton active /> : <BarChart data={poliData} height={200} />}
        </div>
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Tindakan teratas</h3>
              <p>Berdasarkan nilai tindakan</p>
            </div>
            <ExperimentOutlined style={{ color: 'var(--brand)', fontSize: 18 }} />
          </div>
          {procedureQ.isLoading ? (
            <Skeleton active />
          ) : (
            <div>
              {(procedureQ.data || []).slice(0, 5).map((row, index) => (
                <div className="list-row" key={row.procedure_name}>
                  <div className="flex-gap">
                    <span className="queue-number" style={{ minWidth: 30, height: 30, fontSize: 12 }}>{index + 1}</span>
                    <div>
                      <strong>{row.procedure_name}</strong>
                      <span>{number(row.qty)} tindakan</span>
                    </div>
                  </div>
                  <strong>{money(row.amount)}</strong>
                </div>
              ))}
              {!procedureQ.data?.length && <div className="chart-empty">Belum ada tindakan</div>}
            </div>
          )}
        </div>
      </div>

      {hasPermission('master.view') && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head">
            <div>
              <h3>Antrean hari ini</h3>
              <p>Status pasien dari pendaftaran sampai pembayaran</p>
            </div>
            <Button type="link" onClick={() => navigate('/app/doctor-queue')} icon={<ArrowRightOutlined />} iconPosition="end">
              Lihat semua
            </Button>
          </div>
          <Table
            rowKey="id"
            size="middle"
            columns={queueColumns}
            dataSource={(board?.all || []).slice(0, 8)}
            loading={boardQ.isLoading}
            pagination={false}
            scroll={{ x: 720 }}
          />
        </div>
      )}

      {hasPermission('billing.read') && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head">
            <div>
              <h3>Invoice terbaru</h3>
              <p>Tagihan yang dibuat hari ini</p>
            </div>
            <Button type="link" onClick={() => navigate('/app/cashier')} icon={<ArrowRightOutlined />} iconPosition="end">
              Buka kasir
            </Button>
          </div>
          <Table
            rowKey="id"
            size="middle"
            columns={invoiceColumns}
            dataSource={invoiceQ.data || []}
            loading={invoiceQ.isLoading}
            pagination={false}
            scroll={{ x: 640 }}
          />
        </div>
      )}

      {!hasPermission('master.view') && !hasPermission('billing.read') && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head">
            <div>
              <h3>Akses cepat</h3>
              <p>Modul yang tersedia untuk peran Anda</p>
            </div>
          </div>
          <div className="flex-gap">
            <Button icon={<PlusOutlined />} onClick={() => navigate('/app/patients')}>Data Pasien</Button>
            <Button icon={<CheckCircleOutlined />} onClick={() => navigate('/app/reports')}>Laporan</Button>
          </div>
        </div>
      )}
    </div>
  )
}
