<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    public const ROLE_SUPERADMIN    = 'Superadmin';
    public const ROLE_ADMIN_GENERAL = 'Admin General';
    public const ROLE_ADMIN         = 'Administrador';
    public const ROLE_VENTAS        = 'Ventas';

    public const ALL_ROLES = [
        self::ROLE_SUPERADMIN,
        self::ROLE_ADMIN_GENERAL,
        self::ROLE_ADMIN,
        self::ROLE_VENTAS,
    ];

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
     * Roles y Permisos
     * ============================ */

    public function isSuperAdmin(): bool
    {
        return $this->role === self::ROLE_SUPERADMIN;
    }

    public function isAdminGeneral(): bool
    {
        return $this->role === self::ROLE_ADMIN_GENERAL;
    }

    public function isAdministrador(): bool
    {
        return $this->role === self::ROLE_ADMIN;
    }

    public function isVentas(): bool
    {
        return $this->role === self::ROLE_VENTAS;
    }

    public function hasPermission(string $permission): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        $permissions = RolePermission::getPermissionsForRole($this->role);
        return in_array($permission, $permissions, true);
    }

    public function getAllPermissions(): array
    {
        if ($this->isSuperAdmin()) {
            return RolePermission::getAllPermissionKeys();
        }

        return RolePermission::getPermissionsForRole($this->role);
    }

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

    public function ventasActualizadas()
    {
        return $this->hasMany(Venta::class, 'actualizada_por');
    }

    public function ventasEliminadas()
    {
        return $this->hasMany(Venta::class, 'eliminada_por');
    }

    public function notasCreditoCreadas()
    {
        return $this->hasMany(NotaCredito::class, 'creada_por');
    }

    public function notasCreditoActualizadas()
    {
        return $this->hasMany(NotaCredito::class, 'actualizada_por');
    }
}
