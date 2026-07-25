<?php
// app/Models/LabelPreset.php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class LabelPreset extends Model
{
    protected $fillable = [
        'slug','nombre','categoria','paper_size','per_sheet','is_active',
        'cols','rows',
        'margin_top_mm','margin_right_mm','margin_bottom_mm','margin_left_mm',
        'gap_x_mm','gap_y_mm',
        'label_w_mm','label_h_mm',
        'font_store_name_pt','font_product_code_pt','font_price_pt','barcode_height_pt',
    ];

    protected $casts = [
        'is_active' => 'bool',
        'cols' => 'int','rows' => 'int','per_sheet' => 'int',
        'margin_top_mm' => 'float','margin_right_mm' => 'float','margin_bottom_mm' => 'float','margin_left_mm' => 'float',
        'gap_x_mm' => 'float','gap_y_mm' => 'float',
        'label_w_mm' => 'float','label_h_mm' => 'float',
        'font_store_name_pt' => 'float','font_product_code_pt' => 'float','font_price_pt' => 'float','barcode_height_pt' => 'float',
    ];

    public function scopeActivos(Builder $q): Builder {
        return $q->where('is_active', true);
    }

    // Helper para tu controlador/vista si quieres armar el config completo:
    public function toConfig(): array
    {
        // Dimensiones del papel en puntos
        $paper = $this->paper_size === 'a4'
            ? ['width' => 595.28, 'height' => 841.89] // A4
            : ['width' => 612.00, 'height' => 792.00]; // Carta

        $MM_TO_PT = 72 / 25.4;
        $mm = fn($n) => $n * $MM_TO_PT;

        $cfg = [
            'paperSize' => $this->paper_size,
            'page'      => $paper,
            'cols'      => $this->cols,
            'rows'      => $this->rows,
            'margin'    => [
                'top'    => $mm($this->margin_top_mm),
                'right'  => $mm($this->margin_right_mm),
                'bottom' => $mm($this->margin_bottom_mm),
                'left'   => $mm($this->margin_left_mm),
            ],
            'gap'       => [
                'x' => $mm($this->gap_x_mm),
                'y' => $mm($this->gap_y_mm),
            ],
            'labelSize' => null,
            'fonts'     => [
                'storeName' => $this->font_store_name_pt,
                'productCode' => $this->font_product_code_pt,
                'price' => $this->font_price_pt,
                'barcode' => ['height' => $this->barcode_height_pt],
            ],
        ];

        if (!is_null($this->label_w_mm) && !is_null($this->label_h_mm)) {
            $cfg['labelSize'] = [
                'width'  => $mm($this->label_w_mm),
                'height' => $mm($this->label_h_mm),
            ];
        }

        return $cfg;
    }
}
