<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Admin\CambioCodigoProductoController;

/*
|--------------------------------------------------------------------------
| Rutas exclusivas de gestión de productos para el Administrador
|--------------------------------------------------------------------------
*/

Route::middleware(['auth', 'verified', 'role:Administrador'])
    ->prefix('admin/productos')
    ->name('admin.productos.')
    ->group(function () {
        Route::get('/cambiar-codigo', [CambioCodigoProductoController::class, 'index'])
            ->name('cambiar_codigo.index');

        Route::put('/{producto}/cambiar-codigo', [CambioCodigoProductoController::class, 'update'])
            ->name('cambiar_codigo.update');
    });
