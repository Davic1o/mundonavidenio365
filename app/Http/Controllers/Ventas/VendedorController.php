<?php

namespace App\Http\Controllers\Ventas;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

// Modelos
use App\Models\Cliente;
use App\Models\Producto;
use App\Models\Venta;
use App\Models\VentaProducto;
use App\Models\VentaPago;
use App\Models\VentaTarjeta;
use App\Services\SignDOcumentToSRI;
use App\Services\SriFacturaService;
use SoapClient;

class VendedorController extends Controller
{
    /* =====================
     * Helpers generales
     * ===================== */

    protected function normalizarItems(array $items): array
    {
        return collect($items)->map(fn($it) => [
            'producto_id' => (int)$it['producto_id'],
            'cantidad'    => (float)$it['cantidad'],
            'precio'      => (float)$it['precio'],        // precio BRUTO (con IVA si corresponde)
            'descuento'   => isset($it['descuento']) ? (float)$it['descuento'] : 0.0,
            'iva'         => (int)($it['iva'] ?? 15),     // 0|15
        ])->all();
    }

    /** Devuelve: base0, base15, subtotal(sin IVA), impuesto_15, impuesto_0, descuento(base), total(con IVA) */
    protected function calcularTotales(array $items): array
    {
        $base0 = 0.0;
        $base15 = 0.0;
        $descTotalBase = 0.0;

        foreach ($items as $it) {
            $cant   = max(0, (float)$it['cantidad']);
            $precio = max(0, (float)$it['precio']);         // BRUTO (con IVA si iva=15)
            $desc   = max(0, (float)($it['descuento'] ?? 0));
            $ivaPct = ((int)($it['iva'] ?? 15)) === 0 ? 0 : 15;

            // Desgrave a base imponible
            $div    = $ivaPct === 15 ? 1.15 : 1.0;
            $pBase  = $precio / $div;
            $dBase  = $desc   / $div;

            $lineaBase = max(0, $cant * $pBase - $dBase);

            if ($ivaPct === 0) {
                $base0 += $lineaBase;
            } else {
                $base15 += $lineaBase;
            }

            $descTotalBase += $dBase;
        }

        $base0       = round($base0, 2);
        $base15      = round($base15, 2);
        $subtotal    = round($base0 + $base15, 2);       // SIN IVA
        $impuesto_15 = round($base15 * 0.15, 2);
        $impuesto_0  = 0.00;
        $total       = round($subtotal + $impuesto_15, 2); // CON IVA

        return [
            'base0'       => $base0,
            'base15'      => $base15,
            'subtotal'    => $subtotal,
            'impuesto_15' => $impuesto_15,
            'impuesto_0'  => $impuesto_0,
            'descuento'   => round($descTotalBase, 2),    // descuento en base
            'total'       => $total,
        ];
    }

    protected function ajustarStock(array $items, int $signo = -1): void
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

    protected function configEmisor($secuencial): array
    {
        $empresa = $this->empresaInfo();

        return [
            'ruc'         => $empresa['ruc'] ?? env('SRI_RUC', '0000000000001'),
            'ambiente'    => (string) ($empresa['ambiente'] ?? env('SRI_AMBIENTE', '1')),
            'estab'       => (string) (!empty($empresa['establecimiento']) ? $empresa['establecimiento'] : (env('SRI_ESTAB') ?: '001')),
            'ptoEmi'      => (string) (!empty($empresa['punto_emision']) ? $empresa['punto_emision'] : (env('SRI_PTO_EMI') ?: '001')),
            'tipoEmision' => '1',
            'secuencial'  => $secuencial,
        ];
    }

    /**
     * Genera la clave de acceso SRI (49 dígitos)
     */
    protected function generarClaveAcceso(
        \DateTimeInterface $fecha,
        array $cfg,
        string $tipoComprobante = '01',
        $secuencial = null,
        ?string $codigoNumerico = null
    ): string {
        $fechaStr       = $fecha->format('dmY'); // ddMMyyyy
        $ruc            = str_pad(preg_replace('/\D/', '', $cfg['ruc'] ?? ''), 13, '0', STR_PAD_LEFT);
        $ambiente       = (string)($cfg['ambiente'] ?? '1');
        $estab          = str_pad((string)($cfg['estab'] ?? ''), 3, '0', STR_PAD_LEFT);
        $ptoEmi         = str_pad((string)($cfg['ptoEmi'] ?? ''), 3, '0', STR_PAD_LEFT);
        $secuencial     = str_pad((string)$cfg['secuencial'], 9, '0', STR_PAD_LEFT);
        $tipoEmision    = (string)($cfg['tipoEmision'] ?? '1');
        $codigoNumerico = $codigoNumerico !== null
            ? str_pad(preg_replace('/\D/','',$codigoNumerico), 8, '0', STR_PAD_LEFT)
            : str_pad((string)random_int(0, 99999999), 8, '0', STR_PAD_LEFT);

        $base = $fechaStr
              . $tipoComprobante
              . $ruc
              . $ambiente
              . $estab
              . $ptoEmi
              . $secuencial
              . $codigoNumerico
              . $tipoEmision;

        $dv = $this->modulo11SRI($base);
        return $base . $dv;
    }

