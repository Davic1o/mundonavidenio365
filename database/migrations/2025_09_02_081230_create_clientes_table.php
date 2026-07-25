<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Tabla de clientes
     * Campos: nombres, ci_o_ruc, telefono, direccion, correo
     * Auditoría: creado_por, actualizado_por
     * Borrado lógico: deleted_at
     */
    public function up(): void
    {
        Schema::create('clientes', function (Blueprint $table) {
            $table->id();

            $table->string('nombres', 255);
            $table->string('ci_o_ruc', 20)->nullable()->unique();
            $table->string('telefono', 50)->nullable();
            $table->string('direccion', 255)->nullable();
            $table->string('correo', 255)->nullable();

            // Auditoría (usuarios)
            $table->foreignId('creado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('actualizado_por')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();
            $table->softDeletes();

            // Índices útiles
            $table->index('nombres');
            $table->index('correo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('clientes');
    }
};
