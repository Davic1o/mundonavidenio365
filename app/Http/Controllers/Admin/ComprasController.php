<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Lote;

use Illuminate\Support\Str; // si usas Str::startsWith para el patch de código TMP
use App\Models\Producto;
use App\Models\Proveedor;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class ComprasController extends Controller

{
    /**
     * GET /compras
     * Filtros: ?q=texto (nombre producto) & codigo=COD & proveedor=texto
     */
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

        return Inertia::render('Admin/Compras/Index', [
            'lotes' => $lotes,
            'filtros' => [
                'q' => $q,
                'codigo' => $codigo,
                'proveedor' => $provQuery,
            ],
        ]);
    }

    /**
     * POST /compras
     * Crea proveedor si no existe y registra el lote.
     * Espera:
     *  - producto_id (obligatorio; producto debe existir)
     *  - proveedor_id ó datos proveedor {nombre, ci_o_ruc, telefono?}
     *  - cantidad_compra, fecha_compra
     *  - precio_compra (unitario), costo_transporte (total), precio_compra_final (unitario), porcentaje_ganancia
     */
public function store(Request $request)
{

    $data = $request->validate([

        // lote
        'cantidad_compra'      => ['required','integer','min:1'],
        'fecha_compra'         => ['required','date'],
        'costo_general'        => ['nullable','numeric','min:0'],
        // precios/costos
        'precio_compra'        => ['required','numeric','min:0'],          // unitario base
        'costo_transporte'     => ['nullable','numeric','min:0'],          // total
        'precio_compra_final'  => ['required','numeric','min:0'],          // unitario final
        'porcentaje_ganancia'  => ['nullable','numeric','min:0'],
    ]);
    $userId = auth()->id();
   // dd($request->producto_id);

    return DB::transaction(function () use ($data, $userId, $request) {
        // 1) Resolver proveedor (crear si no existe)
            $proveedor   = Proveedor::findOrFail($request->proveedor_id);
        // 2) Producto (bloqueo pesimista para consistencia de stock)
        $producto = Producto::where('id', (int) $request->producto_id)
            ->lockForUpdate()
            ->firstOrFail();

        // 3) Cálculos
        $cantidad           = (int) $data['cantidad_compra'];
        $unitBase           = (float) $data['precio_compra'];
        $unitUnitario          = $unitBase+((float) ($data['costo_transporte']/100*$data['precio_compra'] ?? 0))+((float) ($data['costo_general']/100*$data['precio_compra'] ?? 0));
        $unitFinal      =$unitUnitario+((float) ($data['porcentaje_ganancia']/100*$unitUnitario ?? 0));
        $costoTransporte    = (float) ($data['costo_transporte'] ?? 0);
        $costoGeneral       = (float) ($data['costo_general'] ?? 0);
        $porcentajeGanancia = (float) ($data['porcentaje_ganancia'] ?? 0);
        $precioTotal        = round($cantidad * $unitFinal , 2);

        // 4) Año derivado de fecha_compra
        $anio = (int) date('Y', strtotime($data['fecha_compra']));

        // 5) Generar/reemplazar código del producto si está vacío o es provisional "TMP-"
        if (empty($producto->codigo) || Str::startsWith((string) $producto->codigo, 'TMP-')) {
            $producto->codigo = $this->generarCodigoProducto($anio, $producto->id, $proveedor->id, $unitUnitario);
            $producto->actualizado_por = $userId;
            $producto->save();
        }

        // 6) Crear lote
        $lote = Lote::create([
            'producto_id'         => $producto->id,
            'proveedor_id'        => $proveedor->id,
            'cantidad_compra'     => $cantidad,
            'fecha_compra'        => $data['fecha_compra'],
            'anio'                => $anio,
            'precio_compra'       => $unitBase,
            'costo_transporte'    => $costoTransporte,
            'costo_general'       => $costoGeneral,
            'precio_compra_final' => $unitFinal,
            'porcentaje_ganancia' => $porcentajeGanancia,
            'precio_total'        => $precioTotal,
            'registrado_por'      => $userId,
        ]);

        // 7) Actualizar stock total del producto
        $producto->increment('cantidad_total', $cantidad);

        return back()->with('success', 'Compra registrada correctamente.');
    });
}


    /**
     * PUT /compras/{lote}
     * Edita un lote y ajusta el stock del producto si cambia la cantidad.
     */
    public function update(Request $request, Lote $lote)
    {
        $data = $request->validate([
            'proveedor_id'         => ['required','exists:proveedores,id'],
            'cantidad_compra'      => ['required','integer','min:1'],
            'fecha_compra'         => ['required','date'],
            'precio_compra'        => ['required','numeric','min:0'],
            'costo_transporte'     => ['nullable','numeric','min:0'],
            'precio_compra_final'  => ['required','numeric','min:0'],
            'porcentaje_ganancia'  => ['nullable','numeric','min:0'],
        ]);

        $userId = auth()->id();

        return DB::transaction(function () use ($lote, $data, $userId) {
            $producto = $lote->producto()->lockForUpdate()->first();

            $oldCantidad = (int) $lote->cantidad_compra;
            $newCantidad = (int) $data['cantidad_compra'];

            // Recalcular totales
            $unitFinal   = (float) $data['precio_compra_final'];
            $precioTotal = round($newCantidad * $unitFinal, 2);
            $anio        = (int) date('Y', strtotime($data['fecha_compra']));

            $lote->update([
                'proveedor_id'        => (int) $data['proveedor_id'],
                'cantidad_compra'     => $newCantidad,
                'fecha_compra'        => $data['fecha_compra'],
                'anio'                => $anio,
                'precio_compra'       => (float) $data['precio_compra'],
                'costo_transporte'    => (float) ($data['costo_transporte'] ?? 0),
                'precio_compra_final' => $unitFinal,
                'porcentaje_ganancia' => (float) ($data['porcentaje_ganancia'] ?? 0),
                'precio_total'        => $precioTotal,
                'actualizado_por'     => $userId,
            ]);

            // Ajuste de stock si cambia la cantidad
            if ($newCantidad !== $oldCantidad) {
                $delta = $newCantidad - $oldCantidad;
                $producto->increment('cantidad_total', $delta);
            }

            return back()->with('success', 'Compra actualizada correctamente.');
        });
    }

    /**
     * DELETE /compras/{lote}
     * Soft delete del lote y ajuste del stock.
     */
    public function destroy(Request $request, Lote $lote)
    {
        $userId = auth()->id();

        return DB::transaction(function () use ($lote, $userId) {
            $producto = $lote->producto()->lockForUpdate()->first();

            // Marcar quién eliminó (auditoría)
            $lote->eliminado_por = $userId;
            $lote->save();

            // Ajustar stock
            $producto->decrement('cantidad_total', (int) $lote->cantidad_compra);

            // Soft delete
            $lote->delete();

            return back()->with('success', 'Compra eliminada correctamente.');
        });
    }

    /**
     * (Opcional) GET /compras/{lote}
     * Devuelve un lote con relaciones (útil para cargar modal de edición).
     */
    public function show(Lote $lote)
    {
        $lote->load(['producto:id,nombre,codigo', 'proveedor:id,nombre,ci_o_ruc,telefono']);
        return response()->json($lote);
    }

    /* ============================
     * Helpers
     * ============================ */

    /**
     * Genera código del producto: YY-productoId-proveedorId-INT-DEC
     * INT y DEC provienen del precio total (redondeado a 2 decimales).
     * Ej: total=3.45 => INT=3, DEC=45  => 25-4-8-3-45
     */
    protected function generarCodigoProducto(int $anio, int $productoId, int $proveedorId, float $precioTotal): string
    {
        $yy = substr((string)$anio, -2);

        $totalRedondeado = round($precioTotal, 2);
        $entero  = (int) floor($totalRedondeado);
        $decimales = (int) round(($totalRedondeado - $entero) * 100);

        // normalizar decimales a dos dígitos
        $decStr = str_pad((string)$decimales, 2, '0', STR_PAD_LEFT);

        return "{$yy}-{$productoId}-{$proveedorId}-{$entero}-{$decStr}";
    }
        /**
     * GET /admin/proveedores/buscar?q=texto
     * Busca proveedores por nombre o CI/RUC (para el selector del formulario).
     * Devuelve JSON: [{id, nombre, ci_o_ruc, telefono}]
     */
   // Busca por nombre o CI/RUC (GET)
