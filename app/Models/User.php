<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'role',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'password' => 'hashed',
    ];

    /* ============================
     * Relaciones con auditoría
     * ============================ */

    // Productos
    public function productosRegistrados()
    {
        return $this->hasMany(Producto::class, 'registrado_por');
    }

    public function productosActualizados()
    {
        return $this->hasMany(Producto::class, 'actualizado_por');
    }

    public function productosEliminados()
    {
        return $this->hasMany(Producto::class, 'eliminado_por');
    }

    // Proveedores
    public function proveedoresRegistrados()
    {
        return $this->hasMany(Proveedor::class, 'registrado_por');
    }

    public function proveedoresActualizados()
    {
        return $this->hasMany(Proveedor::class, 'actualizado_por');
    }

    public function proveedoresEliminados()
    {
        return $this->hasMany(Proveedor::class, 'eliminado_por');
    }

    // Lotes
    public function lotesRegistrados()
    {
        return $this->hasMany(Lote::class, 'registrado_por');
    }

    public function lotesActualizados()
    {
        return $this->hasMany(Lote::class, 'actualizado_por');
    }

    public function lotesEliminados()
    {
        return $this->hasMany(Lote::class, 'eliminado_por');
    }
    public function empresasCreadas()
{
    return $this->hasMany(Empresa::class, 'created_by');
}

public function empresasActualizadas()
{
    return $this->hasMany(Empresa::class, 'updated_by');
}

public function clientesCreados()
{
    return $this->hasMany(Cliente::class, 'creado_por');
}

public function clientesActualizados()
{
    return $this->hasMany(Cliente::class, 'actualizado_por');
}

public function ventasCreadas()
{
    return $this->hasMany(Venta::class, 'creada_por');
}







}
