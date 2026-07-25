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
        Schema::create('venta_pagos', function (Blueprint $table) {
            $table->id();

            $table->foreignId('venta_id')->constrained('ventas')->cascadeOnDelete();

            $table->string('codigo')->nullable(); // Código del pago (si aplica)
            $table->string('nombre')->nullable(); // Nombre del pago (si aplica)
            $table->unsignedDecimal('valor', 12, 2); // Valor del pago

            $table->timestamps();

            $table->index('venta_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('venta_pagos');
    }
};
