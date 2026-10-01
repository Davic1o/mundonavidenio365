<?php

use App\Http\Controllers\Public\LandingController;
use Illuminate\Support\Facades\Route;


Route::get('/', [LandingController::class, 'index'])->name('public.landing');

Route::get('/consultar', [LandingController::class, 'consultar'])->name('public.consulta');

require __DIR__.'/auth.php';
require __DIR__.'/dashboard.php';
require __DIR__.'/user.php';
require __DIR__.'/compras.php';
require __DIR__.'/ventas.php';
require __DIR__.'/notasCredito.php';
require __DIR__.'/reportes.php';
require __DIR__.'/productos.php';
