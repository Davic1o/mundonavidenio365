<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Crea la tabla 'empresas' para almacenar la información
     * de la empresa dueña de la app.
     */
    public function up(): void
    {
        Schema::create('empresas', function (Blueprint $table) {
            $table->id();

            // Identificación y nombre
            $table->string('nombre_comercial', 255);
            $table->string('razon_social', 255);

            // Cumplimiento fiscal/contable
            $table->boolean('obligado_a_llevar_contabilidad')->default(false);
            $table->string('tipo_contribuyente', 100)->nullable(); // p.ej. 'RIMPE', 'Régimen General'
            $table->string('regimen', 100)->nullable();            // p.ej. 'General', 'RIMPE Emprendedor'
            $table->tinyInteger('ambiente')->default(1);           // 1 = Pruebas, 2 = Producción
            $table->string('establecimiento', 3)->default('001');
            $table->string('punto_emision', 3)->default('001');
            $table->string('secuencial_factura', 9)->default('000000001');

            // Contacto
            $table->string('direccion', 255)->nullable();
            $table->string('telefono', 50)->nullable();
            $table->string('correo', 255)->nullable();

            // Identificación tributaria
            $table->string('ruc', 20)->unique();

            // Firma electrónica (ruta al archivo y clave)
            $table->string('ruta_firma_electronica', 255)->nullable();
            $table->text('clave_firma_electronica')->nullable(); // se encripta vía cast en el modelo
            $table->string('firma_propietario')->nullable();
            $table->string('firma_emisor')->nullable();
            $table->timestamp('firma_valido_desde')->nullable();
            $table->timestamp('firma_valido_hasta')->nullable();

            // Auditoría (usuarios)
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();

            $table->timestamps();

            // Índices útiles
            $table->index('nombre_comercial');
            $table->index('razon_social');
            $table->index('correo');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('empresas');
    }
};
