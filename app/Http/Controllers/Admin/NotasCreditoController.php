<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;

use App\Models\Cliente;
use App\Models\Producto;
use App\Models\Venta;
use App\Models\VentaProducto;
use App\Models\NotaCredito;
use App\Models\NotaCreditoDetalle;

use App\Services\SignDOcumentToSRI;
use App\Services\SriFacturaService;
use SoapClient;

class NotasCreditoController extends Controller
{
    /* =========================================================
     * Helpers base (reutilizados/adaptados)
     * ========================================================= */

    protected function normalizarItems(array $items): array
    {
        return collect($items)->map(fn($it) => [
            'producto_id' => (int)$it['producto_id'],
            'cantidad'    => (float)$it['cantidad'],   // devuelta (en NC)
            'precio'      => (float)$it['precio'],     // precio guardado (BRUTO, con IVA si iva=15)
            'descuento'   => isset($it['descuento']) ? (float)$it['descuento'] : 0.0,
            'iva'         => (int)($it['iva'] ?? 15),  // 0 | 15
        ])->all();
    }

    /** Totales para NC (desgravando por línea según IVA). Devuelve:
     * base0, base15, subtotal(sin IVA), impuesto_15, impuesto_0, descuento(base), total(con IVA)
     */
    protected function calcularTotales(array $items): array
    {
        $base0 = 0.0;
        $base15 = 0.0;
        $descTotalBase = 0.0;

        foreach ($items as $it) {
            $cant   = max(0, (float)$it['cantidad']);
            $precio = max(0, (float)$it['precio']);     // BRUTO (con IVA si 15)
            $desc   = max(0, (float)($it['descuento'] ?? 0));
            $ivaPct = ((int)($it['iva'] ?? 15)) === 0 ? 0 : 15;

            $div    = $ivaPct === 15 ? 1.15 : 1.0;
            $pBase  = $precio / $div;                   // unitario base
            $dBase  = $desc   / $div;

            $lineaBase = max(0, $cant * $pBase - $dBase);

            if ($ivaPct === 0) $base0 += $lineaBase; else $base15 += $lineaBase;

            $descTotalBase += $dBase;
        }

        $base0       = round($base0, 2);
        $base15      = round($base15, 2);
        $subtotal    = round($base0 + $base15, 2);       // sin IVA
        $impuesto_15 = round($base15 * 0.15, 2);
        $impuesto_0  = 0.00;
        $total       = round($subtotal + $impuesto_15, 2);

        return [
            'base0'       => $base0,
            'base15'      => $base15,
            'subtotal'    => $subtotal,              // sin IVA
            'impuesto_15' => $impuesto_15,
            'impuesto_0'  => $impuesto_0,
            'descuento'   => round($descTotalBase, 2), // descuento en base
            'total'       => $total,                 // con IVA
        ];
    }

    /** En NC el stock se regresa (signo +1) */
    protected function ajustarStock(array $items, int $signo = +1): void
    {
        foreach ($items as $it) {
            if ($signo < 0) {
                DB::table('productos')->where('id', $it['producto_id'])
                    ->decrement('cantidad_total', $it['cantidad']);
            } else {
                DB::table('productos')->where('id', $it['producto_id'])
                    ->increment('cantidad_total', $it['cantidad']);
            }
        }
    }

    protected function numeracionConfig(): array
    {
        $e = DB::table('empresas')->select('establecimiento', 'punto_emision')->first();
        return [
            'estab'  => !empty($e?->establecimiento) ? $e->establecimiento : (env('SRI_ESTAB') ?: '001'),
            'ptoEmi' => !empty($e?->punto_emision) ? $e->punto_emision : (env('SRI_PTO_EMI') ?: '001'),
        ];
    }
    protected function padSecuencial(int $n): string
    {
        return str_pad((string)$n, 9, '0', STR_PAD_LEFT);
    }
    protected function siguienteSecuencialConLock(string $estab, string $ptoEmi): string
    {
        $last = DB::table('notas_credito')
            ->where('estab', $estab)
            ->where('pto_emision', $ptoEmi)
            ->whereNotNull('secuencial')
            ->lockForUpdate()
            ->orderByDesc('secuencial')
            ->value('secuencial');

        if ($last) {
            $nextInt = ((int)$last) + 1;
        } else {
            $e = DB::table('empresas')->select('secuencial_nota_credito')->first();
            $nextInt = ($e && !empty($e->secuencial_nota_credito)) ? (int)$e->secuencial_nota_credito : 1;
        }

        return $this->padSecuencial($nextInt);
    }

