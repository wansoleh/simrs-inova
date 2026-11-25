<?php

declare(strict_types=1);

namespace app\commands;

use app\services\AuthService;
use app\services\BillingService;
use app\services\LabService;
use app\services\PaymentService;
use app\services\PharmacyService;
use Yii;
use yii\console\Controller;
use yii\console\ExitCode;

class SeedController extends Controller
{
    private array $actor = ['id' => 1, 'name' => 'Seeder', 'role' => 'admin'];
    private array $queue = [];

    public function actionIndex(): int
    {
        $db = Yii::$app->db;
        $this->stdout("Membersihkan data DEV...\n");
        $db->createCommand(
            'TRUNCATE TABLE payments, invoice_revisions, invoice_items, invoices,
                lab_results, lab_order_items, lab_orders, dispensings, prescription_items, prescriptions,
                visit_procedures, medical_record_revisions, diagnoses, medical_records,
                queue_counters, visits, lab_tests, stock_movements, medicines, procedures,
                doctor_schedules, polis, doctors, patients, users, audit_logs,
                integration.outbox, integration.inbox, integration.api_log
             RESTART IDENTITY CASCADE'
        )->execute();
        foreach (['mrn_seq', 'visit_no_seq', 'invoice_no_seq', 'payment_no_seq', 'prescription_no_seq', 'lab_order_no_seq'] as $seq) {
            $db->createCommand("ALTER SEQUENCE {$seq} RESTART WITH 1")->execute();
        }

        $this->seedRbac();
        $this->seedUsers();
        $this->seedMaster();
        $this->seedPatients();
        $this->seedTodayVisits();
        $this->seedHistory();
        $db->createCommand('REFRESH MATERIALIZED VIEW reporting.mv_daily_summary')->execute();

        $this->stdout("\nSeed selesai.\n");
        $this->stdout("Akun demo (password):\n");
        foreach ([
            'admin' => 'admin123',
            'pendaftaran' => 'pendaftaran123',
            'dokter' => 'dokter123',
            'farmasi' => 'farmasi123',
            'lab' => 'lab123',
            'kasir' => 'kasir123',
        ] as $u => $p) {
            $this->stdout("  {$u} / {$p}\n");
        }
        return ExitCode::OK;
    }

    private function seedRbac(): void
    {
        $auth = Yii::$app->authManager;
        $auth->removeAll();
        $permissions = [
            'master.view', 'master.manage', 'patient.manage', 'visit.register', 'queue.view',
            'exam.read', 'exam.write', 'procedure.write', 'rx.write', 'rx.read', 'rx.dispense',
            'medicine.view', 'lab.order', 'lab.result.write', 'billing.read', 'billing.pay',
            'invoice.print', 'user.manage', 'dashboard.view',
        ];
        $permObjects = [];
        foreach ($permissions as $p) {
            $permObjects[$p] = $auth->createPermission($p);
            $permObjects[$p]->description = 'Izin ' . $p;
            $auth->add($permObjects[$p]);
        }
        foreach (AuthService::ROLE_LABELS as $key => $label) {
            $role = $auth->createRole($key);
            $role->description = $label;
            $auth->add($role);
            foreach (AuthService::permissionsForRole($key) as $perm) {
                if ($perm === '*') {
                    foreach ($permObjects as $p) {
                        $auth->addChild($role, $p);
                    }
                } elseif (isset($permObjects[$perm])) {
                    $auth->addChild($role, $permObjects[$perm]);
                }
            }
        }
    }

