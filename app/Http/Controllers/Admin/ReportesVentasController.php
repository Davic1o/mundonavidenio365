<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Barryvdh\DomPDF\Facade\Pdf;

class ReportesVentasController extends Controller
{
    /** Vista Inertia */
    public function index(Request $r)
    {
        [$desde, $hasta] = $this->fechas($r->input('desde'), $r->input('hasta'));
        $estado = $r->input('estado');
        if ($estado === '' || strtolower((string)$estado) === 'todos') {
            $estado = null;
        } elseif ($estado === null && !$r->has('desde') && !$r->has('forma_pago')) {
            $estado = 'autorizado';
        }
        $formaPago = trim((string)($r->input('forma_pago') ?? $r->input('formaPago') ?? ''));

        [$rows, $totales] = $this->construirFilas($desde, $hasta, $estado, $formaPago);

        return Inertia::render('Admin/Reportes/Ventas', [
            'rows'    => $rows,
            'totales' => $totales,
            'filtros' => [
                'desde'     => $desde,
                'hasta'     => $hasta,
                'estado'    => $estado ?? '',
                'formaPago' => $formaPago,
            ],
        ]);
    }

    /** Export EXCEL (.xls) */
    public function exportExcel(Request $r)
    {
        [$desde, $hasta] = $this->fechas($r->input('desde'), $r->input('hasta'));
        $estado = $r->input('estado');
        if ($estado === '' || strtolower((string)$estado) === 'todos') {
            $estado = null;
        } elseif ($estado === null && !$r->has('desde') && !$r->has('forma_pago')) {
            $estado = 'autorizado';
        }
        $formaPago = trim((string)($r->input('forma_pago') ?? $r->input('formaPago') ?? ''));
        [$rows, $totales] = $this->construirFilas($desde, $hasta, $estado, $formaPago);

        $filename = 'reporte_pagos_'.now()->format('Ymd_His').'.xls';
        $html = $this->renderExcelHTML($rows, $totales, ['desde'=>$desde,'hasta'=>$hasta,'estado'=>$estado,'formaPago'=>$formaPago]);

        return response($html, 200, [
            'Content-Type'        => 'application/vnd.ms-excel; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"$filename\"",
            'Cache-Control'       => 'max-age=0',
        ]);
    }

    /** Legacy CSV alias -> exportExcel */
    public function exportCsv(Request $r)
    {
        return $this->exportExcel($r);
    }

