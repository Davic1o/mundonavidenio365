<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Agrega la columna secuencial_nota_credito a la tabla empresas.
     */
    public function up(): void
    {
        Schema::table('empresas', function (Blueprint $table) {
            if (!Schema::hasColumn('empresas', 'secuencial_nota_credito')) {
                $table->string('secuencial_nota_credito', 9)->default('000000001')->after('secuencial_factura');
            }
        });
    }

    public function down(): void
    {
        Schema::table('empresas', function (Blueprint $table) {
            if (Schema::hasColumn('empresas', 'secuencial_nota_credito')) {
                $table->dropColumn('secuencial_nota_credito');
            }
        });
    }
};
