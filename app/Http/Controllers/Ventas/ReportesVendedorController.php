<?php

namespace App\Http\Controllers\Ventas;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Barryvdh\DomPDF\Facade\Pdf;

class ReportesVendedorController extends Controller
{
    /** Vista Inertia */
    public function index(Request $r)
    {
        [$desde, $hasta] = $this->fechas($r->input('desde'), $r->input('hasta'));
        $estado = $r->input('estado', 'autorizado');

        [$rows, $totales] = $this->construirFilas($desde, $hasta, $estado);

        return Inertia::render('Ventas/Reportes/Ventas', [
            'rows'    => $rows,
            'totales' => $totales,
            'filtros' => compact('desde','hasta','estado'),
        ]);
    }

    /** Export CSV */
    public function exportCsv(Request $r)
    {
        [$desde, $hasta] = $this->fechas($r->input('desde'), $r->input('hasta'));
        $estado = $r->input('estado', 'autorizado');
        [$rows, $totales] = $this->construirFilas($desde, $hasta, $estado);

        $filename = 'reporte_pagos_'.now()->format('Ymd_His').'.csv';
        $headers = [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"$filename\"",
        ];
        $columns = [
            'Fecha','N° Venta','Forma de pago','Valor del pago',
            'Subtotal (pago)','IVA (pago)','Total (pago)',
            'Subtotal (venta)','IVA (venta)','Total (venta)',
            'Comisión','Vendedor'
        ];

        return response()->stream(function () use ($rows, $totales, $columns) {
            $out = fopen('php://output', 'w');
            fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF)); // BOM UTF-8

            // Totales por filas (pagos)
            fputcsv($out, ['TOTALES (sumando filas/pagos)']);
            fputcsv($out, ['Subtotal (pagos)','IVA (pagos)','Total (pagos)','Comisión']);
            fputcsv($out, [
                number_format($totales['subtotal_pagos'], 2, '.', ''),
                number_format($totales['iva_pagos'],       2, '.', ''),
                number_format($totales['total_pagos'],     2, '.', ''),
                number_format($totales['comision'],        2, '.', ''),
            ]);
            // Referencia por ventas únicas (no duplicadas)
            fputcsv($out, []);
            fputcsv($out, ['REFERENCIA (único por venta)']);
            fputcsv($out, ['Subtotal (ventas)','IVA (ventas)','Total (ventas)']);
            fputcsv($out, [
                number_format($totales['subtotal_ventas'], 2, '.', ''),
                number_format($totales['iva_ventas'],       2, '.', ''),
                number_format($totales['total_ventas'],     2, '.', ''),
            ]);
            fputcsv($out, []);

            // Detalle
            fputcsv($out, $columns);
            foreach ($rows as $r) {
                fputcsv($out, [
                    $r['fecha'], $r['numero'], $r['forma_pago'],
                    number_format($r['valor_pago'], 2, '.', ''),
                    number_format($r['subtotal_pago'], 2, '.', ''),
                    number_format($r['iva_pago'], 2, '.', ''),
                    number_format($r['total_pago'], 2, '.', ''),
                    number_format($r['subtotal_venta'], 2, '.', ''),
                    number_format($r['iva_venta'], 2, '.', ''),
                    number_format($r['total_venta'], 2, '.', ''),
                    number_format($r['comision'], 2, '.', ''),
                    $r['vendedor'],
                ]);
            }
            fclose($out);
        }, 200, $headers);
    }

    /** Export PDF (HTML inline) */
    public function exportPdf(Request $r)
    {
        [$desde, $hasta] = $this->fechas($r->input('desde'), $r->input('hasta'));
        $estado = $r->input('estado', 'autorizado');
        [$rows, $totales] = $this->construirFilas($desde, $hasta, $estado);

        $html = $this->renderHTML($rows, $totales, ['desde'=>$desde,'hasta'=>$hasta,'estado'=>$estado]);
        $pdf  = Pdf::loadHTML($html)->setPaper('a4', 'landscape'); // landscape por el ancho

        return $pdf->download('reporte_pagos_'.now()->format('Ymd_His').'.pdf');
    }

    /* ========================= LÓGICA ========================= */

    private function fechas(?string $desde, ?string $hasta): array
    {
        $desde = $desde ?: now()->toDateString();
        $hasta = $hasta ?: now()->toDateString();
        return [$desde, $hasta];
    }

    private function formateaNumeroVenta($estab, $pto, $secu): string
    {
        return sprintf('%s-%s-%09d', (string)$estab, (string)$pto, (int)$secu);
    }

    /** ¿Pago de tarjeta? por código SRI o por nombre */
    private function esTarjeta(?string $codigo, ?string $nombre): bool
    {
        $c = trim((string)$codigo);
        if (in_array($c, ['19','20'], true)) return true; // 19=Crédito, 20=Débito

        $n = mb_strtolower((string)$nombre, 'UTF-8');
        $n = strtr($n, ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u']);
        return str_contains($n,'tarjeta') || str_contains($n,'credito') || str_contains($n,'debito')
            || str_contains($n,'visa') || str_contains($n,'mastercard') || str_contains($n,'american');
    }

    /**
     * Filas: UNA por CADA pago
     * + prorrateo de subtotal/IVA/total según (valor_pago / total_venta)
     */
    private function construirFilas(string $desde, string $hasta, ?string $estado): array
{
    // Usuario logueado
    $user   = auth()->user();
    $userId = $user?->id;
    $vendNombre = $user?->name ?? '—';

    // Si no hay usuario autenticado, no retornes info
    if (!$userId) {
        return [[], [
            'subtotal_pagos'=>0, 'iva_pagos'=>0, 'total_pagos'=>0, 'comision'=>0,
            'subtotal_ventas'=>0, 'iva_ventas'=>0, 'total_ventas'=>0,
        ]];
    }

    // Ventas del rango (incluye bases e IVA) *solo del usuario actual*
    $ventasQ = DB::table('ventas')
        ->select(
            'ventas.id','ventas.fecha','ventas.estab','ventas.pto_emision','ventas.secuencial',
            'ventas.subtotal','ventas.impuesto_15','ventas.impuesto_0','ventas.total','ventas.estado',
            'ventas.creada_por'
        )
        ->whereDate('ventas.fecha', '>=', $desde)
        ->whereDate('ventas.fecha', '<=', $hasta)
        ->where('ventas.creada_por', $userId);   // <- filtro por vendedor actual

    if ($estado !== null && $estado !== '') {
        $ventasQ->where('ventas.estado', $estado); // califica la columna
    }

    $ventas = $ventasQ->orderBy('ventas.fecha')->get();
    if ($ventas->isEmpty()) {
        return [[], [
            'subtotal_pagos'=>0, 'iva_pagos'=>0, 'total_pagos'=>0, 'comision'=>0,
            'subtotal_ventas'=>0, 'iva_ventas'=>0, 'total_ventas'=>0,
        ]];
    }

    $ventaIds = $ventas->pluck('id');

    // Pagos por venta
    $pagos = DB::table('venta_pagos')
        ->select('venta_id','codigo','nombre','valor')
        ->whereIn('venta_id', $ventaIds)
        ->get()
        ->groupBy('venta_id');

    // Tarjetas por venta (comisión real)
    $tarjetas = DB::table('venta_tarjetas')
        ->select('venta_id','monto','comision')
        ->whereIn('venta_id', $ventaIds)
        ->get()
        ->groupBy('venta_id');

    $rows = [];
    $sumSubPagos = $sumIvaPagos = $sumTotPagos = $sumComision = 0.0;
    $sumSubVentas = $sumIvaVentas = $sumTotVentas = 0.0;

    foreach ($ventas as $v) {
        $vid         = $v->id;
        $fechaStr    = \Carbon\Carbon::parse($v->fecha)->format('Y-m-d');
        $numero      = $this->formateaNumeroVenta($v->estab, $v->pto_emision, $v->secuencial);
        $subtotalV   = (float)$v->subtotal;
        $ivaV        = (float)$v->impuesto_15 + (float)$v->impuesto_0;
        $totalV      = max(0.0, (float)$v->total);

        $sumSubVentas += $subtotalV;
        $sumIvaVentas += $ivaV;
        $sumTotVentas += $totalV;

        $pagosVenta    = $pagos->get($vid, collect());
        $tarjetasVenta = $tarjetas->get($vid, collect());

        $sumComTarj = 0.0;
        $sumMonTarj = 0.0;
        foreach ($tarjetasVenta as $t) {
            $sumComTarj += (float)$t->comision;
            $sumMonTarj += (float)$t->monto;
        }

        $sumValorPagosTarjeta = 0.0;
        foreach ($pagosVenta as $p) {
            if ($this->esTarjeta($p->codigo, $p->nombre)) {
                $sumValorPagosTarjeta += (float)$p->valor;
            }
        }

        if ($pagosVenta->isEmpty()) {
            $rows[] = [
                'fecha'          => $fechaStr,
                'numero'         => $numero,
                'forma_pago'     => 'SIN REGISTRO',
                'valor_pago'     => 0.00,
                'subtotal_pago'  => 0.00,
                'iva_pago'       => 0.00,
                'total_pago'     => 0.00,
                'subtotal_venta' => round($subtotalV, 2),
                'iva_venta'      => round($ivaV, 2),
                'total_venta'    => round($totalV, 2),
                'comision'       => 0.00,
                'vendedor'       => $vendNombre,   // <- vendedor = usuario actual
            ];
            continue;
        }

        foreach ($pagosVenta as $p) {
            $valorPago = max(0.0, (float)$p->valor);
            $factor    = ($totalV > 0) ? min(1.0, $valorPago / $totalV) : 0.0;

            $subPago = round($subtotalV * $factor, 2);
            $ivaPago = round($ivaV * $factor, 2);
            $totPago = round($valorPago, 2);

            $rowComision = 0.0;
            if ($this->esTarjeta($p->codigo, $p->nombre)) {
                if ($sumComTarj > 0) {
                    $divisor = $sumValorPagosTarjeta > 0 ? $sumValorPagosTarjeta : ($sumMonTarj > 0 ? $sumMonTarj : 0.0);
                    if ($divisor > 0) {
                        $rowComision = round($sumComTarj * ($valorPago / $divisor), 2);
                    }
                }
            }

            $rows[] = [
                'fecha'          => $fechaStr,
                'numero'         => $numero,
                'forma_pago'     => strtoupper((string)$p->nombre),
                'valor_pago'     => $totPago,
                'subtotal_pago'  => $subPago,
                'iva_pago'       => $ivaPago,
                'total_pago'     => $totPago,
                'subtotal_venta' => round($subtotalV, 2),
                'iva_venta'      => round($ivaV, 2),
                'total_venta'    => round($totalV, 2),
                'comision'       => $rowComision,
                'vendedor'       => $vendNombre,   // <- vendedor = usuario actual
            ];

            $sumSubPagos += $subPago;
            $sumIvaPagos += $ivaPago;
            $sumTotPagos += $totPago;
            $sumComision += $rowComision;
        }
    }

    usort($rows, fn($a,$b)=>[$a['fecha'],$a['numero'],$a['vendedor'],$a['forma_pago']]
        <=> [$b['fecha'],$b['numero'],$b['vendedor'],$b['forma_pago']]);

    $totales = [
        'subtotal_pagos' => round($sumSubPagos, 2),
        'iva_pagos'      => round($sumIvaPagos, 2),
        'total_pagos'    => round($sumTotPagos, 2),
        'comision'       => round($sumComision, 2),
        'subtotal_ventas'=> round($sumSubVentas, 2),
        'iva_ventas'     => round($sumIvaVentas, 2),
        'total_ventas'   => round($sumTotVentas, 2),
    ];

    return [$rows, $totales];
}


    /** HTML para PDF (landscape por ancho) */
    private function renderHTML(array $rows, array $tot, array $f): string
    {
        $style = 'table{width:100%;border-collapse:collapse;font-size:11px}
          th,td{border:1px solid #ccc;padding:6px}
          th{text-align:center;background:#f6f6f6}
          td:nth-child(1),td:nth-child(2),td:nth-child(3),td:nth-child(12){text-align:left}
          td{text-align:right}
          h1,h3{margin:0 0 8px 0}
          .tot td{padding:4px 8px;border:none;}';

        $head  = "<tr>
    <th>Fecha</th><th>N° Venta</th><th>Forma de pago</th>
    <th>Valor del pago</th><th>Subtotal (pago)</th><th>IVA (pago)</th><th>Total (pago)</th>
    <th>Subtotal (venta)</th><th>IVA (venta)</th><th>Total (venta)</th>
    <th>Comisión</th><th>Vendedor</th>
</tr>";

        $trs   = '';
        foreach ($rows as $r) {
     $trs .= "<tr>
    <td>{$r['fecha']}</td>
    <td>{$r['numero']}</td>
    <td>{$r['forma_pago']}</td>
    <td>".number_format($r['valor_pago'],2,'.','')."</td>
    <td>".number_format($r['subtotal_pago'],2,'.','')."</td>
    <td>".number_format($r['iva_pago'],2,'.','')."</td>
    <td>".number_format($r['total_pago'],2,'.','')."</td>
    <td>".number_format($r['subtotal_venta'],2,'.','')."</td>
    <td>".number_format($r['iva_venta'],2,'.','')."</td>
    <td>".number_format($r['total_venta'],2,'.','')."</td>
    <td>".number_format($r['comision'],2,'.','')."</td>
    <td>{$r['vendedor']}</td>
</tr>";

        }
        $totPagos = "<table class='tot' style='margin-bottom:6px'><tr>
            <td><strong>Subtotal (pagos):</strong> ".number_format($tot['subtotal_pagos'],2,'.','')."</td>
            <td><strong>IVA (pagos):</strong> ".number_format($tot['iva_pagos'],2,'.','')."</td>
            <td><strong>Total (pagos):</strong> ".number_format($tot['total_pagos'],2,'.','')."</td>
            <td><strong>Comisión:</strong> ".number_format($tot['comision'],2,'.','')."</td>
        </tr></table>";
        $totVentas = "<table class='tot' style='margin-bottom:12px'><tr>
            <td><em>Subtotal (ventas únicas):</em> ".number_format($tot['subtotal_ventas'],2,'.','')."</td>
            <td><em>IVA (ventas únicas):</em> ".number_format($tot['iva_ventas'],2,'.','')."</td>
            <td><em>Total (ventas únicas):</em> ".number_format($tot['total_ventas'],2,'.','')."</td>
        </tr></table>";

        return "<html><head><meta charset='utf-8'><style>$style</style></head><body>
            <h1>Reporte de Pagos por Venta</h1>
            <h3>Rango: {$f['desde']} a {$f['hasta']} — Estado: ".($f['estado'] ?: 'TODOS')."</h3>
            $totPagos
            $totVentas
            <table><thead>$head</thead><tbody>$trs</tbody></table>
        </body></html>";
    }
}