    protected function modulo11SRI(string $cadena48): string
    {
        $coef = [2,3,4,5,6,7];
        $sum = 0;
        $coefIdx = 0;

        for ($i = strlen($cadena48) - 1; $i >= 0; $i--) {
            $dig = (int)$cadena48[$i];
            $sum += $dig * $coef[$coefIdx];
            $coefIdx = ($coefIdx + 1) % count($coef);
        }

        $mod = $sum % 11;
        $dv  = 11 - $mod;
        if ($dv === 11) $dv = 0;
        if ($dv === 10) $dv = 1;

        return (string)$dv;
    }

    /* =====================
     * Helpers de numeración
     * ===================== */

    protected function numeracionConfig(): array
    {
        $e = DB::table('empresas')->select('establecimiento', 'punto_emision')->first();
        return [
            'estab'  => $e->establecimiento ?? env('SRI_ESTAB', '001'),
            'ptoEmi' => $e->punto_emision ?? env('SRI_PTO_EMI', '001'),
        ];
    }

    protected function padSecuencial(int $n): string
    {
        return str_pad((string) $n, 9, '0', STR_PAD_LEFT);
    }

    /** Siguiente secuencial con bloqueo (usar dentro de una transacción) */
    protected function siguienteSecuencialConLock(string $estab, string $ptoEmi): string
    {
        $last = DB::table('ventas')
            ->where('estab', $estab)
            ->where('pto_emision', $ptoEmi)
            ->whereNotNull('secuencial')
            ->lockForUpdate()
            ->orderByDesc('secuencial')
            ->value('secuencial');

        if ($last) {
            $nextInt = ((int) $last) + 1;
        } else {
            // Si no hay ventas, usamos el secuencial inicial configurado en la empresa
            $e = DB::table('empresas')->select('secuencial_factura')->first();
            $nextInt = ($e && !empty($e->secuencial_factura)) ? max(1, (int)$e->secuencial_factura) : 1;
        }

        return $this->padSecuencial($nextInt);
    }

    /* =====================
     * Index / Show
     * ===================== */

