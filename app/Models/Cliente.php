<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;

class Cliente extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'nombres',
        'ci_o_ruc',
        'telefono',
        'direccion',
        'correo',
        'creado_por',
        'actualizado_por',
    ];

    protected $casts = [
        // sin decimales; aquí no hay montos
    ];

    /* Relaciones */
    public function ventas()
    {
        return $this->hasMany(Venta::class, 'cliente_id');
    }

    public function creador()
    {
        return $this->belongsTo(User::class, 'creado_por');
    }

    public function editor()
    {
        return $this->belongsTo(User::class, 'actualizado_por');
    }
    public function notasCredito()
{
    return $this->hasMany(NotaCredito::class, 'cliente_id');
}

}
