<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class PermissionMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        if (!Auth::check()) {
            return redirect('/')->with('error', 'Debes iniciar sesión.');
        }

        $user = Auth::user();

        // El Superadmin siempre tiene acceso absoluto
        if ($user->isSuperAdmin()) {
            return $next($request);
        }

        // Verificar si el usuario tiene al menos uno de los permisos requeridos
        $hasPermission = false;
        foreach ($permissions as $permission) {
            if ($user->hasPermission($permission)) {
                $hasPermission = true;
                break;
            }
        }

        if (!$hasPermission) {
            if ($request->expectsJson() || $request->wantsJson()) {
                return response()->json([
                    'message' => 'No tienes permiso para realizar esta acción.',
                    'required_permissions' => $permissions,
                ], 403);
            }

            return redirect()->back()->with('error', 'No tienes permisos suficientes para realizar esta acción.');
        }

        return $next($request);
    }
}
