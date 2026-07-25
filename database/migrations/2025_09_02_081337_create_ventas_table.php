<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Tabla de ventas
     * Campos: cliente_id, fecha, autorizacion, estado,
     * numeración: estab, pto_emision, secuencial, numero
     * totales: subtotal, impuesto_15, impuesto_0, descuento, total
     * Auditoría: creada_por
     * Borrado lógico: deleted_at
     */
    public function up(): void
    {
        Schema::create('ventas', function (Blueprint $table) {
            $table->id();

            $table->foreignId('cliente_id')->constrained('clientes')->restrictOnDelete();

            $table->dateTime('fecha');

            // === Numeración SRI ===
            // Usamos CHAR/STRING para preservar ceros a la izquierda (001, 002, 000000123)
            $table->char('estab', 3)->nullable()->index();          // Establecimiento (001)
            $table->char('pto_emision', 3)->nullable()->index();    // Punto de emisión (002)
            $table->char('secuencial', 9)->nullable();              // Secuencial (000000123)

            // Número completo (ej: 001-002-000000123). Útil para búsquedas y mostrar.
            $table->string('numero', 17)->nullable()->unique();

            // Índice único por combinación (permite múltiples NULL; se valida al emitir)
            $table->unique(['estab','pto_emision','secuencial'], 'ventas_numero_unico');

            // Autorización/clave de acceso
            $table->string('autorizacion', 100)->nullable();   // # de autorización (SRI u otro)

            // Estado de la venta
            $table->string('estado', 20)->index();             // ej: 'creada','emitida','anulada'

            // Totales
            $table->unsignedDecimal('subtotal',   12, 2)->default(0);
            $table->unsignedDecimal('impuesto_15',12, 2)->default(0); // IVA 15%
            $table->unsignedDecimal('impuesto_0', 12, 2)->default(0); // IVA 0%
            $table->unsignedDecimal('descuento',  12, 2)->default(0);
            $table->unsignedDecimal('total',      12, 2)->default(0);

            // Auditoría (usuario creador)
            $table->foreignId('creada_por')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ventas');
    }
};