    private function seedUsers(): void
    {
        $users = [
            ['admin', 'admin123', 'Administrator Sistem', 'admin'],
            ['pendaftaran', 'pendaftaran123', 'Rina Pendaftaran', 'pendaftaran'],
            ['dokter', 'dokter123', 'dr. Andi Pratama, Sp.PD', 'dokter'],
            ['farmasi', 'farmasi123', 'Apoteker Sari', 'farmasi'],
            ['lab', 'lab123', 'Analis Laboratorium Joko', 'lab'],
            ['kasir', 'kasir123', 'Kasir Dewi', 'kasir'],
        ];
        $auth = Yii::$app->authManager;
        foreach ($users as [$username, $password, $name, $role]) {
            $row = $this->insert('users', [
                'username' => $username,
                'password_hash' => (new AuthService())->hashPassword($password),
                'full_name' => $name,
                'role' => $role,
                'is_active' => true,
            ]);
            $rbacRole = $auth->getRole($role);
            if ($rbacRole) {
                $auth->assign($rbacRole, (string) $row['id']);
            }
        }
    }

    private function seedMaster(): void
    {
        $polis = [
            ['UMU', 'Poli Umum', 25000, 'Pelayanan umum dan konsultasi dasar'],
            ['PD', 'Poli Penyakit Dalam', 35000, 'Penyakit dalam dan metabolik'],
            ['ANAK', 'Poli Anak', 30000, 'Kesehatan anak dan imunisasi'],
            ['GIGI', 'Poli Gigi', 40000, 'Kesehatan gigi dan mulut'],
            ['MATA', 'Poli Mata', 35000, 'Kesehatan mata dan refraksi'],
            ['THT', 'Poli THT', 30000, 'Telinga, hidung, tenggorokan'],
        ];
        $poliIds = [];
        foreach ($polis as [$code, $name, $fee, $desc]) {
            $poliIds[$code] = $this->insert('polis', [
                'code' => $code, 'name' => $name, 'registration_fee' => $fee, 'description' => $desc,
            ])['id'];
        }

        $doctors = [
            ['1234567890', 'dr. Andi Pratama, Sp.PD', 'Penyakit Dalam', '081200000001', 'PD'],
            ['1234567891', 'dr. Siti Rahma, Sp.A', 'Anak', '081200000002', 'ANAK'],
            ['1234567892', 'drg. Budi Santoso', 'Gigi', '081200000003', 'GIGI'],
            ['1234567893', 'dr. Maya Lestari, Sp.M', 'Mata', '081200000004', 'MATA'],
            ['1234567894', 'dr. Rizky Hidayat, Sp.THT', 'THT', '081200000005', 'THT'],
            ['1234567895', 'dr. Dewi Anggraini', 'Umum', '081200000006', 'UMU'],
        ];
        $doctorIds = [];
        $doctorPoli = [];
        foreach ($doctors as [$str, $name, $spec, $phone, $poliCode]) {
            $row = $this->insert('doctors', [
                'str_no' => $str, 'name' => $name, 'specialization' => $spec, 'phone' => $phone,
            ]);
            $doctorIds[] = $row['id'];
            $doctorPoli[$row['id']] = $poliIds[$poliCode];
        }
        foreach ($doctorIds as $doctorId) {
            for ($day = 0; $day <= 6; $day++) {
                $this->insert('doctor_schedules', [
                    'doctor_id' => $doctorId,
                    'poli_id' => $doctorPoli[$doctorId],
                    'day_of_week' => $day,
                    'start_time' => '08:00',
                    'end_time' => '21:00',
                    'quota' => 40,
                ]);
            }
        }

        $procedures = [
            ['P001', 'Konsultasi Dokter', 50000, 'Konsultasi'],
            ['P002', 'Pemeriksaan Fisik Lengkap', 75000, 'Pemeriksaan'],
            ['P003', 'Nebulizer', 120000, 'Tindakan'],
            ['P004', 'Elektrokardiografi (EKG)', 150000, 'Penunjang'],
            ['P005', 'Injeksi Obat', 60000, 'Tindakan'],
            ['P006', 'Perawatan Luka', 100000, 'Tindakan'],
            ['P007', 'Cabut Gigi', 200000, 'Gigi'],
            ['P008', 'Tambal Gigi', 250000, 'Gigi'],
            ['P009', 'Pemeriksaan Refraksi Mata', 80000, 'Mata'],
            ['P010', 'Tes Pendengaran', 120000, 'THT'],
            ['P011', 'USG Abdomen', 250000, 'Penunjang'],
            ['P012', 'Ganti Kateter', 150000, 'Tindakan'],
        ];
        foreach ($procedures as [$code, $name, $price, $cat]) {
            $this->insert('procedures', ['code' => $code, 'name' => $name, 'price' => $price, 'category' => $cat]);
        }

        $medicines = [
            ['M001', 'Paracetamol 500mg', 'Tablet', 500, 5000, 'Analgesik'],
            ['M002', 'Amoxicillin 500mg', 'Kapsul', 1200, 4000, 'Antibiotik'],
            ['M003', 'Ibuprofen 400mg', 'Tablet', 800, 4000, 'Analgesik'],
            ['M004', 'Cetirizine 10mg', 'Tablet', 700, 3500, 'Antihistamin'],
            ['M005', 'Omeprazole 20mg', 'Kapsul', 1500, 3000, 'Gastro'],
            ['M006', 'Metformin 500mg', 'Tablet', 600, 3000, 'Antidiabetik'],
            ['M007', 'Amlodipine 5mg', 'Tablet', 900, 3000, 'Kardiovaskular'],
            ['M008', 'Salbutamol Inhaler', 'Inhaler', 45000, 600, 'Respirasi'],
            ['M009', 'OBH Sirup 100ml', 'Botol', 25000, 800, 'Respirasi'],
            ['M010', 'Vitamin C 500mg', 'Tablet', 400, 6000, 'Vitamin'],
            ['M011', 'Dexamethasone 0.5mg', 'Tablet', 300, 4000, 'Kortikosteroid'],
            ['M012', 'Ranitidine 150mg', 'Tablet', 500, 3000, 'Gastro'],
            ['M013', 'Cefadroxil 500mg', 'Kapsul', 1800, 2000, 'Antibiotik'],
            ['M014', 'Betadine Solution 60ml', 'Botol', 18000, 700, 'Antiseptik'],
            ['M015', 'Povidone Iodine 10%', 'Botol', 15000, 900, 'Antiseptik'],
        ];
        foreach ($medicines as [$code, $name, $unit, $price, $stock, $cat]) {
            $this->insert('medicines', [
                'code' => $code, 'name' => $name, 'unit' => $unit, 'price' => $price, 'stock' => $stock, 'category' => $cat,
            ]);
        }

        $labs = [
            ['L001', 'Hemoglobin', 'g/dL', '13 - 17', 35000, 'Hematologi'],
            ['L002', 'Leukosit', '10^3/uL', '4 - 10', 35000, 'Hematologi'],
            ['L003', 'Trombosit', '10^3/uL', '150 - 400', 35000, 'Hematologi'],
            ['L004', 'Gula Darah Puasa', 'mg/dL', '70 - 100', 40000, 'Kimia'],
            ['L005', 'Gula Darah Sewaktu', 'mg/dL', '70 - 140', 40000, 'Kimia'],
            ['L006', 'Kolesterol Total', 'mg/dL', '< 200', 45000, 'Kimia'],
            ['L007', 'Asam Urat', 'mg/dL', '3.4 - 7.0', 40000, 'Kimia'],
            ['L008', 'Kreatinin', 'mg/dL', '0.6 - 1.2', 45000, 'Kimia'],
            ['L009', 'SGOT', 'U/L', '< 35', 50000, 'Kimia'],
            ['L010', 'SGPT', 'U/L', '< 35', 50000, 'Kimia'],
            ['L011', 'Urinalisis', '-', '-', 30000, 'Urin'],
            ['L012', 'Widal', '-', '-', 55000, 'Serologi'],
        ];
        foreach ($labs as [$code, $name, $unit, $range, $price, $cat]) {
            $this->insert('lab_tests', [
                'code' => $code, 'name' => $name, 'unit' => $unit, 'ref_range' => $range, 'price' => $price, 'category' => $cat,
            ]);
        }
    }

