<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Detalle: productos vendidos por venta
     * Campos: venta_id, producto_id, cantidad, precio (unitario),
     * descuento (línea), precio_total (línea)
     */
    public function up(): void
    {
        Schema::create('venta_productos', function (Blueprint $table) {
            $table->id();

            $table->foreignId('venta_id')->constrained('ventas')->cascadeOnDelete();
            $table->foreignId('producto_id')->constrained('productos')->restrictOnDelete();

            $table->unsignedInteger('cantidad');
            $table->unsignedDecimal('precio',       12, 2); // unitario
            $table->unsignedDecimal('descuento',    12, 2)->default(0); // en $
            $table->unsignedDecimal('precio_total', 12, 2); // cantidad * precio - descuento

            $table->timestamps();

            // Índices útiles
            $table->index(['venta_id', 'producto_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('venta_productos');
    }
};
