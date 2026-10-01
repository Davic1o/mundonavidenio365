<?php

namespace App\Http\Middleware;

use App\Providers\RouteServiceProvider;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class RedirectIfAuthenticated
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next, string ...$guards): Response
    {
        $guards = empty($guards) ? [null] : $guards;

        foreach ($guards as $guard) {
           if (Auth::guard($guard)->check()) {
    $user = Auth::user();

    switch ($user->role) {
        case 'Superadmin':
        case 'Admin General':
        case 'Administrador':
            return redirect()->route('admin.dashboard.index');
        case 'Ventas':
            return redirect()->route('ventas.dashboard.index');
        default:
            return redirect()->route('admin.dashboard.index');
    }
}

        }

        return $next($request);
    }
}
