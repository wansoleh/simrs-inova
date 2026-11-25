import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  App,
  Button,
  DatePicker,
  Descriptions,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
} from 'antd'
import {
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  PhoneOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { api, errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import PageHeader from '../components/PageHeader'
import StatusTag from '../components/StatusTag'
import { age, date, dateTime, initials, money } from '../lib/format'
import { BLOOD_TYPES, GENDERS } from '../lib/constants'

export default function Patients() {
  const { hasPermission } = useAuth()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') || '')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(10)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [detailId, setDetailId] = useState(null)
  const [form] = Form.useForm()

  useEffect(() => {
    setSearch(params.get('q') || '')
    setPage(1)
  }, [params])

  const listQ = useQuery({
    queryKey: ['patients', page, perPage, search],
    queryFn: async () => {
      const { data } = await api.get('/patients', { params: { page, per_page: perPage, q: search || undefined } })
      return { rows: data.data, meta: data.meta }
    },
  })

  const detailQ = useQuery({
    queryKey: ['patient', detailId],
    queryFn: async () => (await api.get(`/patients/${detailId}`)).data.data,
    enabled: Boolean(detailId),
  })
  const historyQ = useQuery({
    queryKey: ['patient-history', detailId],
    queryFn: async () => (await api.get(`/patients/${detailId}/history`)).data.data,
    enabled: Boolean(detailId) && hasPermission('exam.read'),
  })
  const medicationQ = useQuery({
    queryKey: ['patient-medication', detailId],
    queryFn: async () => (await api.get(`/patients/${detailId}/medication-history`)).data.data,
    enabled: Boolean(detailId) && hasPermission('rx.read'),
  })

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ gender: 'L' })
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    form.setFieldsValue({
      ...row,
      birth_date: row.birth_date ? dayjs(row.birth_date) : null,
    })
    setModalOpen(true)
  }

  const save = async () => {
    try {
      const values = await form.validateFields()
      const payload = {
        ...values,
        birth_date: values.birth_date?.format('YYYY-MM-DD'),
      }
      if (editing) {
        await api.put(`/patients/${editing.id}`, payload)
        message.success('Data pasien diperbarui')
      } else {
        await api.post('/patients', payload)
        message.success('Pasien baru berhasil ditambahkan')
      }
      setModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      if (detailId) queryClient.invalidateQueries({ queryKey: ['patient', detailId] })
    } catch (error) {
      if (error?.errorFields) return
      message.error(errorMessage(error))
    }
  }

  const submitSearch = (value) => {
    const next = new URLSearchParams(params)
    if (value.trim()) next.set('q', value.trim())
    else next.delete('q')
    setParams(next)
  }

  const columns = [
    {
      title: 'Pasien',
      dataIndex: 'name',
      render: (_, row) => (
        <div className="patient-cell">
          <div className="patient-avatar">{initials(row.name)}</div>
          <div>
            <strong>{row.name}</strong>
            <span>{row.mrn} · {row.gender === 'L' ? 'Laki-laki' : 'Perempuan'} · {age(row.birth_date)}</span>
          </div>
        </div>
      ),
    },
    { title: 'NIK', dataIndex: 'nik', responsive: ['xl'], render: (v) => v || <span className="muted">-</span> },
    {
      title: 'Kontak',
      dataIndex: 'phone',
      responsive: ['lg'],
      render: (v) => v ? <span><PhoneOutlined /> {v}</span> : <span className="muted">-</span>,
    },
    { title: 'Gol. Darah', dataIndex: 'blood_type', width: 100, responsive: ['lg'], render: (v) => v || '-' },
    {
      title: 'Alamat',
      dataIndex: 'address',
      responsive: ['xl'],
      ellipsis: true,
      render: (v) => v || <span className="muted">-</span>,
    },
    {
      title: 'Aksi',
      key: 'action',
      width: 150,
      render: (_, row) => (
        <Space size={2}>
          <Tooltip title="Detail & riwayat">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setDetailId(row.id)} />
          </Tooltip>
          {hasPermission('patient.manage') && (
            <Tooltip title="Edit data">
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
            </Tooltip>
          )}
          {hasPermission('visit.register') && (
            <Tooltip title="Daftarkan kunjungan">
              <Button
                type="text"
                size="small"
                icon={<UserAddOutlined />}
                onClick={() => navigate('/app/registration', { state: { patient_id: row.id } })}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  const detail = detailQ.data

  return (
    <div>
      <PageHeader
        eyebrow="Master Pasien"
        title="Data Pasien"
        subtitle="Cari berdasarkan nama, MRN, NIK, atau nomor telepon. Riwayat kunjungan dan obat tersimpan otomatis."
        extra={(
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={() => listQ.refetch()}>Muat ulang</Button>
            {hasPermission('patient.manage') && (
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Pasien Baru</Button>
            )}
          </Space>
        )}
      />

      <div className="panel">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Cari nama, MRN, NIK, atau telepon…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={(e) => submitSearch(e.currentTarget.value)}
              style={{ width: 340, maxWidth: '100%' }}
            />
            <Button onClick={() => submitSearch(search)}>Cari</Button>
            {(search || params.get('q')) && (
              <Button type="link" onClick={() => { setSearch(''); setParams({}) }}>Reset</Button>
            )}
          </div>
          <div className="table-toolbar-right">
            <Tag bordered={false} color="cyan">{listQ.data?.meta?.total ?? 0} pasien</Tag>
          </div>
        </div>

        <Table
          rowKey="id"
          columns={columns}
          dataSource={listQ.data?.rows || []}
          loading={listQ.isLoading}
          scroll={{ x: 860 }}
          pagination={{
            current: page,
            pageSize: perPage,
            total: listQ.data?.meta?.total || 0,
            showSizeChanger: true,
            pageSizeOptions: [10, 20, 50],
            showTotal: (total) => `${total} pasien`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage)
              setPerPage(nextSize)
            },
          }}
        />
      </div>

      <Modal
        open={modalOpen}
        title={editing ? `Edit Pasien — ${editing.mrn}` : 'Tambah Pasien Baru'}
        onCancel={() => setModalOpen(false)}
        onOk={save}
        okText={editing ? 'Simpan Perubahan' : 'Simpan Pasien'}
        cancelText="Batal"
        width={720}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark="optional">
          <div className="exam-form-grid">
            <Form.Item name="name" label="Nama Lengkap" rules={[{ required: true, message: 'Nama wajib diisi' }]}>
              <Input prefix={<UserOutlined />} placeholder="Nama sesuai identitas" />
            </Form.Item>
            <Form.Item name="nik" label="NIK">
              <Input placeholder="16 digit NIK" maxLength={16} />
            </Form.Item>
            <Form.Item name="birth_date" label="Tanggal Lahir" rules={[{ required: true, message: 'Tanggal lahir wajib diisi' }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" placeholder="Pilih tanggal" />
            </Form.Item>
            <Form.Item name="gender" label="Jenis Kelamin" rules={[{ required: true, message: 'Pilih jenis kelamin' }]}>
              <Select options={GENDERS} />
            </Form.Item>
            <Form.Item name="phone" label="Nomor Telepon">
              <Input placeholder="08xxxxxxxxxx" />
            </Form.Item>
            <Form.Item name="blood_type" label="Golongan Darah">
              <Select allowClear options={BLOOD_TYPES} placeholder="Pilih golongan darah" />
            </Form.Item>
            <Form.Item name="address" label="Alamat" className="full">
              <Input.TextArea rows={2} placeholder="Alamat lengkap" />
            </Form.Item>
            <Form.Item name="allergy" label="Alergi" className="full">
              <Input.TextArea rows={2} placeholder="Riwayat alergi obat/makanan (opsional)" />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Drawer
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        width={680}
        title="Detail Pasien"
        extra={hasPermission('patient.manage') && detail ? (
          <Button icon={<EditOutlined />} onClick={() => openEdit(detail)}>Edit</Button>
        ) : null}
      >
        {detailQ.isLoading ? <div className="chart-empty">Memuat data pasien…</div> : detail && (
          <>
            <div className="detail-hero">
              <div className="patient-avatar">{initials(detail.name)}</div>
              <div>
                <h3>{detail.name}</h3>
                <p>{detail.mrn} · {detail.gender === 'L' ? 'Laki-laki' : 'Perempuan'} · {age(detail.birth_date)} · {date(detail.birth_date)}</p>
                <Space wrap style={{ marginTop: 6 }}>
                  {detail.blood_type && <Tag color="red">Gol. darah {detail.blood_type}</Tag>}
                  {detail.phone && <Tag icon={<PhoneOutlined />}>{detail.phone}</Tag>}
                </Space>
              </div>
            </div>

            <Tabs
              items={[
                {
                  key: 'profile',
                  label: 'Profil',
                  children: (
                    <Descriptions column={1} size="small" bordered>
                      <Descriptions.Item label="NIK">{detail.nik || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Alamat">{detail.address || '-'}</Descriptions.Item>
                      <Descriptions.Item label="Alergi">{detail.allergy || 'Tidak ada catatan alergi'}</Descriptions.Item>
                      <Descriptions.Item label="Terdaftar">{dateTime(detail.created_at)}</Descriptions.Item>
                      <Descriptions.Item label="Diperbarui">{dateTime(detail.updated_at)}</Descriptions.Item>
                    </Descriptions>
                  ),
                },
                {
                  key: 'history',
                  label: <span><FileTextOutlined /> Riwayat Kunjungan</span>,
                  children: hasPermission('exam.read') ? (
                    historyQ.isLoading ? <div className="chart-empty">Memuat riwayat…</div> : (
                      <Timeline
                        items={(historyQ.data || []).map((visit) => ({
                          dot: <span className="timeline-dot" />,
                          children: (
                            <div>
                              <div className="flex-between">
                                <strong>{date(visit.visit_date)} · {visit.poli_name}</strong>
                                <StatusTag type="visit" status={visit.status} />
                              </div>
                              <div className="muted" style={{ fontSize: 12 }}>
                                {visit.visit_no} · {visit.doctor_name}
                              </div>
                              {visit.diagnoses?.length > 0 && (
                                <div style={{ marginTop: 6 }}>
                                  {visit.diagnoses.map((d) => (
                                    <Tag key={d.id} color={d.type === 'P' ? 'teal' : 'default'}>
                                      {d.icd10_code} — {d.name}
                                    </Tag>
                                  ))}
                                </div>
                              )}
                              {visit.record?.anamnesis && (
                                <div className="soft-card" style={{ marginTop: 8, fontSize: 12.5 }}>
                                  <span className="tiny-label">Anamnesis</span>
                                  <div>{visit.record.anamnesis}</div>
                                </div>
                              )}
                              <div style={{ marginTop: 8 }}>
                                <Button
                                  type="link"
                                  size="small"
                                  onClick={() => navigate(`/app/exam/${visit.id}`)}
                                  disabled={!['REGISTERED', 'WAITING', 'IN_EXAM', 'EXAM_DONE'].includes(visit.status)}
                                >
                                  Buka pemeriksaan
                                </Button>
                              </div>
                            </div>
                          ),
                        }))}
                      />
                    )
                  ) : <div className="empty-card">Peran Anda tidak memiliki akses riwayat pemeriksaan.</div>,
                },
                {
                  key: 'medication',
                  label: 'Riwayat Obat',
                  children: hasPermission('rx.read') ? (
                    <Table
                      rowKey={(row) => `${row.prescription_no}-${row.medicine_name}`}
                      size="small"
                      loading={medicationQ.isLoading}
                      dataSource={medicationQ.data || []}
                      pagination={false}
                      columns={[
                        { title: 'Tanggal', dataIndex: 'dispensed_at', render: (v) => date(v) },
                        { title: 'Obat', dataIndex: 'medicine_name', render: (v, r) => <strong>{v} <span className="muted">({r.qty} {r.unit})</span></strong> },
                        { title: 'Aturan', dataIndex: 'dose', render: (v, r) => v ? `${v} · ${r.frequency || '-'}` : '-' },
                        { title: 'Dokter', dataIndex: 'doctor_name', responsive: ['lg'] },
                      ]}
                    />
                  ) : <div className="empty-card">Peran Anda tidak memiliki akses riwayat obat.</div>,
                },
              ]}
            />
          </>
        )}
      </Drawer>
    </div>
  )
}
