<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\RolesPermisosController;

Route::middleware(['auth', 'verified', 'role:Administrador'])->group(function () {
    Route::get('/admin/usuarios', [UserController::class, 'index'])->name('admin.usuarios.index');
    Route::post('/admin/usuarios', [UserController::class, 'store'])->name('admin.usuarios.store');
    Route::put('/admin/usuarios/{user}', [UserController::class, 'update'])->name('admin.usuarios.update');
});

Route::middleware(['auth', 'verified', 'role:Superadmin'])->group(function () {
    Route::get('/admin/roles-permisos', [RolesPermisosController::class, 'index'])->name('admin.roles_permisos.index');
    Route::post('/admin/roles-permisos', [RolesPermisosController::class, 'update'])->name('admin.roles_permisos.update');
    Route::post('/admin/roles-permisos/reset', [RolesPermisosController::class, 'resetDefaults'])->name('admin.roles_permisos.reset');
});