    protected function configEmisor($secuencial): array
    {
        return [
            'ruc'        => env('SRI_RUC', '0000000000001'),
            'ambiente'   => (string) env('SRI_AMBIENTE', '1'),
            'estab'      => (string) env('SRI_ESTAB', '001'),
            'ptoEmi'     => (string) env('SRI_PTO_EMI', '001'),
            'secuencial' => $secuencial,
            'tipoEmision'=> '1',
        ];
    }

    protected function generarClaveAcceso(\DateTimeInterface $fecha, array $cfg, string $tipoComprobante = '04', $secuencial = null, ?string $codigoNumerico = null): string
    {
        $fechaStr       = $fecha->format('dmY');
        $ruc            = str_pad(preg_replace('/\D/', '', $cfg['ruc'] ?? ''), 13, '0', STR_PAD_LEFT);
        $ambiente       = (string)($cfg['ambiente'] ?? '1');
        $estab          = str_pad((string)($cfg['estab'] ?? ''), 3, '0', STR_PAD_LEFT);
        $ptoEmi         = str_pad((string)($cfg['ptoEmi'] ?? ''), 3, '0', STR_PAD_LEFT);
        $secuencial     = str_pad((string)$cfg['secuencial'], 9, '0', STR_PAD_LEFT);
        $tipoEmision    = (string)($cfg['tipoEmision'] ?? '1');
        $codigoNumerico = $codigoNumerico !== null
            ? str_pad(preg_replace('/\D/','',$codigoNumerico), 8, '0', STR_PAD_LEFT)
            : str_pad((string)random_int(0, 99999999), 8, '0', STR_PAD_LEFT);

        $base = $fechaStr.$tipoComprobante.$ruc.$ambiente.$estab.$ptoEmi.$secuencial.$codigoNumerico.$tipoEmision;
        $dv = $this->modulo11SRI($base);
        return $base.$dv;
    }

    protected function modulo11SRI(string $cadena48): string
    {
        $coef = [2,3,4,5,6,7];
        $sum = 0; $coefIdx = 0;
        for ($i = strlen($cadena48) - 1; $i >= 0; $i--) {
            $sum += ((int)$cadena48[$i]) * $coef[$coefIdx];
            $coefIdx = ($coefIdx + 1) % count($coef);
        }
        $mod = $sum % 11; $dv  = 11 - $mod;
        if ($dv === 11) $dv = 0;
        if ($dv === 10) $dv = 1;
        return (string)$dv;
    }

    protected function empresaInfo(): array
    {
        if (Schema::hasTable('empresas')) {
            $e = DB::table('empresas')->first();
            if ($e) {
                return [
                    'nombre_comercial' => $e->nombre_comercial ?: (config('app.name') ?? 'Mi Empresa'),
                    'razon_social'     => $e->razon_social ?: ($e->nombre_comercial ?: (config('app.name') ?? 'Mi Empresa')),
                    'ruc'              => $e->ruc ?: env('SRI_RUC', '0000000000001'),
                    'telefono'         => $e->telefono ?: null,
                    'email'            => $e->correo ?: null,
                    'direccion'        => $e->direccion ?: null,
                    'ruta_firma_electronica' => $e->ruta_firma_electronica ?: env('SRI_FIRMA_PATH'),
                    'clave_firma_electronica' => $e->clave_firma_electronica ?: env('SRI_FIRMA_PASSWORD'),
                    'ambiente'         => $e->ambiente ?? 1,
                    'establecimiento'  => $e->establecimiento ?? '001',
                    'punto_emision'    => $e->punto_emision ?? '001',
                    'secuencial_factura'      => $e->secuencial_factura ?? '000000001',
                    'secuencial_nota_credito' => $e->secuencial_nota_credito ?? '000000001',
                ];
            }
        }
        return [
            'nombre_comercial' => config('app.name', 'Mi Empresa'),
            'razon_social'     => config('app.name', 'Mi Empresa'),
            'ruc'              => env('SRI_RUC', '0000000000001'),
            'telefono'         => env('APP_PHONE', null),
            'email'            => env('APP_EMAIL', null),
            'direccion'        => env('APP_ADDRESS', null),
            'ambiente'         => (int)env('SRI_AMBIENTE', 1),
            'establecimiento'  => env('SRI_ESTAB', '001'),
            'punto_emision'    => env('SRI_PTO_EMI', '001'),
            'secuencial_factura'      => '000000001',
            'secuencial_nota_credito' => '000000001',
        ];
    }

