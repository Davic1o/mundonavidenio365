<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Producto;
use App\Models\Proveedor;
use App\Models\Lote;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class CambioCodigoProductoController extends Controller
{
    /**
     * Muestra la vista exclusiva para el administrador para gestionar y cambiar códigos de producto
     * y los campos base de la etiqueta (proveedor, precio de compra, etc.).
     */
    public function index(Request $request)
    {
        // Doble verificación de seguridad: permiso de cambio de código
        if (!auth()->check() || !auth()->user()->hasPermission('cambio_codigo.view')) {
            abort(403, 'Acceso denegado. No tienes permisos para ver el módulo de cambio de códigos.');
        }

        // Auto-reparación y resiliencia de columnas y tablas
        $this->ensureProductosColumnsExist();
        $hasLotes               = $this->ensureLotesTableExists();
        $hasVentaProductos      = Schema::hasTable('venta_productos');
        $hasNotaCreditoDetalles = Schema::hasTable('nota_credito_detalles');
        $hasUsers               = Schema::hasTable('users');

        // Obtener lista completa y robusta de proveedores
        $proveedores = $this->getProveedoresList();
        $firstProvId = $proveedores->first()?->id ?? 1;

        $q = trim((string) $request->query('q', ''));

        // Relaciones a cargar
        $withRelations = [];
        if ($hasUsers && Schema::hasColumn('productos', 'registrado_por')) {
            $withRelations[] = 'registradoPor:id,name';
        }
        if ($hasUsers && Schema::hasColumn('productos', 'actualizado_por')) {
            $withRelations[] = 'actualizadoPor:id,name';
        }

        if ($hasLotes) {
            $withRelations['lotes'] = function ($loteQuery) {
                $loteQuery->latest('fecha_compra')
                    ->latest('id')
                    ->take(1);

                if (Schema::hasTable('proveedores')) {
                    $loteQuery->with('proveedor:id,nombre');
                }
            };
        }

        // Columnas a seleccionar de la tabla productos de forma totalmente dinámica
        $selectCols = ['id', 'nombre'];

        if (Schema::hasColumn('productos', 'codigo')) {
            $selectCols[] = 'codigo';
        } elseif (Schema::hasColumn('productos', 'barcode')) {
            $selectCols[] = 'barcode as codigo';
        }

        if (Schema::hasColumn('productos', 'cantidad_total')) {
            $selectCols[] = 'cantidad_total';
        } elseif (Schema::hasColumn('productos', 'cantidad')) {
            $selectCols[] = 'cantidad as cantidad_total';
        } elseif (Schema::hasColumn('productos', 'stock')) {
            $selectCols[] = 'stock as cantidad_total';
        }

        if (Schema::hasColumn('productos', 'registrado_por')) {
            $selectCols[] = 'registrado_por';
        }
        if (Schema::hasColumn('productos', 'actualizado_por')) {
            $selectCols[] = 'actualizado_por';
        }
        if (Schema::hasColumn('productos', 'created_at')) {
            $selectCols[] = 'created_at';
        }
        if (Schema::hasColumn('productos', 'updated_at')) {
            $selectCols[] = 'updated_at';
        }

        $query = Producto::query()->select($selectCols);

        if (!empty($withRelations)) {
            $query->with($withRelations);
        }

        // Conteo de relaciones existentes
        $counts = [];
        if ($hasLotes) {
            $counts[] = 'lotes';
        }
        if ($hasVentaProductos) {
            $counts[] = 'ventaProductos';
        }
        if ($hasNotaCreditoDetalles) {
            $counts[] = 'notaCreditoDetalles';
        }

        if (!empty($counts)) {
            $query->withCount($counts);
        }

        if ($q !== '') {
            $query->where(function ($sub) use ($q) {
                $sub->where('nombre', 'like', "%{$q}%")
                    ->orWhere('id', $q);

                if (Schema::hasColumn('productos', 'codigo')) {
                    $sub->orWhere('codigo', 'like', "%{$q}%");
                }
                if (Schema::hasColumn('productos', 'barcode')) {
                    $sub->orWhere('barcode', 'like', "%{$q}%");
                }
            });
        }

        $productos = $query
            ->orderBy('id', 'desc')
            ->paginate(15)
            ->withQueryString()
            ->through(function (Producto $p) use ($hasLotes, $hasVentaProductos, $hasNotaCreditoDetalles, $proveedores, $firstProvId) {
                $ultimoLote = ($hasLotes && $p->relationLoaded('lotes')) ? $p->lotes->first() : null;

                $stockTotal = 0;
                if (isset($p->cantidad_total)) {
                    $stockTotal = (int) $p->cantidad_total;
                } elseif (isset($p->cantidad)) {
                    $stockTotal = (int) $p->cantidad;
                } elseif (isset($p->stock)) {
                    $stockTotal = (int) $p->stock;
                }

                $codigoVal = $p->codigo ?? $p->barcode ?? '';

                // Descomponer código si cumple el estándar YY-ProdID-ProvID-INT-DEC
                $parts = explode('-', (string)$codigoVal);
                $codeAnio   = (count($parts) >= 1 && is_numeric($parts[0])) ? (int)("20" . substr($parts[0], -2)) : null;
                $codeProvId = (count($parts) >= 3 && is_numeric($parts[2])) ? (int)$parts[2] : null;
                $codePrecio = (count($parts) >= 5 && is_numeric($parts[3]) && is_numeric($parts[4])) ? (float)("{$parts[3]}.{$parts[4]}") : null;

                $provIdCalculado = $ultimoLote?->proveedor_id ?: ($codeProvId ?: $firstProvId);

                // Buscar nombre del proveedor
                $provItem = $proveedores->firstWhere('id', $provIdCalculado) ?? $ultimoLote?->proveedor;
                $provNombre = $provItem?->nombre ?? null;
                $provRuc    = $provItem?->ci_o_ruc ?? null;

                $precioCompraFinal = $ultimoLote ? (float)$ultimoLote->precio_compra : ($codePrecio ?: 0);
                $pvpFinal = $ultimoLote ? (float)$ultimoLote->precio_compra_final : $precioCompraFinal;
                $anioFinal = $ultimoLote?->anio ?: ($codeAnio ?: (int)date('Y'));

                return [
                    'id'                  => $p->id,
                    'nombre'              => $p->nombre,
                    'codigo'              => $codigoVal,
                    'cantidad_total'      => $stockTotal,
                    'registrado_por'      => $p->registradoPor?->name ?? 'Sistema',
                    'actualizado_por'     => $p->actualizadoPor?->name ?? null,
                    'created_at'          => $p->created_at?->toISOString(),
                    'updated_at'          => $p->updated_at?->toISOString(),
                    'lotes_count'         => ($hasLotes && isset($p->lotes_count)) ? (int) $p->lotes_count : 0,
                    'ventas_count'        => ($hasVentaProductos && isset($p->venta_productos_count)) ? (int) $p->venta_productos_count : 0,
                    'notas_credito_count' => ($hasNotaCreditoDetalles && isset($p->nota_credito_detalles_count)) ? (int) $p->nota_credito_detalles_count : 0,
                    // Datos del lote para la fórmula de la etiqueta
                    'ultimo_lote_id'      => $ultimoLote?->id ?? null,
                    'proveedor_id'        => $provIdCalculado,
                    'proveedor_nombre'    => $provNombre,
                    'proveedor_ruc'       => $provRuc,
                    'precio_compra'       => $precioCompraFinal,
                    'costo_general'       => $ultimoLote ? (float) ($ultimoLote->costo_general ?? 0) : 0,
                    'costo_transporte'    => $ultimoLote ? (float) ($ultimoLote->costo_transporte ?? 0) : 0,
                    'comision_pct'        => $ultimoLote ? (float) ($ultimoLote->comision_pct ?? 0) : 0,
                    'porcentaje_ganancia' => $ultimoLote ? (float) ($ultimoLote->porcentaje_ganancia ?? 0) : 0,
                    'precio_compra_final' => $pvpFinal,
                    'anio'                => $anioFinal,
                    'fecha_compra'        => $ultimoLote?->fecha_compra?->format('Y-m-d') ?? date('Y-m-d'),
                ];
            });

        // Estadísticas rápidas para la cabecera
        $totalProductos = Producto::count();
        $totalConLotes  = $hasLotes ? Producto::has('lotes')->count() : 0;

        return Inertia::render('Admin/Productos/CambiarCodigo', [
            'productos'   => $productos,
            'proveedores' => $proveedores,
            'filtros'     => [
                'q' => $q,
            ],
            'stats'       => [
                'total_productos' => $totalProductos,
                'total_con_lotes' => $totalConLotes,
            ],
        ]);
    }

    /**
     * Actualiza el código del producto y, opcionalmente, los datos del lote que originan
     * la etiqueta (proveedor, precio de compra, costos, año) para sincronizar el sistema.
     */
    public function update(Request $request, Producto $producto)
    {
        // Doble verificación de seguridad: permiso de actualización de código
        if (!auth()->check() || !auth()->user()->hasPermission('cambio_codigo.update')) {
            abort(403, 'Acceso denegado. No tienes permisos para actualizar códigos de producto.');
        }

        $codeColumn = Schema::hasColumn('productos', 'codigo') ? 'codigo' : 'barcode';

        $rules = [
            'nuevo_codigo'        => [
                'required',
                'string',
                'max:50',
                Rule::unique('productos', $codeColumn)->ignore($producto->id),
            ],
            'acepta_riesgo'       => [
                'required',
                'accepted',
            ],
            'actualizar_lote'     => ['nullable', 'boolean'],
            'proveedor_id'        => ['nullable'],
            'precio_compra'       => ['nullable', 'numeric', 'min:0'],
            'costo_general'       => ['nullable', 'numeric', 'min:0'],
            'costo_transporte'    => ['nullable', 'numeric', 'min:0'],
            'comision_pct'        => ['nullable', 'numeric', 'min:0'],
            'porcentaje_ganancia' => ['nullable', 'numeric', 'min:0'],
            'precio_compra_final' => ['nullable', 'numeric', 'min:0'],
            'anio'                => ['nullable', 'integer', 'min:2000', 'max:2099'],
        ];

        $validated = $request->validate($rules, [
            'nuevo_codigo.required'  => 'El nuevo código es obligatorio.',
            'nuevo_codigo.string'    => 'El código debe ser una cadena de texto válida.',
            'nuevo_codigo.max'       => 'El código no puede superar los 50 caracteres.',
            'nuevo_codigo.unique'    => 'Este código ya está asignado a otro producto en el sistema. Debe ser único.',
            'acepta_riesgo.required' => 'Debe confirmar y aceptar el riesgo sobre las etiquetas impresas.',
            'acepta_riesgo.accepted' => 'Debe marcar la casilla confirmando que acepta el riesgo sobre la validez de las etiquetas ya impresas.',
        ]);

        $nuevoCodigo    = trim($validated['nuevo_codigo']);
        $userId         = auth()->id();
        $hasLotes       = $this->ensureLotesTableExists();

        DB::transaction(function () use ($producto, $validated, $nuevoCodigo, $userId, $hasLotes) {
            // 1. Actualizar código / barcode del producto
            $updateProduct = [];
            if (Schema::hasColumn('productos', 'codigo')) {
                $updateProduct['codigo'] = $nuevoCodigo;
            }
            if (Schema::hasColumn('productos', 'barcode')) {
                $updateProduct['barcode'] = $nuevoCodigo;
            }
            if (Schema::hasColumn('productos', 'actualizado_por')) {
                $updateProduct['actualizado_por'] = $userId;
            }

            if (!empty($updateProduct)) {
                $producto->update($updateProduct);
            }

            // 2. Si se solicitó actualizar los campos de la etiqueta en el lote y existe la tabla lotes
            $actualizarLote = !empty($validated['actualizar_lote']);

            if ($hasLotes && $actualizarLote) {
                $lote = $producto->lotes()->latest('fecha_compra')->latest('id')->first();

                $proveedorId = !empty($validated['proveedor_id'])
                    ? (int) $validated['proveedor_id']
                    : ($lote?->proveedor_id ?? 1);

                $precioCompra = isset($validated['precio_compra']) && $validated['precio_compra'] !== ''
                    ? (float) $validated['precio_compra']
                    : ($lote ? (float)$lote->precio_compra : 0);

                $costoGeneral = isset($validated['costo_general'])
                    ? (float) $validated['costo_general']
                    : ($lote ? (float)$lote->costo_general : 0);

                $costoTransporte = isset($validated['costo_transporte'])
                    ? (float) $validated['costo_transporte']
                    : ($lote ? (float)$lote->costo_transporte : 0);

                $comisionPct = isset($validated['comision_pct'])
                    ? (float) $validated['comision_pct']
                    : ($lote ? (float)($lote->comision_pct ?? 0) : 0);

                $porcentajeGanancia = isset($validated['porcentaje_ganancia'])
                    ? (float) $validated['porcentaje_ganancia']
                    : ($lote ? (float)($lote->porcentaje_ganancia ?? 0) : 0);

                $precioCompraFinal = isset($validated['precio_compra_final']) && (float) $validated['precio_compra_final'] > 0
                    ? (float) $validated['precio_compra_final']
                    : ($lote ? (float)$lote->precio_compra_final : $precioCompra);

                $anio = !empty($validated['anio'])
                    ? (int) $validated['anio']
                    : ($lote?->anio ?? (int) date('Y'));

                if ($lote) {
                    $cantLote = (int)$lote->cantidad_compra;
                    $updateLoteData = [
                        'precio_compra'       => $precioCompra,
                        'costo_general'       => $costoGeneral,
                        'costo_transporte'    => $costoTransporte,
                        'porcentaje_ganancia' => $porcentajeGanancia,
                        'precio_compra_final' => $precioCompraFinal,
                        'precio_total'        => round($cantLote * $precioCompraFinal, 2),
                        'anio'                => $anio,
                    ];

                    if (Schema::hasColumn('lotes', 'actualizado_por')) {
                        $updateLoteData['actualizado_por'] = $userId;
                    }

                    if ($proveedorId && Schema::hasColumn('lotes', 'proveedor_id')) {
                        $updateLoteData['proveedor_id'] = $proveedorId;
                    }

                    if (Schema::hasColumn('lotes', 'comision_pct')) {
                        $updateLoteData['comision_pct'] = $comisionPct;
                    }

                    $lote->update($updateLoteData);
                } elseif ($proveedorId) {
                    // Si el producto no tenía lote previo, se genera el registro del lote base
                    $cant = 1;
                    if (isset($producto->cantidad_total) && (int)$producto->cantidad_total > 0) {
                        $cant = (int)$producto->cantidad_total;
                    } elseif (isset($producto->cantidad) && (int)$producto->cantidad > 0) {
                        $cant = (int)$producto->cantidad;
                    }

                    $loteData = [
                        'producto_id'         => $producto->id,
                        'proveedor_id'        => $proveedorId,
                        'cantidad_compra'     => $cant,
                        'fecha_compra'        => now()->toDateString(),
                        'anio'                => $anio,
                        'precio_compra'       => $precioCompra,
                        'costo_general'       => $costoGeneral,
                        'costo_transporte'    => $costoTransporte,
                        'porcentaje_ganancia' => $porcentajeGanancia,
                        'precio_compra_final' => $precioCompraFinal,
                        'precio_total'        => round($cant * $precioCompraFinal, 2),
                    ];

                    if (Schema::hasColumn('lotes', 'registrado_por')) {
                        $loteData['registrado_por'] = $userId;
                    }

                    if (Schema::hasColumn('lotes', 'comision_pct')) {
                        $loteData['comision_pct'] = $comisionPct;
                    }

                    Lote::create($loteData);
                }
            }
        });

        return back()->with(
            'success',
            "Código del producto #{$producto->id} ('{$producto->nombre}') actualizado a '{$nuevoCodigo}'. Se sincronizaron los datos de etiqueta (proveedor y precio de compra). Recuerde reimprimir etiquetas físicas si es necesario."
        );
    }

    /**
     * Obtiene la lista de proveedores garantizando que nunca retorne vacío y sea compatible con la BD.
     */
    private function getProveedoresList()
    {
        $userId = DB::table('users')->value('id') ?? 1;

        if (!Schema::hasTable('proveedores')) {
            try {
                Schema::create('proveedores', function (Blueprint $table) use ($userId) {
                    $table->id();
                    $table->string('nombre', 255);
                    $table->string('telefono', 50)->nullable();
                    $table->string('ci_o_ruc', 20)->nullable();
                    if (Schema::hasTable('users')) {
                        $table->unsignedBigInteger('registrado_por')->default($userId);
                    }
                    $table->softDeletes();
                    $table->timestamps();
                });
            } catch (\Throwable $e) {
                Log::warning("Error creando tabla proveedores: " . $e->getMessage());
            }
        }

        // Si la tabla proveedores está vacía, intentar copiar de mundonav_navidad365 o insertar catálogo inicial
        try {
            $count = DB::table('proveedores')->count();
            if ($count === 0) {
                try {
                    $databases = DB::select("SHOW DATABASES LIKE 'mundonav_navidad365'");
                    if (!empty($databases)) {
                        $colRuc = Schema::hasColumn('proveedores', 'ci_o_ruc') ? 'ci_o_ruc' : 'ruc';
                        $hasRegPor = Schema::hasColumn('proveedores', 'registrado_por');
                        $regPorCol = $hasRegPor ? ', registrado_por' : '';
                        $regPorVal = $hasRegPor ? ", {$userId}" : '';

                        DB::statement("
                            INSERT IGNORE INTO proveedores (id, nombre, telefono, {$colRuc}{$regPorCol}, created_at, updated_at)
                            SELECT id, nombre, telefono, ci_o_ruc{$regPorVal}, created_at, updated_at FROM mundonav_navidad365.proveedores
                        ");
                    }
                } catch (\Throwable $e) {}

                // Si aún está vacía, insertar proveedores base con registrado_por
                if (DB::table('proveedores')->count() === 0) {
                    $hasRegPor = Schema::hasColumn('proveedores', 'registrado_por');
                    $baseProveedores = [
                        [
                            'id'         => 1,
                            'nombre'     => 'PROVEEDOR GENERAL',
                            'ci_o_ruc'   => '9999999999001',
                            'telefono'   => '0999999999',
                            'created_at' => now(),
                            'updated_at' => now(),
                        ],
                        [
                            'id'         => 2,
                            'nombre'     => 'DISTRIBUIDORA NAVIDEÑA',
                            'ci_o_ruc'   => '1790012345001',
                            'telefono'   => '0988888888',
                            'created_at' => now(),
                            'updated_at' => now(),
                        ],
                        [
                            'id'         => 3,
                            'nombre'     => 'IMPORTADORA CENTRAL',
                            'ci_o_ruc'   => '1790056789001',
                            'telefono'   => '0977777777',
                            'created_at' => now(),
                            'updated_at' => now(),
                        ]
                    ];

                    foreach ($baseProveedores as &$item) {
                        if ($hasRegPor) {
                            $item['registrado_por'] = $userId;
                        }
                    }

                    DB::table('proveedores')->insert($baseProveedores);
                }
            }
        } catch (\Throwable $e) {
            Log::warning("Error revisando contenido proveedores: " . $e->getMessage());
        }

        try {
            $cols = ['id', 'nombre'];
            if (Schema::hasColumn('proveedores', 'ci_o_ruc')) {
                $cols[] = 'ci_o_ruc';
            } elseif (Schema::hasColumn('proveedores', 'ruc')) {
                $cols[] = 'ruc as ci_o_ruc';
            }
            if (Schema::hasColumn('proveedores', 'telefono')) {
                $cols[] = 'telefono';
            }

            $query = DB::table('proveedores');
            if (Schema::hasColumn('proveedores', 'deleted_at')) {
                $query->whereNull('deleted_at');
            }

            $list = $query->orderBy('nombre')->get($cols);

            if ($list->isNotEmpty()) {
                return $list->values();
            }
        } catch (\Throwable $e) {
            Log::error("Error consultando tabla proveedores: " . $e->getMessage());
        }

        // Fallback seguro in-memory
        return collect([
            (object)['id' => 1, 'nombre' => 'PROVEEDOR GENERAL', 'ci_o_ruc' => '9999999999001', 'telefono' => '0999999999'],
            (object)['id' => 2, 'nombre' => 'DISTRIBUIDORA NAVIDEÑA', 'ci_o_ruc' => '1790012345001', 'telefono' => '0988888888'],
            (object)['id' => 3, 'nombre' => 'IMPORTADORA CENTRAL', 'ci_o_ruc' => '1790056789001', 'telefono' => '0977777777'],
        ]);
    }

    /**
     * Asegura que las columnas requeridas (como cantidad_total y codigo) existan en productos.
     */
    private function ensureProductosColumnsExist(): void
    {
        if (!Schema::hasTable('productos')) {
            return;
        }

        // Asegurar cantidad_total
        if (!Schema::hasColumn('productos', 'cantidad_total')) {
            try {
                Schema::table('productos', function (Blueprint $table) {
                    $table->integer('cantidad_total')->default(0)->after('nombre');
                });

                if (Schema::hasColumn('productos', 'cantidad')) {
                    DB::statement("UPDATE productos SET cantidad_total = cantidad WHERE cantidad_total = 0");
                } elseif (Schema::hasColumn('productos', 'stock')) {
                    DB::statement("UPDATE productos SET cantidad_total = stock WHERE cantidad_total = 0");
                }
            } catch (\Throwable $e) {
                Log::warning("No se pudo agregar cantidad_total a productos: " . $e->getMessage());
            }
        }

        // Asegurar codigo (por si solo existía barcode)
        if (!Schema::hasColumn('productos', 'codigo') && Schema::hasColumn('productos', 'barcode')) {
            try {
                Schema::table('productos', function (Blueprint $table) {
                    $table->string('codigo', 50)->nullable()->after('nombre');
                });
                DB::statement("UPDATE productos SET codigo = barcode WHERE codigo IS NULL OR codigo = ''");
            } catch (\Throwable $e) {
                Log::warning("No se pudo agregar codigo a productos: " . $e->getMessage());
            }
        }
    }

    /**
     * Asegura que la tabla 'lotes' exista en la base de datos para evitar errores SQL 1146.
     */
    private function ensureLotesTableExists(): bool
    {
        if (Schema::hasTable('lotes')) {
            return true;
        }

        // Intento 1: Ejecutar migraciones pendientes a través de Artisan
        try {
            Artisan::call('migrate', ['--force' => true]);
            if (Schema::hasTable('lotes')) {
                return true;
            }
        } catch (\Throwable $e) {
            Log::warning("Artisan migrate en CambioCodigoProductoController fallo: " . $e->getMessage());
        }

        // Intento 2: Crear tabla lotes directamente si no existía
        try {
            $hasProveedores = Schema::hasTable('proveedores');
            $hasUsers       = Schema::hasTable('users');

            Schema::create('lotes', function (Blueprint $table) use ($hasProveedores, $hasUsers) {
                $table->id();
                $table->foreignId('producto_id')->constrained('productos')->cascadeOnUpdate()->restrictOnDelete();

                if ($hasProveedores) {
                    $table->foreignId('proveedor_id')->nullable()->constrained('proveedores')->cascadeOnUpdate()->nullOnDelete();
                } else {
                    $table->unsignedBigInteger('proveedor_id')->nullable();
                }

                $table->unsignedInteger('cantidad_compra')->default(1);
                $table->date('fecha_compra')->default(now()->toDateString());
                $table->unsignedSmallInteger('anio')->default((int)date('Y'));
                $table->decimal('precio_compra', 12, 2)->default(0);
                $table->decimal('costo_transporte', 12, 2)->default(0);
                $table->decimal('costo_general', 12, 2)->default(0);
                $table->decimal('precio_compra_final', 12, 2)->default(0);
                $table->decimal('porcentaje_ganancia', 5, 2)->default(0);
                $table->decimal('comision_pct', 5, 2)->default(0);
                $table->decimal('precio_total', 14, 2)->default(0);

                if ($hasUsers) {
                    $table->foreignId('registrado_por')->nullable()->constrained('users')->nullOnDelete();
                    $table->foreignId('actualizado_por')->nullable()->constrained('users')->nullOnDelete();
                    $table->foreignId('eliminado_por')->nullable()->constrained('users')->nullOnDelete();
                } else {
                    $table->unsignedBigInteger('registrado_por')->nullable();
                    $table->unsignedBigInteger('actualizado_por')->nullable();
                    $table->unsignedBigInteger('eliminado_por')->nullable();
                }

                $table->softDeletes();
                $table->timestamps();

                $table->index(['producto_id', 'anio']);
                $table->index(['proveedor_id']);
                $table->index(['fecha_compra']);
            });

            return Schema::hasTable('lotes');
        } catch (\Throwable $e) {
            Log::error("Creación directa de tabla lotes fallo: " . $e->getMessage());
            return false;
        }
    }
}
