<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Admin\ReportesProductosController;
use App\Http\Controllers\Admin\ReportesVentasController;
use App\Http\Controllers\Ventas\ReportesVendedorController;

Route::middleware(['auth',  'role:Administrador'])
    ->group(function () {
        Route::get('/admin/reportes',                 [ReportesVentasController::class, 'index'])->name('admin.reportes.index');
        Route::get('/admin/reportes/excel',           [ReportesVentasController::class, 'exportExcel'])->name('admin.ventas.excel');
        Route::get('/admin/reportes/csv',             [ReportesVentasController::class, 'exportExcel'])->name('admin.ventas.csv');
        Route::get('/admin/reportes/pdf',             [ReportesVentasController::class, 'exportPdf'])->name('admin.ventas.pdf');
        
        Route::get('/admin/reportes/productos',       [ReportesProductosController::class, 'index'])->name('admin.reportes.productos.index');
        Route::get('/admin/reportes/productos/excel', [ReportesProductosController::class, 'exportExcel'])->name('admin.reportes.productos.excel');
        Route::get('/admin/reportes/productos/csv',   [ReportesProductosController::class, 'exportExcel'])->name('admin.reportes.productos.csv');
        Route::get('/admin/reportes/productos/pdf',   [ReportesProductosController::class, 'exportPdf'])->name('admin.reportes.productos.pdf');
    });


Route::middleware(['auth',  'role:Ventas'])
    ->group(function () {
        Route::get('/ventas/reportes',                [ReportesVendedorController::class, 'index'])->name('ventas.reportes.index');
        Route::get('/ventas/reportes/excel',          [ReportesVendedorController::class, 'exportExcel'])->name('ventas.ventas.excel');
        Route::get('/ventas/reportes/csv',            [ReportesVendedorController::class, 'exportExcel'])->name('ventas.ventas.csv');
        Route::get('/ventas/reportes/pdf',            [ReportesVendedorController::class, 'exportPdf'])->name('ventas.ventas.pdf');
    });