    /* =========================================================
     * Listado de facturas (selección de sustento)
     * ========================================================= */
    public function facturasIndex(Request $r)
    {
        /* ===== Filtros de FACTURAS (existentes) ===== */
        $q           = trim((string)$r->query('q',''));
        $estado      = trim((string)$r->query('estado','autorizado')) ?: 'autorizado';
        $fechaDesde  = $r->query('fecha_desde');
        $fechaHasta  = $r->query('fecha_hasta');

        $ventas = DB::table('ventas')
            ->leftJoin('clientes','clientes.id','=','ventas.cliente_id')
            ->leftJoin('notas_credito as nc_ref','nc_ref.venta_id','=','ventas.id')
            ->select(
                'ventas.id','ventas.fecha','ventas.estado',
                'ventas.estab','ventas.pto_emision','ventas.secuencial',
                'ventas.subtotal','ventas.impuesto_15','ventas.impuesto_0','ventas.descuento','ventas.total',
                'clientes.nombres as cliente_nombres','clientes.ci_o_ruc as cliente_ci_o_ruc',
                'nc_ref.id as nc_id',
                'nc_ref.estado as nc_estado'
            )
            ->when($q !== '', function($qq) use ($q) {
                $qq->where(function($w) use ($q){
                    $w->where('clientes.nombres','like',"%{$q}%")
                      ->orWhere('clientes.ci_o_ruc','like',"%{$q}%")
                      ->orWhereRaw("CONCAT(ventas.estab,'-',ventas.pto_emision,'-',LPAD(ventas.secuencial,9,'0')) LIKE ?", ["%{$q}%"]);
                });
            })
            ->when($estado !== '', fn($qq)=>$qq->where('ventas.estado',$estado))
            ->when($fechaDesde, fn($qq)=>$qq->whereDate('ventas.fecha','>=',$fechaDesde))
            ->when($fechaHasta, fn($qq)=>$qq->whereDate('ventas.fecha','<=',$fechaHasta))
            ->orderByDesc('ventas.id')
            ->paginate(15)
            ->withQueryString();

        /* ===== NUEVO: Filtros y listado de NOTAS DE CRÉDITO ===== */
        $n_q          = trim((string)$r->query('n_q',''));
        $n_estado     = trim((string)$r->query('n_estado',''));
        $n_desde      = $r->query('n_fecha_desde');
        $n_hasta      = $r->query('n_fecha_hasta');

        $notas = DB::table('notas_credito')
            ->leftJoin('clientes','clientes.id','=','notas_credito.cliente_id')
            ->leftJoin('ventas as vdoc','vdoc.id','=','notas_credito.venta_id')
            ->select(
                'notas_credito.id','notas_credito.fecha','notas_credito.estado',
                'notas_credito.estab','notas_credito.pto_emision','notas_credito.secuencial',
                'notas_credito.subtotal','notas_credito.impuesto_15','notas_credito.impuesto_0','notas_credito.descuento','notas_credito.total',
                'notas_credito.motivo',
                'clientes.nombres as cliente_nombres','clientes.ci_o_ruc as cliente_ci_o_ruc',
                DB::raw("CONCAT(notas_credito.estab,'-',notas_credito.pto_emision,'-',LPAD(notas_credito.secuencial,9,'0')) as numero"),
                DB::raw("CONCAT(vdoc.estab,'-',vdoc.pto_emision,'-',LPAD(vdoc.secuencial,9,'0')) as doc_sustento")
            )
            ->when($n_q !== '', function($qq) use ($n_q) {
                $qq->where(function($w) use ($n_q){
                    $w->where('clientes.nombres','like',"%{$n_q}%")
                      ->orWhere('clientes.ci_o_ruc','like',"%{$n_q}%")
                      ->orWhereRaw("CONCAT(notas_credito.estab,'-',notas_credito.pto_emision,'-',LPAD(notas_credito.secuencial,9,'0')) LIKE ?", ["%{$n_q}%"])
                      ->orWhereRaw("CONCAT(vdoc.estab,'-',vdoc.pto_emision,'-',LPAD(vdoc.secuencial,9,'0')) LIKE ?", ["%{$n_q}%"]);
                });
            })
            ->when($n_estado !== '', fn($qq)=>$qq->where('notas_credito.estado',$n_estado))
            ->when($n_desde, fn($qq)=>$qq->whereDate('notas_credito.fecha','>=',$n_desde))
            ->when($n_hasta, fn($qq)=>$qq->whereDate('notas_credito.fecha','<=',$n_hasta))
            ->orderByDesc('notas_credito.id')
            ->paginate(15, ['*'], 'notas_page')
            ->withQueryString();

        return Inertia::render('Admin/NotasCredito/FacturasIndex', [
            'ventas'  => $ventas,
            'notas'   => $notas,
            'filtros' => [
                'q' => $q,
                'estado' => $estado,
                'fecha_desde' => $fechaDesde,
                'fecha_hasta' => $fechaHasta
            ],
            'filtros_nc' => [
                'n_q' => $n_q,
                'n_estado' => $n_estado,
                'n_fecha_desde' => $n_desde,
                'n_fecha_hasta' => $n_hasta,
            ],
            'flash'   => ['success'=>session('success'),'error'=>session('error')],
        ]);
    }

