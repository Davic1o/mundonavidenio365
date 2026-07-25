<?php

namespace App\Http\Controllers\Ventas;

use App\Http\Controllers\Controller;
use App\Models\Lote;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ProductosController extends Controller
{
       public function index(Request $request)
    {
        $q         = trim($request->string('q')->toString());
        $codigo    = trim($request->string('codigo')->toString());
        $provQuery = trim($request->string('proveedor')->toString());

        $lotes = Lote::query()
            ->with(['producto:id,nombre,codigo,cantidad_total', 'proveedor:id,nombre,ci_o_ruc'])
            ->when($q !== '', function ($qr) use ($q) {
                $qr->whereHas('producto', function ($p) use ($q) {
                    $p->where('nombre', 'like', "%{$q}%");
                });
            })
            ->when($codigo !== '', function ($qr) use ($codigo) {
                $qr->whereHas('producto', function ($p) use ($codigo) {
                    $p->where('codigo', 'like', "%{$codigo}%");
                });
            })
            ->when($provQuery !== '', function ($qr) use ($provQuery) {
                $qr->whereHas('proveedor', function ($p) use ($provQuery) {
                    $p->where('nombre', 'like', "%{$provQuery}%")
                      ->orWhere('ci_o_ruc', 'like', "%{$provQuery}%");
                });
            })
            ->latest('fecha_compra')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Ventas/Compras/Index', [
            'lotes' => $lotes,
            'filtros' => [
                'q' => $q,
                'codigo' => $codigo,
                'proveedor' => $provQuery,
            ],
        ]);
    }

}
