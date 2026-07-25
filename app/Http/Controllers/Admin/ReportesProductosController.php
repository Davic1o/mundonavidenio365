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

    /** ===================== EXPORT CSV (TODOS LOS FILTRADOS + SUBFILA VENDIDAS/STOCK) ===================== */
    public function exportCsv(Request $request)
    {
        $q         = trim($request->string('q')->toString());
        $codigo    = trim($request->string('codigo')->toString());
        $provQuery = trim($request->string('proveedor')->toString());

        $base = $this->baseQuery($q, $codigo, $provQuery);

        // Totales globales (del filtro)
        $agg = (clone $base)
            ->selectRaw('COALESCE(SUM(cantidad_compra),0) AS cantidad_total')
            ->selectRaw('COALESCE(SUM(cantidad_compra * precio_compra_final),0) AS compra_total')
            ->first();

        // Traer todo para exportar y agrupar por producto
        $all = $base->get([
            'id','producto_id','proveedor_id','fecha_compra','cantidad_compra','precio_compra_final'
        ]);

        // Group by producto
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
            // si viniera null en la primera, intenta tomarlo de otras filas
            if ($groups[$pid]['stock'] === null && $l->producto) {
                $groups[$pid]['stock'] = (float)$l->producto->cantidad_total;
            }
        }

        $filename = 'reporte_productos_'.now()->format('Ymd_His').'.csv';
        $headers = [
            'Content-Type'        => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"$filename\"",
        ];
        $columns = [
            'Número','Código','Nombre','Proveedor','Fecha de compra','Cantidad',
            'Precio final (unit.)','Compra total',
        ];

        return response()->stream(function () use ($groups, $agg, $columns) {
            $out = fopen('php://output', 'w');
            fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF)); // BOM UTF-8

            // Totales globales
            fputcsv($out, ['TOTALES (filtro completo)']);
            fputcsv($out, ['Cantidad total','Compra total']);
            fputcsv($out, [
                number_format((float)$agg->cantidad_total, 2, '.', ''),
                number_format((float)$agg->compra_total,   2, '.', ''),
            ]);
            fputcsv($out, []);

            // Encabezados
            fputcsv($out, $columns);

            // Cuerpo por grupos
            foreach ($groups as $g) {
                foreach ($g['rows'] as $r) {
                    fputcsv($out, [
                        $r['numero'],
                        $r['codigo_texto'],               // plano para CSV
                        $r['nombre'],
                        $r['proveedor'],
                        $r['fecha_compra'],
                        number_format($r['cantidad'], 2, '.', ''),
                        number_format($r['precio_final'], 2, '.', ''),
                        number_format($r['compra_total'], 2, '.', ''),
                    ]);
                }

                // Fila adicional: VENDIDAS y STOCK
                $stock    = $g['stock'];
                $vendidas = is_null($stock) ? null : max(0, $g['sumCant'] - (float)$stock);

                fputcsv($out, []); // separador visual
                fputcsv($out, [
                    '', '', 'Vendidas:',
                    '', '',   // dejamos columnas de texto vacías
                    is_null($vendidas) ? '—' : number_format($vendidas, 2, '.', ''),
                    'Stock: '.(is_null($stock) ? '—' : number_format($stock, 2, '.', '')),
                ]);
                fputcsv($out, []); // otra línea en blanco entre grupos
            }

            fclose($out);
        }, 200, $headers);
    }

    /** ===================== EXPORT PDF (TODOS LOS FILTRADOS + SUBFILA VENDIDAS/STOCK) ===================== */
    public function exportPdf(Request $request)
    {
        $q         = trim($request->string('q')->toString());
        $codigo    = trim($request->string('codigo')->toString());
        $provQuery = trim($request->string('proveedor')->toString());

        $base = $this->baseQuery($q, $codigo, $provQuery);

        // Totales globales
        $agg = (clone $base)
            ->selectRaw('COALESCE(SUM(cantidad_compra),0) AS cantidad_total')
            ->selectRaw('COALESCE(SUM(cantidad_compra * precio_compra_final),0) AS compra_total')
            ->first();

        // Traer todo para el PDF y agrupar por producto
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

        // Armar HTML
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

    /** Query base reutilizable con filtros (incluye cantidad_total para STOCK) */
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

    /** Arma la fila que consumen UI/exports a partir de un Lote */
    private function rowFromLote($l)
    {
        $prod = $l->producto;
        $prov = $l->proveedor;

        $cantidad    = (float) ($l->cantidad_compra ?? 0);
        $precioFinal = (float) ($l->precio_compra_final ?? 0);
        $compraTotal = round($cantidad * $precioFinal, 2);

        $fecha = $l->fecha_compra ? Carbon::parse($l->fecha_compra)->format('Y-m-d') : '';

        return [
            'numero'       => $l->id,
            'codigo_html'  => $this->codigoPretty($prod?->codigo), // 2.º bloque grande/bold (solo PDF/HTML)
            'codigo_texto' => (string) ($prod?->codigo ?? ''),      // CSV
            'nombre'       => (string) ($prod?->nombre ?? '—'),
            'proveedor'    => $prov ? ($prov->nombre.' — ['.$prov->ci_o_ruc.']') : '—',
            'fecha_compra' => $fecha,
            'cantidad'     => round($cantidad, 2),
            'precio_final' => round($precioFinal, 2),
            'compra_total' => $compraTotal,
        ];
    }

    /** Render del código con el 2.º segmento grande + negrita (para PDF/HTML) */
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
