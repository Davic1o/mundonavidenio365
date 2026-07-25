<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('nota_credito_detalles', function (Blueprint $table) {
            $table->id();

            $table->unsignedBigInteger('nota_credito_id');
            $table->unsignedBigInteger('producto_id');

            // Cantidad devuelta y valores (siguiendo tu convención: precio guardado CON IVA)
            $table->decimal('cantidad', 12, 6)->default(0);
            $table->decimal('precio',   12, 6)->default(0);   // precio unitario (con IVA)
            $table->decimal('descuento',12, 2)->default(0);   // valor (no %)
            $table->decimal('precio_total',12, 2)->default(0);// cantidad*precio - descuento (con IVA)
            $table->unsignedTinyInteger('iva')->default(15);  // 0|15

            $table->timestamps();

            $table->index(['nota_credito_id', 'producto_id']);

            $table->foreign('nota_credito_id')->references('id')->on('notas_credito')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreign('producto_id')->references('id')->on('productos')->cascadeOnUpdate()->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('nota_credito_detalles');
    }
};