    private function seedPatients(): void
    {
        $patients = [
            ['Budi Hartono', '1985-04-12', 'L', '081311110001', 'Jl. Merdeka No. 10, Jakarta', 'O', 'Tidak ada'],
            ['Siti Aminah', '1990-08-23', 'P', '081311110002', 'Jl. Sudirman No. 21, Jakarta', 'A', 'Penisilin'],
            ['Agus Setiawan', '1978-01-15', 'L', '081311110003', 'Jl. Thamrin No. 5, Jakarta', 'B', 'Tidak ada'],
            ['Dewi Kartika', '1995-11-30', 'P', '081311110004', 'Jl. Gatot Subroto No. 8, Jakarta', 'AB', 'Seafood'],
            ['Rudi Wijaya', '1982-06-07', 'L', '081311110005', 'Jl. Kuningan No. 17, Jakarta', 'O', 'Tidak ada'],
            ['Nina Marlina', '2001-03-19', 'P', '081311110006', 'Jl. Casablanca No. 3, Jakarta', 'A', 'Debu'],
            ['Hendra Gunawan', '1969-09-25', 'L', '081311110007', 'Jl. Rasuna Said No. 12, Jakarta', 'B', 'Tidak ada'],
            ['Rina Wulandari', '1988-12-02', 'P', '081311110008', 'Jl. Senayan No. 9, Jakarta', 'O', 'Aspirin'],
            ['Fajar Nugroho', '1993-07-14', 'L', '081311110009', 'Jl. Kebayoran No. 44, Jakarta', 'A', 'Tidak ada'],
            ['Lestari Putri', '1997-02-28', 'P', '081311110010', 'Jl. Fatmawati No. 6, Jakarta', 'B', 'Tidak ada'],
            ['Yusuf Maulana', '1975-05-11', 'L', '081311110011', 'Jl. Pondok Indah No. 2, Jakarta', 'AB', 'Tidak ada'],
            ['Ani Suryani', '1984-10-16', 'P', '081311110012', 'Jl. Cipete No. 31, Jakarta', 'O', 'Sulfa'],
            ['Bambang Supriyadi', '1960-08-08', 'L', '081311110013', 'Jl. Tebet No. 18, Jakarta', 'A', 'Tidak ada'],
            ['Maya Sari', '1999-01-21', 'P', '081311110014', 'Jl. Manggarai No. 7, Jakarta', 'B', 'Tidak ada'],
            ['Doni Saputra', '1991-06-30', 'L', '081311110015', 'Jl. Pasar Minggu No. 25, Jakarta', 'O', 'Tidak ada'],
        ];
        foreach ($patients as $i => [$name, $birth, $gender, $phone, $address, $blood, $allergy]) {
            $this->insert('patients', [
                'nik' => '3171' . str_pad((string) (100000000000 + $i), 12, '0', STR_PAD_LEFT),
                'name' => $name,
                'birth_date' => $birth,
                'gender' => $gender,
                'phone' => $phone,
                'address' => $address,
                'blood_type' => $blood,
                'allergy' => $allergy,
            ]);
        }
    }

