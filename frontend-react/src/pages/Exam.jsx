import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  App,
  Button,
  Descriptions,
  Divider,
  Drawer,
  Empty,
  Form,
  Input,
  InputNumber,
  Select,
  Skeleton,
  Space,
  Steps,
  Table,
  Tabs,
  Tag,
  Timeline,
  Tooltip,
} from 'antd'
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  ExperimentOutlined,
  FileTextOutlined,
  MedicineBoxOutlined,
  PlusOutlined,
  PrinterOutlined,
  ReloadOutlined,
  SaveOutlined,
  SolutionOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorMessage } from '../api/client'
import { useAuth } from '../auth/AuthContext'
import PageHeader from '../components/PageHeader'
import StatusTag from '../components/StatusTag'
import { age, date, dateTime, initials, money, time } from '../lib/format'

export default function Exam() {
  const { visitId } = useParams()
  const navigate = useNavigate()
  const { message, modal } = App.useApp()
  const { hasPermission, user } = useAuth()
  const queryClient = useQueryClient()
  const [recordForm] = Form.useForm()
  const [diagnosisForm] = Form.useForm()
  const [procedureForm] = Form.useForm()
  const [rxForm] = Form.useForm()
  const [labForm] = Form.useForm()
  const [saving, setSaving] = useState('')
  const [rxDetail, setRxDetail] = useState(null)
  const [finishing, setFinishing] = useState(false)

  const examQ = useQuery({
    queryKey: ['exam', visitId],
    queryFn: async () => (await api.get(`/exams/${visitId}`)).data.data,
  })
  const proceduresQ = useQuery({
    queryKey: ['procedures-options'],
    queryFn: async () => (await api.get('/procedures', { params: { per_page: 200, is_active: 1 } })).data.data,
  })
  const medicinesQ = useQuery({
    queryKey: ['medicines-options'],
    queryFn: async () => (await api.get('/medicines', { params: { per_page: 300, is_active: 1 } })).data.data,
  })
  const labTestsQ = useQuery({
    queryKey: ['lab-tests-options'],
    queryFn: async () => (await api.get('/lab-tests', { params: { per_page: 200, is_active: 1 } })).data.data,
  })
  const historyQ = useQuery({
    queryKey: ['exam-history', examQ.data?.patient_id],
    queryFn: async () => (await api.get(`/patients/${examQ.data?.patient_id}/history`)).data.data,
    enabled: Boolean(examQ.data?.patient_id) && hasPermission('exam.read'),
  })
  const rxDetailQ = useQuery({
    queryKey: ['rx-detail', rxDetail],
    queryFn: async () => (await api.get(`/prescriptions/${rxDetail}`)).data.data,
    enabled: Boolean(rxDetail),
  })

  const visit = examQ.data
  const record = visit?.record
  const canWrite = hasPermission('exam.write') && ['REGISTERED', 'WAITING', 'IN_EXAM'].includes(visit?.status)

  useEffect(() => {
    if (!visit) return
    recordForm.setFieldsValue({
      anamnesis: record?.anamnesis || '',
      blood_pressure: record?.blood_pressure || '',
      temperature: record?.temperature ? Number(record.temperature) : null,
      pulse: record?.pulse ? Number(record.pulse) : null,
      respiration: record?.respiration ? Number(record.respiration) : null,
      weight: record?.weight ? Number(record.weight) : null,
      height: record?.height ? Number(record.height) : null,
      physical_exam: record?.physical_exam || '',
      notes: record?.notes || '',
    })
    diagnosisForm.setFieldsValue({
      diagnoses: visit.diagnoses?.length
        ? visit.diagnoses.map((d) => ({ type: d.type, icd10_code: d.icd10_code, name: d.name, notes: d.notes }))
        : [{ type: 'P', icd10_code: '', name: '', notes: '' }],
    })
  }, [visit, record, recordForm, diagnosisForm])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['exam', visitId] })
    queryClient.invalidateQueries({ queryKey: ['exam-waiting'] })
  }

  const startExam = async () => {
    try {
      await api.post(`/exams/${visitId}/start`)
      message.success('Pemeriksaan dimulai')
      refresh()
    } catch (error) {
      message.error(errorMessage(error))
    }
  }

  const saveRecord = async (values) => {
    setSaving('record')
    try {
      await api.put(`/exams/${visitId}/record`, values)
      message.success('Rekam medis tersimpan')
      refresh()
    } catch (error) {
      message.error(errorMessage(error))
    } finally {
      setSaving('')
    }
  }

  const saveDiagnoses = async (values) => {
    setSaving('diagnosis')
    try {
      await api.put(`/exams/${visitId}/diagnoses`, { diagnoses: values.diagnoses })
      message.success('Diagnosis tersimpan')
      refresh()
    } catch (error) {
      message.error(errorMessage(error))
    } finally {
      setSaving('')
    }
  }

  const addProcedure = async (values) => {
    setSaving('procedure')
    try {
      await api.post(`/visits/${visitId}/procedures`, values)
      message.success('Tindakan ditambahkan ke tagihan')
      procedureForm.resetFields()
      refresh()
    } catch (error) {
      message.error(errorMessage(error))
    } finally {
      setSaving('')
    }
  }

  const removeProcedure = async (row) => {
    try {
      await api.delete(`/visits/${visitId}/procedures/${row.id}`)
      message.success('Tindakan dihapus dari tagihan')
      refresh()
    } catch (error) {
      message.error(errorMessage(error))
    }
  }

  const createPrescription = async (values) => {
    setSaving('rx')
    try {
      const items = (values.items || []).filter((item) => item.medicine_id && item.qty > 0)
      if (!items.length) {
        message.warning('Tambahkan minimal satu obat')
        return
      }
      await api.post(`/visits/${visitId}/prescriptions`, { items, notes: values.notes })
      message.success('Resep dikirim ke farmasi')
      rxForm.setFieldsValue({ items: [{}], notes: '' })
      refresh()
    } catch (error) {
      message.error(errorMessage(error))
    } finally {
      setSaving('')
    }
  }

  const createLabOrder = async (values) => {
    setSaving('lab')
    try {
      await api.post(`/visits/${visitId}/lab-orders`, { test_ids: values.test_ids, notes: values.notes })
      message.success('Order laboratorium dibuat')
      labForm.resetFields()
      refresh()
    } catch (error) {
      message.error(errorMessage(error))
    } finally {
      setSaving('')
    }
  }

  const finishExam = () => {
    modal.confirm({
      title: 'Selesaikan pemeriksaan?',
      icon: <CheckCircleOutlined style={{ color: '#16a34a' }} />,
      content: 'Pastikan diagnosis utama, tindakan, resep, dan order lab sudah lengkap. Tagihan akan disinkronkan otomatis.',
      okText: 'Selesaikan',
      cancelText: 'Periksa lagi',
      onOk: async () => {
        setFinishing(true)
        try {
          const { data } = await api.post(`/exams/${visitId}/finish`)
          message.success(`Pemeriksaan selesai. Tagihan ${money(data.data.invoice?.total)}`)
          refresh()
          queryClient.invalidateQueries({ queryKey: ['registrations-today'] })
          navigate('/app/doctor-queue')
        } catch (error) {
          message.error(errorMessage(error))
        } finally {
          setFinishing(false)
        }
      },
    })
  }

  const stepCurrent = useMemo(() => {
    if (!visit) return 0
    if (visit.status === 'REGISTERED' || visit.status === 'WAITING') return 0
    if (visit.status === 'IN_EXAM') return 1
    if (visit.status === 'EXAM_DONE') return 2
    return 3
  }, [visit])

  if (examQ.isLoading) {
    return (
      <div className="panel">
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    )
  }

  if (examQ.isError || !visit) {
    return (
      <div className="panel empty-card">
        <Empty description="Data pemeriksaan tidak ditemukan" />
        <Button onClick={() => navigate('/app/doctor-queue')}>Kembali ke antrean</Button>
      </div>
    )
  }

  const procedureRows = visit.procedures || []
  const activeProcedures = procedureRows.filter((row) => row.status === 'ACTIVE')
  const procedureTotal = activeProcedures.reduce((sum, row) => sum + Number(row.qty) * Number(row.unit_price), 0)

  return (
    <div>
      <PageHeader
        eyebrow="Rekam Medis Elektronik"
        title="Pemeriksaan Pasien"
        subtitle={`${visit.visit_no} · ${date(visit.visit_date)} · ${visit.poli_name}`}
        extra={(
          <Space wrap>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/app/doctor-queue')}>Kembali</Button>
            <Button icon={<ReloadOutlined />} onClick={refresh}>Muat ulang</Button>
            {['REGISTERED', 'WAITING'].includes(visit.status) && (
              <Button type="primary" icon={<PlayCircleOutlined />} onClick={startExam}>Mulai Pemeriksaan</Button>
            )}
            {visit.status === 'IN_EXAM' && (
              <Button type="primary" icon={<CheckCircleOutlined />} loading={finishing} onClick={finishExam}>Selesaikan</Button>
            )}
            {['EXAM_DONE', 'BILLING', 'PAID'].includes(visit.status) && hasPermission('billing.read') && (
              <Button icon={<PrinterOutlined />} onClick={() => navigate(`/app/cashier?invoice=${visit.invoice_id}`)}>Buka Kasir</Button>
            )}
          </Space>
        )}
      />

      <div className="detail-hero">
        <div className="patient-avatar">{initials(visit.patient_name)}</div>
        <div style={{ flex: 1 }}>
          <div className="flex-between">
            <div>
              <h3>{visit.patient_name}</h3>
              <p>{visit.mrn} · {visit.gender === 'L' ? 'Laki-laki' : 'Perempuan'} · {age(visit.birth_date)} · {date(visit.birth_date)}</p>
            </div>
            <Space wrap>
              <span className="queue-number">{String(visit.queue_no).padStart(2, '0')}</span>
              <StatusTag type="visit" status={visit.status} />
            </Space>
          </div>
          <div className="flex-gap" style={{ marginTop: 10 }}>
            <Tag icon={<StethoscopeOutlined />}>{visit.doctor_name}</Tag>
            <Tag icon={<TeamOutlined />}>{visit.poli_name}</Tag>
            <Tag color={visit.guarantor_type === 'UMUM' ? 'default' : 'blue'}>{visit.guarantor_type}</Tag>
            {visit.invoice_no && <Tag color="cyan">{visit.invoice_no}</Tag>}
            {visit.invoice_status && <StatusTag type="invoice" status={visit.invoice_status} />}
          </div>
        </div>
      </div>

      <div className="exam-layout">
        <div className="panel" style={{ paddingTop: 12 }}>
          <Tabs
            defaultActiveKey="record"
            items={[
              {
                key: 'record',
                label: <span><FileTextOutlined /> Rekam Medis</span>,
                children: (
                  <Form form={recordForm} layout="vertical" onFinish={saveRecord} disabled={!canWrite}>
                    <Form.Item name="anamnesis" label="Anamnesis (S / O)">
                      <Input.TextArea rows={3} placeholder="Keluhan, riwayat penyakit, pemeriksaan fisik singkat…" />
                    </Form.Item>
                    <div className="vital-grid">
                      <div className="vital-box">
                        <span className="tiny-label">Tekanan Darah</span>
                        <Form.Item name="blood_pressure" noStyle>
                          <Input placeholder="120/80" />
                        </Form.Item>
                        <span className="vital-unit">mmHg</span>
                      </div>
                      <div className="vital-box">
                        <span className="tiny-label">Suhu</span>
                        <Form.Item name="temperature" noStyle>
                          <InputNumber min={30} max={45} step={0.1} placeholder="36.5" />
                        </Form.Item>
                        <span className="vital-unit">°C</span>
                      </div>
                      <div className="vital-box">
                        <span className="tiny-label">Nadi</span>
                        <Form.Item name="pulse" noStyle>
                          <InputNumber min={20} max={250} placeholder="80" />
                        </Form.Item>
                        <span className="vital-unit">bpm</span>
                      </div>
                      <div className="vital-box">
                        <span className="tiny-label">Pernapasan</span>
                        <Form.Item name="respiration" noStyle>
                          <InputNumber min={5} max={80} placeholder="18" />
                        </Form.Item>
                        <span className="vital-unit">x/menit</span>
                      </div>
                      <div className="vital-box">
                        <span className="tiny-label">Berat Badan</span>
                        <Form.Item name="weight" noStyle>
                          <InputNumber min={1} max={400} step={0.1} placeholder="65" />
                        </Form.Item>
                        <span className="vital-unit">kg</span>
                      </div>
                      <div className="vital-box">
                        <span className="tiny-label">Tinggi Badan</span>
                        <Form.Item name="height" noStyle>
                          <InputNumber min={30} max={250} placeholder="170" />
                        </Form.Item>
                        <span className="vital-unit">cm</span>
                      </div>
                    </div>
                    <Form.Item name="physical_exam" label="Pemeriksaan Fisik (O)" style={{ marginTop: 14 }}>
                      <Input.TextArea rows={3} placeholder="Hasil pemeriksaan fisik" />
                    </Form.Item>
                    <Form.Item name="notes" label="Catatan / Rencana (A / P)">
                      <Input.TextArea rows={3} placeholder="Assessment, plan, edukasi, follow-up" />
                    </Form.Item>
                    {canWrite && (
                      <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving === 'record'}>
                        Simpan Rekam Medis
                      </Button>
                    )}
                  </Form>
                ),
              },
              {
                key: 'diagnosis',
                label: <span><SolutionOutlined /> Diagnosis</span>,
                children: (
                  <Form form={diagnosisForm} layout="vertical" onFinish={saveDiagnoses} disabled={!canWrite}>
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: 14, borderRadius: 12 }}
                      message="Isi tepat satu diagnosis utama (P) dan boleh beberapa diagnosis sekunder (S)."
                    />
                    <Form.List name="diagnoses">
                      {(fields, { add, remove }) => (
                        <>
                          {fields.map((field, index) => (
                            <div key={field.key} className="soft-card" style={{ marginBottom: 10 }}>
                              <div className="flex-between" style={{ marginBottom: 8 }}>
                                <Tag color={index === 0 ? 'teal' : 'default'}>{index === 0 ? 'Diagnosis Utama' : `Diagnosis ${index + 1}`}</Tag>
                                {fields.length > 1 && (
                                  <Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                                )}
                              </div>
                              <div className="exam-form-grid">
                                <Form.Item
                                  name={[field.name, 'type']}
                                  label="Tipe"
                                  rules={[{ required: true, message: 'Pilih tipe' }]}
                                >
                                  <Select options={[{ value: 'P', label: 'Primer (P)' }, { value: 'S', label: 'Sekunder (S)' }]} />
                                </Form.Item>
                                <Form.Item
                                  name={[field.name, 'icd10_code']}
                                  label="Kode ICD-10"
                                  rules={[{ required: true, message: 'Kode wajib diisi' }]}
                                >
                                  <Input placeholder="Contoh: I10" />
                                </Form.Item>
                                <Form.Item
                                  name={[field.name, 'name']}
                                  label="Nama Diagnosis"
                                  className="full"
                                  rules={[{ required: true, message: 'Nama diagnosis wajib diisi' }]}
                                >
                                  <Input placeholder="Contoh: Hipertensi esensial" />
                                </Form.Item>
                                <Form.Item name={[field.name, 'notes']} label="Catatan" className="full">
                                  <Input placeholder="Catatan tambahan (opsional)" />
                                </Form.Item>
                              </div>
                            </div>
                          ))}
                          {canWrite && (
                            <Space>
                              <Button type="dashed" onClick={() => add({ type: 'S', icd10_code: '', name: '', notes: '' })} icon={<PlusOutlined />}>
                                Tambah Diagnosis
                              </Button>
                              <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving === 'diagnosis'}>
                                Simpan Diagnosis
                              </Button>
                            </Space>
                          )}
                        </>
                      )}
                    </Form.List>
                  </Form>
                ),
              },
              {
                key: 'procedure',
                label: <span><ExperimentOutlined /> Tindakan</span>,
                children: (
                  <div>
                    {canWrite && (
                      <Form form={procedureForm} layout="inline" onFinish={addProcedure} style={{ marginBottom: 14, rowGap: 8 }}>
                        <Form.Item name="procedure_id" rules={[{ required: true, message: 'Pilih tindakan' }]}>
                          <Select
                            showSearch
                            placeholder="Pilih tindakan"
                            style={{ minWidth: 280 }}
                            optionFilterProp="label"
                            options={(proceduresQ.data || []).map((p) => ({
                              value: p.id,
                              label: `${p.name} · ${money(p.price)}`,
                            }))}
                          />
                        </Form.Item>
                        <Form.Item name="qty" initialValue={1} rules={[{ required: true }]}>
                          <InputNumber min={1} max={20} style={{ width: 90 }} placeholder="Qty" />
                        </Form.Item>
                        <Button type="primary" htmlType="submit" icon={<PlusOutlined />} loading={saving === 'procedure'}>
                          Tambah
                        </Button>
                      </Form>
                    )}
                    <Table
                      rowKey="id"
                      size="small"
                      pagination={false}
                      dataSource={procedureRows}
                      columns={[
                        { title: 'Tindakan', dataIndex: 'name', render: (v, r) => <strong>{v} <span className="muted">({r.code})</span></strong> },
                        { title: 'Qty', dataIndex: 'qty', width: 70 },
                        { title: 'Harga', dataIndex: 'unit_price', align: 'right', render: (v) => money(v) },
                        { title: 'Subtotal', key: 'subtotal', align: 'right', render: (_, r) => money(Number(r.qty) * Number(r.unit_price)) },
                        { title: 'Status', dataIndex: 'status', width: 100, render: (v) => <Tag color={v === 'ACTIVE' ? 'green' : 'red'}>{v === 'ACTIVE' ? 'Aktif' : 'Dibatalkan'}</Tag> },
                        {
                          title: '',
                          key: 'action',
                          width: 60,
                          render: (_, row) => row.status === 'ACTIVE' && canWrite && (
                            <Tooltip title="Hapus tindakan">
                              <Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={() => removeProcedure(row)} />
                            </Tooltip>
                          ),
                        },
                      ]}
                    />
                    <div className="total-box">
                      <span>Total tindakan aktif</span>
                      <strong>{money(procedureTotal)}</strong>
                    </div>
                  </div>
                ),
              },
              {
                key: 'prescription',
                label: <span><MedicineBoxOutlined /> Resep</span>,
                children: (
                  <div>
                    {canWrite && (
                      <Form form={rxForm} layout="vertical" onFinish={createPrescription} initialValues={{ items: [{}] }}>
                        <Form.List name="items">
                          {(fields, { add, remove }) => (
                            <>
                              {fields.map((field) => (
                                <div className="soft-card" style={{ marginBottom: 10 }} key={field.key}>
                                  <div className="flex-between" style={{ marginBottom: 8 }}>
                                    <Tag color="purple">Obat {field.name + 1}</Tag>
                                    {fields.length > 1 && (
                                      <Button danger type="text" size="small" icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
                                    )}
                                  </div>
                                  <div className="exam-form-grid">
                                    <Form.Item
                                      name={[field.name, 'medicine_id']}
                                      label="Obat"
                                      className="full"
                                      rules={[{ required: true, message: 'Pilih obat' }]}
                                    >
                                      <Select
                                        showSearch
                                        optionFilterProp="label"
                                        placeholder="Cari dan pilih obat"
                                        options={(medicinesQ.data || []).map((m) => ({
                                          value: m.id,
                                          label: `${m.name} · ${m.unit} · stok ${m.stock} · ${money(m.price)}`,
                                        }))}
                                      />
                                    </Form.Item>
                                    <Form.Item name={[field.name, 'qty']} label="Jumlah" rules={[{ required: true, message: 'Isi jumlah' }]}>
                                      <InputNumber min={1} max={999} style={{ width: '100%' }} />
                                    </Form.Item>
                                    <Form.Item name={[field.name, 'dose']} label="Dosis / Aturan">
                                      <Input placeholder="Contoh: 1 tablet" />
                                    </Form.Item>
                                    <Form.Item name={[field.name, 'frequency']} label="Frekuensi" className="full">
                                      <Input placeholder="Contoh: 3x sehari sesudah makan" />
                                    </Form.Item>
                                  </div>
                                </div>
                              ))}
                              <Space style={{ marginBottom: 12 }}>
                                <Button type="dashed" onClick={() => add()} icon={<PlusOutlined />}>Tambah Obat</Button>
                              </Space>
                            </>
                          )}
                        </Form.List>
                        <Form.Item name="notes" label="Catatan Resep">
                          <Input.TextArea rows={2} placeholder="Catatan untuk farmasi (opsional)" />
                        </Form.Item>
                        <Button type="primary" htmlType="submit" icon={<MedicineBoxOutlined />} loading={saving === 'rx'}>
                          Kirim Resep ke Farmasi
                        </Button>
                      </Form>
                    )}

                    <Divider />
                    <div className="section-title">Resep pada kunjungan ini</div>
                    {(visit.prescriptions || []).length === 0 ? (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada resep" />
                    ) : (
                      (visit.prescriptions || []).map((rx) => (
                        <div className="list-row" key={rx.id}>
                          <div>
                            <strong>{rx.prescription_no}</strong>
                            <span>Dibuat {dateTime(rx.created_at)}</span>
                          </div>
                          <Space>
                            <StatusTag type="rx" status={rx.status} />
                            <Button size="small" onClick={() => setRxDetail(rx.id)}>Detail</Button>
                          </Space>
                        </div>
                      ))
                    )}
                  </div>
                ),
              },
              {
                key: 'lab',
                label: <span><ExperimentOutlined /> Laboratorium</span>,
                children: (
                  <div>
                    {canWrite && (
                      <Form form={labForm} layout="vertical" onFinish={createLabOrder}>
                        <Form.Item name="test_ids" label="Pemeriksaan Lab" rules={[{ required: true, message: 'Pilih minimal satu pemeriksaan' }]}>
                          <Select
                            mode="multiple"
                            showSearch
                            optionFilterProp="label"
                            placeholder="Pilih pemeriksaan laboratorium"
                            options={(labTestsQ.data || []).map((t) => ({
                              value: t.id,
                              label: `${t.name} · ${money(t.price)}`,
                            }))}
                          />
                        </Form.Item>
                        <Form.Item name="notes" label="Catatan Order">
                          <Input.TextArea rows={2} placeholder="Indikasi / catatan untuk petugas lab" />
                        </Form.Item>
                        <Button type="primary" htmlType="submit" icon={<ExperimentOutlined />} loading={saving === 'lab'}>
                          Buat Order Lab
                        </Button>
                      </Form>
                    )}

                    <Divider />
                    <div className="section-title">Order lab pada kunjungan ini</div>
                    {(visit.lab_orders || []).length === 0 ? (
                      <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Belum ada order lab" />
                    ) : (
                      (visit.lab_orders || []).map((order) => (
                        <div className="list-row" key={order.id}>
                          <div>
                            <strong>{order.order_no}</strong>
                            <span>Dibuat {dateTime(order.created_at)}</span>
                          </div>
                          <Space>
                            <StatusTag type="lab" status={order.status} />
                            <Button size="small" onClick={() => navigate(`/app/lab?order=${order.id}`)}>Lihat Order</Button>
                          </Space>
                        </div>
                      ))
                    )}
                  </div>
                ),
              },
              {
                key: 'history',
                label: <span><FileTextOutlined /> Riwayat</span>,
                children: historyQ.isLoading ? <Skeleton active /> : (
                  <Timeline
                    items={(historyQ.data || []).map((item) => ({
                      dot: <span className="timeline-dot" />,
                      children: (
                        <div>
                          <div className="flex-between">
                            <strong>{date(item.visit_date)} · {item.poli_name}</strong>
                            <StatusTag type="visit" status={item.status} />
                          </div>
                          <div className="muted" style={{ fontSize: 12 }}>{item.visit_no} · {item.doctor_name}</div>
                          {item.diagnoses?.length > 0 && (
                            <div style={{ marginTop: 6 }}>
                              {item.diagnoses.map((d) => <Tag key={d.id} color={d.type === 'P' ? 'teal' : 'default'}>{d.icd10_code} — {d.name}</Tag>)}
                            </div>
                          )}
                          {item.record?.anamnesis && <div className="soft-card" style={{ marginTop: 8, fontSize: 12.5 }}>{item.record.anamnesis}</div>}
                        </div>
                      ),
                    }))}
                  />
                ),
              },
            ]}
          />
        </div>

        <aside className="exam-side">
          <div className="panel">
            <div className="panel-head">
              <div>
                <h3>Alur pelayanan</h3>
                <p>Status kunjungan saat ini</p>
              </div>
            </div>
            <Steps
              direction="vertical"
              size="small"
              current={stepCurrent}
              items={[
                { title: 'Pendaftaran', description: visit.status === 'REGISTERED' ? 'Menunggu check-in' : 'Selesai' },
                { title: 'Pemeriksaan', description: visit.status === 'IN_EXAM' ? 'Sedang berlangsung' : 'Rekam medis' },
                { title: 'Farmasi & Lab', description: 'Resep dan hasil penunjang' },
                { title: 'Pembayaran', description: visit.invoice_status === 'PAID' ? 'Lunas' : 'Menunggu kasir' },
              ]}
            />
          </div>

          <div className="panel">
            <div className="panel-head">
              <div>
                <h3>Ringkasan tagihan</h3>
                <p>{visit.invoice_no || 'Belum ada invoice'}</p>
              </div>
              {visit.invoice_status && <StatusTag type="invoice" status={visit.invoice_status} />}
            </div>
            <div className="list-row"><span>Total tagihan</span><strong>{money(visit.total)}</strong></div>
            <div className="list-row"><span>Sudah dibayar</span><strong>{money(visit.paid_total)}</strong></div>
            <div className="list-row"><span>Sisa</span><strong className={Number(visit.total) - Number(visit.paid_total) > 0 ? 'danger-text' : 'success-text'}>{money(Number(visit.total) - Number(visit.paid_total))}</strong></div>
            {hasPermission('billing.read') && visit.invoice_id && (
              <Button block style={{ marginTop: 10 }} onClick={() => navigate(`/app/cashier?invoice=${visit.invoice_id}`)}>
                Buka Kasir
              </Button>
            )}
          </div>

          <div className="panel">
            <div className="panel-head">
              <div><h3>Data kunjungan</h3><p>Informasi administratif</p></div>
            </div>
            <Descriptions column={1} size="small" colon={false}>
              <Descriptions.Item label="No. kunjungan">{visit.visit_no}</Descriptions.Item>
              <Descriptions.Item label="Tanggal">{date(visit.visit_date)}</Descriptions.Item>
              <Descriptions.Item label="Jam daftar">{time(visit.created_at)}</Descriptions.Item>
              <Descriptions.Item label="Penjamin">{visit.guarantor_type}</Descriptions.Item>
              <Descriptions.Item label="Keluhan">{visit.complaint || '-'}</Descriptions.Item>
              <Descriptions.Item label="Revisi RME">{record?.revision ?? 0}x</Descriptions.Item>
            </Descriptions>
          </div>

          {record?.revision > 0 && (
            <Alert
              type="info"
              showIcon
              message="Rekam medis dapat direvisi"
              description="Setiap perubahan menyimpan snapshot revisi untuk audit."
            />
          )}
        </aside>
      </div>

      <Drawer
        open={Boolean(rxDetail)}
        onClose={() => setRxDetail(null)}
        title="Detail Resep"
        width={520}
      >
        {rxDetailQ.isLoading ? <Skeleton active /> : rxDetailQ.data && (
          <>
            <div className="detail-hero" style={{ padding: 14 }}>
              <div>
                <h3>{rxDetailQ.data.prescription_no}</h3>
                <p>{rxDetailQ.data.patient_name} · {rxDetailQ.data.poli_name}</p>
              </div>
              <StatusTag type="rx" status={rxDetailQ.data.status} />
            </div>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              dataSource={rxDetailQ.data.items || []}
              columns={[
                { title: 'Obat', dataIndex: 'name', render: (v, r) => <strong>{v} <span className="muted">({r.unit})</span></strong> },
                { title: 'Qty', dataIndex: 'qty', width: 60 },
                { title: 'Dosis', dataIndex: 'dose', render: (v, r) => v ? `${v} · ${r.frequency || ''}` : '-' },
                { title: 'Subtotal', key: 'subtotal', align: 'right', render: (_, r) => money(Number(r.qty) * Number(r.unit_price)) },
              ]}
            />
            {rxDetailQ.data.notes && <Alert style={{ marginTop: 12 }} type="info" message={rxDetailQ.data.notes} />}
          </>
        )}
      </Drawer>
    </div>
  )
}
