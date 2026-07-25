<?php
// database/migrations/2025_09_16_000000_create_label_presets_table.php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        Schema::create('label_presets', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->unique(); // ej: grandes-letter, grandes-a4, pequenas-letter, pequenas-a4
            $table->string('nombre');         // etiqueta legible
            $table->enum('categoria', ['grandes','pequenas']);
            $table->enum('paper_size', ['letter','a4']);
            $table->unsignedInteger('per_sheet'); // 50 ó 100 (solo informativo)
            $table->boolean('is_active')->default(true);
            // Config base editable:
            $table->unsignedTinyInteger('cols')->default(5);
            $table->unsignedTinyInteger('rows')->default(10);
            $table->float('margin_top_mm')->default(7);
            $table->float('margin_right_mm')->default(5);
            $table->float('margin_bottom_mm')->default(7);
            $table->float('margin_left_mm')->default(5);
            $table->float('gap_x_mm')->default(2);
            $table->float('gap_y_mm')->default(2);
            // Opcional: tamaño fijo de etiqueta (mm). Si null ==> se calcula por grid.
            $table->float('label_w_mm')->nullable();
            $table->float('label_h_mm')->nullable();
            // Tipografías y código de barras:
            $table->float('font_store_name_pt')->default(8);
            $table->float('font_product_code_pt')->default(6);
            $table->float('font_price_pt')->default(10);
            $table->float('barcode_height_pt')->default(16);

            $table->timestamps();
            $table->unique(['categoria','paper_size']);
        });
    }

    public function down(): void {
        Schema::dropIfExists('label_presets');
    }
};
