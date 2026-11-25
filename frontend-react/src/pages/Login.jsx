import { useState } from 'react'
import { App, Button, Form, Input, Tag } from 'antd'
import {
  ArrowRightOutlined,
  ExperimentOutlined,
  HeartOutlined,
  LockOutlined,
  MedicineBoxOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
  DollarOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { errorMessage } from '../api/client'

const DEMO = [
  { role: 'Admin', username: 'admin', password: 'admin123', icon: <SafetyCertificateOutlined /> },
  { role: 'Pendaftaran', username: 'pendaftaran', password: 'pendaftaran123', icon: <TeamOutlined /> },
  { role: 'Dokter', username: 'dokter', password: 'dokter123', icon: <ExperimentOutlined /> },
  { role: 'Farmasi', username: 'farmasi', password: 'farmasi123', icon: <MedicineBoxOutlined /> },
  { role: 'Lab', username: 'lab', password: 'lab123', icon: <ExperimentOutlined /> },
  { role: 'Kasir', username: 'kasir', password: 'kasir123', icon: <DollarOutlined /> },
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)

  const submit = async (values) => {
    setLoading(true)
    try {
      const user = await login(values.username, values.password)
      message.success(`Selamat datang, ${user.full_name}`)
      const target = location.state?.from || '/app'
      navigate(target, { replace: true })
    } catch (error) {
      message.error(errorMessage(error, 'Login gagal'))
    } finally {
      setLoading(false)
    }
  }

  const fill = (account) => {
    form.setFieldsValue({ username: account.username, password: account.password })
    form.focusField?.('username')
  }

  return (
    <div className="login-page">
      <section className="login-visual">
        <div className="login-brand brand-pulse">
          <div className="brand-mark heart-beat">
            <HeartOutlined />
            <span className="brand-plus">+</span>
          </div>
          <div>
            <strong>SIMRS Inova</strong>
            <span>Rawat Jalan Terintegrasi</span>
          </div>
        </div>

        <div className="login-hero">
          <Tag bordered={false} style={{ background: 'rgba(94,234,212,.14)', color: '#99f6e4', borderRadius: 999, fontWeight: 700, marginBottom: 18 }}>
            Satu alur, semua terhubung
          </Tag>
          <h1>
            Pelayanan pasien yang <em>cepat, aman,</em> dan terukur.
          </h1>
          <p>
            Dari pendaftaran, rekam medis elektronik, resep, laboratorium, sampai pembayaran —
            semuanya dalam satu sistem yang konsisten dan siap audit.
          </p>

          <div className="login-features">
            <div className="login-feature floating">
              <TeamOutlined />
              <div><strong>Pendaftaran & antrean</strong><span>Nomor antrean otomatis per dokter</span></div>
            </div>
            <div className="login-feature floating">
              <ExperimentOutlined />
              <div><strong>Rekam medis elektronik</strong><span>SOAP, diagnosis ICD-10, revisi tersimpan</span></div>
            </div>
            <div className="login-feature floating">
              <MedicineBoxOutlined />
              <div><strong>Farmasi & stok</strong><span>Resep, penyerahan, dan pergerakan stok</span></div>
            </div>
            <div className="login-feature floating">
              <ExperimentOutlined />
              <div><strong>Lab & integrasi</strong><span>Order, hasil, outbox-inbox idempoten</span></div>
            </div>
          </div>
        </div>

        <div className="login-stats banner-slide">
          <div><strong>6</strong><span>Role terintegrasi</span></div>
          <div><strong>1</strong><span>Alur pelayanan</span></div>
          <div><strong>100%</strong><span>Riwayat terjejak</span></div>
          <div><strong>24/7</strong><span>Siap melayani</span></div>
        </div>
      </section>

      <section className="login-panel">
<div className="login-card card-lift ripple">
          <h2>Masuk ke SIMRS</h2>
          <p>Gunakan akun petugas untuk mengakses modul sesuai peran Anda.</p>
          <Form form={form} layout="vertical" onFinish={submit} requiredMark={false} size="large">
            <Form.Item name="username" label="Username" rules={[{ required: true, message: 'Username wajib diisi' }]}>
              <Input prefix={<UserOutlined />} placeholder="contoh: dokter" autoComplete="username" autoFocus />
            </Form.Item>
            <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Password wajib diisi' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Masukkan password" autoComplete="current-password" />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={loading}
              className="login-submit"
              icon={<ArrowRightOutlined />}
              iconPosition="end"
            >
              Masuk ke Dashboard
            </Button>
          </Form>

          <div className="demo-accounts">
            <div className="demo-title">Akun demo — klik untuk mengisi</div>
            <div className="demo-grid">
              {DEMO.map((account) => (
                <button
                  type="button"
                  className="demo-chip ripple"
                  key={account.username}
                  onClick={() => fill(account)}
                  style={{ hover: 'auto' }}
                >
                  {account.icon}
                  <span>
                    <strong>{account.role}</strong>
                    <span>{account.username} / {account.password}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="login-foot">
            © {new Date().getFullYear()} SIMRS Inova · Lingkungan DEV · Data demo
          </div>
        </div>
      </section>
    </div>
  )
}
