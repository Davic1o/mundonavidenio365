<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Detalle de pagos con tarjeta por venta
     * Campos: venta_id, monto, comision, tipo_tarjeta, plazo
     */
    public function up(): void
    {
        Schema::create('venta_tarjetas', function (Blueprint $table) {
            $table->id();

            $table->foreignId('venta_id')->constrained('ventas')->cascadeOnDelete();

            $table->unsignedDecimal('monto',    12, 2);       // valor cobrado con tarjeta
            $table->unsignedDecimal('comision', 12, 2)->default(0); // comisión del adquirente/TPV

            $table->string('tipo_tarjeta', 30)->nullable();   // ej: 'Crédito', 'Débito', 'Visa', 'Mastercard'
            $table->unsignedSmallInteger('plazo')->default(0); // meses/diferidos (0 = corriente)

            $table->timestamps();

            $table->index('venta_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('venta_tarjetas');
    }
};
