<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('notas_credito', function (Blueprint $table) {
            $table->id();

            // Referencias
            $table->unsignedBigInteger('venta_id');   // factura sustentada
            $table->unsignedBigInteger('cliente_id'); // redundante (snapshot de la factura)

            // Numeración SRI
            $table->string('estab', 3)->nullable();        // 001
            $table->string('pto_emision', 3)->nullable();  // 001
            $table->string('secuencial', 9)->nullable();   // 000000123
            $table->string('numero', 17)->nullable();      // 001-001-000000123 (index)

            // Clave de acceso (49 dígitos)
            $table->string('autorizacion', 49)->nullable()->unique();

            // Fechas / estado
            $table->dateTime('fecha')->nullable();
            $table->string('estado', 20)->default('creada'); // creada|emitida|Firmada|AUTORIZADO|Devuelta|anulada

            // Totales (misma convención que ventas)
            $table->decimal('subtotal',   12, 2)->default(0);  // SIN IVA (como en tu controlador de ventas)
            $table->decimal('impuesto_15',12, 2)->default(0);
            $table->decimal('impuesto_0', 12, 2)->default(0);
            $table->decimal('descuento',  12, 2)->default(0);
            $table->decimal('total',      12, 2)->default(0);

            // Motivo (requerido por SRI)
            $table->string('motivo', 300)->nullable();

            $table->unsignedBigInteger('creada_por')->nullable();
            $table->unsignedBigInteger('actualizada_por')->nullable();

            $table->timestamps();

            // Índices y FKs
            $table->index(['estab','pto_emision','secuencial']);
            $table->index('numero');

            $table->foreign('venta_id')->references('id')->on('ventas')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreign('cliente_id')->references('id')->on('clientes')->cascadeOnUpdate()->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notas_credito');
    }
};
