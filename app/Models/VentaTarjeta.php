<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class VentaTarjeta extends Model
{
    use HasFactory;

    protected $table = 'venta_tarjetas';

    protected $fillable = [
        'venta_id',
        'monto',
        'comision',
        'tipo_tarjeta', // 'Crédito', 'Débito', 'Visa', 'Mastercard', etc.
        'plazo',        // meses/diferidos (0 = corriente)
    ];

    protected $casts = [
        'monto'    => 'decimal:2',
        'comision' => 'decimal:2',
        'plazo'    => 'integer',
    ];

    /* Relaciones */
    public function venta()
    {
        return $this->belongsTo(Venta::class, 'venta_id');
    }
}
