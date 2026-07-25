<?php

// database/seeders/LabelPresetSeeder.php
namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\LabelPreset;
use Illuminate\Support\Str;

class LabelPresetSeeder extends Seeder
{
    public function run(): void
    {
        $rows = [
            ['categoria'=>'grandes',  'paper_size'=>'letter', 'per_sheet'=>50,  'nombre'=>'Grandes · Carta', 'cols'=>5,  'rows'=>10, 'fonts'=>[8,6,10,16]],
            ['categoria'=>'grandes',  'paper_size'=>'a4',     'per_sheet'=>50,  'nombre'=>'Grandes · A4',    'cols'=>5,  'rows'=>10, 'fonts'=>[8,6,10,16]],
            ['categoria'=>'pequenas', 'paper_size'=>'letter', 'per_sheet'=>100, 'nombre'=>'Pequeñas · Carta','cols'=>10, 'rows'=>10, 'fonts'=>[7,5.5,9,14]],
            ['categoria'=>'pequenas', 'paper_size'=>'a4',     'per_sheet'=>100, 'nombre'=>'Pequeñas · A4',   'cols'=>10, 'rows'=>10, 'fonts'=>[7,5.5,9,14]],
        ];

        foreach ($rows as $r) {
            $slug = "{$r['categoria']}-{$r['paper_size']}";
            LabelPreset::updateOrCreate(
                ['slug' => $slug],
                [
                    'nombre' => $r['nombre'],
                    'categoria' => $r['categoria'],
                    'paper_size'=> $r['paper_size'],
                    'per_sheet' => $r['per_sheet'],
                    'is_active' => true,
                    'cols' => $r['cols'],
                    'rows' => $r['rows'],
                    'margin_top_mm' => 7, 'margin_right_mm'=>5, 'margin_bottom_mm'=>7, 'margin_left_mm'=>5,
                    'gap_x_mm'=>2, 'gap_y_mm'=>2,
                    'label_w_mm'=>null, 'label_h_mm'=>null,
                    'font_store_name_pt'=>$r['fonts'][0],
                    'font_product_code_pt'=>$r['fonts'][1],
                    'font_price_pt'=>$r['fonts'][2],
                    'barcode_height_pt'=>$r['fonts'][3],
                ]
            );
        }
    }
}
