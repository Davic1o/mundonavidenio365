<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('empresas') && !Schema::hasColumn('empresas', 'secuencial_nota_credito')) {
            Schema::table('empresas', function (Blueprint $table) {
                $table->string('secuencial_nota_credito', 9)->default('000000001')->after('secuencial_factura');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('empresas') && Schema::hasColumn('empresas', 'secuencial_nota_credito')) {
            Schema::table('empresas', function (Blueprint $table) {
                $table->dropColumn('secuencial_nota_credito');
            });
        }
    }
};
