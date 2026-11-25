import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Alert,
  App,
  Button,
  DatePicker,
  Form,
  Input,
  Modal,
  Result,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'antd'
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { api, errorMessage } from '../api/client'
import PageHeader from '../components/PageHeader'
import StatusTag from '../components/StatusTag'
import { age, date, initials, money, today } from '../lib/format'
import { GUARANTORS } from '../lib/constants'

function defaultDate() {
  const now = dayjs()
  const hour = now.hour()
  return hour >= 21 || hour < 8 ? now.add(1, 'day') : now
}

export default function Registration() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [patientSearch, setPatientSearch] = useState('')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [selectedPoli, setSelectedPoli] = useState(null)
  const [selectedDate, setSelectedDate] = useState(defaultDate())
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(null)
  const [selectedDoctorOption, setSelectedDoctorOption] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelReason, setCancelReason] = useState('')

  const patientsQ = useQuery({
    queryKey: ['patient-options', patientSearch],
    queryFn: async () => (await api.get('/patients', { params: { q: patientSearch || undefined, per_page: 30 } })).data.data,
  })
  const polisQ = useQuery({
    queryKey: ['poli-options'],
    queryFn: async () => (await api.get('/polis', { params: { per_page: 100, is_active: 1 } })).data.data,
  })
  const doctorsQ = useQuery({
    queryKey: ['doctor-options'],
    queryFn: async () => (await api.get('/doctors', { params: { per_page: 100, is_active: 1 } })).data.data,
  })
  const schedulesQ = useQuery({
    queryKey: ['schedule-options'],
    queryFn: async () => (await api.get('/schedules', { params: { per_page: 300, is_active: 1 } })).data.data,
  })

  const visitsQ = useQuery({
    queryKey: ['registrations-today', today()],
    queryFn: async () => (await api.get('/visits', { params: { date: today(), per_page: 30 } })).data,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    const patientId = location.state?.patient_id
    if (!patientId) return
    api.get(`/patients/${patientId}`).then(({ data }) => {
      setSelectedPatient(data.data)
      form.setFieldValue('patient_id', data.data.id)
    }).catch(() => {})
  }, [location.state, form])

  const doctorOptions = useMemo(() => {
    if (!selectedPoli || !selectedDate) return []
    const dayOfWeek = selectedDate.day()
    const schedules = (schedulesQ.data || []).filter(
      (s) => Number(s.poli_id) === Number(selectedPoli) && Number(s.day_of_week) === dayOfWeek,
    )
    return schedules.map((schedule) => {
      const doctor = (doctorsQ.data || []).find((d) => Number(d.id) === Number(schedule.doctor_id))
      return {
        value: schedule.doctor_id,
        label: `${doctor?.name || schedule.doctor_name} · ${schedule.start_time.slice(0, 5)}–${schedule.end_time.slice(0, 5)}`,
        schedule,
      }
    })
  }, [selectedPoli, selectedDate, schedulesQ.data, doctorsQ.data])

  const patientOptions = useMemo(() => {
    const rows = [...(patientsQ.data || [])]
    if (selectedPatient && !rows.some((row) => row.id === selectedPatient.id)) rows.unshift(selectedPatient)
    return rows.map((patient) => ({
      value: patient.id,
      label: `${patient.name} — ${patient.mrn}`,
      patient,
    }))
  }, [patientsQ.data, selectedPatient])

