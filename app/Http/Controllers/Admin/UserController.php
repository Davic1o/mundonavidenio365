<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class UserController extends Controller
{
    /** Ajusta esta lista a los roles que uses en tu app */
    private const ROLES = [
        'Administrador',  'Ventas',
    ];

    /**
     * GET /admin/usuarios
     * Lista usuarios con filtros y paginación.
     * Filtros: name (like), email (like), role (exact).
     * Extras: per_page, sort/order si luego quieres.
     */
    public function index(Request $request)
    {
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

        return Inertia::render('Admin/Usuarios/Index', [
            'users'   => $users,
            'filters' => [
                'name'     => $name,
                'email'    => $email,
                'role'     => $role,
                'per_page' => $perPage,
            ],
            'roles'   => self::ROLES,
        ]);
    }

    /**
     * POST /admin/usuarios
     * Crea un usuario. El password es opcional aquí si usas invitaciones;
     * si lo envías, el cast 'hashed' del modelo lo encripta.
     */
    public function store(Request $request)
    {
        $data = $request->validate([
            'name'     => ['required', 'string', 'max:255'],
            'email'    => ['required', 'string', 'email', 'max:255', 'unique:users,email'],
            'role'     => ['required', 'string', Rule::in(self::ROLES)],
            'password' => ['nullable', 'string', 'min:8'], // puedes endurecer reglas si quieres
        ]);

        // Si no envían password, puedes generar uno temporal o dejarlo nulo si manejas set-password por email.
        if (!isset($data['password']) || $data['password'] === '') {
            // Ejemplo: generar uno temporal (opcional)
            // $data['password'] = Str::password(12);
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
     * Actualiza datos del usuario. El password es opcional (solo si lo envías).
     */
    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name'     => ['required', 'string', 'max:255'],
            'email'    => ['required', 'string', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'role'     => ['required', 'string', Rule::in(self::ROLES)],
            'password' => ['nullable', 'string', 'min:8'],
        ]);

        // Si password viene vacío, no lo toques
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
