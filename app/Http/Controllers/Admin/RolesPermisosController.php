<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\RolePermission;
use App\Models\User;
use Illuminate\Http\Request;
use Inertia\Inertia;

class RolesPermisosController extends Controller
{
    /**
     * Muestra la matriz de permisos por rol.
     * Acceso exclusivo para el Superadmin.
     */
    public function index(Request $request)
    {
        /** @var User $user */
        $user = auth()->user();

        if (!$user || !$user->isSuperAdmin()) {
            abort(403, 'Acceso denegado. Solo el Superadmin puede gestionar roles y permisos.');
        }

        RolePermission::seedDefaultsIfEmpty();

        $configurableRoles = [
            User::ROLE_ADMIN_GENERAL,
            User::ROLE_ADMIN,
            User::ROLE_VENTAS,
        ];

        $rolePermissions = [];
        foreach ($configurableRoles as $r) {
            $rolePermissions[$r] = RolePermission::getPermissionsForRole($r);
        }

        return Inertia::render('Admin/RolesPermisos/Index', [
            'modules'           => RolePermission::getModulesDefinition(),
            'roles'             => $configurableRoles,
            'rolePermissions'   => $rolePermissions,
            'allPermissionKeys' => RolePermission::getAllPermissionKeys(),
        ]);
    }

    /**
     * Guarda los permisos asignados a un rol específico.
     */
    public function update(Request $request)
    {
        /** @var User $user */
        $user = auth()->user();

        if (!$user || !$user->isSuperAdmin()) {
            abort(403, 'Acceso denegado. Solo el Superadmin puede modificar permisos.');
        }

        $configurableRoles = [
            User::ROLE_ADMIN_GENERAL,
            User::ROLE_ADMIN,
            User::ROLE_VENTAS,
        ];

        $validated = $request->validate([
            'role'          => ['required', 'string', 'in:' . implode(',', $configurableRoles)],
            'permissions'   => ['nullable', 'array'],
            'permissions.*' => ['string'],
        ]);

        $role = $validated['role'];
        $permissions = $validated['permissions'] ?? [];

        RolePermission::syncRolePermissions($role, $permissions);

        return redirect()
            ->back()
            ->with('success', "Permisos actualizados exitosamente para el rol '{$role}'.");
    }

    /**
     * Restablece los permisos a los valores predeterminados para un rol o todos.
     */
    public function resetDefaults(Request $request)
    {
        /** @var User $user */
        $user = auth()->user();

        if (!$user || !$user->isSuperAdmin()) {
            abort(403, 'Acceso denegado.');
        }

        $role = $request->input('role');
        $defaults = RolePermission::getDefaultPermissionsByRole();

        if ($role && isset($defaults[$role])) {
            RolePermission::syncRolePermissions($role, $defaults[$role]);
            $msg = "Permisos del rol '{$role}' restablecidos a los valores predeterminados.";
        } else {
            foreach ($defaults as $r => $perms) {
                RolePermission::syncRolePermissions($r, $perms);
            }
            $msg = "Todos los permisos han sido restablecidos a sus valores predeterminados.";
        }

        return redirect()
            ->back()
            ->with('success', $msg);
    }
}
