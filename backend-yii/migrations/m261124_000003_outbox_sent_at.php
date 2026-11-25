<?php

use yii\db\Migration;

class m261124_000003_outbox_sent_at extends Migration
{
    public function safeUp()
    {
        $this->addColumn('integration.outbox', 'sent_at', 'timestamptz NULL');
    }

    public function safeDown()
    {
        $this->dropColumn('integration.outbox', 'sent_at');
    }
}
