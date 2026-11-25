import { useMemo, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Avatar,
  Badge,
  Button,
  Drawer,
  Dropdown,
  Grid,
  Input,
  Layout,
  Menu,
  Tag,
  Tooltip,
} from 'antd'
import {
  AppstoreOutlined,
  BarChartOutlined,
  BellOutlined,
  CalendarOutlined,
  DashboardOutlined,
  DollarOutlined,
  ExperimentOutlined,
  HeartOutlined,
  LogoutOutlined,
  MedicineBoxOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MoonOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,

  SunOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { useAuth } from '../auth/AuthContext'
import { initials } from '../lib/format'
import { ROLE_LABELS } from '../lib/constants'

const { Header, Sider, Content } = Layout
const { useBreakpoint } = Grid

const MENU = [
  { key: '/app', icon: <DashboardOutlined />, label: 'Dashboard', permission: 'dashboard.view' },
  { key: '/app/registration', icon: <UserAddOutlined />, label: 'Pendaftaran', permission: 'visit.register' },
  { key: '/app/patients', icon: <TeamOutlined />, label: 'Data Pasien', permission: 'master.view' },
  { key: '/app/doctor-queue', icon: <ExperimentOutlined />, label: 'Antrean Dokter', permission: 'exam.read' },
  { key: '/app/pharmacy', icon: <MedicineBoxOutlined />, label: 'Farmasi', permission: 'rx.read' },
  { key: '/app/lab', icon: <ExperimentOutlined />, label: 'Laboratorium', permission: 'lab.result.write' },
  { key: '/app/cashier', icon: <DollarOutlined />, label: 'Kasir & Billing', permission: 'billing.read' },
  { key: '/app/reports', icon: <BarChartOutlined />, label: 'Laporan', permission: 'dashboard.view' },
  { key: '/app/master', icon: <SettingOutlined />, label: 'Master Data', permission: 'master.view' },
  { key: '/app/users', icon: <SafetyCertificateOutlined />, label: 'Pengguna & Role', permission: 'user.manage' },
]

const TITLES = {
  '/app': ['Dashboard', 'Ringkasan operasional hari ini'],
  '/app/registration': ['Pendaftaran', 'Daftarkan pasien dan kelola antrean'],
  '/app/patients': ['Data Pasien', 'Cari, lihat, dan kelola data pasien'],
  '/app/doctor-queue': ['Antrean Dokter', 'Daftar tunggu dan pemeriksaan'],
  '/app/pharmacy': ['Farmasi', 'Resep masuk dan ketersediaan obat'],
  '/app/lab': ['Laboratorium', 'Order dan hasil pemeriksaan lab'],
  '/app/cashier': ['Kasir & Billing', 'Invoice, pembayaran, dan cetak'],
  '/app/reports': ['Laporan', 'Analitik kunjungan dan pendapatan'],
  '/app/master': ['Master Data', 'Poli, dokter, jadwal, tindakan, obat, lab'],
  '/app/users': ['Pengguna & Role', 'Kelola akun dan hak akses'],
  '/app/profile': ['Profil Saya', 'Informasi akun dan izin akses'],
}

function Brand({ collapsed }) {
  return (
    <div className={`brand ${collapsed ? 'brand-collapsed' : ''}`}>
      <div className="brand-mark">
        <HeartOutlined />
        <span className="brand-plus">+</span>
      </div>
      {!collapsed && (
        <div className="brand-text">
          <strong>SIMRS Inova</strong>
          <span>Rawat Jalan Terintegrasi</span>
        </div>
      )}
    </div>
  )
}

function SidebarContent({ collapsed, onNavigate }) {
  const { hasPermission } = useAuth()
  const location = useLocation()
  const items = MENU.filter((item) => hasPermission(item.permission)).map(({ permission, ...item }) => item)
  const selected = [...items]
    .map((item) => item.key)
    .filter((key) => (key === '/app' ? location.pathname === '/app' : location.pathname.startsWith(key)))
    .sort((a, b) => b.length - a.length)[0] || '/app'

  return (
    <div className="sidebar-inner">
      <Brand collapsed={collapsed} />
      <div className="sidebar-section">{!collapsed && 'Menu Utama'}</div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selected]}
        items={items}
        onClick={({ key }) => onNavigate(key)}
        className="sidebar-menu"
      />
      <div className="sidebar-footer">
        {!collapsed ? (
          <div className="sidebar-help">
            <div className="sidebar-help-icon"><AppstoreOutlined /></div>
            <div>
              <strong>Alur terintegrasi</strong>
              <span>Pendaftaran → Periksa → Farmasi/Lab → Bayar</span>
            </div>
          </div>
        ) : (
          <Tooltip title="Alur terintegrasi" placement="right">
            <div className="sidebar-help compact"><AppstoreOutlined /></div>
          </Tooltip>
        )}
        <div className="sidebar-version">v1.0 · DEV</div>
      </div>
    </div>
  )
}

