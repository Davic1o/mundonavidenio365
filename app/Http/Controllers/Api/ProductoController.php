<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Producto;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class ProductoController extends Controller
{
    /**
     * GET /api/productos
     * Listar productos detallados paginados (o todos con ?all=1), con sus lotes y precio de compra neto.
     */
    public function index(Request $request)
    {
        $query = Producto::with(['lotes' => function($q) {
            $q->orderBy('id', 'desc');
        }]);

        // Filtrar productos con stock disponible
        if ($request->boolean('disponibles')) {
            $query->where('cantidad_total', '>', 0);
        }

        // Búsqueda por nombre o código de etiqueta
        if ($request->filled('q')) {
            $q = trim((string)$request->input('q'));
            $query->where(function ($b) use ($q) {
                $b->where('nombre', 'like', "%{$q}%")
                  ->orWhere('codigo', 'like', "%{$q}%");
            });
        }

        $transformProduct = function ($p) {
            $lote = $p->lotes->first();
            $precioBase = $lote ? (float)$lote->precio_compra : 0.0;
            $gastosPct  = $lote ? (float)$lote->costo_general : 0.0;
            $factor1Pct = $lote ? (float)$lote->costo_transporte : 0.0;

            $gastosMonto = $precioBase * ($gastosPct / 100);
            $costoTotalProd = $precioBase + $gastosMonto;
            $factor1Monto = $costoTotalProd * ($factor1Pct / 100);
            $precioCompraNeto = round($costoTotalProd + $factor1Monto, 2);

            return [
                'id'                 => $p->id,
                'nombre'             => $p->nombre,
                'codigo'             => $p->codigo,
                'cantidad_total'     => (int)$p->cantidad_total,
                'precio_compra_base' => $precioBase,
                'gastos_pct'         => $gastosPct,
                'factor1_pct'        => $factor1Pct,
                'precio_compra_neto' => $precioCompraNeto,
                'pvp_final'          => $lote ? (float)$lote->precio_compra_final : 0.0,
                'created_at'         => $p->created_at,
                'updated_at'         => $p->updated_at,
                'lotes'              => $p->lotes,
            ];
        };

        // Si la petición requiere explícitamente sin paginación (?all=true)
        if ($request->boolean('all')) {
            $productos = $query->orderBy('nombre', 'asc')->get()->map($transformProduct);
            return response()->json([
                'success' => true,
                'data'    => $productos
            ]);
        }

        // Paginación por defecto (15 por página o ?per_page=)
        $perPage = (int) $request->input('per_page', 15);
        $paginador = $query->orderBy('nombre', 'asc')->paginate($perPage);

        $paginador->getCollection()->transform($transformProduct);

        return response()->json([
            'success' => true,
            'data'    => $paginador
        ]);
    }

    /**
     * GET /api/productos/{id}
     * Obtener el detalle de un producto específico con sus lotes y precio neto.
     */
    public function show($id)
    {
        $p = Producto::with(['lotes' => function($q) {
            $q->orderBy('id', 'desc');
        }])->find($id);

        if (!$p) {
            return response()->json([
                'success' => false,
                'message' => 'Producto no encontrado'
            ], 404);
        }

        $lote = $p->lotes->first();
        $precioBase = $lote ? (float)$lote->precio_compra : 0.0;
        $gastosPct  = $lote ? (float)$lote->costo_general : 0.0;
        $factor1Pct = $lote ? (float)$lote->costo_transporte : 0.0;

        $gastosMonto = $precioBase * ($gastosPct / 100);
        $costoTotalProd = $precioBase + $gastosMonto;
        $factor1Monto = $costoTotalProd * ($factor1Pct / 100);
        $precioCompraNeto = round($costoTotalProd + $factor1Monto, 2);

        $data = [
            'id'                 => $p->id,
            'nombre'             => $p->nombre,
            'codigo'             => $p->codigo,
            'cantidad_total'     => (int)$p->cantidad_total,
            'precio_compra_base' => $precioBase,
            'gastos_pct'         => $gastosPct,
            'factor1_pct'        => $factor1Pct,
            'precio_compra_neto' => $precioCompraNeto,
            'pvp_final'          => $lote ? (float)$lote->precio_compra_final : 0.0,
            'created_at'         => $p->created_at,
            'updated_at'         => $p->updated_at,
            'lotes'              => $p->lotes,
        ];

        return response()->json([
            'success' => true,
            'data'    => $data
        ]);
    }

    /**
     * POST / PATCH /api/productos/{id}/disminuir-stock
     * Disminuir únicamente el stock (cantidad) de un producto.
     */
    public function disminuirStock(Request $request, $id)
    {
        $producto = Producto::find($id);

        if (!$producto) {
            return response()->json([
                'success' => false,
                'message' => 'Producto no encontrado'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'cantidad' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors'  => $validator->errors()
            ], 422);
        }

        $cantidadADisminuir = (int)$request->input('cantidad');

        if ($producto->cantidad_total < $cantidadADisminuir) {
            return response()->json([
                'success' => false,
                'message' => "Stock insuficiente. Disponibles: {$producto->cantidad_total}, Solicitados a disminuir: {$cantidadADisminuir}"
            ], 400);
        }

        DB::transaction(function () use ($producto, $cantidadADisminuir) {
            $producto->decrement('cantidad_total', $cantidadADisminuir);
        });

        $producto->refresh();

        return response()->json([
            'success' => true,
            'message' => "Stock disminuido exitosamente en {$cantidadADisminuir} unidad(es)",
            'data'    => [
                'id'             => $producto->id,
                'nombre'         => $producto->nombre,
                'codigo'         => $producto->codigo,
                'cantidad_total' => (int)$producto->cantidad_total,
                'disminuido'     => $cantidadADisminuir,
            ]
        ]);
    }
}
