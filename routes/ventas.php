<?php
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Admin\ClientesController;
use App\Http\Controllers\Admin\VentasController;
use App\Http\Controllers\Ventas\VendedorController;
use App\Http\Controllers\Ventas\ProductosController as VentasProductosController;

/* Ventas CRUD base (ya las tenías) */
Route::middleware(['auth', 'verified', 'role:Administrador'])->group(function () {
Route::get('/admin/ventas',              [VentasController::class, 'index'])->name('admin.ventas.index');
Route::post('/admin/ventas',             [VentasController::class, 'store'])->name('admin.ventas.store');
Route::get('/admin/ventas/{venta}',      [VentasController::class, 'show'])->name('admin.ventas.show');
Route::put('/admin/ventas/{venta}',      [VentasController::class, 'update'])->name('admin.ventas.update');
Route::delete('/admin/ventas/{venta}',   [VentasController::class, 'destroy'])->name('admin.ventas.destroy');
Route::post('/admin/ventas/{venta}/xml', [VentasController::class, 'generarXmlFactura'])->name('admin.ventas.xml');
Route::post('/admin/{venta}/sri/firmar-enviar', [VentasController::class, 'firmarYEnviarSriFactura'])->name('admin.ventas.sri.firmar_enviar');
Route::post('/admin/ventas/{venta}/reautorizar', [VentasController::class, 'reautorizarSri'])->name('admin.ventas.reautorizar');
Route::get('/admin/ventas/nueva/cliente/{venta?}',              [VentasController::class, 'vistaCliente'])->name('admin.ventas.vista_cliente');
Route::post('/admin/ventas/nueva/cliente/{venta?}',             [VentasController::class, 'iniciarConCliente'])->name('admin.admin.iniciar_con_cliente');
Route::get('/admin/ventas/{venta}/editar',             [VentasController::class, 'vistaProductos'])->name('admin.ventas.vista_productos');
Route::put('/admin/ventas/{venta}/items',              [VentasController::class, 'guardarItems'])->name('admin.ventas.items.guardar');
Route::get('/admin/ventas/{venta}/pagos',              [VentasController::class, 'vistaPagos'])->name('admin.ventas.vista_pagos');
Route::post('/admin/ventas/{venta}/pagos',              [VentasController::class, 'guardarPagos'])->name('admin.ventas.pagos.guardar');
Route::get('/admin/clientes/buscar',     [ClientesController::class, 'buscar'])->name('admin.clientes.buscar');
Route::post('/admin/clientes/crear',     [ClientesController::class, 'crear'])->name('admin.clientes.crear');
Route::put('/admin/clientes/editar', [ClientesController::class, 'editar'])->name('admin.clientes.editar');
Route::get('/admin/productos/buscar',    [VentasController::class, 'buscarProductos'])->name('admin.productos.buscar');

});

Route::middleware(['auth', 'verified', 'role:Ventas'])->group(function () {
Route::get('/ventas/ventas',              [VendedorController::class, 'index'])->name('ventas.ventas.index');
Route::post('/ventas/ventas',             [VendedorController::class, 'store'])->name('ventas.ventas.store');
Route::get('/ventas/ventas/{venta}',      [VendedorController::class, 'show'])->name('ventas.ventas.show');
Route::put('/ventas/ventas/{venta}',      [VendedorController::class, 'update'])->name('ventas.ventas.update');
Route::delete('/ventas/ventas/{venta}',   [VendedorController::class, 'destroy'])->name('ventas.ventas.destroy');
Route::post('/ventas/ventas/{venta}/xml', [VendedorController::class, 'generarXmlFactura'])->name('ventas.ventas.xml');
Route::post('/ventas/{venta}/sri/firmar-enviar', [VendedorController::class, 'firmarYEnviarSriFactura'])->name('ventas.ventas.sri.firmar_enviar');
Route::post('/ventas/ventas/{venta}/reautorizar', [VendedorController::class, 'reautorizarSri'])->name('ventas.ventas.reautorizar');
Route::get('/ventas/ventas/nueva/cliente/{venta?}',              [VendedorController::class, 'vistaCliente'])->name('ventas.ventas.vista_cliente');
Route::post('/ventas/ventas/nueva/cliente/{venta?}',             [VendedorController::class, 'iniciarConCliente'])->name('ventas.ventas.iniciar_con_cliente');
Route::get('/ventas/ventas/{venta}/editar',             [VendedorController::class, 'vistaProductos'])->name('ventas.ventas.vista_productos');
Route::put('/ventas/ventas/{venta}/items',              [VendedorController::class, 'guardarItems'])->name('ventas.ventas.items.guardar');
Route::get('/ventas/ventas/{venta}/pagos',              [VendedorController::class, 'vistaPagos'])->name('ventas.ventas.vista_pagos');
Route::post('/ventas/ventas/{venta}/pagos',              [VendedorController::class, 'guardarPagos'])->name('ventas.ventas.pagos.guardar');
Route::get('/ventas/clientes/buscar',     [ClientesController::class, 'buscar'])->name('ventas.clientes.buscar');
Route::post('/ventas/clientes/crear',     [ClientesController::class, 'crear'])->name('ventas.clientes.crear');
Route::put('/ventas/clientes/editar', [ClientesController::class, 'editar'])->name('ventas.clientes.editar');
Route::get('/ventas/productos',    [VentasProductosController::class, 'index'])->name('ventas.productos.index');
Route::get('/ventas/productos/buscar',    [VentasController::class, 'buscarProductos'])->name('ventas.productos.buscar');

});
