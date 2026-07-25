<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NotaCreditoDetalle extends Model
{
    protected $table = 'nota_credito_detalles';

    protected $fillable = [
        'nota_credito_id','producto_id',
        'cantidad','precio','descuento','precio_total','iva',
    ];

    protected $casts = [
        'cantidad'     => 'decimal:6',
        'precio'       => 'decimal:6',
        'descuento'    => 'decimal:2',
        'precio_total' => 'decimal:2',
        'iva'          => 'integer',
    ];

    // === Relaciones ===
    public function notaCredito()
    {
        return $this->belongsTo(NotaCredito::class, 'nota_credito_id');
    }

    public function producto()
    {
        return $this->belongsTo(Producto::class);
    }
}