    private function seedTodayVisits(): void
    {
        $today = date('Y-m-d');
        $patientIds = $this->ids('patients');
        $doctorRows = Yii::$app->db->createCommand('SELECT id, name FROM doctors ORDER BY id')->queryAll();
        $poliIds = $this->ids('polis');

        $this->createVisit($patientIds[0], $doctorRows[5]['id'], $poliIds[0], $today, 'WAITING', [
            'complaint' => 'Demam dan batuk sejak 2 hari',
        ]);
        $this->createVisit($patientIds[1], $doctorRows[0]['id'], $poliIds[1], $today, 'IN_EXAM', [
            'complaint' => 'Nyeri ulu hati dan mual',
            'procedures' => [1],
            'prescription' => 'PROCESSING',
            'lab' => ['L004', 'L006'],
        ]);
        $this->createVisit($patientIds[2], $doctorRows[5]['id'], $poliIds[0], $today, 'EXAM_DONE', [
            'complaint' => 'Sakit kepala dan demam',
            'procedures' => [1, 2],
            'prescription' => 'DISPENSED',
            'lab' => ['L001', 'L002', 'L003'],
        ]);
        $this->createVisit($patientIds[3], $doctorRows[1]['id'], $poliIds[2], $today, 'BILLING', [
            'complaint' => 'Batuk pilek pada anak',
            'procedures' => [1, 3],
            'prescription' => 'DISPENSED',
            'lab' => ['L002'],
        ]);
        $this->createVisit($patientIds[4], $doctorRows[2]['id'], $poliIds[3], $today, 'PAID', [
            'complaint' => 'Sakit gigi geraham bawah',
            'procedures' => [7, 8],
            'prescription' => 'DISPENSED',
            'payment' => 'FULL',
        ]);
        $this->createVisit($patientIds[5], $doctorRows[3]['id'], $poliIds[4], $today, 'PAID', [
            'complaint' => 'Pandangan kabur saat membaca',
            'procedures' => [9],
            'payment' => 'FULL',
        ]);
        $this->createVisit($patientIds[6], $doctorRows[4]['id'], $poliIds[5], $today, 'WAITING', [
            'complaint' => 'Telinga berdenging',
            'guarantor' => 'BPJS',
        ]);
        $this->createVisit($patientIds[7], $doctorRows[5]['id'], $poliIds[0], $today, 'REGISTERED', [
            'complaint' => 'Kontrol tekanan darah',
            'guarantor' => 'ASURANSI',
        ]);
        $this->createVisit($patientIds[8], $doctorRows[5]['id'], $poliIds[0], $today, 'CANCELLED', [
            'complaint' => 'Batal berobat',
            'cancel_reason' => 'Pasien berhalangan hadir',
        ]);
    }

