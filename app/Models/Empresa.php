<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Empresa extends Model
{
    // Tabla: 'empresas' (por convención no es necesario especificarla)

    /**
     * Atributos asignables en masa.
     */
    protected $fillable = [
        'nombre_comercial',
        'razon_social',
        'obligado_a_llevar_contabilidad',
        'tipo_contribuyente',
        'regimen',
        'ambiente',
        'establecimiento',
        'punto_emision',
        'secuencial_factura',
        'secuencial_nota_credito',
        'direccion',
        'telefono',
        'correo',
        'ruc',
        'ruta_firma_electronica',
        'clave_firma_electronica',
        'firma_propietario',
        'firma_emisor',
        'firma_valido_desde',
        'firma_valido_hasta',
        'created_by',
        'updated_by',
    ];

    /**
     * Casts de atributos.
     * - boolean: para checkbox/flags.
     * - encrypted: protege el valor en BD (Laravel 10+).
     */
    protected $casts = [
        'obligado_a_llevar_contabilidad' => 'boolean',
        'firma_valido_desde'             => 'datetime',
        'firma_valido_hasta'             => 'datetime',
    ];

    /* ==========================
     * Relaciones (auditoría)
     * ========================== */

    public function creador()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function editor()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
