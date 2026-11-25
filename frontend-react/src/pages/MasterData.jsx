import { useMemo, useState } from 'react'
import {
  App,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  TimePicker,
  Tooltip,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  ExperimentOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  
  TeamOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import dayjs from 'dayjs'
import { api, errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import PageHeader from '../components/PageHeader'
import { date, money, number, normalizeTime } from '../lib/format'
import { DAYS } from '../lib/constants'

const CONFIG = {
  polis: {
    label: 'Poli',
    endpoint: '/polis',
    icon: <TeamOutlined />,
    columns: [
      { title: 'Kode', dataIndex: 'code', width: 100, render: (v) => <strong>{v}</strong> },
      { title: 'Nama Poli', dataIndex: 'name' },
      { title: 'Biaya Daftar', dataIndex: 'registration_fee', align: 'right', render: (v) => money(v) },
      { title: 'Deskripsi', dataIndex: 'description', responsive: ['lg'], render: (v) => v || '-' },
      { title: 'Status', dataIndex: 'is_active', width: 100, render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Aktif' : 'Nonaktif'}</Tag> },
    ],
    fields: [
      { name: 'code', label: 'Kode', type: 'text', required: true },
      { name: 'name', label: 'Nama Poli', type: 'text', required: true },
      { name: 'registration_fee', label: 'Biaya Pendaftaran', type: 'number', required: true, min: 0 },
      { name: 'description', label: 'Deskripsi', type: 'textarea', full: true },
      { name: 'is_active', label: 'Aktif', type: 'switch', initial: true },
    ],
  },
  doctors: {
    label: 'Dokter',
    endpoint: '/doctors',
    icon: <ExperimentOutlined />,
    columns: [
      { title: 'STR', dataIndex: 'str_no', width: 120 },
      { title: 'Nama Dokter', dataIndex: 'name', render: (v) => <strong>{v}</strong> },
      { title: 'Spesialisasi', dataIndex: 'specialization', render: (v) => v || '-' },
      { title: 'Telepon', dataIndex: 'phone', responsive: ['lg'], render: (v) => v || '-' },
      { title: 'Status', dataIndex: 'is_active', width: 100, render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Aktif' : 'Nonaktif'}</Tag> },
    ],
    fields: [
      { name: 'str_no', label: 'Nomor STR', type: 'text', required: true },
      { name: 'name', label: 'Nama Lengkap', type: 'text', required: true },
      { name: 'specialization', label: 'Spesialisasi', type: 'text' },
      { name: 'phone', label: 'Telepon', type: 'text' },
      { name: 'is_active', label: 'Aktif', type: 'switch', initial: true },
    ],
  },
  schedules: {
    label: 'Jadwal',
    endpoint: '/schedules',
    icon: <SettingOutlined />,
    columns: [
      { title: 'Dokter', dataIndex: 'doctor_name', render: (v) => <strong>{v}</strong> },
      { title: 'Poli', dataIndex: 'poli_name' },
      { title: 'Hari', dataIndex: 'day_of_week', render: (v) => DAYS.find((d) => d.value === Number(v))?.label || v },
      { title: 'Jam', key: 'time', render: (_, r) => `${r.start_time?.slice(0, 5)} – ${r.end_time?.slice(0, 5)}` },
      { title: 'Kuota', dataIndex: 'quota', width: 80, align: 'center' },
      { title: 'Status', dataIndex: 'is_active', width: 100, render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Aktif' : 'Nonaktif'}</Tag> },
    ],
    fields: [
      { name: 'doctor_id', label: 'Dokter', type: 'select', optionsKey: 'doctors', required: true },
      { name: 'poli_id', label: 'Poli', type: 'select', optionsKey: 'polis', required: true },
      { name: 'day_of_week', label: 'Hari', type: 'select', options: DAYS, required: true },
      { name: 'start_time', label: 'Jam Mulai', type: 'time', required: true },
      { name: 'end_time', label: 'Jam Selesai', type: 'time', required: true },
      { name: 'quota', label: 'Kuota Pasien', type: 'number', min: 1 },
      { name: 'is_active', label: 'Aktif', type: 'switch', initial: true },
    ],
  },
  procedures: {
    label: 'Tindakan',
    endpoint: '/procedures',
    icon: <ExperimentOutlined />,
    columns: [
      { title: 'Kode', dataIndex: 'code', width: 100, render: (v) => <strong>{v}</strong> },
      { title: 'Nama Tindakan', dataIndex: 'name' },
      { title: 'Kategori', dataIndex: 'category', render: (v) => v || '-' },
      { title: 'Harga', dataIndex: 'price', align: 'right', render: (v) => money(v) },
      { title: 'Status', dataIndex: 'is_active', width: 100, render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Aktif' : 'Nonaktif'}</Tag> },
    ],
    fields: [
      { name: 'code', label: 'Kode', type: 'text', required: true },
      { name: 'name', label: 'Nama Tindakan', type: 'text', required: true },
      { name: 'price', label: 'Harga', type: 'number', required: true, min: 0 },
      { name: 'category', label: 'Kategori', type: 'text' },
      { name: 'is_active', label: 'Aktif', type: 'switch', initial: true },
    ],
  },
  medicines: {
    label: 'Obat',
    endpoint: '/medicines',
    icon: <MedicineBoxOutlined />,
    columns: [
      { title: 'Kode', dataIndex: 'code', width: 100, render: (v) => <strong>{v}</strong> },
      { title: 'Nama Obat', dataIndex: 'name', render: (v, r) => <div><strong>{v}</strong><div className="muted" style={{ fontSize: 11.5 }}>{r.category || 'Umum'}</div></div> },
      { title: 'Satuan', dataIndex: 'unit', width: 90 },
      { title: 'Harga', dataIndex: 'price', align: 'right', render: (v) => money(v) },
      { title: 'Stok', dataIndex: 'stock', align: 'center', width: 100, render: (v) => <Tag color={Number(v) < 100 ? 'red' : 'green'}>{number(v)}</Tag> },
      { title: 'Status', dataIndex: 'is_active', width: 100, render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Aktif' : 'Nonaktif'}</Tag> },
    ],
    fields: [
      { name: 'code', label: 'Kode', type: 'text', required: true },
      { name: 'name', label: 'Nama Obat', type: 'text', required: true },
      { name: 'unit', label: 'Satuan', type: 'text', required: true },
      { name: 'price', label: 'Harga', type: 'number', required: true, min: 0 },
      { name: 'category', label: 'Kategori', type: 'text' },
      { name: 'is_active', label: 'Aktif', type: 'switch', initial: true },
    ],
  },
  'lab-tests': {
    label: 'Lab',
    endpoint: '/lab-tests',
    icon: <ExperimentOutlined />,
    columns: [
      { title: 'Kode', dataIndex: 'code', width: 100, render: (v) => <strong>{v}</strong> },
      { title: 'Nama Pemeriksaan', dataIndex: 'name' },
      { title: 'Satuan', dataIndex: 'unit', width: 90 },
      { title: 'Nilai Rujukan', dataIndex: 'ref_range', render: (v) => v || '-' },
      { title: 'Harga', dataIndex: 'price', align: 'right', render: (v) => money(v) },
      { title: 'Status', dataIndex: 'is_active', width: 100, render: (v) => <Tag color={v ? 'green' : 'red'}>{v ? 'Aktif' : 'Nonaktif'}</Tag> },
    ],
    fields: [
      { name: 'code', label: 'Kode', type: 'text', required: true },
      { name: 'name', label: 'Nama Pemeriksaan', type: 'text', required: true },
      { name: 'unit', label: 'Satuan', type: 'text' },
      { name: 'ref_range', label: 'Nilai Rujukan', type: 'text' },
      { name: 'price', label: 'Harga', type: 'number', required: true, min: 0 },
      { name: 'category', label: 'Kategori', type: 'text' },
      { name: 'is_active', label: 'Aktif', type: 'switch', initial: true },
    ],
  },
}

export default function MasterData() {
  const { hasPermission } = useAuth()
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('polis')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()
  const config = CONFIG[tab]
  const canManage = hasPermission('master.manage')

  const polisQ = useQuery({
    queryKey: ['master-polis-options'],
    queryFn: async () => (await api.get('/polis', { params: { per_page: 200, is_active: 1 } })).data.data,
  })
  const doctorsQ = useQuery({
    queryKey: ['master-doctor-options'],
    queryFn: async () => (await api.get('/doctors', { params: { per_page: 200, is_active: 1 } })).data.data,
  })

  const listQ = useQuery({
    queryKey: ['master', tab, page, search],
    queryFn: async () => {
      const { data } = await api.get(config.endpoint, { params: { page, per_page: 20, q: search || undefined } })
      return { rows: data.data, meta: data.meta }
    },
  })

  const optionSources = useMemo(() => ({
    polis: (polisQ.data || []).map((p) => ({ value: p.id, label: p.name })),
    doctors: (doctorsQ.data || []).map((d) => ({ value: d.id, label: d.name })),
  }), [polisQ.data, doctorsQ.data])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    const initial = {}
    config.fields.forEach((field) => {
      if (field.initial !== undefined) initial[field.name] = field.initial
      if (field.type === 'switch' && field.initial === undefined) initial[field.name] = true
    })
    form.setFieldsValue(initial)
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    const values = { ...row }
    config.fields.forEach((field) => {
      if (field.type === 'time' && values[field.name]) values[field.name] = dayjs(values[field.name], 'HH:mm:ss')
      if (field.type === 'switch') values[field.name] = Boolean(values[field.name])
      if (field.type === 'select' && field.optionsKey) values[field.name] = Number(values[field.name])
    })
    form.setFieldsValue(values)
    setModalOpen(true)
  }

  const save = async () => {
    try {
      const values = await form.validateFields()
      const payload = { ...values }
      config.fields.forEach((field) => {
        if (field.type === 'time') payload[field.name] = normalizeTime(values[field.name])
      })
      if (editing) {
        await api.put(`${config.endpoint}/${editing.id}`, payload)
        message.success(`${config.label} diperbarui`)
      } else {
        await api.post(config.endpoint, payload)
        message.success(`${config.label} ditambahkan`)
      }
      setModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['master', tab] })
      queryClient.invalidateQueries({ queryKey: ['master-polis-options'] })
      queryClient.invalidateQueries({ queryKey: ['master-doctor-options'] })
    } catch (error) {
      if (error?.errorFields) return
      message.error(errorMessage(error))
    }
  }

  const deactivate = (row) => {
    modal.confirm({
      title: `Nonaktifkan ${config.label}?`,
      content: `${row.name || row.code || row.id} tidak akan muncul pada pilihan baru. Data historis tetap tersimpan.`,
      okText: 'Nonaktifkan',
      okButtonProps: { danger: true },
      cancelText: 'Batal',
      onOk: async () => {
        try {
          await api.delete(`${config.endpoint}/${row.id}`)
          message.success(`${config.label} dinonaktifkan`)
          queryClient.invalidateQueries({ queryKey: ['master', tab] })
        } catch (error) {
          message.error(errorMessage(error))
        }
      },
    })
  }

  const columns = [
    ...config.columns,
    ...(canManage ? [{
      title: '',
      key: 'action',
      width: 100,
      render: (_, row) => (
        <Space size={2}>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          </Tooltip>
          <Tooltip title="Nonaktifkan">
            <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => deactivate(row)} />
          </Tooltip>
        </Space>
      ),
    }] : []),
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Konfigurasi"
        title="Master Data"
        subtitle="Kelola referensi layanan: poli, dokter, jadwal praktik, tindakan, obat, dan pemeriksaan laboratorium."
        extra={(
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => listQ.refetch()}>Muat ulang</Button>
            {canManage && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>{config.label} Baru</Button>}
          </Space>
        )}
      />

      <div className="panel">
        <Tabs
          activeKey={tab}
          onChange={(key) => { setTab(key); setPage(1); setSearch('') }}
          items={Object.entries(CONFIG).map(([key, item]) => ({
            key,
            label: <span>{item.icon} {item.label}</span>,
          }))}
        />
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder={`Cari ${config.label.toLowerCase()}…`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 300, maxWidth: '100%' }}
            />
          </div>
          <div className="table-toolbar-right">
            <Tag bordered={false} color="cyan">{listQ.data?.meta?.total ?? 0} data</Tag>
          </div>
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={listQ.data?.rows || []}
          loading={listQ.isLoading}
          scroll={{ x: 820 }}
          pagination={{
            current: page,
            pageSize: 20,
            total: listQ.data?.meta?.total || 0,
            showSizeChanger: false,
            onChange: setPage,
            showTotal: (total) => `${total} data`,
          }}
        />
      </div>

      <Modal
        open={modalOpen}
        title={editing ? `Edit ${config.label}` : `${config.label} Baru`}
        onCancel={() => setModalOpen(false)}
        onOk={save}
        okText="Simpan"
        cancelText="Batal"
        width={680}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark="optional">
          <div className="exam-form-grid">
            {config.fields.map((field) => {
              const rules = field.required ? [{ required: true, message: `${field.label} wajib diisi` }] : []
              let control = null
              if (field.type === 'text') control = <Input placeholder={field.label} />
              if (field.type === 'textarea') control = <Input.TextArea rows={2} placeholder={field.label} />
              if (field.type === 'number') control = <InputNumber style={{ width: '100%' }} min={field.min} />
              if (field.type === 'switch') control = <Switch />
              if (field.type === 'time') control = <TimePicker format="HH:mm" style={{ width: '100%' }} minuteStep={5} />
              if (field.type === 'select') {
                control = (
                  <Select
                    showSearch
                    optionFilterProp="label"
                    placeholder={`Pilih ${field.label}`}
                    options={field.options || optionSources[field.optionsKey] || []}
                  />
                )
              }
              return (
                <Form.Item
                  key={field.name}
                  name={field.name}
                  label={field.label}
                  rules={rules}
                  className={field.full ? 'full' : undefined}
                  valuePropName={field.type === 'switch' ? 'checked' : 'value'}
                >
                  {control}
                </Form.Item>
              )
            })}
          </div>
        </Form>
      </Modal>
    </div>
  )
}