    public function index(Request $r)
    {
        $q           = trim((string)$r->query('q',''));
        $estado      = trim((string)$r->query('estado',''));
        $fechaDesde  = $r->query('fecha_desde');
        $fechaHasta  = $r->query('fecha_hasta');

        $ventas = DB::table('ventas')
            ->leftJoin('clientes','clientes.id','=','ventas.cliente_id')
            ->where('ventas.creada_por', auth()->id())
            ->select(
                'ventas.id','ventas.fecha','ventas.estado',
                'ventas.subtotal','ventas.impuesto_15','ventas.impuesto_0','ventas.descuento','ventas.total',
                'clientes.nombres as cliente_nombres','clientes.ci_o_ruc as cliente_ci_o_ruc'
            )
            ->when($q !== '', function($qq) use ($q) {
                $qq->where(function($w) use ($q){
                    $w->where('clientes.nombres','like',"%{$q}%")
                      ->orWhere('clientes.ci_o_ruc','like',"%{$q}%");
                });
            })
            ->when($estado !== '', fn($qq)=>$qq->where('ventas.estado',$estado))
            ->when($fechaDesde, fn($qq)=>$qq->whereDate('ventas.fecha','>=',$fechaDesde))
            ->when($fechaHasta, fn($qq)=>$qq->whereDate('ventas.fecha','<=',$fechaHasta))
            ->orderByDesc('ventas.id')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Ventas/Ventas/Index', [
            'ventas'  => $ventas,
            'filtros' => [
                'q' => $q, 'estado' => $estado,
                'fecha_desde' => $fechaDesde, 'fecha_hasta' => $fechaHasta
            ],
            'flash'   => ['success'=>session('success'),'error'=>session('error')],
        ]);
    }
    public function destroy($id)
    {
        $venta = Venta::where('creada_por', auth()->id())->findOrFail($id);

        // Solo permitir eliminar si el estado es 'creada' o 'creado'
        $estado = strtolower(trim((string)$venta->estado));
        if ($estado !== 'creada' && $estado !== 'creado') {
            return back()->with('error', 'Solo se pueden eliminar ventas en estado CREADA.');
        }

        DB::transaction(function() use ($venta) {
            $venta->delete();
        });

        return back()->with('success', 'Venta eliminada correctamente.');
    }

    /** Empresa desde DB o ENV/Config */
    protected function empresaInfo(): array
    {
        if (Schema::hasTable('empresas')) {
            $e = DB::table('empresas')
                ->select('*')
                ->first();

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
            'ambiente'         => env('SRI_AMBIENTE', 1),
            'establecimiento'  => env('SRI_ESTAB', '001'),
            'punto_emision'    => env('SRI_PTO_EMI', '001'),
            'secuencial_factura'      => '000000001',
            'secuencial_nota_credito' => '000000001',
        ];
    }

    public function show($venta)
    {
        $v = Venta::where('creada_por', auth()->id())->findOrFail($venta);
        $cliente = $v->cliente_id ? Cliente::find($v->cliente_id) : null;

        $items = DB::table('venta_productos')
            ->join('productos','productos.id','=','venta_productos.producto_id')
            ->where('venta_productos.venta_id',$venta)
            ->select(
                'venta_productos.producto_id','venta_productos.cantidad','venta_productos.precio',
                'venta_productos.descuento','venta_productos.precio_total',
                'productos.nombre','productos.codigo','productos.cantidad_total'
            )->get();

        $pagos    = VentaPago::where('venta_id',$venta)->get();
        $tarjetas = VentaTarjeta::where('venta_id',$venta)->get();

        $empresa = $this->empresaInfo();

        $initial = [
            'id'          => $v->id,
            'cliente_id'  => $v->cliente_id,
            'cliente'     => $cliente,
            'fecha'       => $v->fecha,
            'estado'      => $v->estado,

            'productosVendidos' => $items->map(fn($it) => [
                'producto_id' => $it->producto_id,
                'cantidad'    => $it->cantidad,
                'precio'      => $it->precio,
                'descuento'   => $it->descuento,
                'producto'    => [
                    'nombre'         => $it->nombre,
                    'codigo'         => $it->codigo,
                    'cantidad_total' => $it->cantidad_total,
                ],
            ])->values(),

            'pagos'    => $pagos->map(fn($p)=>['codigo'=>$p->codigo,'nombre'=>$p->nombre,'valor'=>$p->valor])->values(),
            'tarjetas' => $tarjetas->map(fn($t)=>[
                'monto'=>$t->monto,'comision'=>$t->comision,'tipo_tarjeta'=>$t->tipo_tarjeta,'plazo'=>$t->plazo
            ])->values(),

            'subtotal'    => $v->subtotal,
            'impuesto_15' => $v->impuesto_15,
            'impuesto_0'  => $v->impuesto_0,
            'descuento'   => $v->descuento,
            'total'       => $v->total,

            'estab'       => $v->estab,
            'pto_emision' => $v->pto_emision,
            'secuencial'  => $v->secuencial,
            'numero'      => $v->numero,
            'autorizacion'=> $v->autorizacion ?? null,

            'empresa' => $empresa,
            'nombre_comercial' => $empresa['nombre_comercial'],
            'ruc_emisor'       => $empresa['ruc'],
            'tel_emisor'       => $empresa['telefono'],
            'email_emisor'     => $empresa['email'],
            'dir_emisor'       => $empresa['direccion'],
        ];

        return Inertia::render('Ventas/Ventas/Show', [
            'initial' => $initial,
            'flash'   => ['success'=>session('success'),'error'=>session('error')],
        ]);
    }

    /* =====================
     * JSON: Autocompletar productos
     * ===================== */

    public function buscarProductos(Request $request)
    {
        $q = trim((string)$request->query('q',''));
        if ($q === '') return response()->json([]);

        $hasDeletedAt       = Schema::hasColumn('productos','deleted_at');

        $hasProdPvp         = Schema::hasColumn('productos','pvp');
        $hasProdPrecioVenta = Schema::hasColumn('productos','precio_venta');
        $hasProdIva         = Schema::hasColumn('productos','iva');

        $hasLotes               = Schema::hasTable('lotes');
        $hasLotePrecioFinal     = $hasLotes && Schema::hasColumn('lotes','precio_compra_final');
        $hasLoteFecha           = $hasLotes && Schema::hasColumn('lotes','fecha_compra');
        $hasLoteEstado          = $hasLotes && Schema::hasColumn('lotes','estado');

        $qtyCol = null;
        if ($hasLotes) {
            if (Schema::hasColumn('lotes','cantidad_restante')) $qtyCol = 'cantidad_restante';
            elseif (Schema::hasColumn('lotes','stock_restante')) $qtyCol = 'stock_restante';
            elseif (Schema::hasColumn('lotes','cantidad'))      $qtyCol = 'cantidad';
        }

        $hasVPPrecio = Schema::hasColumn('venta_productos','precio');
        $hasVPIva    = Schema::hasColumn('venta_productos','iva');

        $subUltPrecioVenta = $hasVPPrecio
            ? "(SELECT vp.precio FROM venta_productos vp
                WHERE vp.producto_id = productos.id
                ORDER BY vp.created_at DESC, vp.id DESC
                LIMIT 1)"
            : "NULL";

        $subUltIvaVenta = $hasVPIva
            ? "(SELECT vp.iva FROM venta_productos vp
                WHERE vp.producto_id = productos.id
                ORDER BY vp.created_at DESC, vp.id DESC
                LIMIT 1)"
            : "NULL";

        $subLoteVigente = "NULL";
        $subLoteReciente = "NULL";
        if ($hasLotePrecioFinal) {
            $order = $hasLoteFecha ? "ORDER BY l.fecha_compra DESC, l.id DESC" : "ORDER BY l.id DESC";

            $vigConds = [];
            if ($hasLoteEstado) $vigConds[] = "l.estado = 'activo'";
            if ($qtyCol)        $vigConds[] = "COALESCE(l.$qtyCol,0) > 0";
            $vigWhere = count($vigConds) ? " AND (".implode(' OR ', $vigConds).")" : "";

            $subLoteVigente = "(SELECT l.precio_compra_final
                                FROM lotes l
                                WHERE l.producto_id = productos.id
                                $vigWhere
                                $order
                                LIMIT 1)";

            $subLoteReciente = "(SELECT l.precio_compra_final
                                 FROM lotes l
                                 WHERE l.producto_id = productos.id
                                 $order
                                 LIMIT 1)";
        }

        $pvpParts = [];
        if ($hasLotePrecioFinal) { $pvpParts[] = $subLoteVigente; $pvpParts[] = $subLoteReciente; }
        if ($hasProdPvp)         $pvpParts[] = 'productos.pvp';
        if ($hasProdPrecioVenta) $pvpParts[] = 'productos.precio_venta';
        $pvpParts[] = $subUltPrecioVenta;
        $pvpExpr = 'COALESCE('.implode(', ', $pvpParts).', 0)';

        $ivaParts = [];
        if ($hasProdIva) $ivaParts[] = 'productos.iva';
        $ivaParts[] = $subUltIvaVenta;
        $ivaExpr = 'COALESCE('.implode(', ', $ivaParts).', 15)';

        $baseQuery = DB::table('productos')
            ->select(['productos.id','productos.nombre','productos.codigo','productos.cantidad_total'])
            ->selectRaw("$pvpExpr as pvp")
            ->selectRaw("$ivaExpr as iva")
            ->when($hasDeletedAt, fn($w)=>$w->whereNull('productos.deleted_at'));

        if (preg_match('/^\d+$/', $q) === 1) {
            $rows = (clone $baseQuery)
                ->where('productos.id', (int)$q)
                ->limit(1)
                ->get()
                ->map(function($r){
                    $r->pvp = (float)($r->pvp ?? 0);
                    $r->iva = in_array((int)$r->iva, [0,15], true) ? (int)$r->iva : 15;
                    return $r;
                });

            return response()->json($rows);
        }

        $rows = (clone $baseQuery)
            ->where(function($qq) use ($q){
                $qq->where('productos.nombre','like',"%{$q}%")
                   ->orWhere('productos.codigo','like',"%{$q}%");
            })
            ->orderBy('productos.nombre')
            ->limit(20)
            ->get()
            ->map(function($r){
                $r->pvp = (float)($r->pvp ?? 0);
                $r->iva = in_array((int)$r->iva, [0,15], true) ? (int)$r->iva : 15;
                return $r;
            });

        return response()->json($rows);
    }

    /* =====================
     * Wizard: 3 vistas
     * ===================== */

    public function vistaCliente($ventaId = null)
    {
        $venta = ($ventaId && $ventaId !== 'nueva')
            ? Venta::where('creada_por', auth()->id())->findOrFail($ventaId)
            : null;

        return Inertia::render('Ventas/Ventas/ClienteSelect', [
            'venta' => $venta,
            'flash' => ['success'=>session('success'),'error'=>session('error')],
        ]);
    }

    public function iniciarConCliente(Request $r, $ventaId = null)
    {
        $payload = $r->validate([
            'cliente_id'          => ['nullable','integer','exists:clientes,id'],
            'nuevo'               => ['nullable','array'],
            'nuevo.nombres'       => ['required_without:cliente_id','string','max:255'],
            'nuevo.ci_o_ruc'      => ['required_without:cliente_id','unique:clientes,ci_o_ruc','string','max:20'],
            'nuevo.telefono'      => ['nullable','string','max:50'],
            'nuevo.direccion'     => ['nullable','string','max:255'],
            'nuevo.correo'        => ['nullable','email','max:255'],
        ]);

        // 1) Crear/obtener cliente
        $clienteId = $payload['cliente_id'] ?? null;
        if (!$clienteId) {
            $cli = Cliente::create($payload['nuevo']);
            $clienteId = $cli->id;
        }

        // Si ya existe la venta en DB, la actualizamos y volvemos al paso anterior
        if ($ventaId && $ventaId !== 'nueva') {
            $venta = Venta::where('creada_por', auth()->id())->findOrFail($ventaId);
            if ($venta->estado === 'autorizado') {
                return back()->with('error', 'No se puede cambiar el cliente de una venta ya autorizada.');
            }
            $venta->cliente_id = (int)$clienteId;
            $venta->save();
            return redirect()->route('ventas.ventas.vista_productos', $venta->id);
        }

        // NUEVA VENTA: Guardar borrador en sesión sin insertar registro en la BD
        session([
            'draft_venta' => [
                'cliente_id' => (int)$clienteId,
                'items' => [],
                'totales' => ['base0' => 0, 'base15' => 0, 'subtotal' => 0, 'impuesto_15' => 0, 'impuesto_0' => 0, 'descuento' => 0, 'total' => 0],
            ]
        ]);

        return redirect()->route('ventas.ventas.vista_productos', 'nueva');
    }

    public function vistaProductos($venta)
    {
        if ($venta === 'nueva') {
            $draft = session('draft_venta');
            if (!$draft || !isset($draft['cliente_id'])) {
                return redirect()->route('ventas.ventas.vista_cliente')->with('error', 'Por favor selecciona un cliente para la venta.');
            }
            $cliente = Cliente::find($draft['cliente_id']);
            $items = $draft['items'] ?? [];
            $v = [
                'id' => 'nueva',
                'estado' => 'creada',
                'subtotal' => $draft['totales']['subtotal'] ?? 0,
                'total' => $draft['totales']['total'] ?? 0,
            ];
            return Inertia::render('Ventas/Ventas/Editar', [
                'venta'   => $v,
                'cliente' => $cliente,
                'items'   => $items,
                'flash'   => ['success'=>session('success'),'error'=>session('error')],
            ]);
        }

        $v = Venta::where('creada_por', auth()->id())->findOrFail($venta);
        $cliente = $v->cliente_id ? Cliente::find($v->cliente_id) : null;

        $items = VentaProducto::query()
            ->join('productos','productos.id','=','venta_productos.producto_id')
            ->where('venta_productos.venta_id',$v->id)
            ->select('venta_productos.*','productos.nombre','productos.codigo')
            ->get();

        return Inertia::render('Ventas/Ventas/Editar', [
            'venta'   => $v,
            'cliente' => $cliente,
            'items'   => $items,
            'flash'   => ['success'=>session('success'),'error'=>session('error')],
        ]);
    }

    public function guardarItems(Request $request, $venta)
    {
        $data = $request->validate([
            'items'               => ['required','array','min:1'],
            'items.*.producto_id' => ['required','integer','exists:productos,id'],
            'items.*.cantidad'    => ['required','numeric','min:0.0001'],
            'items.*.precio'      => ['required','numeric','min:0'],
            'items.*.descuento'   => ['nullable','numeric','min:0'],
            'items.*.iva'         => ['nullable','integer', Rule::in([0,15])],
        ]);

        $itemsNorm = $this->normalizarItems($data['items']);
        $tot = $this->calcularTotales($itemsNorm);

        if ($venta === 'nueva') {
            $draft = session('draft_venta');
            if (!$draft || !isset($draft['cliente_id'])) {
                return redirect()->route('ventas.ventas.vista_cliente')->with('error', 'La sesión de la venta ha expirado.');
            }

            $prodIds = array_column($itemsNorm, 'producto_id');
            $prods = DB::table('productos')->whereIn('id', $prodIds)->get(['id','nombre','codigo','cantidad_total'])->keyBy('id');

            $itemsWithMeta = array_map(function($it) use ($prods) {
                $p = $prods->get($it['producto_id']);
                $it['nombre'] = $p ? $p->nombre : 'Producto';
                $it['codigo'] = $p ? $p->codigo : '';
                $it['cantidad_total'] = $p ? $p->cantidad_total : 9999;
                return $it;
            }, $itemsNorm);

            $draft['items'] = $itemsWithMeta;
            $draft['totales'] = $tot;
            session(['draft_venta' => $draft]);

            return redirect()->route('ventas.ventas.vista_pagos', 'nueva');
        }

        $v = Venta::where('creada_por', auth()->id())->findOrFail($venta);

        DB::transaction(function() use ($v, $itemsNorm, $tot){
            VentaProducto::where('venta_id',$v->id)->delete();

            foreach ($itemsNorm as $it) {
                $ivaPct = ((int)($it['iva'] ?? 15)) === 0 ? 0 : 15;
                $div    = $ivaPct === 15 ? 1.15 : 1.0;

                $pBase  = $it['precio'] / $div;
                $dBase  = $it['descuento'] / $div;

                $precioTotalBase  = max(0, $it['cantidad'] * $pBase - $dBase);
                $precioTotalLinea = $ivaPct === 15
                    ? round($precioTotalBase * 1.15, 2)
                    : round($precioTotalBase, 2);

                VentaProducto::create([
                    'venta_id'     => $v->id,
                    'producto_id'  => $it['producto_id'],
                    'cantidad'     => $it['cantidad'],
                    'precio'       => $it['precio'],
                    'descuento'    => $it['descuento'],
                    'precio_total' => $precioTotalLinea,
                ]);
            }

            $v->subtotal    = $tot['subtotal'];
            $v->impuesto_15 = $tot['impuesto_15'];
            $v->impuesto_0  = $tot['impuesto_0'];
            $v->descuento   = $tot['descuento'];
            $v->total       = $tot['total'];
            $v->save();
        });

        return redirect()->route('ventas.ventas.vista_pagos', $v->id);
    }

    public function vistaPagos($venta)
    {
        if ($venta === 'nueva') {
            $draft = session('draft_venta');
            if (!$draft || !isset($draft['cliente_id'])) {
                return redirect()->route('ventas.ventas.vista_cliente')->with('error', 'La sesión de la venta ha expirado.');
            }
            $cliente = Cliente::find($draft['cliente_id']);
            $items = $draft['items'] ?? [];
            $tot = $draft['totales'] ?? $this->calcularTotales($items);

            $v = (object)[
                'id'          => 'nueva',
                'estado'      => 'creada',
                'subtotal'    => $tot['subtotal'],
                'impuesto_15' => $tot['impuesto_15'],
                'impuesto_0'  => $tot['impuesto_0'],
                'descuento'   => $tot['descuento'],
                'total'       => $tot['total'],
            ];

            return Inertia::render('Ventas/Ventas/Pagos', [
                'venta'=>$v, 'cliente'=>$cliente, 'items'=>$items,
                'pagos'=>[], 'tarjetas'=>[],
                'flash'=>['success'=>session('success'),'error'=>session('error')],
            ]);
        }

        $v = Venta::where('creada_por', auth()->id())->findOrFail($venta);
        $cliente = $v->cliente_id ? Cliente::find($v->cliente_id) : null;
        $items   = VentaProducto::where('venta_id',$v->id)->get();
        $pagos   = VentaPago::where('venta_id',$v->id)->get();
        $tarjetas= VentaTarjeta::where('venta_id',$v->id)->get();

        return Inertia::render('Ventas/Ventas/Pagos', [
            'venta'=>$v, 'cliente'=>$cliente, 'items'=>$items,
            'pagos'=>$pagos, 'tarjetas'=>$tarjetas,
            'flash'=>['success'=>session('success'),'error'=>session('error')],
        ]);
    }

    /**
     * Paso final: guardar pagos / numerar / firmar / enviar y autorizar SRI.
     */
    public function guardarPagos(Request $request, $ventaId)
    {
        $isNueva = ($ventaId === 'nueva');
        $empresa = $this->empresaInfo();

        $ambiente = $empresa['ambiente'];
        $urlRec = ($ambiente == 2) 
            ? 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl' 
            : 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl';
        $urlAut = ($ambiente == 2) 
            ? 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl' 
            : 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl';

        $webRecepcion = env('SRI_RECEPCION', $urlRec);
        $webAutoriza  = env('SRI_AUTORIZACION', $urlAut);

        $stockMov = ['aplico' => false, 'items' => []];
        $venta = null;

        try {
            DB::transaction(function () use (&$venta, $isNueva, $request, &$stockMov) {
                if ($isNueva) {
                    $draft = session('draft_venta');
                    if (!$draft || !isset($draft['cliente_id'])) {
                        throw new \DomainException('DRAFT_EXPIRED:La sesión de la venta ha expirado.');
                    }

                    $draftItems = $draft['items'] ?? [];
                    if (empty($draftItems)) {
                        throw new \DomainException('NO_STOCK:No hay productos cargados en la venta.');
                    }

                    $cfgNum = $this->numeracionConfig();
                    $estab  = $cfgNum['estab'];
                    $ptoEmi = $cfgNum['ptoEmi'];
                    $sec    = $this->siguienteSecuencialConLock($estab, $ptoEmi);
                    $num    = $estab . '-' . $ptoEmi . '-' . $sec;

                    $venta = new Venta();
                    $venta->cliente_id   = (int)$draft['cliente_id'];
                    $venta->fecha        = now()->toDateTimeString();
                    $venta->estado       = 'creada';
                    $venta->estab        = $estab;
                    $venta->pto_emision  = $ptoEmi;
                    $venta->secuencial   = $sec;
                    $venta->numero       = $num;

                    $tot = $draft['totales'] ?? $this->calcularTotales($draftItems);
                    $venta->subtotal     = $tot['subtotal'];
                    $venta->impuesto_15  = $tot['impuesto_15'];
                    $venta->impuesto_0   = $tot['impuesto_0'];
                    $venta->descuento    = $tot['descuento'];
                    $venta->total        = $tot['total'];
                    $venta->creada_por   = auth()->id();

                    $cfg = $this->configEmisor($sec);
                    $venta->autorizacion = $this->generarClaveAcceso(now(), $cfg, '01');
                    $venta->save();

                    // Guardar ítems en DB
                    foreach ($draftItems as $it) {
                        $ivaPct = ((int)($it['iva'] ?? 15)) === 0 ? 0 : 15;
                        $div    = $ivaPct === 15 ? 1.15 : 1.0;
                        $pBase  = $it['precio'] / $div;
                        $dBase  = $it['descuento'] / $div;
                        $precioTotalBase  = max(0, $it['cantidad'] * $pBase - $dBase);
                        $precioTotalLinea = $ivaPct === 15
                            ? round($precioTotalBase * 1.15, 2)
                            : round($precioTotalBase, 2);

                        VentaProducto::create([
                            'venta_id'     => $venta->id,
                            'producto_id'  => $it['producto_id'],
                            'cantidad'     => $it['cantidad'],
                            'precio'       => $it['precio'],
                            'descuento'    => $it['descuento'],
                            'precio_total' => $precioTotalLinea,
                        ]);
                    }
                } else {
                    $venta = Venta::where('creada_por', auth()->id())->with(['cliente'])->findOrFail($request->route('venta'));
                }

                /* 1) Reemplazar pagos */
                VentaPago::where('venta_id', $venta->id)->delete();
                $totalPagos = 0.0;

                foreach ((array) $request->pagos as $p) {
                    $valor = max(0, (float)($p['valor'] ?? 0));
                    if ($valor <= 0) continue;

                    VentaPago::create([
                        'venta_id' => $venta->id,
                        'codigo'   => isset($p['codigo']) ? trim($p['codigo']) : null,
                        'nombre'   => isset($p['nombre']) ? trim($p['nombre']) : null,
                        'valor'    => $valor,
                    ]);
                    $totalPagos += $valor;
                }

                /* 2) Tarjeta (si hay) */
                VentaTarjeta::where('venta_id', $venta->id)->delete();
                if (isset($request->tarjeta) && is_array($request->tarjeta)) {
                    $t = $request->tarjeta;
                    $monto = max(0, (float)($t['monto'] ?? 0));
                    if ($monto > 0) {
                        VentaTarjeta::create([
                            'venta_id'     => $venta->id,
                            'monto'        => $monto,
                            'comision'     => isset($t['comision']) ? max(0, (float)$t['comision']) : 0.0,
                            'tipo_tarjeta' => isset($t['tipo_tarjeta']) ? trim($t['tipo_tarjeta']) : null,
                            'plazo'        => isset($t['plazo']) ? max(0, (int)$t['plazo']) : 0,
                        ]);
                        $totalPagos += $monto;
                    }
                }

                /* 3) Validar y descontar stock (solo si aún no estaba emitida) */
                if ($venta->estado !== 'emitida') {
                    $itemsAgg = DB::table('venta_productos')
                        ->where('venta_id', $venta->id)
                        ->select('producto_id', DB::raw('SUM(cantidad) as qty'))
                        ->groupBy('producto_id')
                        ->get();

                    if ($itemsAgg->isEmpty()) {
                        throw new \DomainException('NO_STOCK:No hay productos cargados en la venta.');
                    }

                    $ids = $itemsAgg->pluck('producto_id')->all();

                    $prods = DB::table('productos')
                        ->whereIn('id', $ids)
                        ->lockForUpdate()
                        ->get(['id','nombre','codigo','cantidad_total']);

                    // Descontar del stock sin bloquear la emisión por saldo insuficiente
                    foreach ($itemsAgg as $it) {
                        DB::table('productos')
                            ->where('id', $it->producto_id)
                            ->decrement('cantidad_total', $it->qty);
                    }

                    $stockMov['aplico'] = true;
                    $stockMov['items']  = $itemsAgg->map(fn($r) => [
                        'producto_id' => $r->producto_id,
                        'cantidad'    => (float)$r->qty,
                    ])->values()->all();
                }

                /* 4) Numeración y datos de emisión */
                $venta->refresh();

                if (strtoupper((string)($venta->sri_estado_autorizacion ?? '')) !== 'AUTORIZADO') {
                    $cfgNum = $this->numeracionConfig();
                    $estab  = $cfgNum['estab'];
                    $ptoEmi = $cfgNum['ptoEmi'];

                    if (empty($venta->secuencial) || $venta->estab !== $estab || $venta->pto_emision !== $ptoEmi) {
                        $sec = $this->siguienteSecuencialConLock($estab, $ptoEmi);
                        $venta->secuencial = $sec;
                    }

                    $venta->estab       = $estab;
                    $venta->pto_emision = $ptoEmi;
                    $venta->numero      = $estab . '-' . $ptoEmi . '-' . str_pad((string)$venta->secuencial, 9, '0', STR_PAD_LEFT);
                    $venta->estado      = 'emitida';
                    $venta->fecha       = \Carbon\Carbon::now()->toDateTimeString();

                    // Re-generar claveAcceso con fecha actual, estab, ptoEmi, secuencial y configuracion vigente de la empresa
                    $fechaEmision = \Carbon\Carbon::parse($venta->fecha);
                    $cfg = $this->configEmisor($venta->secuencial);
                    $venta->autorizacion = $this->generarClaveAcceso($fechaEmision, $cfg, '01');
                    $venta->save();
                }
            });

            // Limpiar borrador de sesión tras éxito
            session()->forget('draft_venta');
        } catch (\DomainException $e) {
            $targetId = ($isNueva || !$venta) ? 'nueva' : $venta->id;
            if (str_starts_with($e->getMessage(), 'DRAFT_EXPIRED:')) {
                return redirect()
                    ->route('ventas.ventas.vista_cliente')
                    ->with('error', 'La sesión de la venta ha expirado.');
            }
            if (str_starts_with($e->getMessage(), 'NO_STOCK:')) {
                $raw   = substr($e->getMessage(), strlen('NO_STOCK:'));
                $items = array_filter(explode('||', $raw));
                $msg   = $items
                    ? 'No hay la cantidad exacta de productos para: ' . implode(', ', $items)
                    : 'No hay la cantidad exacta de productos.';
                return redirect()
                    ->route('ventas.ventas.vista_pagos', $targetId)
                    ->with('error', $msg);
            }
            throw $e;
        }

        /* === Emitir y Autorizar ante el SRI mediante SriFacturaService === */
        $sriService = new SriFacturaService();
        $resultadoSRI = $sriService->procesarFacturaSRI($venta, $empresa, $stockMov);

        if (!$resultadoSRI['success']) {
            return redirect()->route('ventas.ventas.show', $venta->id)
                ->with('error', $resultadoSRI['message']);
        }

        return redirect()->route('ventas.ventas.show', $venta->id)
            ->with('success', $resultadoSRI['message']);
    }

    protected function isConsumidorFinalId(?string $id): bool
    {
        $num = preg_replace('/\D/', '', (string)$id);
        if ($num === '9999999999999' || $num === '9999999999') return true;
        return $num !== '' && preg_match('/^9+$/', $num) === 1 && in_array(strlen($num), [10,13], true);
    }
}

