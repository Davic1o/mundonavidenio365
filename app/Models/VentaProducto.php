<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class VentaProducto extends Model
{
    use HasFactory;

    protected $table = 'venta_productos';

    protected $fillable = [
        'venta_id',
        'producto_id',
        'cantidad',
        'precio',        // unitario
        'descuento',     // $ en la línea
        'precio_total',  // cantidad * precio - descuento
    ];

    protected $casts = [
        'cantidad'     => 'integer',
        'precio'       => 'decimal:2',
        'descuento'    => 'decimal:2',
        'precio_total' => 'decimal:2',
    ];

    /* Relaciones */
    public function venta()
    {
        return $this->belongsTo(Venta::class, 'venta_id');
    }

    public function producto()
    {
        return $this->belongsTo(Producto::class, 'producto_id');
    }
}
