<?php

$params = require __DIR__ . '/params.php';
$db = require __DIR__ . '/db.php';

$config = [
    'id' => 'simrs-api',
    'basePath' => dirname(__DIR__),
    'bootstrap' => ['log'],
    'aliases' => [
        '@bower' => '@vendor/bower-asset',
        '@npm' => '@vendor/npm-asset',
    ],
    'modules' => [
        'api' => [
            'class' => \app\modules\api\Module::class,
        ],
    ],
    'components' => [
        'request' => [
            'cookieValidationKey' => 'simrs-inova-dev-cookie-key',
            'enableCsrfValidation' => false,
            'parsers' => [
                'application/json' => \yii\web\JsonParser::class,
            ],
        ],
        'response' => [
            'format' => \yii\web\Response::FORMAT_JSON,
            'on beforeSend' => function ($event) {
                $response = $event->sender;
                $response->headers->set('X-Content-Type-Options', 'nosniff');
                $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
            },
        ],
        'cache' => [
            'class' => \yii\caching\FileCache::class,
        ],
        'user' => [
            'identityClass' => \app\models\User::class,
            'enableAutoLogin' => false,
            'enableSession' => false,
        ],
        'errorHandler' => [
            'class' => \app\components\ApiErrorHandler::class,
            'errorAction' => null,
        ],
        'authManager' => [
            'class' => \yii\rbac\DbManager::class,
        ],
        'log' => [
            'traceLevel' => YII_DEBUG ? 3 : 0,
            'targets' => [
                [
                    'class' => \yii\log\FileTarget::class,
                    'levels' => ['error', 'warning'],
                ],
            ],
        ],
        'db' => $db,
        'urlManager' => [
            'enablePrettyUrl' => true,
            'showScriptName' => false,
            'enableStrictParsing' => false,
            'rules' => [
                // Auth
                'POST api/v1/auth/login' => 'api/auth/login',
                'POST api/v1/auth/refresh' => 'api/auth/refresh',
'POST api/v1/auth/logout' => 'api/auth/logout',
               'POST api/v1/auth/change-password' => 'api/auth/change-password',
               'GET api/v1/auth/me' => 'api/auth/me',
                'GET api/v1/health' => 'api/default/health',

                // Pasien
                'GET api/v1/patients/search' => 'api/patient/search',
                'GET api/v1/patients/<id:\d+>/history' => 'api/exam/history',
                'GET api/v1/patients/<id:\d+>/medication-history' => 'api/prescription/medication-history',

                // Kunjungan / antrean
                'POST api/v1/visits' => 'api/visit/create',
                'GET api/v1/visits' => 'api/visit/index',
                'GET api/v1/visits/<id:\d+>' => 'api/visit/view',
                'PATCH api/v1/visits/<id:\d+>/cancel' => 'api/visit/cancel',
                'PATCH api/v1/visits/<id:\d+>/checkin' => 'api/visit/checkin',
                'GET api/v1/queues/board' => 'api/visit/board',

                // Pemeriksaan / RME
                'GET api/v1/exams/waiting' => 'api/exam/waiting',
                'GET api/v1/exams/<visit:\d+>' => 'api/exam/detail',
                'POST api/v1/exams/<visit:\d+>/start' => 'api/exam/start',
                'PUT api/v1/exams/<visit:\d+>/record' => 'api/exam/record',
                'PUT api/v1/exams/<visit:\d+>/diagnoses' => 'api/exam/diagnoses',
                'POST api/v1/exams/<visit:\d+>/finish' => 'api/exam/finish',

                // Tindakan
                'GET api/v1/visits/<id:\d+>/procedures' => 'api/visit-procedure/index',
                'POST api/v1/visits/<id:\d+>/procedures' => 'api/visit-procedure/create',
                'DELETE api/v1/visits/<id:\d+>/procedures/<pid:\d+>' => 'api/visit-procedure/delete',

                // Resep / farmasi
                'POST api/v1/visits/<id:\d+>/prescriptions' => 'api/prescription/create',
                'GET api/v1/pharmacy/queue' => 'api/prescription/queue',
                'GET api/v1/prescriptions/<id:\d+>' => 'api/prescription/view',
                'POST api/v1/prescriptions/<id:\d+>/process' => 'api/prescription/process',
                'POST api/v1/prescriptions/<id:\d+>/dispense' => 'api/prescription/dispense',
                'POST api/v1/medicines/<id:\d+>/stock-adjust' => 'api/medicine/stock-adjust',

                // Lab
                'POST api/v1/visits/<id:\d+>/lab-orders' => 'api/lab-order/create',
                'GET api/v1/visits/<id:\d+>/lab-results' => 'api/lab-order/results',
                'GET api/v1/lab-orders' => 'api/lab-order/index',
                'GET api/v1/lab-orders/<id:\d+>' => 'api/lab-order/view',
                'POST api/v1/lab-orders/<id:\d+>/results' => 'api/lab-order/submit',

                // Billing / pembayaran
                'POST api/v1/visits/<id:\d+>/invoice' => 'api/invoice/sync',
                'GET api/v1/invoices' => 'api/invoice/index',
                'GET api/v1/invoices/<id:\d+>' => 'api/invoice/view',
                'POST api/v1/invoices/<id:\d+>/payments' => 'api/invoice/pay',
                'GET api/v1/invoices/<id:\d+>/payments' => 'api/invoice/payments',
                'GET api/v1/invoices/<id:\d+>/print' => 'api/invoice/print',
                'POST api/v1/invoices/<id:\d+>/adjustments' => 'api/invoice/adjustment',
                'GET api/v1/payments/<id:\d+>/receipt' => 'api/payment/receipt',

                // Pengguna & role
                'GET api/v1/users' => 'api/user/index',
                'POST api/v1/users' => 'api/user/create',
                'PUT api/v1/users/<id:\d+>' => 'api/user/update',
                'PUT api/v1/users/<id:\d+>/roles' => 'api/user/roles',
                'GET api/v1/roles' => 'api/user/roles-list',

                // Internal service (Node -> Yii)
                'POST internal/v1/lab-results' => 'api/internal/lab-results',
                'GET internal/v1/health' => 'api/internal/health',

                // Master CRUD (nama jamak -> controller tunggal)
                'GET api/v1/patients' => 'api/patient/index',
                'POST api/v1/patients' => 'api/patient/create',
                'GET api/v1/patients/<id:\d+>' => 'api/patient/view',
                'PUT api/v1/patients/<id:\d+>' => 'api/patient/update',
                'DELETE api/v1/patients/<id:\d+>' => 'api/patient/delete',
                'GET api/v1/doctors' => 'api/doctor/index',
                'POST api/v1/doctors' => 'api/doctor/create',
                'GET api/v1/doctors/<id:\d+>' => 'api/doctor/view',
                'PUT api/v1/doctors/<id:\d+>' => 'api/doctor/update',
                'DELETE api/v1/doctors/<id:\d+>' => 'api/doctor/delete',
                'GET api/v1/polis' => 'api/poli/index',
                'POST api/v1/polis' => 'api/poli/create',
                'GET api/v1/polis/<id:\d+>' => 'api/poli/view',
                'PUT api/v1/polis/<id:\d+>' => 'api/poli/update',
                'DELETE api/v1/polis/<id:\d+>' => 'api/poli/delete',
                'GET api/v1/schedules' => 'api/schedule/index',
                'POST api/v1/schedules' => 'api/schedule/create',
                'GET api/v1/schedules/<id:\d+>' => 'api/schedule/view',
                'PUT api/v1/schedules/<id:\d+>' => 'api/schedule/update',
                'DELETE api/v1/schedules/<id:\d+>' => 'api/schedule/delete',
                'GET api/v1/procedures' => 'api/procedure/index',
                'POST api/v1/procedures' => 'api/procedure/create',
                'GET api/v1/procedures/<id:\d+>' => 'api/procedure/view',
                'PUT api/v1/procedures/<id:\d+>' => 'api/procedure/update',
                'DELETE api/v1/procedures/<id:\d+>' => 'api/procedure/delete',
                'GET api/v1/medicines' => 'api/medicine/index',
                'POST api/v1/medicines' => 'api/medicine/create',
                'GET api/v1/medicines/<id:\d+>' => 'api/medicine/view',
                'PUT api/v1/medicines/<id:\d+>' => 'api/medicine/update',
                'DELETE api/v1/medicines/<id:\d+>' => 'api/medicine/delete',
                'GET api/v1/lab-tests' => 'api/lab-test/index',
                'POST api/v1/lab-tests' => 'api/lab-test/create',
                'GET api/v1/lab-tests/<id:\d+>' => 'api/lab-test/view',
                'PUT api/v1/lab-tests/<id:\d+>' => 'api/lab-test/update',
                'DELETE api/v1/lab-tests/<id:\d+>' => 'api/lab-test/delete',

                // Master CRUD generik
                'POST api/v1/<controller:[\w-]+>' => 'api/<controller>/create',
                'GET api/v1/<controller:[\w-]+>' => 'api/<controller>/index',
                'PUT api/v1/<controller:[\w-]+>/<id:\d+>' => 'api/<controller>/update',
                'DELETE api/v1/<controller:[\w-]+>/<id:\d+>' => 'api/<controller>/delete',
                'GET api/v1/<controller:[\w-]+>/<id:\d+>' => 'api/<controller>/view',
                'api/v1/<controller:[\w-]+>/<action:[\w-]+>' => 'api/<controller>/<action>',
            ],
        ],
    ],
    'params' => $params,
];

if (YII_ENV_DEV) {
    $config['bootstrap'][] = 'debug';
    $config['modules']['debug'] = [
        'class' => \yii\debug\Module::class,
        'allowedIPs' => ['127.0.0.1', '::1'],
    ];
    $config['bootstrap'][] = 'gii';
    $config['modules']['gii'] = [
        'class' => \yii\gii\Module::class,
        'allowedIPs' => ['127.0.0.1', '::1'],
    ];
}

return $config;
