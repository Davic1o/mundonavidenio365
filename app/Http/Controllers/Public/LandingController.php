<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Venta;
use App\Models\Cliente;
use App\Models\VentaPago;
use App\Models\VentaTarjeta;
use Illuminate\Support\Facades\DB;

class LandingController extends Controller
{
    public function index()
    {
        return Inertia::render('Public/Landing');
    }

    /**
     * GET /consultar?doc=###########
     * Lista de ventas por cédula/RUC (paginadas) + productos + pagos/tarjetas por venta.
     */
public function consultar(Request $request)
{
    $doc = preg_replace('/\D+/', '', (string) $request->query('doc', ''));

    $errors = [];
    // Si quieres validar estrictamente Ecuador: cédula=10, RUC=13
    if ($doc !== '' && (strlen($doc) < 8 || strlen($doc) > 13)) {
        $errors['doc'] = 'El documento debe tener entre 8 y 13 dígitos (cédula o RUC).';
    }

    // SIEMPRE inicializa empresa (evita variable indefinida)
    $empresa = $this->empresaInfo();

    $ventas = null;

    if ($doc !== '' && empty($errors)) {

        $ventas = Venta::query()
            ->with(['cliente:id,nombres,ci_o_ruc,direccion,telefono,correo'])
            ->whereHas('cliente', function ($q) use ($doc) {
                $q->where('ci_o_ruc', $doc);
            })
            // Ajusta el estado según lo que realmente necesitas:
            ->where('estado', 'AUTORIZADO') // <-- antes: 'DEVUELTA'
            ->orderByDesc('fecha')
            ->select([
                'id','cliente_id','fecha','estado',
                'subtotal','impuesto_15','impuesto_0','descuento','total',
                'estab','pto_emision','secuencial','autorizacion'
                // 'numero', // quita si no existe en tu tabla
            ])
            ->paginate(10)
            ->withQueryString();

        $ventaIds = $ventas->getCollection()->pluck('id')->all();

        if (!empty($ventaIds)) {
            // Productos
            $rows = DB::table('venta_productos')
                ->join('productos', 'productos.id', '=', 'venta_productos.producto_id')
                ->whereIn('venta_productos.venta_id', $ventaIds)
                ->select(
                    'venta_productos.venta_id',
                    'venta_productos.producto_id',
                    'venta_productos.cantidad',
                    'venta_productos.precio',
                    'venta_productos.descuento',
                    'venta_productos.precio_total',
                    'productos.nombre as prod_nombre',
                    'productos.codigo as prod_codigo',
                    'productos.cantidad_total as prod_stock'
                )
                ->get()
                ->groupBy('venta_id');

            // Pagos
            $pagos = VentaPago::whereIn('venta_id', $ventaIds)
                ->get()
                ->groupBy('venta_id');

            // Tarjetas
            $tarjetas = VentaTarjeta::whereIn('venta_id', $ventaIds)
                ->get()
                ->groupBy('venta_id');

            // Inyectar datos relacionados
            $ventas->setCollection(
                $ventas->getCollection()->map(function ($v) use ($rows, $pagos, $tarjetas) {

                    $items = $rows->get($v->id, collect());
                    $v->productosVendidos = $items->map(function ($it) {
                        return [
                            'producto_id'  => $it->producto_id,
                            'cantidad'     => $it->cantidad,
                            'precio'       => $it->precio,
                            'descuento'    => $it->descuento,
                            'precio_total' => $it->precio_total,
                            'producto'     => [
                                'nombre'         => $it->prod_nombre,
                                'codigo'         => $it->prod_codigo,
                                'cantidad_total' => $it->prod_stock,
                            ],
                        ];
                    })->values();

                    $p = $pagos->get($v->id, collect());
                    $v->pagos = $p->map(function ($pg) {
                        return [
                            'codigo' => $pg->codigo,
                            'nombre' => $pg->nombre,
                            'valor'  => $pg->valor,
                        ];
                    })->values();

                    $t = $tarjetas->get($v->id, collect());
                    $v->tarjetas = $t->map(function ($tg) {
                        return [
                            'monto'        => $tg->monto,
                            'comision'     => $tg->comision,
                            'tipo_tarjeta' => $tg->tipo_tarjeta,
                            'plazo'        => $tg->plazo,
                        ];
                    })->values();

                    return $v;
                })
            );
        }
    }

    return Inertia::render('Public/Consultar', [
        'doc'     => $doc,
        'errors'  => $errors,
        'ventas'  => $ventas,
        'empresa' => $empresa,
    ]);
}

    /**
     * GET /consultar/ventas/{venta}?doc=###########
     * (lo demás queda igual)
     */
    public function consultarVenta(Request $request, $ventaId)
    {
        $doc = preg_replace('/\D+/', '', (string) $request->query('doc', ''));
        if ($doc === '') abort(404);

        $v = Venta::with('cliente')->findOrFail($ventaId);

        $cli = $v->cliente;
        $ciCliente = $cli?->ci_o_ruc ?? $cli?->ci_o_ruc ?? null;
        if (!$ciCliente || $ciCliente !== $doc) {
            abort(404);
        }

        $items = DB::table('venta_productos')
            ->join('productos','productos.id','=','venta_productos.producto_id')
            ->where('venta_productos.venta_id',$v->id)
            ->select(
                'venta_productos.producto_id','venta_productos.cantidad','venta_productos.precio',
                'venta_productos.descuento','venta_productos.precio_total',
                'productos.nombre','productos.codigo','productos.cantidad_total'
            )->get();

        $pagos    = \App\Models\VentaPago::where('venta_id',$v->id)->get();
        $tarjetas = \App\Models\VentaTarjeta::where('venta_id',$v->id)->get();

        $empresa = $this->empresaInfo();

        $initial = [
            'id'          => $v->id,
            'cliente_id'  => $v->cliente_id,
            'cliente'     => $cli ? [
                'nombres'     => $cli->nombres ?? ($cli->nombre ?? null),
                'ci_o_ruc'    => $cli->ci_o_ruc ?? $cli->ci_o_ruc ?? null,
                'telefono'    => $cli->telefono,
                'correo'      => $cli->correo ?? $cli->email,
                'direccion'   => $cli->direccion,
                'nombre'      => $cli->nombre ?? null,
                'ci_o_ruc'    => $cli->ci_o_ruc ?? null,
            ] : null,
            'fecha'       => $v->fecha,
            'estado'      => $v->estado,

            'productosVendidos' => $items->map(fn($it) => [
                'producto_id' => $it->producto_id,
                'cantidad'    => $it->cantidad,
                'precio'      => $it->precio,
                'descuento'   => $it->descuento,
                'precio_total'=> $it->precio_total,
                'producto'    => [
                    'nombre'         => $it->nombre,
                    'codigo'         => $it->codigo,
                    'cantidad_total' => $it->cantidad_total,
                ],
            ])->values(),

            'pagos'    => $pagos->map(fn($p)=>[
                'codigo'=>$p->codigo,'nombre'=>$p->nombre,'valor'=>$p->valor
            ])->values(),
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

        return response()->json(['initial' => $initial]);
    }

    /** Datos de empresa */
    protected function empresaInfo(): array
    {
        return [
            'nombre_comercial' => config('empresa.nombre_comercial', 'Mundo Navideño 365'),
            'ruc'              => config('empresa.ruc', '1790000000001'),
            'telefono'         => config('empresa.telefono', '099 000 0000'),
            'email'            => config('empresa.email', 'info@mnavidad.ec'),
            'direccion'        => config('empresa.direccion', 'Av. Siempre Viva 123'),
        ];
    }
}
