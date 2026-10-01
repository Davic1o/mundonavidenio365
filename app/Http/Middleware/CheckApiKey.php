<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckApiKey
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $providedKey = $request->header('X-API-KEY') ?? $request->query('api_key');
        $expectedKey = env('PRODUCT_API_KEY');

        if (empty($expectedKey) || $providedKey !== $expectedKey) {
            return response()->json([
                'success' => false,
                'message' => 'No autorizado. API Key inválida o no proporcionada.'
            ], 401);
        }

        return $next($request);
    }
}
