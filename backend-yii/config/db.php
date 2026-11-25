<?php

return [
    'class' => \yii\db\Connection::class,
    'dsn' => getenv('DB_DSN') ?: sprintf(
        'pgsql:host=%s;port=%s;dbname=%s',
        getenv('DB_HOST') ?: '127.0.0.1',
        getenv('DB_PORT') ?: '5432',
        getenv('DB_NAME') ?: 'simrs_dev'
    ),
    'username' => getenv('DB_USER') ?: 'simrs_dev',
    'password' => getenv('DB_PASS') ?: '',
    'charset' => 'UTF8',
    'enableSchemaCache' => false,
    'on afterOpen' => function ($event) {
        $event->sender->createCommand("SET TIME ZONE 'Asia/Jakarta'")->execute();
    },
];