    /* =========================================================
     * Crear/obtener NC para una factura (estado creada)
     * ========================================================= */
    protected function crearNCBaseParaVenta(Venta $venta): NotaCredito
    {
        return DB::transaction(function () use ($venta) {
            $cfgNum = $this->numeracionConfig();
            $secuencial = $this->siguienteSecuencialConLock($cfgNum['estab'], $cfgNum['ptoEmi']);

            $nc = new NotaCredito();
            $nc->venta_id    = $venta->id;
            $nc->cliente_id  = $venta->cliente_id;
            $nc->fecha       = now()->toDateTimeString();
            $nc->estab       = $cfgNum['estab'];
            $nc->pto_emision = $cfgNum['ptoEmi'];
            $nc->secuencial  = $secuencial;
            $nc->numero      = $cfgNum['estab'].'-'.$cfgNum['ptoEmi'].'-'.$secuencial;
            $nc->estado      = 'creada';
            $nc->subtotal    = 0;
            $nc->impuesto_15 = 0;
            $nc->impuesto_0  = 0;
            $nc->descuento   = 0;
            $nc->total       = 0;

            $cfg = $this->configEmisor($secuencial);
            $nc->autorizacion = $this->generarClaveAcceso(now(), $cfg, '04'); // Nota de crédito
            $nc->save();

            return $nc;
        });
    }

    /** Prefill detalles de NC con los ítems de la factura */
    protected function prellenarDesdeFactura(NotaCredito $nc, array $cantidadesPorProducto = null): NotaCredito
    {
        $venta = Venta::findOrFail($nc->venta_id);

        $itemsFactura = VentaProducto::where('venta_id', $venta->id)->get();

        $maxFact = $itemsFactura->groupBy('producto_id')
            ->map(fn($g) => (float)$g->sum('cantidad'));

        $cantidadesPorProducto = $cantidadesPorProducto ?? $maxFact->toArray();

        foreach ($cantidadesPorProducto as $pid => $qtyDev) {
            $max = (float)($maxFact[$pid] ?? 0);
            if ($qtyDev > $max + 1e-9) {
                throw new \InvalidArgumentException("Cantidad devuelta mayor a lo facturado para producto {$pid}");
            }
        }

        DB::transaction(function () use ($nc, $itemsFactura, $cantidadesPorProducto) {
            NotaCreditoDetalle::where('nota_credito_id', $nc->id)->delete();

            $items = [];
            foreach ($itemsFactura as $vf) {
                $pid = (int)$vf->producto_id;
                $cantDev = (float)($cantidadesPorProducto[$pid] ?? 0);
                if ($cantDev <= 0) continue;

                $precio = (float)$vf->precio;     // BRUTO
                $desc   = (float)($vf->descuento ?? 0);
                $iva    = (int)($vf->iva ?? 15);

                $precioTotal = round(max(0, $cantDev * $precio - $desc), 2);

                NotaCreditoDetalle::create([
                    'nota_credito_id' => $nc->id,
                    'producto_id'     => $pid,
                    'cantidad'        => $cantDev,
                    'precio'          => $precio,
                    'descuento'       => $desc,
                    'precio_total'    => $precioTotal, // con IVA si aplica
                    'iva'             => $iva,
                ]);

                $items[] = [
                    'producto_id' => $pid,
                    'cantidad'    => $cantDev,
                    'precio'      => $precio,
                    'descuento'   => $desc,
                    'iva'         => $iva,
                ];
            }

            $tot = $this->calcularTotales($items);
            $nc->subtotal    = $tot['subtotal'];
            $nc->impuesto_15 = $tot['impuesto_15'];
            $nc->impuesto_0  = $tot['impuesto_0'];
            $nc->descuento   = $tot['descuento'];
            $nc->total       = $tot['total'];
            if (!$nc->motivo) $nc->motivo = 'Devolución de mercadería';
            $nc->save();
        });

        return $nc;
    }

