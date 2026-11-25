import { useState } from 'react'
import {
  App,
  Avatar,
  Button,
  Form,
  Input,
  Skeleton,
  Space,
  Tag,
} from 'antd'
import {
  ClockCircleOutlined,
  KeyOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import PageHeader from '../components/PageHeader'
import { dateTime, initials } from '../lib/format'
import { ROLE_LABELS } from '../lib/constants'

const PERMISSION_LABELS = {
  '*': 'Akses penuh seluruh modul',
  'master.view': 'Melihat master data',
  'master.manage': 'Mengelola master data',
  'patient.manage': 'Mengelola data pasien',
  'visit.register': 'Mendaftarkan kunjungan',
  'queue.view': 'Melihat antrean',
  'exam.read': 'Melihat pemeriksaan',
  'exam.write': 'Menulis rekam medis',
  'procedure.write': 'Mencatat tindakan',
  'rx.write': 'Menulis resep',
  'rx.read': 'Melihat resep',
  'rx.dispense': 'Menyerahkan obat',
  'lab.order': 'Membuat order lab',
  'lab.result.write': 'Mengisi hasil lab',
  'billing.read': 'Melihat tagihan',
  'billing.pay': 'Memproses pembayaran',
  'invoice.print': 'Mencetak invoice',
  'user.manage': 'Mengelola pengguna & role',
  'dashboard.view': 'Melihat dashboard',
}

export default function Profile() {
  const { user, logout } = useAuth()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [changing, setChanging] = useState(false)
  const [form] = Form.useForm()

  const meQ = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get('/auth/me')).data.data,
  })
  const profile = meQ.data || user
  const permissions = profile?.permissions || []

  const changePassword = async (values) => {
    setChanging(true)
    try {
      await api.post('/auth/change-password', {
        current_password: values.current_password,
        new_password: values.new_password,
      })
      message.success('Password berhasil diperbarui')
      form.resetFields()
      queryClient.invalidateQueries({ queryKey: ['me'] })
    } catch (error) {
      message.error(errorMessage(error))
    } finally {
      setChanging(false)
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Akun"
        title="Profil Saya"
        subtitle="Informasi akun, role, izin akses, dan pengaturan keamanan."
        extra={<Button onClick={logout} danger>Keluar dari akun</Button>}
      />

      {meQ.isLoading ? <Skeleton active /> : (
        <>
          <div className="panel">
            <div className="profile-hero">
              <Avatar size={92} className="profile-avatar">{initials(profile?.full_name)}</Avatar>
              <div style={{ flex: 1 }}>
                <h2>{profile?.full_name}</h2>
                <p className="muted">@{profile?.username}</p>
                <Space wrap style={{ marginTop: 8 }}>
                  <Tag color="teal" bordered={false} style={{ borderRadius: 999, fontWeight: 600 }}>
                    {ROLE_LABELS[profile?.role] || profile?.role_label || profile?.role}
                  </Tag>
                  <Tag icon={<ClockCircleOutlined />} bordered={false} color="default">
                    Login terakhir: {profile?.last_login_at ? dateTime(profile.last_login_at) : 'sesi ini'}
                  </Tag>
                </Space>
              </div>
              <div className="profile-badge">
                <SafetyCertificateOutlined />
                <span>Akun terverifikasi</span>
              </div>
            </div>
          </div>

          <div className="dashboard-grid equal" style={{ marginTop: 16 }}>
            <div className="panel">
              <div className="panel-head">
                <div>
                  <h3>Izin Akses</h3>
                  <p>Hak yang melekat pada role Anda</p>
                </div>
                <Tag color="cyan">{permissions.length} izin</Tag>
              </div>
              <div className="permission-list">
                {permissions.map((permission) => (
                  <div className="permission-item" key={permission}>
                    <SafetyCertificateOutlined />
                    <div>
                      <strong>{PERMISSION_LABELS[permission] || permission}</strong>
                      <span>{permission}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <div>
                  <h3>Ubah Password</h3>
                  <p>Gunakan minimal 6 karakter</p>
                </div>
                <KeyOutlined style={{ color: 'var(--brand)', fontSize: 18 }} />
              </div>
              <Form form={form} layout="vertical" onFinish={changePassword} requiredMark="optional">
                <Form.Item name="current_password" label="Password Saat Ini" rules={[{ required: true, message: 'Password saat ini wajib diisi' }]}>
                  <Input.Password autoComplete="current-password" prefix={<UserOutlined />} />
                </Form.Item>
                <Form.Item name="new_password" label="Password Baru" rules={[{ required: true, message: 'Password baru wajib diisi' }, { min: 6, message: 'Minimal 6 karakter' }]}>
                  <Input.Password autoComplete="new-password" prefix={<KeyOutlined />} />
                </Form.Item>
                <Form.Item
                  name="confirm_password"
                  label="Konfirmasi Password Baru"
                  dependencies={['new_password']}
                  rules={[
                    { required: true, message: 'Konfirmasi password wajib diisi' },
                    ({ getFieldValue }) => ({
                      validator: (_, value) => (!value || getFieldValue('new_password') === value
                        ? Promise.resolve()
                        : Promise.reject(new Error('Konfirmasi tidak sama'))),
                    }),
                  ]}
                >
                  <Input.Password autoComplete="new-password" prefix={<KeyOutlined />} />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={changing} block>
                  Simpan Password Baru
                </Button>
              </Form>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
