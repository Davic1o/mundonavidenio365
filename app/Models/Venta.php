<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;

class Venta extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
    'cliente_id','fecha','autorizacion','estado',
    'estab','pto_emision','secuencial','numero',
    'subtotal','impuesto_15','impuesto_0','descuento','total','creada_por'
];


    protected $casts = [
        'fecha'        => 'datetime',
        'subtotal'     => 'decimal:2',
        'impuesto_15'  => 'decimal:2',
        'impuesto_0'   => 'decimal:2',
        'descuento'    => 'decimal:2',
        'total'        => 'decimal:2',
    ];

    /* Relaciones */
    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }

    public function creador()
    {
        return $this->belongsTo(User::class, 'creada_por');
    }

    public function productosVendidos()
    {
        return $this->hasMany(VentaProducto::class, 'venta_id');
    }

    public function pagos()
    {
        return $this->hasMany(VentaPago::class, 'venta_id');
    }

    public function tarjetas()
    {
        return $this->hasMany(VentaTarjeta::class, 'venta_id');
    }

    /**
     * Relación conveniente muchos-a-muchos con Producto a través de venta_productos.
     * Incluye pivote con cantidad, precio, descuento, precio_total y timestamps.
     */
    public function productos()
    {
        return $this->belongsToMany(Producto::class, 'venta_productos', 'venta_id', 'producto_id')
                    ->withPivot(['cantidad', 'precio', 'descuento', 'precio_total'])
                    ->withTimestamps();
    }
    public function notasCredito()
{
    return $this->hasMany(NotaCredito::class, 'venta_id');
}

}
