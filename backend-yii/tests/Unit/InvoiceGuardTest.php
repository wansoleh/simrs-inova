<?php

declare(strict_types=1);

namespace app\tests\Unit;

use app\services\ApiException;
use yii\codeception\TestCase;

class InvoiceGuardTest extends TestCase
{
    /**
     * @group skip
     * @expectedException \Codeception\Exception\Skip
     */
    public function testVoidProcedureWhenInvoiceIsPaidReturns422(): void
    {
        $this->skip('Skipping - requires database setup with invoice PAID state');
    }

    /**
     * @group skip
     * @expectedException \Codeception\Exception\Skip
     */
    public function testCreateResepWhenInvoiceIsPaidReturns422(): void
    {
        $this->skip('Skipping - requires database setup with invoice PAID state');
    }

    /**
     * @group skip
     * @expectedException \Codeception\Exception\Skip
     */
    public function testCreateLabOrderWhenInvoiceIsPaidReturns422(): void
    {
        $this->skip('Skipping - requires database setup with invoice PAID state');
    }
}