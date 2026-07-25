<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Producto extends Model
{
    use HasFactory, SoftDeletes;

    public function setNombreAttribute($value)
    {
        $this->attributes['nombre'] = mb_strtoupper($value, 'UTF-8');
    }

    protected $table = 'productos';

    protected $fillable = [
        'nombre',
        'codigo',
        'cantidad_total',
        'registrado_por',
        'actualizado_por',
        'eliminado_por',
    ];

    /* Relaciones */
    public function lotes()
    {
        return $this->hasMany(Lote::class, 'producto_id');
    }

    /* Auditoría */
    public function registradoPor()
    {
        return $this->belongsTo(User::class, 'registrado_por');
    }

    public function actualizadoPor()
    {
        return $this->belongsTo(User::class, 'actualizado_por');
    }

    public function eliminadoPor()
    {
        return $this->belongsTo(User::class, 'eliminado_por');
    }
    public function ventaProductos()
{
    return $this->hasMany(VentaProducto::class, 'producto_id');
}

public function ventas()
{
    return $this->belongsToMany(Venta::class, 'venta_productos', 'producto_id', 'venta_id')
                ->withPivot(['cantidad', 'precio', 'descuento', 'precio_total'])
                ->withTimestamps();
}
public function notaCreditoDetalles()
{
    return $this->hasMany(\App\Models\NotaCreditoDetalle::class, 'producto_id');
}


}
