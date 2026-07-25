<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        // Cambiar cantidad_total a INT SIGNED para evitar errores 1690 Out of Range al vender sin stock suficiente
        DB::statement("ALTER TABLE productos MODIFY cantidad_total INT NOT NULL DEFAULT 0");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE productos MODIFY cantidad_total INT UNSIGNED NOT NULL DEFAULT 0");
    }
};
