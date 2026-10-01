<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('lotes', function (Blueprint $table) {
            if (!Schema::hasColumn('lotes', 'comision_pct')) {
                $table->decimal('comision_pct', 5, 2)->default(0.00)->after('porcentaje_ganancia');
            }
        });
    }

    public function down(): void
    {
        Schema::table('lotes', function (Blueprint $table) {
            if (Schema::hasColumn('lotes', 'comision_pct')) {
                $table->dropColumn('comision_pct');
            }
        });
    }
};
