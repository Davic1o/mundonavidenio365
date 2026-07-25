<?php

namespace App\Http\Middleware;

	use Closure;
	use Illuminate\Support\Facades\Auth;

	class RoleMiddleware
	{
	    public function handle($request, Closure $next, ...$roles)
	    {
       	 if (!Auth::check() || !in_array(Auth::user()->role, $roles)) {
       	     return redirect('/')->with('error', 'No tienes acceso a esta sección.');
       	 }

	        return $next($request);
	    }
	}