    private function seedHistory(): void
    {
        $patientIds = $this->ids('patients');
        $doctorRows = Yii::$app->db->createCommand('SELECT id, name FROM doctors ORDER BY id')->queryAll();
        $poliIds = $this->ids('polis');
        $doctorPoli = Yii::$app->db->createCommand('SELECT doctor_id, poli_id FROM doctor_schedules GROUP BY doctor_id, poli_id')->queryAll();
        $map = [];
        foreach ($doctorPoli as $row) {
            $map[$row['doctor_id']] = $row['poli_id'];
        }

        for ($d = 1; $d <= 14; $d++) {
            $date = date('Y-m-d', strtotime("-{$d} days"));
            for ($i = 0; $i < 3; $i++) {
                $doctor = $doctorRows[($d + $i) % count($doctorRows)];
                $patientId = $patientIds[($d * 3 + $i) % count($patientIds)];
                $poliId = $map[$doctor['id']] ?? $poliIds[0];
                $statuses = ['PAID', 'PAID', 'PAID', 'BILLING', 'EXAM_DONE', 'CANCELLED'];
                $status = $statuses[($d + $i) % count($statuses)];
                $opts = [
                    'complaint' => 'Kontrol rutin',
                    'procedures' => [$i % 4 + 1],
                ];
                if ($status === 'PAID' || $status === 'BILLING') {
                    $opts['prescription'] = 'DISPENSED';
                    if (($d + $i) % 2 === 0) {
                        $opts['lab'] = ['L004', 'L005'];
                    }
                }
                if ($status === 'PAID') {
                    $opts['payment'] = 'FULL';
                }
                $this->createVisit($patientId, $doctor['id'], $poliId, $date, $status, $opts);
            }
        }
    }

