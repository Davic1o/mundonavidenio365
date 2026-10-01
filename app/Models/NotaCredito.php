<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NotaCredito extends Model
{
    protected $table = 'notas_credito';

    protected $fillable = [
        'venta_id','cliente_id',
        'estab','pto_emision','secuencial','numero',
        'autorizacion','fecha','estado',
        'subtotal','impuesto_15','impuesto_0','descuento','total',
        'motivo','creada_por','actualizada_por','eliminada_por',
    ];

    protected $casts = [
        'fecha' => 'datetime',
        'subtotal'    => 'decimal:2',
        'impuesto_15' => 'decimal:2',
        'impuesto_0'  => 'decimal:2',
        'descuento'   => 'decimal:2',
        'total'       => 'decimal:2',
    ];

    // === Relaciones ===
    public function venta()
    {
        return $this->belongsTo(Venta::class);
    }

    public function cliente()
    {
        return $this->belongsTo(Cliente::class);
    }

    public function creador()
    {
        return $this->belongsTo(User::class, 'creada_por');
    }

    public function actualizadoPor()
    {
        return $this->belongsTo(User::class, 'actualizada_por');
    }

    public function eliminadoPor()
    {
        return $this->belongsTo(User::class, 'eliminada_por');
    }

    public function detalles()
    {
        return $this->hasMany(NotaCreditoDetalle::class, 'nota_credito_id');
    }
}