    /** Export PDF (HTML inline) */
    public function exportPdf(Request $r)
    {
        [$desde, $hasta] = $this->fechas($r->input('desde'), $r->input('hasta'));
        $estado = $r->input('estado');
        if ($estado === '' || strtolower((string)$estado) === 'todos') {
            $estado = null;
        } elseif ($estado === null && !$r->has('desde') && !$r->has('forma_pago')) {
            $estado = 'autorizado';
        }
        $formaPago = trim((string)($r->input('forma_pago') ?? $r->input('formaPago') ?? ''));
        [$rows, $totales] = $this->construirFilas($desde, $hasta, $estado, $formaPago);

        $html = $this->renderHTML($rows, $totales, ['desde'=>$desde,'hasta'=>$hasta,'estado'=>$estado,'formaPago'=>$formaPago]);
        $pdf  = Pdf::loadHTML($html)->setPaper('a4', 'landscape');

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
        if (in_array($c, ['16','18','19'], true)) return true;

        $n = mb_strtolower((string)$nombre, 'UTF-8');
        $n = strtr($n, ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u']);
        return str_contains($n,'tarjeta') || str_contains($n,'credito') || str_contains($n,'debito')
            || str_contains($n,'visa') || str_contains($n,'mastercard') || str_contains($n,'american')
            || str_contains($n,'amex') || str_contains($n,'diners') || str_contains($n,'discover')
            || str_contains($n,'tc') || str_contains($n,'td') || str_contains($n,'tarj')
            || str_contains($n,'datafast') || str_contains($n,'medianet') || str_contains($n,'pacificard')
            || str_contains($n,'payphone');
    }

    /** Categorizar tipo de pago: Efectivo, Transferencia, Tarjeta, Otros */
    private function categorizarFormaPago(?string $codigo, ?string $nombre): string
    {
        $c = trim((string)$codigo);
        $n = mb_strtolower((string)$nombre, 'UTF-8');
        $n = strtr($n, ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u']);

        if ($c === '01' || str_contains($n, 'efectivo')) {
            return 'Efectivo';
        }
        if (in_array($c, ['16','18','19'], true) 
            || str_contains($n, 'tarjeta') || str_contains($n, 'credito') || str_contains($n, 'debito')
            || str_contains($n, 'visa') || str_contains($n, 'mastercard') || str_contains($n, 'amex')
            || str_contains($n, 'american') || str_contains($n, 'diners') || str_contains($n, 'discover')
            || str_contains($n, 'tc') || str_contains($n, 'td') || str_contains($n, 'tarj')
            || str_contains($n, 'datafast') || str_contains($n, 'medianet') || str_contains($n, 'pacificard')
            || str_contains($n, 'payphone')) {
            return 'Tarjeta';
        }
        if (in_array($c, ['17','20'], true) || str_contains($n, 'transfer') || str_contains($n, 'deposito') || str_contains($n, 'banco') || str_contains($n, 'cuenta') || str_contains($n, 'cheque')) {
            return 'Transferencia';
        }
        return 'Otros';
    }

    /** Filas: UNA por CADA pago */
    private function construirFilas(string $desde, string $hasta, ?string $estado, ?string $formaPagoFiltro = null): array
    {
        $ventasQ = DB::table('ventas')
            ->leftJoin('users', 'users.id', '=', 'ventas.creada_por')
            ->select(
                'ventas.id','ventas.fecha','ventas.estab','ventas.pto_emision','ventas.secuencial',
                'ventas.subtotal','ventas.impuesto_15','ventas.impuesto_0','ventas.total','ventas.estado',
                DB::raw("COALESCE(users.name, '—') as vendedor")
            )
            ->whereDate('ventas.fecha','>=',$desde)
            ->whereDate('ventas.fecha','<=',$hasta);

        if ($estado !== null && $estado !== '') {
            $ventasQ->whereRaw('LOWER(ventas.estado) = ?', [strtolower(trim($estado))]);
        }

        $ventas = $ventasQ->orderBy('fecha')->get();
        if ($ventas->isEmpty()) {
            return [[], [
                'total_pagos'=>0, 'pagos_efectivo'=>0, 'pagos_transferencia'=>0, 'pagos_tarjeta'=>0, 'pagos_otros'=>0,
                'subtotal_pagos'=>0, 'iva_pagos'=>0, 'comision'=>0, 'venta_neta'=>0,
                'subtotal_ventas'=>0, 'iva_ventas'=>0, 'total_ventas'=>0,
            ]];
        }

        $ventaIds = $ventas->pluck('id');

        $pagos = DB::table('venta_pagos')
            ->select('venta_id','codigo','nombre','valor')
            ->whereIn('venta_id', $ventaIds)
            ->get()
            ->groupBy('venta_id');

        $tarjetas = collect();
        if (Schema::hasTable('venta_tarjetas')) {
            $tarjetas = DB::table('venta_tarjetas')
                ->select('venta_id','monto','comision','tipo_tarjeta')
                ->whereIn('venta_id', $ventaIds)
                ->get()
                ->groupBy('venta_id');
        }

        $rows = [];
        $sumSubPagos = $sumIvaPagos = $sumTotPagos = $sumComision = 0.0;
        $sumSubVentas = $sumIvaVentas = $sumTotVentas = 0.0;
        $sumEfectivo = $sumTransferencia = $sumTarjeta = $sumOtros = 0.0;

        foreach ($ventas as $v) {
            $vid         = $v->id;
            $fechaStr    = \Carbon\Carbon::parse($v->fecha)->format('Y-m-d');
            $numero      = $this->formateaNumeroVenta($v->estab, $v->pto_emision, $v->secuencial);
            $subtotalV   = (float)$v->subtotal;
            $ivaV        = (float)$v->impuesto_15 + (float)$v->impuesto_0;
            $totalV      = max(0.0, (float)$v->total);

            $pagosVenta    = $pagos->get($vid, collect());
            $tarjetasVenta = $tarjetas->get($vid, collect());

            $sumComTarj = 0.0;
            $sumMonTarj = 0.0;
            foreach ($tarjetasVenta as $t) {
                $sumComTarj += (float)$t->comision;
                $sumMonTarj += (float)$t->monto;
            }

            // Si no hay pagos en venta_pagos pero sí en venta_tarjetas, sintetizamos la fila de pago con tarjeta
            if ($pagosVenta->isEmpty() && $tarjetasVenta->isNotEmpty()) {
                $pagosVenta = $tarjetasVenta->map(function ($t) {
                    $tipo = !empty($t->tipo_tarjeta) ? strtoupper($t->tipo_tarjeta) : 'CRÉDITO';
                    return (object)[
                        'codigo' => '19',
                        'nombre' => 'TARJETA ' . $tipo,
                        'valor'  => (float)$t->monto,
                    ];
                });
            }

            $sumValorPagosTarjeta = 0.0;
            foreach ($pagosVenta as $p) {
                if ($this->esTarjeta($p->codigo, $p->nombre)) {
                    $sumValorPagosTarjeta += (float)$p->valor;
                }
            }

            if ($pagosVenta->isEmpty()) {
                if (empty($formaPagoFiltro)) {
                    $rows[] = [
                        'fecha'          => $fechaStr,
                        'numero'         => $numero,
                        'forma_pago'     => 'SIN REGISTRO',
                        'categoria_pago' => 'Otros',
                        'valor_pago'     => 0.00,
                        'subtotal_pago'  => 0.00,
                        'iva_pago'       => 0.00,
                        'total_pago'     => 0.00,
                        'subtotal_venta' => round($subtotalV, 2),
                        'iva_venta'      => round($ivaV, 2),
                        'total_venta'    => round($totalV, 2),
                        'comision'       => 0.00,
                        'vendedor'       => (string)$v->vendedor,
                    ];
                    $sumSubVentas += $subtotalV;
                    $sumIvaVentas += $ivaV;
                    $sumTotVentas += $totalV;
                }
                continue;
            }

            $matchingRowsForSale = [];
            foreach ($pagosVenta as $p) {
                $valorPago = max(0.0, (float)$p->valor);
                $factor    = ($totalV > 0) ? min(1.0, $valorPago / $totalV) : 0.0;

                $subPago = round($subtotalV * $factor, 2);
                $ivaPago = round($ivaV * $factor, 2);
                $totPago = round($valorPago, 2);

                $nombreForma = strtoupper((string)$p->nombre);
                $categoria = $this->categorizarFormaPago($p->codigo, $p->nombre);

                // Filtro estricto y flexible por forma de pago
                if (!empty($formaPagoFiltro)) {
                    $filtroLow = mb_strtolower(trim($formaPagoFiltro), 'UTF-8');
                    $catLow    = mb_strtolower($categoria, 'UTF-8');
                    $nomLow    = mb_strtolower($nombreForma, 'UTF-8');

                    $matches = false;
                    if ($filtroLow === 'tarjeta') {
                        $matches = ($categoria === 'Tarjeta') || $this->esTarjeta($p->codigo, $p->nombre);
                    } elseif ($filtroLow === 'efectivo') {
                        $matches = ($categoria === 'Efectivo') || str_contains($nomLow, 'efectivo');
                    } elseif ($filtroLow === 'transferencia') {
                        $matches = ($categoria === 'Transferencia') || str_contains($nomLow, 'transfer') || str_contains($nomLow, 'deposito') || str_contains($nomLow, 'banco');
                    } elseif ($filtroLow === 'otros') {
                        $matches = ($categoria === 'Otros');
                    } else {
                        $matches = str_contains($catLow, $filtroLow) || str_contains($nomLow, $filtroLow);
                    }

                    if (!$matches) {
                        continue;
                    }
                }

                $rowComision = 0.0;
                if ($this->esTarjeta($p->codigo, $p->nombre)) {
                    if ($sumComTarj > 0) {
                        $divisor = $sumValorPagosTarjeta > 0 ? $sumValorPagosTarjeta : ($sumMonTarj > 0 ? $sumMonTarj : 0.0);
                        if ($divisor > 0) {
                            $rowComision = round($sumComTarj * ($valorPago / $divisor), 2);
                        }
                    }
                }

                // Acumuladores por forma de pago (solo de los pagos que coinciden con el filtro)
                if ($categoria === 'Efectivo') $sumEfectivo += $totPago;
                elseif ($categoria === 'Transferencia') $sumTransferencia += $totPago;
                elseif ($categoria === 'Tarjeta') $sumTarjeta += $totPago;
                else $sumOtros += $totPago;

                $sumSubPagos += $subPago;
                $sumIvaPagos += $ivaPago;
                $sumTotPagos += $totPago;
                $sumComision += $rowComision;

                $matchingRowsForSale[] = [
                    'fecha'          => $fechaStr,
                    'numero'         => $numero,
                    'forma_pago'     => $nombreForma ?: $categoria,
                    'categoria_pago' => $categoria,
                    'valor_pago'     => $totPago,
                    'subtotal_pago'  => $subPago,
                    'iva_pago'       => $ivaPago,
                    'total_pago'     => $totPago,
                    'subtotal_venta' => round($subtotalV, 2),
                    'iva_venta'      => round($ivaV, 2),
                    'total_venta'    => round($totalV, 2),
                    'comision'       => $rowComision,
                    'vendedor'       => (string)$v->vendedor,
                ];
            }

            if (!empty($matchingRowsForSale)) {
                if (!empty($formaPagoFiltro)) {
                    $mSub = 0.0;
                    $mIva = 0.0;
                    $mTot = 0.0;
                    foreach ($matchingRowsForSale as $mItem) {
                        $mSub += (float)$mItem['subtotal_pago'];
                        $mIva += (float)$mItem['iva_pago'];
                        $mTot += (float)$mItem['total_pago'];
                    }
                    $sumSubVentas += $mSub;
                    $sumIvaVentas += $mIva;
                    $sumTotVentas += $mTot;
                } else {
                    $sumSubVentas += $subtotalV;
                    $sumIvaVentas += $ivaV;
                    $sumTotVentas += $totalV;
                }

                foreach ($matchingRowsForSale as $rowItem) {
                    $rows[] = $rowItem;
                }
            }
        }

        usort($rows, fn($a,$b)=>[$a['fecha'],$a['numero'],$a['vendedor'],$a['forma_pago']]
            <=> [$b['fecha'],$b['numero'],$b['vendedor'],$b['forma_pago']]);

        $totales = [
            'total_pagos'         => round($sumTotPagos, 2),
            'pagos_efectivo'      => round($sumEfectivo, 2),
            'pagos_transferencia' => round($sumTransferencia, 2),
            'pagos_tarjeta'       => round($sumTarjeta, 2),
            'pagos_otros'         => round($sumOtros, 2),
            'subtotal_pagos'      => round($sumSubPagos, 2),
            'iva_pagos'           => round($sumIvaPagos, 2),
            'comision'            => round($sumComision, 2),
            'venta_neta'          => round(max(0, $sumTotPagos - $sumIvaPagos - $sumComision), 2),
            'subtotal_ventas'     => round($sumSubVentas, 2),
            'iva_ventas'          => round($sumIvaVentas, 2),
            'total_ventas'        => round($sumTotVentas, 2),
        ];

        return [$rows, $totales];
    }

    /** Genera HTML estructurado para Excel con formato .xls */
    private function renderExcelHTML(array $rows, array $tot, array $f): string
    {
        $rowsHtml = '';
        foreach ($rows as $i => $r) {
            $bg = ($i % 2 === 0) ? '#ffffff' : '#f8fafc';
            $rowsHtml .= "<tr style='background-color: {$bg};'>
                <td style='border:1px solid #cbd5e1; padding:6px; text-align:left;'>{$r['fecha']}</td>
                <td style='border:1px solid #cbd5e1; padding:6px; text-align:left; font-weight:bold;'>{$r['numero']}</td>
                <td style='border:1px solid #cbd5e1; padding:6px; text-align:left;'>{$r['forma_pago']}</td>
                <td style='border:1px solid #cbd5e1; padding:6px; text-align:right; font-weight:bold;'>$" . number_format($r['valor_pago'], 2, '.', '') . "</td>
                <td style='border:1px solid #cbd5e1; padding:6px; text-align:right;'>$" . number_format($r['subtotal_pago'], 2, '.', '') . "</td>
                <td style='border:1px solid #cbd5e1; padding:6px; text-align:right;'>$" . number_format($r['iva_pago'], 2, '.', '') . "</td>
                <td style='border:1px solid #cbd5e1; padding:6px; text-align:right; font-weight:bold;'>$" . number_format($r['total_pago'], 2, '.', '') . "</td>
                <td style='border:1px solid #cbd5e1; padding:6px; text-align:right;'>$" . number_format($r['subtotal_venta'], 2, '.', '') . "</td>
                <td style='border:1px solid #cbd5e1; padding:6px; text-align:right;'>$" . number_format($r['iva_venta'], 2, '.', '') . "</td>
                <td style='border:1px solid #cbd5e1; padding:6px; text-align:right;'>$" . number_format($r['total_venta'], 2, '.', '') . "</td>
                <td style='border:1px solid #cbd5e1; padding:6px; text-align:right; color:#b45309;'>$" . number_format($r['comision'], 2, '.', '') . "</td>
                <td style='border:1px solid #cbd5e1; padding:6px; text-align:left;'>{$r['vendedor']}</td>
            </tr>";
        }

        return '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<!--[if gte mso 9]>
<xml>
 <x:ExcelWorkbook>
  <x:ExcelWorksheets>
   <x:ExcelWorksheet>
    <x:Name>Reporte de Pagos</x:Name>
    <x:WorksheetOptions>
     <x:DisplayGridlines/>
    </x:WorksheetOptions>
   </x:ExcelWorksheet>
  </x:ExcelWorksheets>
 </x:ExcelWorkbook>
</xml>
<![endif]-->
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; }
  table { border-collapse: collapse; width: 100%; }
  th { background-color: #047857; color: #ffffff; font-weight: bold; border: 1px solid #065f46; padding: 8px; text-align: center; }
  td { border: 1px solid #cbd5e1; padding: 6px; }
  .card-main { background-color: #047857; color: #ffffff; font-size: 14px; font-weight: bold; padding: 10px; text-align: center; }
  .card-neta { background-color: #0284c7; color: #ffffff; font-size: 14px; font-weight: bold; padding: 10px; text-align: center; }
  .card-desglose { background-color: #f8fafc; border: 1px solid #cbd5e1; margin-bottom: 12px; }
  .card-desglose td { padding: 6px 12px; border: 1px solid #cbd5e1; }
</style>
</head>
<body>
  <h2>REPORTE DE PAGOS Y VENTA NETA REAL</h2>
  <p><strong>Rango:</strong> ' . $f['desde'] . ' a ' . $f['hasta'] . ' | <strong>Estado:</strong> ' . ($f['estado'] ?: 'TODOS') . ' | <strong>Forma de pago:</strong> ' . ($f['formaPago'] ?: 'TODAS') . '</p>
  
  <table style="margin-bottom: 12px;">
    <tr>
      <td colspan="6" class="card-main">
        TOTAL PAGOS RECAUDADOS: $' . number_format($tot['total_pagos'] ?? 0, 2, '.', '') . '
      </td>
      <td colspan="6" class="card-neta">
        💰 VENTA NETA REAL (Pagos - IVA - Comisión): $' . number_format($tot['venta_neta'] ?? 0, 2, '.', '') . '
      </td>
    </tr>
  </table>

  <table class="card-desglose">
    <tr style="background-color: #f1f5f9; font-weight: bold;">
      <td colspan="3">💵 Total Efectivo: $' . number_format($tot['pagos_efectivo'] ?? 0, 2, '.', '') . '</td>
      <td colspan="3">🏦 Total Transferencia: $' . number_format($tot['pagos_transferencia'] ?? 0, 2, '.', '') . '</td>
      <td colspan="3">💳 Total Tarjetas: $' . number_format($tot['pagos_tarjeta'] ?? 0, 2, '.', '') . '</td>
      <td colspan="3">🧾 Total Otros: $' . number_format($tot['pagos_otros'] ?? 0, 2, '.', '') . '</td>
    </tr>
    <tr>
      <td colspan="3"><strong>Subtotal Pagos:</strong> $' . number_format($tot['subtotal_pagos'] ?? 0, 2, '.', '') . '</td>
      <td colspan="3"><strong>- IVA (15%):</strong> $' . number_format($tot['iva_pagos'] ?? 0, 2, '.', '') . '</td>
      <td colspan="3"><strong>- Comisión Tarjetas:</strong> $' . number_format($tot['comision'] ?? 0, 2, '.', '') . '</td>
      <td colspan="3" style="background-color:#e0f2fe; color:#0369a1; font-weight:bold;"><strong>= VENTA NETA REAL:</strong> $' . number_format($tot['venta_neta'] ?? 0, 2, '.', '') . '</td>
    </tr>
    <tr style="color: #475569; font-style: italic;">
      <td colspan="12">Referencia (Ventas Únicas): Subtotal $' . number_format($tot['subtotal_ventas'] ?? 0, 2, '.', '') . ' · IVA $' . number_format($tot['iva_ventas'] ?? 0, 2, '.', '') . ' · Total $' . number_format($tot['total_ventas'] ?? 0, 2, '.', '') . '</td>
    </tr>
  </table>

  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th>N° Venta</th>
        <th>Forma de Pago</th>
        <th>Valor Pago</th>
        <th>Subtotal (Pago)</th>
        <th>IVA (Pago)</th>
        <th>Total (Pago)</th>
        <th>Subtotal (Venta)</th>
        <th>IVA (Venta)</th>
        <th>Total (Venta)</th>
        <th>Comisión</th>
        <th>Vendedor</th>
      </tr>
    </thead>
    <tbody>
      ' . $rowsHtml . '
    </tbody>
  </table>
</body>
</html>';
    }

    /** HTML para PDF */
    private function renderHTML(array $rows, array $tot, array $f): string
    {
        $style = 'body{font-family:Arial,sans-serif;margin:15px;color:#1e293b}
          table{width:100%;border-collapse:collapse;font-size:10px}
          th,td{border:1px solid #cbd5e1;padding:4px 6px}
          th{text-align:center;background:#0f172a;color:#ffffff;font-size:10px}
          td:nth-child(1),td:nth-child(2),td:nth-child(3),td:nth-child(12){text-align:left}
          td{text-align:right}
          h1{margin:0 0 4px 0;font-size:16px;color:#0f172a}
          .subtitle{font-size:11px;color:#475569;margin-bottom:12px;border-bottom:2px solid #0f172a;padding-bottom:6px}
          .card-tot{background:#047857;color:#ffffff;padding:8px;border-radius:6px;text-align:center;font-size:13px;font-weight:bold;}
          .card-neta{background:#0284c7;color:#ffffff;padding:8px;border-radius:6px;text-align:center;font-size:13px;font-weight:bold;}
          .card-sub{background:#f8fafc;border:1px solid #cbd5e1;padding:6px;border-radius:6px;margin-bottom:10px;}
          .card-sub td{border:none;padding:3px 6px;font-size:10px;}';

        $head  = "<tr>
    <th>Fecha</th><th>N° Venta</th><th>Forma de pago</th>
    <th>Valor del pago</th><th>Subtotal (pago)</th><th>IVA (pago)</th><th>Total (pago)</th>
    <th>Subtotal (venta)</th><th>IVA (venta)</th><th>Total (venta)</th>
    <th>Comisión</th><th>Vendedor</th>
</tr>";

        $trs   = '';
        if (empty($rows)) {
            $trs = "<tr><td colspan='12' style='text-align:center; padding:15px; color:#64748b;'>No se encontraron registros de ventas para la consulta seleccionada.</td></tr>";
        } else {
            foreach ($rows as $r) {
                $trs .= "<tr>
                    <td>{$r['fecha']}</td>
                    <td style='font-weight:bold;'>{$r['numero']}</td>
                    <td>{$r['forma_pago']}</td>
                    <td>".number_format($r['valor_pago'],2,'.','')."</td>
                    <td>".number_format($r['subtotal_pago'],2,'.','')."</td>
                    <td>".number_format($r['iva_pago'],2,'.','')."</td>
                    <td style='font-weight:bold;'>".number_format($r['total_pago'],2,'.','')."</td>
                    <td>".number_format($r['subtotal_venta'],2,'.','')."</td>
                    <td>".number_format($r['iva_venta'],2,'.','')."</td>
                    <td>".number_format($r['total_venta'],2,'.','')."</td>
                    <td style='color:#b45309;'>".number_format($r['comision'],2,'.','')."</td>
                    <td>{$r['vendedor']}</td>
                </tr>";
            }
        }

        $lblEstado = !empty($f['estado']) ? strtoupper($f['estado']) : 'TODOS';
        $lblForma  = !empty($f['formaPago']) ? strtoupper($f['formaPago']) : 'TODAS LAS FORMAS DE PAGO';

        $totPagosHeader = "<table style='margin-bottom:8px; border:none;'><tr>
            <td class='card-tot' style='width:50%;'>TOTAL PAGOS RECAUDADOS: $" . number_format($tot['total_pagos'] ?? 0, 2, '.', '') . "</td>
            <td class='card-neta' style='width:50%;'>💰 VENTA NETA REAL: $" . number_format($tot['venta_neta'] ?? 0, 2, '.', '') . "</td>
        </tr></table>";

        $totDesglose = "<table class='card-sub'><tr>
            <td>💵 <strong>Efectivo:</strong> $".number_format($tot['pagos_efectivo'] ?? 0, 2, '.', '')."</td>
            <td>🏦 <strong>Transferencia:</strong> $".number_format($tot['pagos_transferencia'] ?? 0, 2, '.', '')."</td>
            <td>💳 <strong>Tarjeta:</strong> $".number_format($tot['pagos_tarjeta'] ?? 0, 2, '.', '')."</td>
            <td>🧾 <strong>Otros:</strong> $".number_format($tot['pagos_otros'] ?? 0, 2, '.', '')."</td>
            <td><strong>- IVA:</strong> $".number_format($tot['iva_pagos'] ?? 0, 2, '.', '')."</td>
            <td><strong>- Comisión:</strong> $".number_format($tot['comision'] ?? 0, 2, '.', '')."</td>
            <td style='color:#0369a1; font-weight:bold;'>= <strong>Venta Neta:</strong> $".number_format($tot['venta_neta'] ?? 0, 2, '.', '')."</td>
        </tr></table>";

        $totVentas = "<div style='font-size:10px; color:#475569; margin-bottom:8px;'>
            <em>Referencia Ventas Filtradas: Subtotal $".number_format($tot['subtotal_ventas'] ?? 0,2,'.','')." · IVA $".number_format($tot['iva_ventas'] ?? 0,2,'.','')." · Total $".number_format($tot['total_ventas'] ?? 0,2,'.','')."</em>
        </div>";

        return "<html><head><meta charset='utf-8'><style>$style</style></head><body>
            <h1>Reporte de Pagos por Venta</h1>
            <div class='subtitle'>
                <strong>Período:</strong> {$f['desde']} al {$f['hasta']} &nbsp;|&nbsp;
                <strong>Estado:</strong> {$lblEstado} &nbsp;|&nbsp;
                <strong>Forma de Pago:</strong> <span style='color:#047857; font-weight:bold;'>{$lblForma}</span>
            </div>
            $totPagosHeader
            $totDesglose
            $totVentas
            <table><thead>$head</thead><tbody>$trs</tbody></table>
        </body></html>";
    }
}
