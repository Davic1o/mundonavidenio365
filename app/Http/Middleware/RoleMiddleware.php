<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class RoleMiddleware
{
    /**
     * Valida el acceso a las rutas verificando el rol o los permisos asignados por el Superadmin.
     */
    public function handle(Request $request, Closure $next, ...$roles)
    {
        if (!Auth::check()) {
            return redirect('/')->with('error', 'Debes iniciar sesión para acceder.');
        }

        /** @var \App\Models\User $user */
        $user = Auth::user();

        // 1. El Superadmin siempre tiene acceso absoluto e inmutable a todas las rutas
        if ($user->isSuperAdmin()) {
            return $next($request);
        }

        // 2. Rutas reservadas exclusivamente para el Superadmin
        if (in_array('Superadmin', $roles, true)) {
            if ($request->expectsJson()) {
                return response()->json(['message' => 'Esta acción es exclusiva del Superadmin.'], 403);
            }
            return redirect()->route('admin.dashboard.index')
                ->with('error', 'Acceso denegado. Esta sección es exclusiva para el Superadmin.');
        }

        // 3. Resolver el permiso requerido según la ruta y método HTTP
        $requiredPermission = $this->resolveRequiredPermission($request);

        if ($requiredPermission !== null) {
            if ($user->hasPermission($requiredPermission)) {
                return $next($request);
            }

            if ($request->expectsJson()) {
                return response()->json([
                    'message' => 'No tienes permisos suficientes para realizar esta acción.',
                    'required_permission' => $requiredPermission,
                ], 403);
            }

            return redirect()->back()
                ->with('error', 'No tienes permisos asignados para acceder a esta sección.');
        }

        // 4. Fallback: Verificación tradicional por rol
        if (in_array('Administrador', $roles, true) && $user->isAdminGeneral()) {
            return $next($request);
        }

        if (in_array($user->role, $roles, true)) {
            return $next($request);
        }

        if ($request->expectsJson()) {
            return response()->json(['message' => 'No tienes acceso a esta sección.'], 403);
        }

        return redirect('/')->with('error', 'No tienes acceso a esta sección.');
    }

    /**
     * Mapea rutas y verbos HTTP a los permisos gestionables por el Superadmin.
     */
    private function resolveRequiredPermission(Request $request): ?string
    {
        $routeName = $request->route()?->getName();
        $path = '/' . trim($request->path(), '/');
        $method = strtoupper($request->method());

        // A. Roles y Permisos (Exclusivo Superadmin)
        if (str_starts_with($path, '/admin/roles-permisos') || str_contains((string) $routeName, 'roles_permisos')) {
            return 'SUPERADMIN_ONLY';
        }

        // B. Dashboard
        if (str_starts_with($path, '/admin/dashboard') || str_starts_with($path, '/ventas/dashboard') || in_array($routeName, ['admin.dashboard.index', 'ventas.dashboard.index'])) {
            return 'dashboard.view';
        }

        // C. Empresa / Datos SRI
        if (str_starts_with($path, '/admin/empresa')) {
            return $method === 'GET' ? 'empresa.view' : 'empresa.edit';
        }

        // D. Usuarios
        if (str_starts_with($path, '/admin/usuarios')) {
            if ($method === 'GET') {
                return 'usuarios.view';
            }
            if ($method === 'POST') {
                return 'usuarios.create';
            }
            if (in_array($method, ['PUT', 'PATCH'])) {
                return 'usuarios.edit';
            }
            return 'usuarios.view';
        }

        // E. Compras y Lotes
        if (str_starts_with($path, '/admin/compras')) {
            if ($method === 'GET') {
                return 'compras.view';
            }
            if ($method === 'POST') {
                return 'compras.create';
            }
            if (in_array($method, ['PUT', 'PATCH'])) {
                return 'compras.edit';
            }
            if ($method === 'DELETE') {
                return 'compras.delete';
            }
            return 'compras.view';
        }
        if (str_starts_with($path, '/admin/proveedores')) {
            return 'compras.proveedores';
        }
        if (str_starts_with($path, '/admin/productos/crear')) {
            return 'compras.create';
        }

        // F. Etiquetas y Presets
        if (str_starts_with($path, '/admin/etiquetas') || str_starts_with($path, '/etiquetas/prefs')) {
            return 'etiquetas.view';
        }
        if (str_starts_with($path, '/presets')) {
            return 'etiquetas.presets';
        }

        // G. Cambio de Códigos de Producto
        if (str_starts_with($path, '/admin/productos/cambiar-codigo') || str_contains($path, 'cambiar-codigo')) {
            return in_array($method, ['PUT', 'PATCH', 'POST']) ? 'cambio_codigo.update' : 'cambio_codigo.view';
        }

        // H. Notas de Crédito
        if (str_starts_with($path, '/admin/notas-credito')) {
            if (str_contains($path, 'emitir')) {
                return 'notas_credito.sri';
            }
            if ($method === 'POST' || $method === 'PUT' || str_contains($path, 'cargar-desde-factura') || str_contains($path, 'guardar_items')) {
                return 'notas_credito.create';
            }
            return 'notas_credito.view';
        }

        // I. Reportes
        if (str_starts_with($path, '/admin/reportes/productos')) {
            if (str_contains($path, 'excel') || str_contains($path, 'csv') || str_contains($path, 'pdf')) {
                return 'reportes_productos.export';
            }
            return 'reportes_productos.view';
        }
        if (str_starts_with($path, '/admin/reportes') || str_starts_with($path, '/ventas/reportes')) {
            if (str_contains($path, 'excel') || str_contains($path, 'csv') || str_contains($path, 'pdf')) {
                return 'reportes_ventas.export';
            }
            return 'reportes_ventas.view';
        }

        // J. Ventas y Facturación
        if (str_starts_with($path, '/admin/ventas') || str_starts_with($path, '/ventas/ventas') || str_contains($path, '/sri/firmar-enviar')) {
            if (str_contains($path, 'sri') || str_contains($path, 'reautorizar') || str_contains($path, 'xml')) {
                return 'ventas.sri';
            }
            if ($method === 'DELETE') {
                return 'ventas.delete';
            }
            if ($method === 'POST' || str_contains($path, 'nueva') || str_contains($path, 'iniciar')) {
                return 'ventas.create';
            }
            if ($method === 'PUT' || str_contains($path, 'editar') || str_contains($path, 'items') || str_contains($path, 'pagos')) {
                return 'ventas.edit';
            }
            return 'ventas.view';
        }

        // K. Clientes
        if (str_contains($path, 'clientes')) {
            return 'ventas.clientes';
        }

        // L. Catálogo de Productos
        if (str_starts_with($path, '/ventas/productos') || str_starts_with($path, '/admin/productos')) {
            return 'productos.view';
        }

        return null;
    }
}
