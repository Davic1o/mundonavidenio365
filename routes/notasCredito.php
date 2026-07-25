<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Admin\NotasCreditoController;

Route::prefix('admin/notas-credito')->middleware(['auth', 'verified', 'role:Administrador'])->name('admin.notas_credito.')->group(function () {
    // Listado de facturas (sustento para NC)
    Route::get('/facturas', [NotasCreditoController::class, 'facturasIndex'])->name('facturas');
    Route::match(['get', 'post'], '/cargar-desde-factura/{venta}', [NotasCreditoController::class, 'cargarProductosDesdeFactura'])
        ->name('cargar_desde_factura');
    Route::get('/{nc}/items', [NotasCreditoController::class, 'vistaItems'])->name('vista_items');
    Route::put('/{nc}/items', [NotasCreditoController::class, 'guardarItems'])->name('guardar_items');
    Route::match(['get', 'post'], '/{nc}/emitir', [NotasCreditoController::class, 'emitirFirmarEnviar'])->name('emitir');
    Route::get('/{nc}', [NotasCreditoController::class, 'show'])->name('show');
});
