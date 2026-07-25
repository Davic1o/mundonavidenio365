<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Admin\DashboardController;
use App\Http\Controllers\Admin\EtiquetasController;
use App\Http\Controllers\Admin\EmpresaController;

Route::middleware(['auth', 'verified', 'role:Administrador'])->group(function () {
    Route::get('/admin/dashboard', [DashboardController::class, 'index'])->name('admin.dashboard.index');
    route::get('/admin/etiquetas', [EtiquetasController::class, 'index'])->name('admin.etiquetas.index');
    route::put('/presets', [EtiquetasController::class, 'presetsUpdate'])->name('admin.presets.update');
    Route::get('/admin/empresa', [EmpresaController::class, 'index'])->name('admin.empresa.index');
    Route::post('/admin/empresa', [EmpresaController::class, 'store'])->name('admin.empresa.store');
    Route::put('/admin/empresa', [EmpresaController::class, 'update'])->name('admin.empresa.update');
});

Route::middleware(['auth', 'verified', 'role:Ventas'])->group(function () {
    Route::get('/ventas/dashboard', [DashboardController::class, 'index'])->name('ventas.dashboard.index');
});