    /* =========================================================
     * Flujo
     * ========================================================= */

    public function cargarProductosDesdeFactura(Request $request, $ventaId)
    {
        $venta = Venta::with('cliente')->findOrFail($ventaId);

        $ncExistente = NotaCredito::where('venta_id', $venta->id)->first();
        if ($ncExistente) {
            $est = strtoupper((string)($ncExistente->estado ?? ''));
            $isAuth = $est === 'AUTORIZADO' || $est === 'EMITIDA';
            if ($isAuth) {
                return redirect()->route('admin.notas_credito.show', $ncExistente->id)
                    ->with('error', 'Ya existe una Nota de Crédito emitida y autorizada para esta factura. No es posible generar otra.');
            }
            $nc = $ncExistente;
        } else {
            $nc = $this->crearNCBaseParaVenta($venta);
            $this->prellenarDesdeFactura($nc, null);
        }

        if ($request->boolean('emitir')) {
            return $this->emitirFirmarEnviar($nc->id);
        }

        return redirect()->route('admin.notas_credito.vista_items', $nc->id);
    }

    public function vistaItems($ncId)
    {
        $nc = NotaCredito::findOrFail($ncId);
        $est = strtoupper((string)($nc->estado ?? ''));
        if ($est === 'AUTORIZADO' || $est === 'EMITIDA') {
            return redirect()->route('admin.notas_credito.show', $nc->id)
                ->with('error', 'Esta nota de crédito ya fue autorizada ante el SRI y no se pueden modificar sus ítems.');
        }

        $venta = Venta::findOrFail($nc->venta_id);
        $cliente = $venta->cliente_id ? Cliente::find($venta->cliente_id) : null;

        $itemsFactura = VentaProducto::query()
            ->join('productos','productos.id','=','venta_productos.producto_id')
            ->where('venta_productos.venta_id',$venta->id)
            ->select('venta_productos.*','productos.nombre','productos.codigo')
            ->get();

        $detallesNC = NotaCreditoDetalle::where('nota_credito_id',$nc->id)->get();

        return Inertia::render('Admin/NotasCredito/EditarItems', [
            'nc'          => $nc,
            'venta'       => $venta,
            'cliente'     => $cliente,
            'itemsFactura'=> $itemsFactura,
            'detallesNC'  => $detallesNC,
            'flash'       => ['success'=>session('success'),'error'=>session('error')],
        ]);
    }

