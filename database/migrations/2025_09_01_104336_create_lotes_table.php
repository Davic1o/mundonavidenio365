<?php
// database/migrations/2025_09_01_000200_crear_tabla_lotes.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('lotes', function (Blueprint $table) {
            $table->id();

            $table->foreignId('producto_id')
                ->constrained('productos')
                ->cascadeOnUpdate()
                ->restrictOnDelete();

            $table->foreignId('proveedor_id')
                ->constrained('proveedores')
                ->cascadeOnUpdate()
                ->restrictOnDelete();

            // Datos del lote
            $table->unsignedInteger('cantidad_compra');
            $table->date('fecha_compra');
            $table->unsignedSmallInteger('anio'); // derivado de fecha_compra

            // Costos
            $table->decimal('precio_compra', 12, 2);
            $table->decimal('costo_transporte', 12, 2)->default(0);
            $table->decimal('costo_general', 12, 2)->default(0);
            $table->decimal('precio_compra_final', 12, 2);
            $table->decimal('porcentaje_ganancia', 5, 2)->default(0);
            $table->decimal('precio_total', 14, 2);

            // Auditoría
            $table->foreignId('registrado_por')->constrained('users')->restrictOnDelete();
            $table->foreignId('actualizado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('eliminado_por')->nullable()->constrained('users')->nullOnDelete();

            $table->softDeletes();
            $table->timestamps();

            $table->index(['producto_id', 'anio']);
            $table->index(['proveedor_id']);
            $table->index(['fecha_compra']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lotes');
    }
};
