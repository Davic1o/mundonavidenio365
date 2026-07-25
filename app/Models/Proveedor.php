<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Proveedor extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'proveedores';

    protected $fillable = [
        'nombre',
        'telefono',
        'ci_o_ruc',
        'registrado_por',
        'actualizado_por',
        'eliminado_por',
    ];

    /* Relaciones */
    public function lotes()
    {
        return $this->hasMany(Lote::class, 'proveedor_id');
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
