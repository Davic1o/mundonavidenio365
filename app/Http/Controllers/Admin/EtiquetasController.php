<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Lote;
use App\Models\LabelPreset;
use App\Models\LabelPreference;
use Illuminate\Http\Request;
use Inertia\Inertia;

class EtiquetasController extends Controller
{
    public function index(Request $request)
    {
        $q         = trim((string) $request->query('q', ''));
        $codigo    = trim((string) $request->query('codigo', ''));
        $provQuery = trim((string) $request->query('proveedor', ''));

        $lotes = Lote::query()
            ->with(['producto:id,nombre,codigo', 'proveedor:id,nombre,ci_o_ruc'])
            ->when($q !== '', fn($qr) => $qr->whereHas('producto', fn($p) => $p->where('nombre','like',"%{$q}%")))
            ->when($codigo !== '', fn($qr) => $qr->whereHas('producto', fn($p) => $p->where('codigo','like',"%{$codigo}%")))
            ->when($provQuery !== '', fn($qr) => $qr->whereHas('proveedor', function ($p) use ($provQuery) {
                $p->where('nombre','like',"%{$provQuery}%")->orWhere('ci_o_ruc','like',"%{$provQuery}%");
            }))
            ->latest('fecha_compra')
            ->paginate(15)
            ->withQueryString();

        // Presets desde BD (agrupados como ya tenías)
        $presets = LabelPreset::activos()
            ->orderBy('per_sheet')
            ->orderBy('paper_size')
            ->get();

        $map = fn(LabelPreset $p) => [
            'slug'       => $p->slug,
            'nombre'     => $p->nombre,
            'per_sheet'  => $p->per_sheet,
            'paper_size' => $p->paper_size,
            'categoria'  => $p->categoria,
            'config'     => $p->toConfig(),
        ];

        $grouped = ['grandes'=>[], 'pequenas'=>[]];
        foreach ($presets as $p) {
            $item = $map($p);
            if ((int)$p->per_sheet === 50)   $grouped['grandes'][$p->paper_size]  = $item;
            if ((int)$p->per_sheet === 100)  $grouped['pequenas'][$p->paper_size] = $item;
        }

        $defaultPresetSlug =
            $grouped['grandes']['letter']['slug']  ??
            $grouped['grandes']['a4']['slug']      ??
            $grouped['pequenas']['letter']['slug'] ??
            $grouped['pequenas']['a4']['slug']     ??
            null;



        // >>> NUEVO: tabla plana con los 4 presets editables (id y todos los campos) <<<
        $presetsTable = LabelPreset::orderByRaw("FIELD(categoria,'grandes','pequenas')")
            ->orderByRaw("FIELD(paper_size,'letter','a4')")
            ->get([
                'id','slug','nombre','categoria','paper_size','per_sheet','is_active',
                'cols','rows',
                'margin_top_mm','margin_right_mm','margin_bottom_mm','margin_left_mm',
                'gap_x_mm','gap_y_mm',
                'label_w_mm','label_h_mm',
                'font_store_name_pt','font_product_code_pt','font_price_pt','barcode_height_pt',
            ]);

        return Inertia::render('Admin/Etiquetas/Index', [
            'lotes'   => $lotes,
            'filtros' => ['q'=>$q, 'codigo'=>$codigo, 'proveedor'=>$provQuery],
            'presets' => $grouped,
            'defaultPresetSlug' => $defaultPresetSlug,
            // <<< añade esto a la vista >>>
            'presetsTable'      => $presetsTable,
        ]);
    }

    // >>> NUEVO: guardar cambios de los 4 presets (misma vista) <<<
    public function presetsUpdate(Request $request)
    {

        foreach ($request->all() as $row) {
        //    dd($row);
            $preset = LabelPreset::find($row['id']);
            $preset->update([
                'nombre' => $row['nombre'],
                'is_active' => (bool)($row['is_active'] ?? false),
                'cols' => (int)$row['cols'],
                'rows' => (int)$row['rows'],
                'margin_top_mm' => (float)$row['margin_top_mm'],
                'margin_right_mm' => (float)$row['margin_right_mm'],
                'margin_bottom_mm' => (float)$row['margin_bottom_mm'],
                'margin_left_mm' => (float)$row['margin_left_mm'],
                'gap_x_mm' => (float)$row['gap_x_mm'],
                'gap_y_mm' => (float)$row['gap_y_mm'],
                'label_w_mm' => $row['label_w_mm'] !== '' ? (float)$row['label_w_mm'] : null,
                'label_h_mm' => $row['label_h_mm'] !== '' ? (float)$row['label_h_mm'] : null,
                'font_store_name_pt' => (float)$row['font_store_name_pt'],
                'font_product_code_pt' => (float)$row['font_product_code_pt'],
                'font_price_pt' => (float)$row['font_price_pt'],
                'barcode_height_pt' => (float)$row['barcode_height_pt'],
            ]);
        }

        return back()->with('success','Presets actualizados correctamente.');
    }
}
