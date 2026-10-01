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

    /**
     * Genera el código de etiqueta del producto con la estructura: YY-productoId-proveedorId-INT-DEC
     * Ejemplo: 26-15-3-12-50
     */
    public static function generarCodigo(int|string $anio, int|string $productoId, int|string $proveedorId, float $valorBaseEtiqueta): string
    {
        $yy = substr((string)$anio, -2);
        $totalRedondeado = round((float)$valorBaseEtiqueta, 2);
        $entero = (int) floor($totalRedondeado);
        $decVal = (int) round(($totalRedondeado - $entero) * 100);
        $decStr = str_pad((string)$decVal, 2, '0', STR_PAD_LEFT);

        return "{$yy}-{$productoId}-{$proveedorId}-{$entero}-{$decStr}";
    }


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
