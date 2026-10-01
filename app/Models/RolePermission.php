<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class RolePermission extends Model
{
    protected $table = 'role_permissions';

    protected $fillable = [
        'role',
        'permission',
    ];

    /**
     * Catálogo completo de módulos y permisos del sistema.
     * Define qué puede VER y qué puede HACER cada rol en cada vista.
     */
    public static function getModulesDefinition(): array
    {
        return [
            'dashboard' => [
                'title'       => 'Dashboard',
                'description' => 'Métricas clave, resúmenes de ventas y accesos rápidos.',
                'icon'        => 'FiBox',
                'permissions' => [
                    [
                        'key'         => 'dashboard.view',
                        'label'       => 'Ver Dashboard',
                        'description' => 'Permite ingresar a la vista principal del dashboard y consultar estadísticas.',
                        'is_view'     => true,
                    ],
                ],
            ],
            'empresa' => [
                'title'       => 'Datos de la Empresa / SRI',
                'description' => 'Configuración de la empresa emisora, RUC, firma digital P12 y ambiente SRI.',
                'icon'        => 'FiSettings',
                'permissions' => [
                    [
                        'key'         => 'empresa.view',
                        'label'       => 'Ver Datos de Empresa',
                        'description' => 'Permite ver la información fiscal y estado de firma de la empresa.',
                        'is_view'     => true,
                    ],
                    [
                        'key'         => 'empresa.edit',
                        'label'       => 'Editar Empresa y Firma SRI',
                        'description' => 'Permite actualizar datos tributarios, cargar nueva firma digital (.p12) y contraseña.',
                        'is_view'     => false,
                    ],
                ],
            ],
            'usuarios' => [
                'title'       => 'Gestión de Usuarios',
                'description' => 'Cuentas de acceso al sistema y asignación de roles.',
                'icon'        => 'FiUsers',
                'permissions' => [
                    [
                        'key'         => 'usuarios.view',
                        'label'       => 'Ver Lista de Usuarios',
                        'description' => 'Permite visualizar la lista de usuarios y sus roles asignados.',
                        'is_view'     => true,
                    ],
                    [
                        'key'         => 'usuarios.create',
                        'label'       => 'Crear Usuarios',
                        'description' => 'Permite dar de alta nuevas cuentas de usuario en el sistema.',
                        'is_view'     => false,
                    ],
                    [
                        'key'         => 'usuarios.edit',
                        'label'       => 'Editar Usuarios',
                        'description' => 'Permite modificar nombres, correos, roles y contraseñas de usuarios.',
                        'is_view'     => false,
                    ],
                ],
            ],
            'compras' => [
                'title'       => 'Compras y Lotes',
                'description' => 'Registro de compras a proveedores, lotes y stock inicial.',
                'icon'        => 'FiTrendingUp',
                'permissions' => [
                    [
                        'key'         => 'compras.view',
                        'label'       => 'Ver Compras y Lotes',
                        'description' => 'Permite consultar el historial de compras ingresadas.',
                        'is_view'     => true,
                    ],
                    [
                        'key'         => 'compras.create',
                        'label'       => 'Registrar Nueva Compra',
                        'description' => 'Permite ingresar nuevas facturas de compra y lotes de productos.',
                        'is_view'     => false,
                    ],
                    [
                        'key'         => 'compras.edit',
                        'label'       => 'Modificar Compras',
                        'description' => 'Permite editar información de compras y lotes ya registrados.',
                        'is_view'     => false,
                    ],
                    [
                        'key'         => 'compras.delete',
                        'label'       => 'Eliminar Compras',
                        'description' => 'Permite anular o suprimir compras del sistema.',
                        'is_view'     => false,
                    ],
                    [
                        'key'         => 'compras.proveedores',
                        'label'       => 'Gestionar Proveedores',
                        'description' => 'Permite registrar y buscar proveedores dentro de compras.',
                        'is_view'     => false,
                    ],
                ],
            ],
            'etiquetas' => [
                'title'       => 'Generador de Etiquetas',
                'description' => 'Impresión y diseño de etiquetas con códigos de barra para productos.',
                'icon'        => 'FiFileText',
                'permissions' => [
                    [
                        'key'         => 'etiquetas.view',
                        'label'       => 'Ver y Generar Etiquetas',
                        'description' => 'Permite acceder al generador e imprimir etiquetas de barras.',
                        'is_view'     => true,
                    ],
                    [
                        'key'         => 'etiquetas.presets',
                        'label'       => 'Modificar Presets / Medidas',
                        'description' => 'Permite cambiar medidas de etiquetas y márgenes de impresión.',
                        'is_view'     => false,
                    ],
                ],
            ],
            'cambio_codigo' => [
                'title'       => 'Cambio de Códigos de Producto',
                'description' => 'Módulo técnico para actualizar códigos de barra de productos existentes.',
                'icon'        => 'FiTag',
                'permissions' => [
                    [
                        'key'         => 'cambio_codigo.view',
                        'label'       => 'Ver Módulo de Cambio de Código',
                        'description' => 'Permite visualizar la interfaz de búsqueda y reemplazo de códigos.',
                        'is_view'     => true,
                    ],
                    [
                        'key'         => 'cambio_codigo.update',
                        'label'       => 'Ejecutar Cambio de Código',
                        'description' => 'Permite efectuar el cambio definitivo del código del producto.',
                        'is_view'     => false,
                    ],
                ],
            ],
            'ventas' => [
                'title'       => 'Ventas y Facturación Electrónica',
                'description' => 'Punto de venta, cobros, facturación y emisión electrónica SRI.',
                'icon'        => 'FiTrendingUp',
                'permissions' => [
                    [
                        'key'         => 'ventas.view',
                        'label'       => 'Ver Listado de Ventas',
                        'description' => 'Permite consultar el historial de ventas y facturas emitidas.',
                        'is_view'     => true,
                    ],
                    [
                        'key'         => 'ventas.create',
                        'label'       => 'Crear / Facturar Venta',
                        'description' => 'Permite iniciar nuevas ventas, agregar productos y procesar pagos.',
                        'is_view'     => false,
                    ],
                    [
                        'key'         => 'ventas.edit',
                        'label'       => 'Modificar Ventas en Proceso',
                        'description' => 'Permite editar items, cantidades y pagos de ventas no cerradas.',
                        'is_view'     => false,
                    ],
                    [
                        'key'         => 'ventas.delete',
                        'label'       => 'Eliminar / Anular Venta',
                        'description' => 'Permite eliminar o revertir una venta.',
                        'is_view'     => false,
                    ],
                    [
                        'key'         => 'ventas.sri',
                        'label'       => 'Firmar y Enviar al SRI',
                        'description' => 'Permite generar XML, firmar con token y reautorizar comprobantes SRI.',
                        'is_view'     => false,
                    ],
                    [
                        'key'         => 'ventas.clientes',
                        'label'       => 'Gestionar Clientes',
                        'description' => 'Permite crear y actualizar datos de clientes al facturar.',
                        'is_view'     => false,
                    ],
                ],
            ],
            'notas_credito' => [
                'title'       => 'Notas de Crédito',
                'description' => 'Emisión de notas de crédito electrónicas vinculadas a facturas autorizadas.',
                'icon'        => 'FiFileText',
                'permissions' => [
                    [
                        'key'         => 'notas_credito.view',
                        'label'       => 'Ver Notas de Crédito y Facturas',
                        'description' => 'Permite ver las facturas disponibles y las notas de crédito emitidas.',
                        'is_view'     => true,
                    ],
                    [
                        'key'         => 'notas_credito.create',
                        'label'       => 'Generar Nota de Crédito',
                        'description' => 'Permite seleccionar items a devolver y generar la nota de crédito.',
                        'is_view'     => false,
                    ],
                    [
                        'key'         => 'notas_credito.sri',
                        'label'       => 'Emitir y Firmar SRI',
                        'description' => 'Permite firmar electrónicamente y enviar la nota de crédito al SRI.',
                        'is_view'     => false,
                    ],
                ],
            ],
            'reportes_ventas' => [
                'title'       => 'Reporte de Ventas',
                'description' => 'Estadísticas detalladas de ventas por período, cajero y forma de pago.',
                'icon'        => 'FiBarChart2',
                'permissions' => [
                    [
                        'key'         => 'reportes_ventas.view',
                        'label'       => 'Ver Reportes de Ventas',
                        'description' => 'Permite consultar las tablas y gráficos de ventas.',
                        'is_view'     => true,
                    ],
                    [
                        'key'         => 'reportes_ventas.export',
                        'label'       => 'Exportar Reporte (Excel, CSV, PDF)',
                        'description' => 'Permite descargar los reportes de ventas en formato descargable.',
                        'is_view'     => false,
                    ],
                ],
            ],
            'reportes_productos' => [
                'title'       => 'Reporte de Productos e Inventario',
                'description' => 'Stock actual, productos más vendidos y rotación de inventario.',
                'icon'        => 'FiBox',
                'permissions' => [
                    [
                        'key'         => 'reportes_productos.view',
                        'label'       => 'Ver Reportes de Productos',
                        'description' => 'Permite ver el reporte de existencias y ventas de productos.',
                        'is_view'     => true,
                    ],
                    [
                        'key'         => 'reportes_productos.export',
                        'label'       => 'Exportar Reporte (Excel, CSV, PDF)',
                        'description' => 'Permite descargar el inventario en formato descargable.',
                        'is_view'     => false,
                    ],
                ],
            ],
            'productos' => [
                'title'       => 'Catálogo de Productos',
                'description' => 'Vista de productos, precios y disponibilidad rápida.',
                'icon'        => 'FiBox',
                'permissions' => [
                    [
                        'key'         => 'productos.view',
                        'label'       => 'Ver Catálogo de Productos',
                        'description' => 'Permite buscar y ver precios y existencias de productos.',
                        'is_view'     => true,
                    ],
                ],
            ],
        ];
    }

    /**
     * Retorna todas las claves de permisos planas.
     */
    public static function getAllPermissionKeys(): array
    {
        $keys = [];
        foreach (self::getModulesDefinition() as $mod) {
            foreach ($mod['permissions'] as $perm) {
                $keys[] = $perm['key'];
            }
        }
        return $keys;
    }

    /**
     * Permisos por defecto sugeridos para cada rol.
     */
    public static function getDefaultPermissionsByRole(): array
    {
        $all = self::getAllPermissionKeys();

        return [
            User::ROLE_ADMIN_GENERAL => $all, // Admin General por defecto tiene acceso a todo excepto manejar permisos (que es exclusivo de Superadmin)
            User::ROLE_ADMIN => [
                'dashboard.view',
                'empresa.view',
                'empresa.edit',
                'usuarios.view',
                'usuarios.create',
                'usuarios.edit',
                'compras.view',
                'compras.create',
                'compras.edit',
                'compras.delete',
                'compras.proveedores',
                'etiquetas.view',
                'etiquetas.presets',
                'cambio_codigo.view',
                'cambio_codigo.update',
                'ventas.view',
                'ventas.create',
                'ventas.edit',
                'ventas.delete',
                'ventas.sri',
                'ventas.clientes',
                'notas_credito.view',
                'notas_credito.create',
                'notas_credito.sri',
                'reportes_ventas.view',
                'reportes_ventas.export',
                'reportes_productos.view',
                'reportes_productos.export',
                'productos.view',
            ],
            User::ROLE_VENTAS => [
                'dashboard.view',
                'ventas.view',
                'ventas.create',
                'ventas.edit',
                'ventas.sri',
                'ventas.clientes',
                'productos.view',
                'reportes_ventas.view',
                'reportes_ventas.export',
            ],
        ];
    }

    /**
     * Obtiene la lista de permisos asignados a un rol.
     */
    public static function getPermissionsForRole(string $role): array
    {
        if ($role === User::ROLE_SUPERADMIN) {
            return self::getAllPermissionKeys();
        }

        self::seedDefaultsIfEmpty();

        return Cache::remember("role_permissions_{$role}", 60, function () use ($role) {
            return self::where('role', $role)->pluck('permission')->toArray();
        });
    }

    /**
     * Sincroniza los permisos para un rol en la base de datos.
     */
    public static function syncRolePermissions(string $role, array $permissions): void
    {
        if ($role === User::ROLE_SUPERADMIN) {
            return; // Superadmin siempre tiene todo
        }

        $allValid = self::getAllPermissionKeys();
        $filtered = array_values(array_intersect($permissions, $allValid));

        DB::transaction(function () use ($role, $filtered) {
            self::where('role', $role)->delete();

            $now = now();
            $rows = array_map(function ($perm) use ($role, $now) {
                return [
                    'role'       => $role,
                    'permission' => $perm,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }, $filtered);

            if (!empty($rows)) {
                self::insert($rows);
            }
        });

        Cache::forget("role_permissions_{$role}");
    }

    /**
     * Inicializa los permisos por defecto en la base de datos si la tabla está vacía.
     */
    public static function seedDefaultsIfEmpty(): void
    {
        if (self::count() === 0) {
            $defaults = self::getDefaultPermissionsByRole();
            foreach ($defaults as $role => $perms) {
                self::syncRolePermissions($role, $perms);
            }
        }
    }
}
