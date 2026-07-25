<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Admin\ReportesProductosController;
use App\Http\Controllers\Admin\ReportesVentasController;
use App\Http\Controllers\Ventas\ReportesVendedorController;

Route::middleware(['auth',  'role:Administrador']) // ajusta tus middlewares

    ->group(function () {
        Route::get('/admin/reportes',     [ReportesVentasController::class, 'index'])->name('admin.reportes.index');
        Route::get('/admin/reportes/csv', [ReportesVentasController::class, 'exportCsv'])->name('admin.ventas.csv');
        Route::get('/admin/reportes/pdf', [ReportesVentasController::class, 'exportPdf'])->name('admin.ventas.pdf');
         Route::get('/admin/reportes/productos',     [ReportesProductosController::class, 'index'])->name('admin.reportes.productos.index');
        Route::get('/admin/reportes/productos/csv', [ReportesProductosController::class, 'exportCsv'])->name('admin.reportes.productos.csv');
        Route::get('/admin/reportes/productos/pdf', [ReportesProductosController::class, 'exportPdf'])->name('admin.reportes.productos.pdf');
    });


    Route::middleware(['auth',  'role:Ventas']) // ajusta tus middlewares
    ->group(function () {
        Route::get('/ventas/reportes',     [ReportesVendedorController::class, 'index'])->name('ventas.reportes.index');
        Route::get('/ventas/reportes/csv', [ReportesVendedorController::class, 'exportCsv'])->name('ventas.ventas.csv');
        Route::get('/ventas/reportes/pdf', [ReportesVendedorController::class, 'exportPdf'])->name('ventas.ventas.pdf');
    });


