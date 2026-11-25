import { Button } from 'antd'
import { HomeOutlined, MedicineBoxOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

export default function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="notfound-screen">
      <div className="notfound-card">
        <div className="notfound-mark"><MedicineBoxOutlined /></div>
        <div className="notfound-code">404</div>
        <h1>Halaman tidak ditemukan</h1>
        <p>Alamat yang Anda tuju tidak tersedia atau sudah dipindahkan.</p>
        <Button type="primary" size="large" icon={<HomeOutlined />} onClick={() => navigate('/app')}>
          Kembali ke Dashboard
        </Button>
      </div>
    </div>
  )
}
