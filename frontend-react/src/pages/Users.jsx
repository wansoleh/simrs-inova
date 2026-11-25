import { useMemo, useState } from 'react'
import {
  App,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Tooltip,
} from 'antd'
import {
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import PageHeader from '../components/PageHeader'
import StatCard from '../components/StatCard'
import { dateTime, initials } from '../lib/format'
import { ROLE_LABELS } from '../lib/constants'

export default function Users() {
  const { user: currentUser } = useAuth()
  const { message, modal } = App.useApp()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()

  const usersQ = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get('/users')).data.data,
  })

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase()
    const source = usersQ.data || []
    if (!term) return source
    return source.filter((row) => `${row.full_name} ${row.username} ${row.role}`.toLowerCase().includes(term))
  }, [usersQ.data, search])

  const stats = useMemo(() => {
    const source = usersQ.data || []
    return {
      total: source.length,
      active: source.filter((row) => row.is_active).length,
      roles: new Set(source.map((row) => row.role)).size,
    }
  }, [usersQ.data])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ role: 'pendaftaran', is_active: true })
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    form.resetFields()
    form.setFieldsValue({ full_name: row.full_name, role: row.role, is_active: Boolean(row.is_active), password: '' })
    setModalOpen(true)
  }

  const save = async () => {
    try {
      const values = await form.validateFields()
      const payload = { ...values }
      if (!payload.password) delete payload.password
      if (editing) {
        await api.put(`/users/${editing.id}`, payload)
        message.success('Pengguna diperbarui')
        if (editing.id === currentUser?.id) message.info('Perubahan akun Anda akan berlaku pada sesi berikutnya')
      } else {
        await api.post('/users', payload)
        message.success('Pengguna baru dibuat')
      }
      setModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['users'] })
    } catch (error) {
      if (error?.errorFields) return
      message.error(errorMessage(error))
    }
  }

  const toggleActive = (row, value) => {
    if (row.id === currentUser?.id && !value) {
      message.warning('Anda tidak dapat menonaktifkan akun yang sedang dipakai')
      return
    }
    modal.confirm({
      title: value ? 'Aktifkan pengguna?' : 'Nonaktifkan pengguna?',
      content: `${row.full_name} (${row.username}) akan ${value ? 'diaktifkan' : 'dinonaktifkan'}.`,
      okText: value ? 'Aktifkan' : 'Nonaktifkan',
      okButtonProps: { danger: !value },
      cancelText: 'Batal',
      onOk: async () => {
        try {
          await api.put(`/users/${row.id}`, { is_active: value })
          message.success('Status pengguna diperbarui')
          queryClient.invalidateQueries({ queryKey: ['users'] })
        } catch (error) {
          message.error(errorMessage(error))
        }
      },
    })
  }

  const changeRole = async (row, role) => {
    if (role === row.role) return
    try {
      await api.put(`/users/${row.id}`, { role })
      message.success(`Role ${row.full_name} diubah menjadi ${ROLE_LABELS[role]}`)
      queryClient.invalidateQueries({ queryKey: ['users'] })
    } catch (error) {
      message.error(errorMessage(error))
    }
  }

  const columns = [
    {
      title: 'Pengguna',
      dataIndex: 'full_name',
      render: (_, row) => (
        <div className="patient-cell">
          <div className="patient-avatar">{initials(row.full_name)}</div>
          <div>
            <strong>{row.full_name} {row.id === currentUser?.id && <Tag color="teal" bordered={false}>Anda</Tag>}</strong>
            <span>@{row.username}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Role',
      dataIndex: 'role',
      width: 190,
      render: (value, row) => (
        <Select
          size="small"
          value={value}
          style={{ width: 170 }}
          onChange={(next) => changeRole(row, next)}
          options={Object.entries(ROLE_LABELS).map(([key, label]) => ({ value: key, label }))}
        />
      ),
    },
    {
      title: 'Status',
      dataIndex: 'is_active',
      width: 110,
      render: (value, row) => (
        <Switch
          size="small"
          checked={Boolean(value)}
          checkedChildren="Aktif"
          unCheckedChildren="Nonaktif"
          onChange={(next) => toggleActive(row, next)}
        />
      ),
    },
    { title: 'Login Terakhir', dataIndex: 'last_login_at', responsive: ['lg'], render: (v) => v ? dateTime(v) : <span className="muted">Belum pernah</span> },
    { title: 'Dibuat', dataIndex: 'created_at', responsive: ['xl'], render: (v) => dateTime(v) },
    {
      title: '',
      key: 'action',
      width: 70,
      render: (_, row) => (
        <Tooltip title="Edit pengguna">
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
        </Tooltip>
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        eyebrow="Administrasi"
        title="Pengguna & Role"
        subtitle="Kelola akun staf, role akses, dan status aktif. Setiap role memiliki izin yang berbeda."
        extra={(
          <Space>
            <Button icon={<ReloadOutlined />} onClick={() => usersQ.refetch()}>Muat ulang</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Pengguna Baru</Button>
          </Space>
        )}
      />

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        <StatCard icon={<UserOutlined />} label="Total pengguna" value={stats.total} hint="Semua akun" tone="teal" />
        <StatCard icon={<SafetyCertificateOutlined />} label="Akun aktif" value={stats.active} hint="Dapat login" tone="green" />
        <StatCard icon={<SafetyCertificateOutlined />} label="Role terpakai" value={`${stats.roles} / 6`} hint="Administrator hingga Kasir" tone="blue" />
      </div>

      <div className="panel">
        <div className="table-toolbar">
          <div className="table-toolbar-left">
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Cari nama, username, atau role…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: 300, maxWidth: '100%' }}
            />
          </div>
          <div className="table-toolbar-right">
            <Tag bordered={false} color="cyan">{rows.length} pengguna</Tag>
          </div>
        </div>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={usersQ.isLoading}
          pagination={false}
          scroll={{ x: 880 }}
        />
      </div>

      <Modal
        open={modalOpen}
        title={editing ? `Edit ${editing.full_name}` : 'Pengguna Baru'}
        onCancel={() => setModalOpen(false)}
        onOk={save}
        okText="Simpan"
        cancelText="Batal"
        destroyOnHidden
        width={620}
      >
        <Form form={form} layout="vertical" requiredMark="optional">
          {!editing && (
            <Form.Item
              name="username"
              label="Username"
              rules={[
                { required: true, message: 'Username wajib diisi' },
                { pattern: /^[a-zA-Z0-9._-]+$/, message: 'Gunakan huruf, angka, titik, garis bawah, atau strip' },
              ]}
            >
              <Input autoComplete="off" placeholder="contoh: perawat01" />
            </Form.Item>
          )}
          <Form.Item name="full_name" label="Nama Lengkap" rules={[{ required: true, message: 'Nama wajib diisi' }]}>
            <Input placeholder="Nama lengkap staf" />
          </Form.Item>
          <div className="exam-form-grid">
            <Form.Item name="role" label="Role" rules={[{ required: true, message: 'Pilih role' }]}>
              <Select options={Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))} />
            </Form.Item>
            <Form.Item name="is_active" label="Status" valuePropName="checked">
              <Switch checkedChildren="Aktif" unCheckedChildren="Nonaktif" />
            </Form.Item>
          </div>
          <Form.Item
            name="password"
            label={editing ? 'Password Baru (opsional)' : 'Password'}
            rules={editing ? [{ min: 6, message: 'Minimal 6 karakter' }] : [{ required: true, message: 'Password wajib diisi' }, { min: 6, message: 'Minimal 6 karakter' }]}
          >
            <Input.Password autoComplete="new-password" placeholder={editing ? 'Kosongkan jika tidak diubah' : 'Minimal 6 karakter'} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
