<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('ventas')) {
            Schema::table('ventas', function (Blueprint $table) {
                if (!Schema::hasColumn('ventas', 'actualizada_por')) {
                    $table->unsignedBigInteger('actualizada_por')->nullable()->after('creada_por')->index();
                }
                if (!Schema::hasColumn('ventas', 'eliminada_por')) {
                    $table->unsignedBigInteger('eliminada_por')->nullable()->after('actualizada_por')->index();
                }
            });
        }

        if (Schema::hasTable('notas_credito')) {
            Schema::table('notas_credito', function (Blueprint $table) {
                if (!Schema::hasColumn('notas_credito', 'eliminada_por')) {
                    $table->unsignedBigInteger('eliminada_por')->nullable()->after('actualizada_por')->index();
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('ventas')) {
            Schema::table('ventas', function (Blueprint $table) {
                if (Schema::hasColumn('ventas', 'eliminada_por')) {
                    $table->dropColumn('eliminada_por');
                }
                if (Schema::hasColumn('ventas', 'actualizada_por')) {
                    $table->dropColumn('actualizada_por');
                }
            });
        }

        if (Schema::hasTable('notas_credito')) {
            Schema::table('notas_credito', function (Blueprint $table) {
                if (Schema::hasColumn('notas_credito', 'eliminada_por')) {
                    $table->dropColumn('eliminada_por');
                }
            });
        }
    }
};