export default function AppLayout({ dark, onToggleTheme }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const screens = useBreakpoint()
  const isMobile = !screens.lg
  const [collapsed, setCollapsed] = useState(false)
  const [drawer, setDrawer] = useState(false)
  const [search, setSearch] = useState('')

  const title = useMemo(() => {
    if (location.pathname.startsWith('/app/exam/')) return ['Pemeriksaan Pasien', 'Rekam medis elektronik']
    return TITLES[location.pathname] || ['SIMRS Inova', 'Rawat jalan terintegrasi']
  }, [location.pathname])

  const handleNavigate = (key) => {
    navigate(key)
    setDrawer(false)
  }

  const userMenu = {
    items: [
      { key: 'profile', icon: <UserOutlined />, label: 'Profil Saya' },
      { type: 'divider' },
      { key: 'logout', icon: <LogoutOutlined />, label: 'Keluar', danger: true },
    ],
    onClick: async ({ key }) => {
      if (key === 'logout') {
        await logout()
        navigate('/login', { replace: true })
      } else {
        navigate('/app/profile')
      }
    },
  }

  const submitSearch = (value) => {
    const q = value.trim()
    if (q) navigate(`/app/patients?q=${encodeURIComponent(q)}`)
  }

  return (
    <Layout className="app-layout">
      {!isMobile && (
        <Sider
          width={264}
          collapsedWidth={86}
          collapsed={collapsed}
          className="app-sider"
          trigger={null}
        >
          <SidebarContent collapsed={collapsed} onNavigate={handleNavigate} />
        </Sider>
      )}

      <Drawer
        open={isMobile && drawer}
        onClose={() => setDrawer(false)}
        placement="left"
        width={280}
        styles={{ body: { padding: 0, background: '#08111f' }, header: { display: 'none' } }}
      >
        <SidebarContent collapsed={false} onNavigate={handleNavigate} />
      </Drawer>

      <Layout className="app-main">
        <Header className="app-header">
          <div className="header-left">
            <Button
              type="text"
              className="header-icon-btn"
              icon={isMobile ? <MenuUnfoldOutlined /> : collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => (isMobile ? setDrawer(true) : setCollapsed((v) => !v))}
            />
            <div className="header-title">
              <div className="header-eyebrow">
                <CalendarOutlined /> {dayjs().format('dddd, DD MMMM YYYY')}
              </div>
              <h1>{title[0]}</h1>
              <span>{title[1]}</span>
            </div>
          </div>

          <div className="header-right">
            <Input
              className="header-search"
              prefix={<SearchOutlined />}
              placeholder="Cari pasien, MRN, atau nama…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPressEnter={(e) => submitSearch(e.currentTarget.value)}
              allowClear
            />
            <Tooltip title="Notifikasi">
              <Badge dot offset={[-4, 4]} color="#f59e0b">
                <Button type="text" className="header-icon-btn" icon={<BellOutlined />} />
              </Badge>
            </Tooltip>
            <Tooltip title={dark ? 'Mode terang' : 'Mode gelap'}>
              <Button
                type="text"
                className="header-icon-btn"
                icon={dark ? <SunOutlined /> : <MoonOutlined />}
                onClick={onToggleTheme}
              />
            </Tooltip>
            <Dropdown menu={userMenu} trigger={['click']} placement="bottomRight">
              <button type="button" className="user-chip">
                <Avatar size={36} className="user-avatar">{initials(user?.full_name)}</Avatar>
                <span className="user-meta">
                  <strong>{user?.full_name}</strong>
                  <small>{ROLE_LABELS[user?.role] || user?.role}</small>
                </span>
              </button>
            </Dropdown>
          </div>
        </Header>

        <Content className="app-content">
          <div className="page-shell">
            <Outlet />
          </div>
          <footer className="app-footer">
            <span>SIMRS Inova · Rawat Jalan Terintegrasi</span>
            <Tag bordered={false} color="cyan">PostgreSQL 18.7 · Yii2 · Node 22 · React</Tag>
          </footer>
        </Content>
      </Layout>
    </Layout>
  )
}
