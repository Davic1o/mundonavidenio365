<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Lote extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'lotes';

    protected $fillable = [
        'producto_id',
        'proveedor_id',
        'cantidad_compra',
        'fecha_compra',
        'anio',
        'precio_compra',
        'costo_transporte',
        'costo_general',
        'precio_compra_final',
        'porcentaje_ganancia',
        'precio_total',
        'registrado_por',
        'actualizado_por',
        'eliminado_por',
    ];

    protected $casts = [
        'fecha_compra' => 'date',
        'anio' => 'integer',
        'cantidad_compra' => 'integer',
        'precio_compra' => 'decimal:2',
        'costo_transporte' => 'decimal:2',
        'costo_general' => 'decimal:2',
        'precio_compra_final' => 'decimal:2',
        'porcentaje_ganancia' => 'decimal:2',
        'precio_total' => 'decimal:2',
    ];

    /* Relaciones */
    public function producto()
    {
        return $this->belongsTo(Producto::class, 'producto_id');
    }

    public function proveedor()
    {
        return $this->belongsTo(Proveedor::class, 'proveedor_id');
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
}
