<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Lote;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;

class ReportesProductosController extends Controller
{
    /** ===================== VISTA INERTIA (PAGINADA) ===================== */
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

        return Inertia::render('Admin/Reportes/Productos', [
            'lotes' => $lotes,
            'filtros' => [
                'q'         => $q,
                'codigo'    => $codigo,
                'proveedor' => $provQuery,
            ],
        ]);
    }

    /** ===================== EXPORT EXCEL (.xls) ===================== */
    public function exportExcel(Request $request)
    {
        $q         = trim($request->string('q')->toString());
        $codigo    = trim($request->string('codigo')->toString());
        $provQuery = trim($request->string('proveedor')->toString());

        $base = $this->baseQuery($q, $codigo, $provQuery);

        $agg = (clone $base)
            ->selectRaw('COALESCE(SUM(cantidad_compra),0) AS cantidad_total')
            ->selectRaw('COALESCE(SUM(cantidad_compra * precio_compra_final),0) AS compra_total')
            ->first();

        $all = $base->get([
            'id','producto_id','proveedor_id','fecha_compra','cantidad_compra','precio_compra','costo_general','costo_transporte','porcentaje_ganancia','precio_compra_final'
        ]);

        $groups = [];
        foreach ($all as $l) {
            $pid = (int) $l->producto_id;
            if (!isset($groups[$pid])) {
                $groups[$pid] = [
                    'rows'   => [],
                    'sumCant'=> 0.0,
                    'stock'  => $l->producto ? (float)$l->producto->cantidad_total : null,
                ];
            }
            $groups[$pid]['rows'][] = $this->rowFromLote($l);
            $groups[$pid]['sumCant'] += (float) ($l->cantidad_compra ?? 0);
            if ($groups[$pid]['stock'] === null && $l->producto) {
                $groups[$pid]['stock'] = (float)$l->producto->cantidad_total;
            }
        }

        $filename = 'reporte_productos_'.now()->format('Ymd_His').'.xls';

        $trs = '';
        foreach ($groups as $g) {
            foreach ($g['rows'] as $r) {
                $trs .= "<tr>
                    <td>{$r['numero']}</td>
                    <td>{$r['codigo_texto']}</td>
                    <td>{$this->esc((string)$r['nombre'])}</td>
                    <td>{$this->esc((string)$r['proveedor'])}</td>
                    <td>{$r['fecha_compra']}</td>
                    <td style='text-align:right'>".number_format((float)$r['precio_compra_base'], 2, '.', '')."</td>
                    <td style='text-align:right'>".number_format((float)$r['gastos_pct'], 2, '.', '')."%</td>
                    <td style='text-align:right'>".number_format((float)$r['factor1_pct'], 2, '.', '')."%</td>
                    <td style='text-align:right; font-weight:bold; background-color:#f0fdf4;'>$".number_format((float)$r['precio_compra_neto'], 2, '.', '')."</td>
                    <td style='text-align:right'>".number_format((float)$r['cantidad'], 2, '.', '')."</td>
                    <td style='text-align:right'>$".number_format((float)$r['precio_final'], 2, '.', '')."</td>
                </tr>";
            }
            $stock    = $g['stock'];
            $vendidas = is_null($stock) ? null : max(0, $g['sumCant'] - (float)$stock);

            $trs .= "<tr style='background-color:#f1f5f9; font-weight:bold;'>
                <td colspan='8'>Vendidas: ". (is_null($vendidas) ? '—' : number_format($vendidas,2,'.','')) ."</td>
                <td colspan='3' style='text-align:right'>Stock Disponible: ". (is_null($stock) ? '—' : number_format($stock,2,'.','')) ."</td>
            </tr>";
        }

        $html = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<!--[if gte mso 9]>
<xml>
 <x:ExcelWorkbook>
  <x:ExcelWorksheets>
   <x:ExcelWorksheet>
    <x:Name>Reporte de Productos</x:Name>
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
</style>
</head>
<body>
  <h2>REPORTE DE PRODUCTOS</h2>
  <table style="margin-bottom: 12px;">
    <tr>
      <td colspan="4" class="card-main">Cantidad Total: ' . number_format((float)$agg->cantidad_total, 2, '.', '') . '</td>
      <td colspan="4" class="card-main">Compra Total: $' . number_format((float)$agg->compra_total, 2, '.', '') . '</td>
    </tr>
  </table>

  <table>
    <thead>
      <tr>
        <th>Número</th>
        <th>Código</th>
        <th>Nombre</th>
        <th>Proveedor</th>
        <th>Fecha de compra</th>
        <th>Cantidad</th>
        <th>Precio final (unit.)</th>
        <th>Compra total</th>
      </tr>
    </thead>
    <tbody>
      ' . $trs . '
    </tbody>
  </table>
</body>
</html>';

        return response($html, 200, [
            'Content-Type'        => 'application/vnd.ms-excel; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"$filename\"",
            'Cache-Control'       => 'max-age=0',
        ]);
    }

    /** Legacy CSV alias -> exportExcel */
    public function exportCsv(Request $request)
    {
        return $this->exportExcel($request);
    }

    /** ===================== EXPORT PDF ===================== */
    public function exportPdf(Request $request)
    {
        $q         = trim($request->string('q')->toString());
        $codigo    = trim($request->string('codigo')->toString());
        $provQuery = trim($request->string('proveedor')->toString());

        $base = $this->baseQuery($q, $codigo, $provQuery);

        $agg = (clone $base)
            ->selectRaw('COALESCE(SUM(cantidad_compra),0) AS cantidad_total')
            ->selectRaw('COALESCE(SUM(cantidad_compra * precio_compra_final),0) AS compra_total')
            ->first();

        $all = $base->get([
            'id','producto_id','proveedor_id','fecha_compra','cantidad_compra','precio_compra_final'
        ]);

        $groups = [];
        foreach ($all as $l) {
            $pid = (int) $l->producto_id;
            if (!isset($groups[$pid])) {
                $groups[$pid] = [
                    'rows'   => [],
                    'sumCant'=> 0.0,
                    'stock'  => $l->producto ? (float)$l->producto->cantidad_total : null,
                ];
            }
            $groups[$pid]['rows'][] = $this->rowFromLote($l);
            $groups[$pid]['sumCant'] += (float) ($l->cantidad_compra ?? 0);
            if ($groups[$pid]['stock'] === null && $l->producto) {
                $groups[$pid]['stock'] = (float)$l->producto->cantidad_total;
            }
        }

        $style = 'table{width:100%;border-collapse:collapse;font-size:12px}
          th,td{border:1px solid #ccc;padding:6px}
          th{text-align:center;background:#f6f6f6}
          td{text-align:right}
          td.txt{ text-align:left }
          h1,h3{margin:0 0 8px 0}
          .tot td{padding:4px 8px;border:none;}
          .sub td{background:#f9fafb; font-size:11px; border-top:none;}';

        $head = "<tr>
            <th class='txt'>Número</th>
            <th class='txt'>Código</th>
            <th class='txt'>Nombre</th>
            <th class='txt'>Proveedor</th>
            <th class='txt'>Fecha de compra</th>
            <th>Cantidad</th>
            <th>Precio final (unit.)</th>
            <th>Compra total</th>
        </tr>";

        $trs = '';
        foreach ($groups as $g) {
            foreach ($g['rows'] as $r) {
                $trs .= "<tr>
                    <td class='txt'>{$this->esc((string)$r['numero'])}</td>
                    <td class='txt'>{$r['codigo_html']}</td>
                    <td class='txt'>{$this->esc((string)$r['nombre'])}</td>
                    <td class='txt'>{$this->esc((string)$r['proveedor'])}</td>
                    <td class='txt'>{$this->esc((string)$r['fecha_compra'])}</td>
                    <td>".number_format((float)$r['cantidad'], 2, '.', '')."</td>
                    <td>".number_format((float)$r['precio_final'], 2, '.', '')."</td>
                    <td>".number_format((float)$r['compra_total'], 2, '.', '')."</td>
                </tr>";
            }
            $stock    = $g['stock'];
            $vendidas = is_null($stock) ? null : max(0, $g['sumCant'] - (float)$stock);

            $trs .= "<tr class='sub'>
                <td class='txt' colspan='6'><strong>Vendidas:</strong> ".
                    (is_null($vendidas) ? '—' : number_format($vendidas,2,'.','')).
                "</td>
                <td class='txt' colspan='2' style='text-align:right'><strong>Stock:</strong> ".
                    (is_null($stock) ? '—' : number_format($stock,2,'.','')).
                "</td>
            </tr>";
        }

        $totTabla = "<table class='tot' style='margin-bottom:10px'>
            <tr>
                <td><strong>Cantidad total:</strong> ".number_format((float)$agg->cantidad_total,2,'.','')."</td>
                <td><strong>Compra total:</strong> ".number_format((float)$agg->compra_total,2,'.','')."</td>
            </tr>
        </table>";

        $html = "<html><head><meta charset='utf-8'><style>{$style}</style></head><body>
            <h1>Reporte de Productos</h1>
            {$totTabla}
            <table>
                <thead>{$head}</thead>
                <tbody>{$trs}</tbody>
            </table>
        </body></html>";

        $pdf  = Pdf::loadHTML($html)->setPaper('a4', 'landscape');
        return $pdf->download('reporte_productos_'.now()->format('Ymd_His').'.pdf');
    }

    /* ========================= HELPERS ========================= */

    private function baseQuery(string $q, string $codigo, string $provQuery)
    {
        return Lote::query()
            ->with(['producto:id,nombre,codigo,cantidad_total', 'proveedor:id,nombre,ci_o_ruc'])
            ->when($q !== '', function ($qr) use ($q) {
                $qr->whereHas('producto', fn($p) => $p->where('nombre', 'like', "%{$q}%"));
            })
            ->when($codigo !== '', function ($qr) use ($codigo) {
                $qr->whereHas('producto', fn($p) => $p->where('codigo', 'like', "%{$codigo}%"));
            })
            ->when($provQuery !== '', function ($qr) use ($provQuery) {
                $qr->whereHas('proveedor', function ($p) use ($provQuery) {
                    $p->where('nombre', 'like', "%{$provQuery}%")
                      ->orWhere('ci_o_ruc', 'like', "%{$provQuery}%");
                });
            })
            ->latest('fecha_compra');
    }

    private function rowFromLote($l)
    {
        $prod = $l->producto;
        $prov = $l->proveedor;

        $cantidad           = (float) ($l->cantidad_compra ?? 0);
        $precioBase         = (float) ($l->precio_compra ?? 0);
        $gastosPct          = (float) ($l->costo_general ?? 0);
        $factor1Pct         = (float) ($l->costo_transporte ?? 0);
        $gananciaPct        = (float) ($l->porcentaje_ganancia ?? 0);
        $comisionPct        = (float) ($l->comision_pct ?? 0);
        $precioFinal        = (float) ($l->precio_compra_final ?? 0);

        // Cálculo de Precio de Compra Neto = Precio Compra + Gastos($) + Factor 1($)
        $gastosMonto        = $precioBase * ($gastosPct / 100);
        $costoTotalProd     = $precioBase + $gastosMonto;
        $factor1Monto       = $costoTotalProd * ($factor1Pct / 100);
        $precioCompraNeto   = round($costoTotalProd + $factor1Monto, 2);

        $compraTotal        = round($cantidad * $precioFinal, 2);
        $fecha              = $l->fecha_compra ? Carbon::parse($l->fecha_compra)->format('Y-m-d') : '';

        return [
            'numero'             => $l->id,
            'codigo_html'        => $this->codigoPretty($prod?->codigo),
            'codigo_texto'       => (string) ($prod?->codigo ?? ''),
            'nombre'             => (string) ($prod?->nombre ?? '—'),
            'proveedor'          => $prov ? ($prov->nombre.' — ['.$prov->ci_o_ruc.']') : '—',
            'fecha_compra'       => $fecha,
            'cantidad'           => round($cantidad, 2),
            'precio_compra_base' => round($precioBase, 2),
            'gastos_pct'         => round($gastosPct, 2),
            'factor1_pct'        => round($factor1Pct, 2),
            'precio_compra_neto' => $precioCompraNeto,
            'ganancia_pct'       => round($gananciaPct, 2),
            'comision_pct'       => round($comisionPct, 2),
            'precio_final'       => round($precioFinal, 2),
            'compra_total'       => $compraTotal,
        ];
    }

    private function codigoPretty(?string $codigo): string
    {
        if (!$codigo) return '—';
        $parts = explode('-', $codigo);
        $out = '';
        foreach ($parts as $i => $seg) {
            if ($i > 0) { $out .= '<span>-</span>'; }
            if ($i === 1) {
                $out .= '<span style="font-weight:700;font-size:1.1rem">'.$this->esc($seg).'</span>';
            } else {
                $out .= '<span>'.$this->esc($seg).'</span>';
            }
        }
        return $out;
    }

    private function esc(string $s): string
    {
        return htmlspecialchars($s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