    private function createVisit(int $patientId, int $doctorId, int $poliId, string $date, string $status, array $opts = []): void
    {
        $db = Yii::$app->db;
        $key = $doctorId . '|' . $date;
        if (!isset($this->queue[$key])) {
            $this->queue[$key] = (int) $db->createCommand(
                'SELECT COALESCE(max(queue_no), 0) FROM visits WHERE doctor_id = :d AND visit_date = :t',
                [':d' => $doctorId, ':t' => $date]
            )->queryScalar();
        }
        $this->queue[$key]++;
        $queueNo = $this->queue[$key];
        $visitNo = $db->createCommand(
            "SELECT 'V' || to_char(:t::date, 'YYYYMMDD') || '-' || lpad(nextval('visit_no_seq')::text, 4, '0')",
            [':t' => $date]
        )->queryScalar();
        $visit = $this->insert('visits', [
            'visit_no' => $visitNo,
            'patient_id' => $patientId,
            'doctor_id' => $doctorId,
            'poli_id' => $poliId,
            'visit_date' => $date,
            'queue_no' => $queueNo,
            'guarantor_type' => $opts['guarantor'] ?? 'UMUM',
            'status' => $status === 'CANCELLED' ? 'CANCELLED' : 'REGISTERED',
            'complaint' => $opts['complaint'] ?? null,
            'cancel_reason' => $opts['cancel_reason'] ?? null,
            'created_by' => 1,
        ]);
        $visitId = (int) $visit['id'];
        $db->createCommand(
            'INSERT INTO queue_counters (doctor_id, visit_date, last_no) VALUES (:d, :t, :n)
             ON CONFLICT (doctor_id, visit_date) DO UPDATE SET last_no = GREATEST(queue_counters.last_no, EXCLUDED.last_no)',
            [':d' => $doctorId, ':t' => $date, ':n' => $queueNo]
        )->execute();

        if ($status === 'CANCELLED') {
            $this->billing()->syncInvoice($visitId, $this->actor, 'Tagihan pendaftaran');
            return;
        }

        if (in_array($status, ['IN_EXAM', 'EXAM_DONE', 'BILLING', 'PAID'], true)) {
            $record = $this->insert('medical_records', [
                'visit_id' => $visitId,
                'anamnesis' => $opts['complaint'] ?? 'Keluhan utama',
                'blood_pressure' => '120/80',
                'temperature' => 36.8,
                'pulse' => 82,
                'respiration' => 18,
                'weight' => 65.5,
                'height' => 168,
                'physical_exam' => 'Keadaan umum baik, kesadaran compos mentis.',
                'notes' => 'Terapi dan edukasi pasien.',
                'created_by' => 1,
                'updated_by' => 1,
            ]);
            $diagnoses = [
                ['A09', 'Diare dan gastroenteritis', 'P'],
                ['R50.9', 'Demam tidak spesifik', 'S'],
            ];
            foreach ($diagnoses as [$code, $name, $type]) {
                $this->insert('diagnoses', [
                    'visit_id' => $visitId,
                    'medical_record_id' => $record['id'],
                    'icd10_code' => $code,
                    'name' => $name,
                    'type' => $type,
                    'is_active' => true,
                ]);
            }
        }

        foreach (($opts['procedures'] ?? []) as $procId) {
            $proc = $db->createCommand('SELECT * FROM procedures WHERE id = :id', [':id' => $procId])->queryOne();
            if (!$proc) {
                continue;
            }
            $this->insert('visit_procedures', [
                'visit_id' => $visitId,
                'procedure_id' => $procId,
                'qty' => 1,
                'unit_price' => $proc['price'],
                'status' => 'ACTIVE',
                'created_by' => 1,
            ]);
        }

        if (!empty($opts['prescription'])) {
            $this->seedPrescription($visitId, $opts['prescription']);
        }
        if (!empty($opts['lab'])) {
            $this->seedLab($visitId, $opts['lab']);
        }

        $invoice = $this->billing()->syncInvoice($visitId, $this->actor, 'Sinkronisasi tagihan demo');
        if (($opts['payment'] ?? '') === 'FULL' && (float) $invoice['total'] > 0) {
            $key = $this->uuid();
            (new PaymentService())->pay((int) $invoice['id'], [
                'method' => ['CASH', 'QRIS', 'TRANSFER'][random_int(0, 2)],
                'amount' => (float) $invoice['total'],
            ], $key, ['id' => 6, 'name' => 'Kasir Dewi', 'role' => 'kasir']);
        } elseif (($opts['payment'] ?? '') === 'PARTIAL' && (float) $invoice['total'] > 0) {
            $key = $this->uuid();
            (new PaymentService())->pay((int) $invoice['id'], [
                'method' => 'CASH',
                'amount' => round((float) $invoice['total'] / 2, 2),
            ], $key, ['id' => 6, 'name' => 'Kasir Dewi', 'role' => 'kasir']);
        }

        if ($status !== 'PAID') {
            $db->createCommand('UPDATE visits SET status = :s WHERE id = :id', [':s' => $status, ':id' => $visitId])->execute();
        }
    }