public function buscarProveedores(Request $request)
{
    $q = trim($request->string('q')->toString());

    $items = Proveedor::query()
        ->when($q !== '', function ($qr) use ($q) {
            $qr->where(function ($w) use ($q) {
                $w->where('nombre', 'like', "%{$q}%")
                  ->orWhere('ci_o_ruc', 'like', "%{$q}%");
            });
        })
        ->orderBy('nombre')
        ->limit(20)
        ->get(['id', 'nombre', 'ci_o_ruc', 'telefono']);

    return response()->json($items);
}

// Crear proveedor por GET (sin CSRF)
public function crearProveedor(Request $request)
{
    // al ser GET, los datos van en query string
    $data = $request->validate([
        'nombre'   => ['required', 'string', 'max:255'],
        'ci_o_ruc' => ['required', 'string', 'max:20', 'unique:proveedores,ci_o_ruc'],
        'telefono' => ['nullable', 'string', 'max:30'],
    ]);

    $proveedor = Proveedor::create([
        'nombre'         => $data['nombre'],
        'ci_o_ruc'       => $data['ci_o_ruc'],
        'telefono'       => $data['telefono'] ?? null,
        'registrado_por' => auth()->id(),
    ]);

    return response()->json($proveedor, 201);
}


/** GET /admin/productos/buscar?q=... */
public function buscarProductos(Request $request)
{
    $q = trim($request->string('q')->toString());

    $items = Producto::query()
        ->when($q !== '', function ($qr) use ($q) {
            $qr->where('nombre', 'like', "%{$q}%")
               ->orWhere('codigo', 'like', "%{$q}%");
        })
        ->orderBy('nombre')
        ->limit(20)
        ->get(['id','nombre','codigo']);

    return response()->json($items);
}

/** GET /admin/productos/crear?nombre=...  (creación rápida sin CSRF) */
public function crearProducto(Request $request)
{
    $data = $request->validate([
        'nombre' => ['required','string','max:255'],
    ]);

    // Código provisional único (se reemplaza al registrar la compra)
    $tmpCode = 'TMP-'.now()->format('ymd-His').'-'.mt_rand(100,999);

    $producto = Producto::create([
        'nombre'         => $data['nombre'],
        'codigo'         => $tmpCode,
        'cantidad_total' => 0,
        'registrado_por' => auth()->id(),
    ]);

    return response()->json($producto, 201);
}






}