const submit = async (values) => {
    setSubmitting(true)
    try {
      const payload = {
        patient_id: values.patient_id,
        poli_id: values.poli_id,
        doctor_id: values.doctor_id,
        visit_date: values.visit_date.format('YYYY-MM-DD'),
        guarantor_type: values.guarantor_type,
        complaint: values.complaint,
      }
      const { data } = await api.post('/visits', payload)
      setSuccess(data.data)
      queryClient.invalidateQueries({ queryKey: ['registrations-today'] })
      queryClient.invalidateQueries({ queryKey: ['queue-board'] })
      message.success('Pendaftaran berhasil')
      form.resetFields(['patient_id', 'complaint'])
      setSelectedPatient(null)
    } catch (error) {
      message.error(errorMessage(error, 'Pendaftaran gagal'))
    } finally {
      setSubmitting(false)
    }
  }

  const checkin = async (row) => {
    try {
      await api.patch(`/visits/${row.id}/checkin`)
      message.success(`Pasien ${row.patient_name} masuk daftar tunggu`)
      queryClient.invalidateQueries({ queryKey: ['registrations-today'] })
    } catch (error) {
      message.error(errorMessage(error))
    }
  }

  const cancel = async () => {
    if (!cancelReason.trim()) {
      message.warning('Alasan pembatalan wajib diisi')
      return
    }
    try {
      await api.patch(`/visits/${cancelTarget.id}/cancel`, { reason: cancelReason })
      message.success('Kunjungan dibatalkan')
      setCancelTarget(null)
      setCancelReason('')
      queryClient.invalidateQueries({ queryKey: ['registrations-today'] })
    } catch (error) {
      message.error(errorMessage(error))
    }
  }

  const printQueue = (row) => {
    const visit = row.visit || row
    const invoice = row.invoice
    const win = window.open('', '_blank', 'width=420,height=620')
    if (!win) return
    win.document.write(`
      <html><head><title>Antrean ${visit.visit_no}</title>
      <style>
        body{font-family:system-ui,sans-serif;padding:24px;color:#0f172a}
        .card{border:1px solid #cbd5e1;border-radius:18px;padding:22px;text-align:center}
        .brand{font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#0f8b8d;font-weight:800}
        h1{margin:4px 0 0;font-size:20px}
        .q{font-size:72px;font-weight:900;margin:16px 0;color:#0f8b8d}
        .row{display:flex;justify-content:space-between;gap:12px;border-top:1px dashed #cbd5e1;padding:8px 0;font-size:13px}
        .row span{color:#64748b}.row strong{text-align:right}
        .foot{margin-top:16px;font-size:11px;color:#94a3b8}
        @media print{body{padding:0}.card{border:0}}
      </style></head><body>
      <div class="card">
        <div class="brand">SIMRS Inova</div>
        <h1>Kartu Antrean</h1>
        <div class="q">${String(visit.queue_no).padStart(2, '0')}</div>
        <div class="row"><span>No. Kunjungan</span><strong>${visit.visit_no}</strong></div>
        <div class="row"><span>Pasien</span><strong>${visit.patient_name || ''}</strong></div>
        <div class="row"><span>Poli</span><strong>${visit.poli_name || ''}</strong></div>
        <div class="row"><span>Dokter</span><strong>${visit.doctor_name || ''}</strong></div>
        <div class="row"><span>Tanggal</span><strong>${date(visit.visit_date)}</strong></div>
        ${invoice ? `<div class="row"><span>Tagihan awal</span><strong>${money(invoice.total)}</strong></div>` : ''}
        <div class="foot">Simpan kartu ini. Terima kasih.</div>
      </div>
      <script>window.onload=()=>window.print()</script>
      </body></html>
    `)
    win.document.close()
  }

  const columns = [
    {
      title: 'Antrean',
      dataIndex: 'queue_no',
      width: 78,
      render: (v) => <span className="queue-number">{String(v).padStart(2, '0')}</span>,
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
    { title: 'Status', dataIndex: 'status', width: 132, render: (v) => <StatusTag type="visit" status={v} /> },
    {
      title: 'Aksi',
      key: 'action',
      width: 120,
      render: (_, row) => (
        <Space size={0}>
          {row.status === 'REGISTERED' && (
            <Tooltip title="Check-in ke daftar tunggu">
              <Button type="text" size="small" icon={<CheckCircleOutlined />} onClick={() => checkin(row)} />
            </Tooltip>
          )}
          {['REGISTERED', 'WAITING'].includes(row.status) && (
            <Tooltip title="Batalkan kunjungan">
              <Button type="text" size="small" danger icon={<CloseCircleOutlined />} onClick={() => { setCancelTarget(row); setCancelReason('') }} />
            </Tooltip>
          )}
          <Tooltip title="Buka pemeriksaan">
            <Button
              type="text"
              size="small"
              icon={<UserOutlined />}
              onClick={() => navigate(`/app/exam/${row.id}`)}
              disabled={!['REGISTERED', 'WAITING', 'IN_EXAM'].includes(row.status)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  const rows = visitsQ.data?.data || []
  const waiting = rows.filter((row) => ['REGISTERED', 'WAITING'].includes(row.status)).length
  const done = rows.filter((row) => ['PAID', 'BILLING', 'EXAM_DONE'].includes(row.status)).length

  return (
    <div>
      <PageHeader
        eyebrow="Front Office"
        title="Pendaftaran Pasien"
        subtitle="Pilih pasien, poli, dan dokter yang praktik. Nomor antrean dan tagihan awal dibuat otomatis."
        extra={<Button icon={<ReloadOutlined />} onClick={() => visitsQ.refetch()}>Muat ulang</Button>}
      />

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <div className="stat-card tone-teal">
          <div className="stat-label">Kunjungan hari ini</div>
          <div className="stat-value">{rows.length}</div>
          <div className="stat-hint">Semua status kunjungan</div>
        </div>
        <div className="stat-card tone-amber">
          <div className="stat-label">Belum diperiksa</div>
          <div className="stat-value">{waiting}</div>
          <div className="stat-hint">Terdaftar & menunggu</div>
        </div>
        <div className="stat-card tone-green">
          <div className="stat-label">Selesai / dibayar</div>
          <div className="stat-value">{done}</div>
          <div className="stat-hint">Sudah melewati pemeriksaan</div>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: 'minmax(0, 0.95fr) minmax(0, 1.35fr)' }}>
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Formulir Pendaftaran</h3>
              <p>Data kunjungan baru</p>
            </div>
            <Tag bordered={false} color="cyan"><UserAddOutlined /> Baru</Tag>
          </div>

          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 14, borderRadius: 12 }}
            message="Pendaftaran hari ini mengikuti jam praktik dokter. Di luar jam praktik, pilih tanggal berikutnya."
          />

          <Form
            form={form}
            layout="vertical"
            requiredMark="optional"
            onFinish={submit}
            initialValues={{
              visit_date: defaultDate(),
              guarantor_type: 'UMUM',
            }}
            onValuesChange={(changed) => {
              if (changed.poli_id !== undefined) {
                setSelectedPoli(changed.poli_id)
                form.setFieldValue('doctor_id', undefined)
              }
              if (changed.visit_date) setSelectedDate(changed.visit_date)
              if (changed.patient_id !== undefined) {
                const found = patientOptions.find((option) => option.value === changed.patient_id)
                setSelectedPatient(found?.patient || null)
              }
              if (changed.doctor_id !== undefined) {
                const dayOfWeek = selectedDate.day()
                const dayOptions = (schedulesQ.data || []).filter(
                  (s) => Number(s.poli_id) === Number(selectedPoli) && Number(s.day_of_week) === dayOfWeek,
                )
                const doctor = (doctorsQ.data || []).find((d) => Number(d.id) === Number(changed.doctor_id))
                setSelectedDoctorOption(dayOptions.length > 0 ? {
                  value: changed.doctor_id,
                  label: `${doctor?.name || 'Dokter'} · ${dayOptions.find((o) => Number(o.doctor_id) === Number(changed.doctor_id))?.start_time?.slice(0, 5) || '—'}–${dayOptions.find((o) => Number(o.doctor_id) === Number(changed.doctor_id))?.end_time?.slice(0, 5) || '—'}`,
                  schedule: dayOptions.find((o) => Number(o.doctor_id) === Number(changed.doctor_id))?.schedule,
                } : null)
              }
            }}
          >
            <Form.Item name="patient_id" label="Pasien" rules={[{ required: true, message: 'Pilih pasien' }]}>
              <Select
                showSearch
                allowClear
                placeholder="Cari nama, MRN, atau NIK…"
                filterOption={false}
                onSearch={setPatientSearch}
                options={patientOptions}
                notFoundContent={patientsQ.isLoading ? 'Mencari…' : 'Pasien tidak ditemukan'}
                suffixIcon={<SearchOutlined />}
              />
            </Form.Item>

            {selectedPatient && (
              <div className="soft-card" style={{ marginBottom: 14 }}>
                <div className="flex-between">
                  <div className="patient-cell">
                    <div className="patient-avatar">{initials(selectedPatient.name)}</div>
                    <div>
                      <strong>{selectedPatient.name}</strong>
                      <span>{selectedPatient.mrn} · {age(selectedPatient.birth_date)} · {selectedPatient.gender === 'L' ? 'Laki-laki' : 'Perempuan'}</span>
                    </div>
                  </div>
                  <Button type="link" size="small" onClick={() => navigate('/app/patients')}>Lihat profil</Button>
                </div>
              </div>
            )}

            <div className="exam-form-grid">
              <Form.Item name="poli_id" label="Poli" rules={[{ required: true, message: 'Pilih poli' }]}>
                <Select
                  placeholder="Pilih poli"
                  options={(polisQ.data || []).map((poli) => ({ value: poli.id, label: `${poli.name} · ${money(poli.registration_fee)}` }))}
                />
              </Form.Item>
              <Form.Item name="visit_date" label="Tanggal Kunjungan" rules={[{ required: true, message: 'Pilih tanggal' }]}>
                <DatePicker
                  style={{ width: '100%' }}
                  format="DD/MM/YYYY"
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                />
              </Form.Item>
              <Form.Item
                name="doctor_id"
                label="Dokter"
                className="full"
                rules={[{ required: true, message: 'Pilih dokter' }]}
                extra={selectedPoli && selectedDate && doctorOptions.length === 0 ? 'Tidak ada jadwal dokter pada poli dan tanggal ini.' : null}
              >
                <Select
                  placeholder={selectedPoli ? 'Pilih dokter yang praktik' : 'Pilih poli terlebih dahulu'}
                  disabled={!selectedPoli}
                  options={doctorOptions}
                  notFoundContent={schedulesQ.isLoading ? 'Memuat jadwal…' : 'Tidak ada jadwal'}
                />
              </Form.Item>
              <Form.Item name="guarantor_type" label="Penjamin" rules={[{ required: true }]}>
                <Select options={GUARANTORS} />
              </Form.Item>
              <Form.Item name="complaint" label="Keluhan Utama">
                <Input placeholder="Keluhan singkat pasien" />
              </Form.Item>
            </div>

            {selectedDoctorOption && (
              <div className="soft-card" style={{ marginBottom: 14 }}>
                <div className="tiny-label">Jadwal praktik</div>
                <div className="flex-between" style={{ marginTop: 4 }}>
                  <strong>{selectedDoctorOption.label}</strong>
                  {selectedDoctorOption.schedule && (
                    <Tag color="teal">Kuota {selectedDoctorOption.schedule.quota ?? '-'} pasien</Tag>
                  )}
                </div>
              </div>
            )}

            <Button type="primary" htmlType="submit" loading={submitting} block icon={<UserAddOutlined />} style={{ height: 44 }}>
              Daftarkan Pasien
            </Button>
          </Form>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Kunjungan Hari Ini</h3>
              <p>{date(today())} · {rows.length} kunjungan</p>
            </div>
            <Space>
              <Button size="small" onClick={() => visitsQ.refetch()} icon={<ReloadOutlined />}>Refresh</Button>
            </Space>
          </div>
          <Table
            rowKey="id"
            size="middle"
            columns={columns}
            dataSource={rows}
            loading={visitsQ.isLoading}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ x: 760 }}
          />
        </div>
      </div>

      <Modal
        open={Boolean(success)}
        footer={null}
        onCancel={() => setSuccess(null)}
        width={520}
        destroyOnHidden
      >
        {success && (
          <Result
            status="success"
            title="Pendaftaran berhasil"
            subTitle={`${success.visit.patient_name} terdaftar di ${success.visit.poli_name} dengan dokter ${success.visit.doctor_name}.`}
            extra={[
              <Button type="primary" key="print" icon={<PrinterOutlined />} onClick={() => printQueue(success)}>Cetak Kartu Antrean</Button>,
              <Button key="again" onClick={() => setSuccess(null)}>Daftarkan Lagi</Button>,
              <Button key="queue" onClick={() => navigate('/app/doctor-queue')}>Lihat Antrean</Button>,
            ]}
          >
            <div className="soft-card" style={{ textAlign: 'left' }}>
              <div className="flex-between" style={{ marginBottom: 10 }}>
                <div>
                  <div className="tiny-label">Nomor antrean</div>
                  <div style={{ fontSize: 40, fontWeight: 900, color: 'var(--brand)', lineHeight: 1 }}>{String(success.visit.queue_no).padStart(2, '0')}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="tiny-label">No. kunjungan</div>
                  <strong>{success.visit.visit_no}</strong>
                </div>
              </div>
              <div className="info-grid">
                <div className="info-item"><span className="tiny-label">Pasien</span><div>{success.visit.patient_name} ({success.visit.mrn})</div></div>
                <div className="info-item"><span className="tiny-label">Penjamin</span><div>{success.visit.guarantor_type}</div></div>
                <div className="info-item"><span className="tiny-label">Tagihan awal</span><div>{money(success.invoice?.total)}</div></div>
                <div className="info-item"><span className="tiny-label">Invoice</span><div>{success.invoice?.invoice_no || '-'}</div></div>
              </div>
            </div>
          </Result>
        )}
      </Modal>

      <Modal
        open={Boolean(cancelTarget)}
        title="Batalkan Kunjungan"
        onCancel={() => setCancelTarget(null)}
        onOk={cancel}
        okText="Batalkan Kunjungan"
        okButtonProps={{ danger: true }}
        cancelText="Kembali"
      >
        <p className="muted">
          Kunjungan <strong>{cancelTarget?.visit_no}</strong> atas nama <strong>{cancelTarget?.patient_name}</strong> akan dibatalkan.
        </p>
        <Input.TextArea
          rows={3}
          value={cancelReason}
          onChange={(e) => setCancelReason(e.target.value)}
          placeholder="Alasan pembatalan (wajib)"
        />
      </Modal>
    </div>
  )
}
