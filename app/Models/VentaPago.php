<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class VentaPago extends Model
{
    use HasFactory;

    protected $table = 'venta_pagos';

    protected $fillable = [
        'venta_id',
        'codigo',
        'nombre',
        'valor',
    ];

    protected $casts = [
        'valor' => 'decimal:2',
    ];

    /* Relaciones */
    public function venta()
    {
        return $this->belongsTo(Venta::class, 'venta_id');
    }
}
