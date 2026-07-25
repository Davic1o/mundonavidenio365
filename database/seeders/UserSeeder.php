<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Usuario Administrador
        User::updateOrCreate(
            ['email' => 'admin@facturacion.com'],
            [
                'name' => 'Admin Sistema',
                'role' => 'Administrador',
                'password' => Hash::make('admin123'),
                'email_verified_at' => now(),
            ]
        );

        // Usuario Ventas
        User::updateOrCreate(
            ['email' => 'ventas@facturacion.com'],
            [
                'name' => 'Vendedor 1',
                'role' => 'Ventas',
                'password' => Hash::make('ventas123'),
                'email_verified_at' => now(),
            ]
        );
    }
}