    public function guardarItems(Request $request, $ncId)
    {
        $nc = NotaCredito::findOrFail($ncId);
        $est = strtoupper((string)($nc->estado ?? ''));
        if ($est === 'AUTORIZADO' || $est === 'EMITIDA') {
            return redirect()->route('admin.notas_credito.show', $nc->id)
                ->with('error', 'Esta nota de crédito ya fue autorizada ante el SRI y no se pueden modificar sus ítems.');
        }

        $venta = Venta::findOrFail($nc->venta_id);

        $data = $request->validate([
            'items' => ['required','array','min:1'],
            'items.*.producto_id' => ['required','integer','exists:productos,id'],
            'items.*.cantidad'    => ['required','numeric','min:0.0001'],
            'items.*.precio'      => ['required','numeric','min:0'],
            'items.*.descuento'   => ['nullable','numeric','min:0'],
            'items.*.iva'         => ['nullable','integer', Rule::in([0,15])],
            'motivo'              => ['nullable','string','max:300'],
            'emitir'              => ['nullable','boolean'],
        ]);

        $facturados = VentaProducto::where('venta_id',$venta->id)
            ->select('producto_id', DB::raw('SUM(cantidad) as qty'))
            ->groupBy('producto_id')->pluck('qty','producto_id');

        $porDevolver = collect($data['items'])->groupBy('producto_id')
            ->map(fn($g)=>$g->sum('cantidad'));

        foreach ($porDevolver as $pid=>$qtyDev) {
            $max = (float)($facturados[$pid] ?? 0);
            if ($qtyDev > $max + 1e-9) {
                return back()->with('error','No puedes devolver más de lo facturado para un ítem.')->withInput();
            }
        }

        DB::transaction(function() use ($nc, $data) {
            NotaCreditoDetalle::where('nota_credito_id',$nc->id)->delete();

            $items = $this->normalizarItems($data['items']);
            foreach ($items as $it) {
                $precioTotal = round(max(0, $it['cantidad']*$it['precio'] - $it['descuento']),2);
                NotaCreditoDetalle::create([
                    'nota_credito_id'=>$nc->id, 'producto_id'=>$it['producto_id'],
                    'cantidad'=>$it['cantidad'],'precio'=>$it['precio'],
                    'descuento'=>$it['descuento'],'precio_total'=>$precioTotal,
                    'iva'=>$it['iva'] ?? 15,
                ]);
            }

            $tot = $this->calcularTotales($items);
            $nc->subtotal    = $tot['subtotal'];
            $nc->impuesto_15 = $tot['impuesto_15'];
            $nc->impuesto_0  = $tot['impuesto_0'];
            $nc->descuento   = $tot['descuento'];
            $nc->total       = $tot['total'];
            $nc->motivo      = $data['motivo'] ?? 'Devolución de mercadería';
            $nc->save();
        });

        if (!empty($data['emitir'])) {
            return $this->emitirFirmarEnviar($nc->id);
        }

        return redirect()->route('admin.notas_credito.show', $nc->id)
            ->with('success', 'Nota de crédito guardada.');
    }

    /**
     * Emitir / firmar / enviar a SRI / autorizar
     */
    public function emitirFirmarEnviar($ncId)
    {
        $nc = NotaCredito::with(['cliente','venta'])->findOrFail($ncId);
        $est = strtoupper((string)($nc->estado ?? ''));

        if ($est === 'AUTORIZADO' || $est === 'EMITIDA') {
            return redirect()->route('admin.notas_credito.show', $nc->id)
                ->with('success', 'Esta nota de crédito ya se encuentra autorizada ante el SRI.');
        }

        // Generamos (o regeneramos) la etapa "emitida" sin mover stock todavía
        DB::transaction(function() use ($nc){
            if ($nc->estado !== 'emitida') {
                $nc->estado = 'emitida';
                $nc->fecha  = now()->toDateTimeString();
                $nc->save();
            }
        });

        // Emitir y Autorizar ante el SRI mediante SriFacturaService
        $empresa = $this->empresaInfo();
        $sriService = new SriFacturaService();
        $resultado = $sriService->procesarNotaCreditoSRI($nc, $empresa);

        if (!$resultado['success']) {
            return redirect()->route('admin.notas_credito.show', $nc->id)
                ->with('error', $resultado['message']);
        }

        return redirect()->route('admin.notas_credito.show', $nc->id)
            ->with('success', $resultado['message']);
    }

    /**
     * Show NC
     */
    public function show($ncId)
    {
        $nc = NotaCredito::findOrFail($ncId);
        $venta = Venta::findOrFail($nc->venta_id);
        $cliente = $venta->cliente_id ? Cliente::find($venta->cliente_id) : null;

        $detalles = NotaCreditoDetalle::query()
            ->join('productos','productos.id','=','nota_credito_detalles.producto_id')
            ->where('nota_credito_detalles.nota_credito_id',$nc->id)
            ->select('nota_credito_detalles.*','productos.nombre','productos.codigo')
            ->get();

        $empresa = $this->empresaInfo();

        return Inertia::render('Admin/NotasCredito/Show', [
            'nc'       => $nc,
            'venta'    => $venta,
            'cliente'  => $cliente,
            'empresa'  => $empresa,
            'detalles' => $detalles,
            'flash'    => ['success'=>session('success'),'error'=>session('error')],
        ]);
    }

    /* =========================================================
     * XML notaCredito (SRI 1.1.0)
     * ========================================================= */

