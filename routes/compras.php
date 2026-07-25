<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Admin\ComprasController;
use App\Http\Controllers\Admin\EtiquetasSettingsController;
use App\Http\Controllers\Ventas\ProductosController;

Route::middleware(['auth', 'verified', 'role:Administrador'])->group(function () {
    // Compras
    Route::get('/admin/compras', [ComprasController::class, 'index'])->name('admin.compras.index');
    Route::post('/admin/compras', [ComprasController::class, 'store'])->name('admin.compras.store');
    Route::get('/admin/compras/{lote}', [ComprasController::class, 'show'])->name('admin.compras.show');
    Route::put('/admin/compras/{lote}', [ComprasController::class, 'update'])->name('admin.compras.update');
    Route::delete('/admin/compras/{lote}', [ComprasController::class, 'destroy'])->name('admin.compras.destroy');
     Route::post('etiquetas/prefs',   [EtiquetasSettingsController::class, 'store'])->name('etiquetas.prefs.store');
    Route::delete('etiquetas/prefs', [EtiquetasSettingsController::class, 'destroy'])->name('etiquetas.prefs.destroy');

    // Proveedores (solo GET)
    Route::get('/admin/productos/buscar', [ComprasController::class, 'buscarProductos'])->name('admin.productos.buscar');
Route::get('/admin/productos/crear', [ComprasController::class, 'crearProducto'])->name('admin.productos.crear');

    Route::get('/admin/proveedores/buscar', [ComprasController::class, 'buscarProveedores'])->name('admin.proveedores.buscar');
    Route::get('/admin/proveedores/crear', [ComprasController::class, 'crearProveedor'])->name('admin.proveedores.crear');
});

Route::middleware(['auth', 'verified', 'role:Ventas'])->group(function () {
    // Compras
    Route::get('/ventas/productos', [ProductosController::class, 'index'])->name('ventas.productos.index');
    });

// Listado con filtros (Inertia con modal)
