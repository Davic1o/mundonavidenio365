<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Carbon\Carbon;

class DashboardController extends Controller
{
    public function index(Request $request)
    {
        // -------- Helpers de esquema --------
        $hasVentas         = Schema::hasTable('ventas');
        $hasDetalles       = Schema::hasTable('venta_detalles') || Schema::hasTable('ventas_detalles');
        $detallesTable     = Schema::hasTable('venta_detalles') ? 'venta_detalles' : (Schema::hasTable('ventas_detalles') ? 'ventas_detalles' : null);
        $hasVentasTotal    = $hasVentas && Schema::hasColumn('ventas', 'total');
        $hasVentasEstado   = $hasVentas && Schema::hasColumn('ventas', 'estado');
        $hasProductos      = Schema::hasTable('productos');
        $hasProdDeleted    = $hasProductos && Schema::hasColumn('productos','deleted_at');
        $hasProdStock      = $hasProductos && Schema::hasColumn('productos','stock');
        $hasLotes          = Schema::hasTable('lotes');
        $hasLoteCantidad   = $hasLotes && Schema::hasColumn('lotes','cantidad');
        $hasLoteFecha      = $hasLotes && Schema::hasColumn('lotes','fecha_compra');
        $hasClientes       = Schema::hasTable('clientes');
        $hasVendedor       = $hasVentas && Schema::hasColumn('ventas','user_id');

        // -------- Ventas por mes/año --------
        // Si existe ventas.total lo usamos; si no, calculamos desde detalles.
        if ($hasVentas && $hasVentasTotal) {
            $ventasMensuales = DB::table('ventas')
                ->when($hasVentasEstado, fn($q) => $q->where('estado', '!=', 'anulada'))
                ->selectRaw('YEAR(created_at) as anio, MONTH(created_at) as mes, COUNT(*) as num_ventas, SUM(total) as monto_total')
                ->groupByRaw('YEAR(created_at), MONTH(created_at)')
                ->orderByRaw('anio, mes')
                ->get();
        } elseif ($hasVentas && $hasDetalles && $detallesTable) {
            // Columns comunes en detalles: cantidad, precio_unitario, descuento, iva
            $ventasMensuales = DB::table($detallesTable.' as d')
                ->join('ventas as v', 'v.id', '=', 'd.venta_id')
                ->when($hasVentasEstado, fn($q) => $q->where('v.estado', '!=', 'anulada'))
                ->selectRaw('YEAR(v.created_at) as anio, MONTH(v.created_at) as mes, COUNT(DISTINCT v.id) as num_ventas,
                             SUM( (COALESCE(d.cantidad,1) * COALESCE(d.precio_unitario,0))
                                  - COALESCE(d.descuento,0)
                                  + COALESCE(d.iva,0) ) as monto_total')
                ->groupByRaw('YEAR(v.created_at), MONTH(v.created_at)')
                ->orderByRaw('anio, mes')
                ->get();
        } else {
            $ventasMensuales = collect([]);
        }

        // -------- Totales globales + ticket promedio --------
        $totVentas = (int) ($ventasMensuales->sum('num_ventas') ?? 0);
        $totMonto  = (float) ($ventasMensuales->sum('monto_total') ?? 0);
        $ticketPromedio = $totVentas > 0 ? round($totMonto / $totVentas, 2) : 0.0;

        // -------- Crecimiento intermensual (últimos 12 meses) --------
        $serieOrdenada = $ventasMensuales
            ->map(fn($r) => [
                'key'   => sprintf('%04d-%02d', $r->anio, $r->mes),
                'anio'  => (int)$r->anio,
                'mes'   => (int)$r->mes,
                'monto' => (float)$r->monto_total,
                'ventas'=> (int)$r->num_ventas,
            ])
            ->sortBy('key')
            ->values();

        $serie12 = $serieOrdenada->slice(-12)->values();
        $mom = [];
        for ($i = 1; $i < $serie12->count(); $i++) {
            $prev = $serie12[$i-1]['monto'];
            $curr = $serie12[$i]['monto'];
            $mom[] = [
                'anio'          => $serie12[$i]['anio'],
                'mes'           => $serie12[$i]['mes'],
                'monto'         => $curr,
                'delta_abs'     => round($curr - $prev, 2),
                'delta_pct'     => $prev > 0 ? round(100 * ($curr - $prev) / $prev, 2) : null,
            ];
        }

        // -------- Productos ingresados --------
        // 1) Nuevos productos creados por mes/año
        $productosIngresados = $hasProductos
            ? DB::table('productos')
                ->when($hasProdDeleted, fn($q) => $q->whereNull('deleted_at'))
                ->selectRaw('YEAR(created_at) as anio, MONTH(created_at) as mes, COUNT(*) as productos_creados')
                ->groupByRaw('YEAR(created_at), MONTH(created_at)')
                ->orderByRaw('anio, mes')
                ->get()
            : collect([]);

        // 2) Unidades ingresadas por lotes (si existen)
        $unidadesPorLote = ($hasLotes && $hasLoteCantidad)
            ? DB::table('lotes')
                ->selectRaw(
                    ($hasLoteFecha ? 'YEAR(fecha_compra) as anio, MONTH(fecha_compra) as mes' : 'YEAR(created_at) as anio, MONTH(created_at) as mes')
                    .' , SUM(COALESCE(cantidad,0)) as unidades_ingresadas'
                )
                ->groupByRaw($hasLoteFecha ? 'YEAR(fecha_compra), MONTH(fecha_compra)' : 'YEAR(created_at), MONTH(created_at)')
                ->orderByRaw('anio, mes')
                ->get()
            : collect([]);

        // -------- Inventario y conteos --------
        $totalProductos = $hasProductos
            ? DB::table('productos')->when($hasProdDeleted, fn($q) => $q->whereNull('deleted_at'))->count()
            : 0;

        $stockActual = 0;
        if ($hasProdStock) {
            $stockActual = (int) DB::table('productos')
                ->when($hasProdDeleted, fn($q) => $q->whereNull('deleted_at'))
                ->sum('stock');
        } elseif ($hasLotes && Schema::hasColumn('lotes','stock_disponible')) {
            $stockActual = (int) DB::table('lotes')->sum('stock_disponible');
        }

        // -------- Top productos (últimos 90 días) --------
        $topProductos = [];
        if ($hasDetalles && $detallesTable) {
            $desde = Carbon::now()->subDays(90)->startOfDay()->toDateTimeString();
            $topProductos = DB::table($detallesTable.' as d')
                ->join('ventas as v', 'v.id', '=', 'd.venta_id')
                ->when($hasVentasEstado, fn($q) => $q->where('v.estado','!=','anulada'))
                ->when($hasProductos && Schema::hasColumn('productos','id'),
                    fn($q) => $q->leftJoin('productos as p', 'p.id', '=', 'd.producto_id'))
                ->where('v.created_at', '>=', $desde)
                ->selectRaw('COALESCE(p.nombre, d.producto_nombre, CONCAT("Prod #", d.producto_id)) as producto,
                             SUM(COALESCE(d.cantidad,1)) as unidades,
                             SUM(COALESCE(d.cantidad,1) * COALESCE(d.precio_unitario,0)) as ingreso_bruto')
                ->groupBy('producto')
                ->orderByDesc('unidades')
                ->limit(10)
                ->get();
        }

        // -------- Top clientes (si existe tabla clientes y ventas.cliente_id) --------
        $topClientes = [];
        if ($hasClientes && $hasVentas && Schema::hasColumn('ventas','cliente_id')) {
            $topClientes = DB::table('ventas as v')
                ->join('clientes as c', 'c.id', '=', 'v.cliente_id')
                ->when($hasVentasEstado, fn($q) => $q->where('v.estado','!=','anulada'))
                ->selectRaw('COALESCE( c.nombres, CONCAT("Cliente #", c.id)) as cliente,
                             COUNT(*) as compras,
                             SUM(COALESCE(v.total,0)) as monto')
                ->groupBy('cliente')
                ->orderByDesc('monto')
                ->limit(10)
                ->get();
        }

        // -------- Rendimiento por vendedor (si ventas.user_id) --------
        $porVendedor = [];
        if ($hasVentas && $hasVendedor) {
            $porVendedor = DB::table('ventas as v')
                ->leftJoin('users as u', 'u.id', '=', 'v.user_id')
                ->when($hasVentasEstado, fn($q) => $q->where('v.estado','!=','anulada'))
                ->selectRaw('COALESCE(u.name, CONCAT("Usuario #", v.user_id)) as vendedor,
                             COUNT(*) as ventas,
                             SUM(COALESCE(v.total,0)) as monto')
                ->groupBy('vendedor')
                ->orderByDesc('monto')
                ->limit(10)
                ->get();
        }

        // -------- KPI rápidos --------
        $hoyInicio   = Carbon::today()->startOfDay();
        $mesInicio   = Carbon::now()->startOfMonth();
        $hoyVentas   = $hasVentas ? DB::table('ventas')
                                ->when($hasVentasEstado, fn($q) => $q->where('estado','!=','anulada'))
                                ->where('created_at', '>=', $hoyInicio)
                                ->count() : 0;
        $hoyMonto    = $hasVentas && $hasVentasTotal
                        ? (float) DB::table('ventas')
                                ->when($hasVentasEstado, fn($q) => $q->where('estado','!=','anulada'))
                                ->where('created_at', '>=', $hoyInicio)
                                ->sum('total')
                        : 0.0;
        $mesMonto    = $hasVentas && $hasVentasTotal
                        ? (float) DB::table('ventas')
                                ->when($hasVentasEstado, fn($q) => $q->where('estado','!=','anulada'))
                                ->where('created_at', '>=', $mesInicio)
                                ->sum('total')
                        : ($serieOrdenada->last()['monto'] ?? 0.0);

        // -------- Respuesta --------
        return Inertia::render('Admin/Dashboard', [
            'metrics' => [
                'ventas_mensuales'     => $ventasMensuales,
                'serie_12m'            => $serie12,
                'crecimiento_mom'      => $mom,
                'total_ventas'         => $totVentas,
                'monto_total'          => round($totMonto, 2),
                'ticket_promedio'      => $ticketPromedio,
                'productos_creados'    => $productosIngresados,
                'unidades_por_lote'    => $unidadesPorLote,
                'total_productos'      => (int)$totalProductos,
                'stock_actual'         => (int)$stockActual,
                'top_productos'        => $topProductos,
                'top_clientes'         => $topClientes,
                'por_vendedor'         => $porVendedor,
                'hoy_ventas'           => (int)$hoyVentas,
                'hoy_monto'            => round($hoyMonto, 2),
                'mes_monto'            => round($mesMonto, 2),
            ],
        ]);
    }
}
