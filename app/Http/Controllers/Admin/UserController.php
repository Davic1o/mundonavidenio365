<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class UserController extends Controller
{
    /**
     * GET /admin/usuarios
     * Lista usuarios con filtros y paginación.
     */
    public function index(Request $request)
    {
        /** @var User $authUser */
        $authUser = auth()->user();

        if ($authUser && !$authUser->hasPermission('usuarios.view')) {
            abort(403, 'No tienes permiso para ver el listado de usuarios.');
        }

        $name     = (string) $request->query('name', '');
        $email    = (string) $request->query('email', '');
        $role     = (string) $request->query('role', '');
        $perPage  = (int) ($request->integer('per_page') ?: 10);

        $query = User::query();

        if ($name !== '') {
            $query->where('name', 'like', '%' . str_replace(' ', '%', $name) . '%');
        }

        if ($email !== '') {
            $query->where('email', 'like', '%' . str_replace(' ', '%', $email) . '%');
        }

        if ($role !== '') {
            $query->where('role', $role);
        }

        $users = $query
            ->orderByDesc('created_at')
            ->paginate($perPage)
            ->appends($request->only(['name','email','role','per_page']))
            ->through(function (User $u) {
                return [
                    'id'         => $u->id,
                    'name'       => $u->name,
                    'email'      => $u->email,
                    'role'       => $u->role,
                    'created_at' => $u->created_at?->toISOString(),
                    'updated_at' => $u->updated_at?->toISOString(),
                ];
            });

        // Solo el Superadmin puede asignar el rol Superadmin
        $availableRoles = $authUser?->isSuperAdmin()
            ? User::ALL_ROLES
            : array_values(array_diff(User::ALL_ROLES, [User::ROLE_SUPERADMIN]));

        return Inertia::render('Admin/Usuarios/Index', [
            'users'   => $users,
            'filters' => [
                'name'     => $name,
                'email'    => $email,
                'role'     => $role,
                'per_page' => $perPage,
            ],
            'roles'   => $availableRoles,
        ]);
    }

    /**
     * POST /admin/usuarios
     * Crea un usuario.
     */
    public function store(Request $request)
    {
        /** @var User $authUser */
        $authUser = auth()->user();

        if ($authUser && !$authUser->hasPermission('usuarios.create')) {
            abort(403, 'No tienes permiso para crear usuarios.');
        }

        $data = $request->validate([
            'name'     => ['required', 'string', 'max:255'],
            'email'    => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'role'     => ['required', 'string', Rule::in(User::ALL_ROLES)],
            'password' => ['nullable', 'string', 'min:8'],
        ]);

        // Si intentan asignar Superadmin y no son Superadmin, rechazar
        if ($data['role'] === User::ROLE_SUPERADMIN && (!$authUser || !$authUser->isSuperAdmin())) {
            abort(403, 'Solo un Superadmin puede asignar el rol de Superadmin.');
        }

        if (!isset($data['password']) || $data['password'] === '') {
            unset($data['password']);
        }

        $user = User::create($data);

        return redirect()
            ->back()
            ->with('success', 'Usuario creado correctamente.')
            ->with('created_user_id', $user->id);
    }

    /**
     * PUT /admin/usuarios/{user}
     * Actualiza datos del usuario.
     */
    public function update(Request $request, User $user)
    {
        /** @var User $authUser */
        $authUser = auth()->user();

        if ($authUser && !$authUser->hasPermission('usuarios.edit')) {
            abort(403, 'No tienes permiso para editar usuarios.');
        }

        // Si el usuario a editar es Superadmin y quien edita no es Superadmin, rechazar
        if ($user->isSuperAdmin() && (!$authUser || !$authUser->isSuperAdmin())) {
            abort(403, 'No tienes permisos para modificar a un Superadmin.');
        }

        $data = $request->validate([
            'name'     => ['required', 'string', 'max:255'],
            'email'    => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'role'     => ['required', 'string', Rule::in(User::ALL_ROLES)],
            'password' => ['nullable', 'string', 'min:8'],
        ]);

        // Si intentan promover a Superadmin y no son Superadmin, rechazar
        if ($data['role'] === User::ROLE_SUPERADMIN && (!$authUser || !$authUser->isSuperAdmin())) {
            abort(403, 'Solo un Superadmin puede asignar el rol de Superadmin.');
        }

        if (!isset($data['password']) || $data['password'] === '') {
            unset($data['password']);
        }

        $user->update($data);

        return redirect()
            ->back()
            ->with('success', 'Usuario actualizado correctamente.')
            ->with('updated_user_id', $user->id);
    }
}