    private function generarNotaCreditoXMLString(NotaCredito $nc, array $cfg): string
    {
        $venta   = $nc->venta;
        $cliente = $nc->cliente;
        $detalles = NotaCreditoDetalle::with('producto')
            ->where('nota_credito_id', $nc->id)->get();

        $secu = str_pad($nc->secuencial, 9, '0', STR_PAD_LEFT);

        $doc = new \DOMDocument('1.0', 'UTF-8');
        $doc->formatOutput = false;

        $root = $doc->createElement('notaCredito');
        $root->setAttribute('id','comprobante');
        $root->setAttribute('version','1.1.0');
        $doc->appendChild($root);

        // ===== infoTributaria
        $it = $doc->createElement('infoTributaria');
        $root->appendChild($it);
        $it->appendChild($doc->createElement('ambiente', (string)env('SRI_AMBIENTE','1')));
        $it->appendChild($doc->createElement('tipoEmision', '1'));
        $it->appendChild($doc->createElement('razonSocial', (string)$cfg['razonSocial']));
        $it->appendChild($doc->createElement('nombreComercial', (string)$cfg['nombreComercial']));
        $it->appendChild($doc->createElement('ruc', (string)$cfg['ruc']));
        $it->appendChild($doc->createElement('claveAcceso', (string)$nc->autorizacion));
        $it->appendChild($doc->createElement('codDoc', '04'));
        $it->appendChild($doc->createElement('estab', (string)$nc->estab));
        $it->appendChild($doc->createElement('ptoEmi', (string)$nc->pto_emision));
        $it->appendChild($doc->createElement('secuencial', $secu));
        $it->appendChild($doc->createElement('dirMatriz', (string)$cfg['dirMatriz']));

        $esCF = $this->isConsumidorFinalId($cliente->ci_o_ruc ?? '');
        $razonComprador = $esCF ? 'CONSUMIDOR FINAL' : (string)($cliente->nombres ?? '');
        $identComprador = $esCF ? '9999999999999' : (string)($cliente->ci_o_ruc ?? '');

        // ===== infoNotaCredito
        $inf = $doc->createElement('infoNotaCredito');
        $root->appendChild($inf);

        $inf->appendChild($doc->createElement('fechaEmision', \Carbon\Carbon::parse($nc->fecha)->format('d/m/Y')));
        $inf->appendChild($doc->createElement('dirEstablecimiento', (string)$cfg['dirEstablecimiento']));
        $inf->appendChild($doc->createElement('tipoIdentificacionComprador', $this->tipoIdComprador($identComprador)));
        $inf->appendChild($doc->createElement('razonSocialComprador', htmlspecialchars($razonComprador, ENT_QUOTES, 'UTF-8')));
        $inf->appendChild($doc->createElement('identificacionComprador', $identComprador));
        $inf->appendChild($doc->createElement('obligadoContabilidad', 'NO'));
        $inf->appendChild($doc->createElement('codDocModificado', '01'));
        $inf->appendChild($doc->createElement('numDocModificado', $venta->estab.'-'.$venta->pto_emision.'-'.str_pad($venta->secuencial,9,'0',STR_PAD_LEFT)));
        $inf->appendChild($doc->createElement('fechaEmisionDocSustento', \Carbon\Carbon::parse($venta->fecha)->format('d/m/Y')));

        // Sumas para totales del header (línea a línea)
        $sumBase15 = 0.00; $sumIva15 = 0.00; $sumBase0 = 0.00;
        foreach ($detalles as $d) {
            $cant = (float)$d->cantidad;
            $precioConIva = (float)$d->precio;   // BRUTO
            $descConIva   = (float)($d->descuento ?? 0);
            $lineaBruta   = max(0.0, $cant*$precioConIva - $descConIva);

            if ((int)$d->iva === 15) {
                $base = round($lineaBruta / 1.15, 2);
                $iva  = round($base * 0.15, 2);
                $sumBase15 += $base;
                $sumIva15  += $iva;
            } else {
                $sumBase0 += round($lineaBruta, 2);
            }
        }
        $totalSinImpuestos = round($sumBase0 + $sumBase15, 2);
        $importeTotal      = round($totalSinImpuestos + $sumIva15, 2);

        $inf->appendChild($doc->createElement('totalSinImpuestos', number_format($totalSinImpuestos, 2, '.', '')));
        $inf->appendChild($doc->createElement('valorModificacion', number_format($importeTotal, 2, '.', '')));
        $inf->appendChild($doc->createElement('moneda', 'DOLAR'));

        $tci = $doc->createElement('totalConImpuestos');
        if ($sumBase0 > 0) {
            $ti0 = $doc->createElement('totalImpuesto');
            $ti0->appendChild($doc->createElement('codigo', '2'));
            $ti0->appendChild($doc->createElement('codigoPorcentaje', '0'));
            $ti0->appendChild($doc->createElement('baseImponible', number_format($sumBase0, 2, '.', '')));
            $ti0->appendChild($doc->createElement('valor', '0.00'));
            $tci->appendChild($ti0);
        }
        if ($sumBase15 > 0 || $sumIva15 > 0) {
            $ti15 = $doc->createElement('totalImpuesto');
            $ti15->appendChild($doc->createElement('codigo', '2'));
            $ti15->appendChild($doc->createElement('codigoPorcentaje', '4')); // 15%
            $ti15->appendChild($doc->createElement('baseImponible', number_format($sumBase15, 2, '.', '')));
            $ti15->appendChild($doc->createElement('valor', number_format($sumIva15, 2, '.', '')));
            $tci->appendChild($ti15);
        }
        $inf->appendChild($tci);

        $inf->appendChild($doc->createElement('motivo', (string)($nc->motivo ?? 'Devolución de mercadería')));

        // ===== detalles
        $detNode = $doc->createElement('detalles');
        $root->appendChild($detNode);

        foreach ($detalles as $d) {
            $p = $d->producto;
            $cantidad  = (float)$d->cantidad;
            $pUnitBrut = (float)$d->precio;   // con IVA en tu sistema
            $descBrut  = (float)($d->descuento ?? 0);

            $pUnitBase = round($pUnitBrut / 1.15, 6);
            $descBase  = round($descBrut / 1.15, 6);
            $totalSinImpLinea = round($cantidad * $pUnitBase - $descBase, 2);

            $det = $doc->createElement('detalle');
            $det->appendChild($doc->createElement('codigoInterno', (string)($p->codigo ?? $p->id)));
            $det->appendChild($doc->createElement('descripcion', (string)($p->nombre ?? 'Producto')));
            $det->appendChild($doc->createElement('cantidad', number_format($cantidad, 6, '.', '')));
            $det->appendChild($doc->createElement('precioUnitario', number_format($pUnitBase, 6, '.', '')));
            $det->appendChild($doc->createElement('descuento', number_format($descBase, 2, '.', '')));
            $det->appendChild($doc->createElement('precioTotalSinImpuesto', number_format($totalSinImpLinea, 2, '.', '')));

            $imps = $doc->createElement('impuestos');
            $imp  = $doc->createElement('impuesto');
            if ((int)$d->iva === 15) {
                $imp->appendChild($doc->createElement('codigo','2'));
                $imp->appendChild($doc->createElement('codigoPorcentaje','4')); // 15%
                $imp->appendChild($doc->createElement('tarifa','15'));
                $imp->appendChild($doc->createElement('baseImponible', number_format($totalSinImpLinea, 2, '.', '')));
                $imp->appendChild($doc->createElement('valor', number_format(round($totalSinImpLinea * 0.15, 2), 2, '.', '')));
            } else {
                $imp->appendChild($doc->createElement('codigo','2'));
                $imp->appendChild($doc->createElement('codigoPorcentaje','0')); // 0%
                $imp->appendChild($doc->createElement('tarifa','0'));
                $imp->appendChild($doc->createElement('baseImponible', number_format($totalSinImpLinea, 2, '.', '')));
                $imp->appendChild($doc->createElement('valor', '0.00'));
            }
            $imps->appendChild($imp);
            $det->appendChild($imps);

            $detNode->appendChild($det);
        }

        return $doc->saveXML();
    }

    protected function tipoIdComprador(string $ciORuc): string
    {
        if ($this->isConsumidorFinalId($ciORuc)) return '07'; // Consumidor Final
        $len = strlen(preg_replace('/\D/','',$ciORuc));
        if ($len === 13) return '04'; // RUC
        if ($len === 10) return '05'; // Cédula
        return '06'; // Pasaporte / otros
    }

    private function guardarXMLPendiente($nc, string $xml, string $tipo='notaCredito'): string
    {
        $dir = storage_path('app/sri/xml/');
        if (!is_dir($dir)) @mkdir($dir, 0775, true);
        $path = $dir . $nc->autorizacion . '.xml';
        file_put_contents($path, $xml);
        return $path;
    }

    protected function isConsumidorFinalId(?string $id): bool
    {
        $num = preg_replace('/\D/', '', (string)$id);
        if ($num === '9999999999999' || $num === '9999999999') return true;
        return $num !== '' && preg_match('/^9+$/', $num) === 1 && in_array(strlen($num), [10,13], true);
    }
}
