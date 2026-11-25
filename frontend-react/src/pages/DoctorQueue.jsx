import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { App, Button, Select, Space, Table, Tag, Tooltip } from 'antd'
import {
  ClockCircleOutlined,
  ReloadOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  PlusOutlined,
  MedicineBoxOutlined,
  SolutionOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import PageHeader from '../components/PageHeader'
import StatusTag from '../components/StatusTag'
import { age, initials, date, today } from '../lib/format'

export default function DoctorQueue() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('waiting')
  const [poliFilter, setPoliFilter] = useState(null)
  const [starting, setStarting] = useState(null)
  const day = today()

  const myDoctorQ = useQuery({
    queryKey: ['my-doctor', user?.full_name],
    queryFn: async () => (await api.get('/doctors', { params: { q: user?.full_name, per_page: 50 } })).data.data,
    enabled: user?.role === 'dokter',
  })
  const myDoctorId = useMemo(
    () => (myDoctorQ.data || []).find((doctor) => doctor.name === user?.full_name)?.id,
    [myDoctorQ.data, user?.full_name],
  )

  const waitingQ = useQuery({
    queryKey: ['exam-waiting', day, myDoctorId],
    queryFn: async () => (await api.get('/exams/waiting', {
      params: { date: day, doctor_id: myDoctorId || undefined },
    })).data.data,
    refetchInterval: 20_000,
    enabled: user?.role !== 'dokter' || myDoctorQ.isFetched,
  })

  const rows = waitingQ.data || []
  const poliOptions = useMemo(() => {
    const names = [...new Set(rows.map((row) => row.poli_name).filter(Boolean))]
    return names.map((name) => ({ value: name, label: name }))
  }, [rows])

  const filtered = useMemo(() => {
    const base = poliFilter ? rows.filter((row) => row.poli_name === poliFilter) : rows
    if (tab === 'waiting') return base.filter((row) => ['REGISTERED', 'WAITING'].includes(row.status))
    if (tab === 'exam') return base.filter((row) => row.status === 'IN_EXAM')
    return base.filter((row) => row.status === 'EXAM_DONE')
  }, [rows, poliFilter, tab])

  const startExam = async (row) => {
    setStarting(row.id)
    try {
      await api.post(`/exams/${row.id}/start`)
      queryClient.invalidateQueries({ queryKey: ['exam-waiting'] })
      message.success(`Pemeriksaan ${row.patient_name} dimulai`)
      navigate(`/app/exam/${row.id}`)
    } catch (error) {
      message.error(errorMessage(error))
    } finally {
      setStarting(null)
    }
  }

  const openExam = (row) => {
    if (row.status === 'IN_EXAM') navigate(`/app/exam/${row.id}`)
    else if (row.status === 'EXAM_DONE') navigate(`/app/exam/${row.id}`)
    else startExam(row)
  }

  const columns = [
    {
      title: 'Antrean',
      dataIndex: 'queue_no',
      width: 84,
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
            <span>{row.mrn} · {row.gender === 'L' ? 'Laki-laki' : 'Perempuan'} · {age(row.birth_date)}</span>
          </div>
        </div>
      ),
    },
    { title: 'Poli', dataIndex: 'poli_name', responsive: ['lg'] },
    { title: 'Dokter', dataIndex: 'doctor_name', responsive: ['xl'] },
    {
      title: 'Keluhan',
      dataIndex: 'complaint',
      responsive: ['xl'],
      ellipsis: true,
      render: (value) => value || <span className="muted">-</span>,
    },
    { title: 'Status', dataIndex: 'status', width: 132, render: (value) => <StatusTag type="visit" status={value} /> },
    {
      title: 'Aksi',
      key: 'action',
      width: 160,
      render: (_, row) => (
        <Space size={4}>
          {['REGISTERED', 'WAITING'].includes(row.status) && (
            <Button
              type="primary"
              size="small"
              icon={<PlusOutlined />}
              loading={starting === row.id}
              onClick={() => startExam(row)}
            >
              Mulai
            </Button>
          )}
          {row.status === 'IN_EXAM' && (
            <Button type="primary" size="small" icon={<MedicineBoxOutlined />} onClick={() => openExam(row)}>
              Lanjutkan
            </Button>
          )}
          {row.status === 'EXAM_DONE' && (
            <Button size="small" icon={<FileTextOutlined />} onClick={() => openExam(row)}>
              Lihat
            </Button>
          )}
        </Space>
      ),
    },
  ]

  const counts = {
    waiting: rows.filter((row) => ['REGISTERED', 'WAITING'].includes(row.status)).length,
    exam: rows.filter((row) => row.status === 'IN_EXAM').length,
    done: rows.filter((row) => row.status === 'EXAM_DONE').length,
  }

  return (
    <div>
      <PageHeader
        eyebrow="Pelayanan Medis"
        title="Antrean Dokter"
        subtitle={`${date(day)} · ${myDoctorId ? 'Menampilkan pasien untuk Anda' : 'Semua dokter'} · data diperbarui otomatis.`}
        extra={(
          <Space wrap>
            <Select
              allowClear
              placeholder="Semua poli"
              options={poliOptions}
              value={poliFilter}
              onChange={setPoliFilter}
              style={{ width: 180 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => waitingQ.refetch()}>Muat ulang</Button>
          </Space>
        )}
      />

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="stat-card tone-amber">
          <div className="stat-top"><div className="stat-icon"><ClockCircleOutlined /></div></div>
          <div className="stat-label">Menunggu</div>
          <div className="stat-value">{counts.waiting}</div>
          <div className="stat-hint">Siap dipanggil untuk diperiksa</div>
        </div>
        <div className="stat-card tone-teal">
          <div className="stat-top"><div className="stat-icon"><MedicineBoxOutlined /></div></div>
          <div className="stat-label">Sedang diperiksa</div>
          <div className="stat-value">{counts.exam}</div>
          <div className="stat-hint">Rekam medis sedang diisi</div>
        </div>
        <div className="stat-card tone-green">
          <div className="stat-top"><div className="stat-icon"><CheckCircleOutlined /></div></div>
          <div className="stat-label">Selesai pemeriksaan</div>
          <div className="stat-value">{counts.done}</div>
          <div className="stat-hint">Menunggu farmasi, lab, atau kasir</div>
        </div>
      </div>

      <div className="panel">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <Space.Compact>
              <Button type={tab === 'waiting' ? 'primary' : 'default'} onClick={() => setTab('waiting')}>
                Menunggu ({counts.waiting})
              </Button>
              <Button type={tab === 'exam' ? 'primary' : 'default'} onClick={() => setTab('exam')}>
                Diperiksa ({counts.exam})
              </Button>
              <Button type={tab === 'done' ? 'primary' : 'default'} onClick={() => setTab('done')}>
                Selesai ({counts.done})
              </Button>
            </Space.Compact>
          </div>
          <div className="table-toolbar-right">
            <Tag bordered={false} color="cyan"><TeamOutlined /> {filtered.length} pasien</Tag>
          </div>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          loading={waitingQ.isLoading}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          scroll={{ x: 900 }}
          locale={{ emptyText: tab === 'waiting' ? 'Tidak ada pasien menunggu' : 'Tidak ada data pada tab ini' }}
        />
      </div>

      {myDoctorId && (
        <div className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head">
            <div>
              <h3>Tips alur pemeriksaan</h3>
              <p>Pastikan setiap langkah tersimpan sebelum menyelesaikan pemeriksaan.</p>
            </div>
          </div>
          <div className="flex-gap">
            <Tag color="blue">1. Mulai pemeriksaan</Tag>
            <Tag color="cyan">2. Isi SOAP & diagnosis utama</Tag>
            <Tag color="purple">3. Tindakan / resep / lab</Tag>
            <Tag color="green">4. Selesaikan → tagihan tersinkron</Tag>
          </div>
        </div>
      )}
    </div>
  )
}