    private function seedPrescription(int $visitId, string $status): void
    {
        $db = Yii::$app->db;
        $no = $db->createCommand(
            "SELECT 'RX' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('prescription_no_seq')::text, 4, '0')"
        )->queryScalar();
        $rx = $this->insert('prescriptions', [
            'prescription_no' => $no,
            'visit_id' => $visitId,
            'status' => $status === 'DISPENSED' ? 'PROCESSING' : $status,
            'created_by' => 1,
            'submitted_at' => date('c'),
            'processed_at' => date('c'),
        ]);
        $meds = $db->createCommand('SELECT * FROM medicines ORDER BY id LIMIT 3')->queryAll();
        foreach (array_slice($meds, 0, 2) as $med) {
            $this->insert('prescription_items', [
                'prescription_id' => $rx['id'],
                'medicine_id' => $med['id'],
                'dose' => '1 tablet',
                'frequency' => '3x sehari',
                'qty' => 10,
                'unit_price' => $med['price'],
            ]);
        }
        if ($status === 'DISPENSED') {
            (new PharmacyService())->dispense((int) $rx['id'], ['id' => 4, 'name' => 'Apoteker Sari', 'role' => 'farmasi']);
        }
    }

    private function seedLab(int $visitId, array $codes): void
    {
        $db = Yii::$app->db;
        $ids = [];
        foreach ($codes as $code) {
            $id = $db->createCommand('SELECT id FROM lab_tests WHERE code = :c', [':c' => $code])->queryScalar();
            if ($id) {
                $ids[] = (int) $id;
            }
        }
        if (!$ids) {
            return;
        }
        $order = (new LabService())->createOrder($visitId, $ids, ['id' => 3, 'name' => 'dr. Andi', 'role' => 'dokter'], 'Pemeriksaan laboratorium');
        foreach ($order['items'] as $item) {
            (new LabService())->submitResult((int) $item['id'], [
                'external_ref' => 'DEMO-' . $item['id'] . '-' . uniqid(),
                'result_value' => (string) random_int(10, 200),
                'unit' => $item['unit'],
                'ref_range' => $item['ref_range'],
                'flag' => 'NORMAL',
            ], ['id' => 5, 'name' => 'Analis Joko', 'role' => 'lab']);
        }
    }

    private function billing(): BillingService
    {
        return new BillingService();
    }

    private function ids(string $table): array
    {
        return array_map('intval', Yii::$app->db->createCommand("SELECT id FROM {$table} ORDER BY id")->queryColumn());
    }

    private function insert(string $table, array $data, bool $upsert = false): array
    {
        $columns = array_keys($data);
        $params = [];
        foreach ($data as $key => $value) {
            $params[':' . $key] = $value;
        }
        $sql = sprintf(
            'INSERT INTO %s (%s) VALUES (%s)%s RETURNING *',
            $table,
            implode(', ', $columns),
            implode(', ', array_map(fn ($c) => ':' . $c, $columns)),
            $upsert ? ' ON CONFLICT DO NOTHING' : ''
        );
        $row = Yii::$app->db->createCommand($sql, $params)->queryOne();
        if (!$row && $upsert) {
            $conditions = [];
            $condParams = [];
            foreach ($data as $key => $value) {
                $conditions[] = "{$key} = :u_{$key}";
                $condParams[':u_' . $key] = $value;
            }
            $row = Yii::$app->db->createCommand(
                sprintf('SELECT * FROM %s WHERE %s LIMIT 1', $table, implode(' AND ', $conditions)),
                $condParams
            )->queryOne();
        }
        return $row ?: [];
    }

    private function uuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
