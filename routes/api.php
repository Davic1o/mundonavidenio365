<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

use App\Http\Controllers\Api\ProductoController;

/* Endpoints exclusivos de Productos API (Protegidos con API Key) */
Route::middleware('api.key')->group(function () {
    Route::get('/productos',                         [ProductoController::class, 'index']);
    Route::get('/productos/{id}',                    [ProductoController::class, 'show']);
    Route::match(['post', 'patch'], '/productos/{id}/disminuir-stock', [ProductoController::class, 'disminuirStock']);
});


