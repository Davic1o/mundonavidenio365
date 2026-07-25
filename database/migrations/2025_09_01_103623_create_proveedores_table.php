<?php
// database/migrations/2025_09_01_000000_crear_tabla_proveedores.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('proveedores', function (Blueprint $table) {
            $table->id();

            $table->string('nombre', 255);
            $table->string('telefono', 30)->nullable();
            $table->string('ci_o_ruc', 20)->unique();

            // Auditoría
            $table->foreignId('registrado_por')->constrained('users')->restrictOnDelete();
            $table->foreignId('actualizado_por')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('eliminado_por')->nullable()->constrained('users')->nullOnDelete();

            $table->softDeletes(); // eliminado en lógica
            $table->timestamps();

            $table->index('nombre');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('proveedores');
    }
};
