<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;
use App\Models\Empresa;
use Illuminate\Support\Facades\Storage;


class HandleInertiaRequests extends Middleware
{
    // ...

public function share(Request $request): array
{
    $user = $request->user();

    // Cargar única empresa (si existe)
    $empresa = Empresa::query()
        ->select(
            'id',
            'nombre_comercial',
            'razon_social',
            'ruc',
            'correo',
            'telefono',
            'direccion',
            'tipo_contribuyente',
            'regimen',
            'ambiente',
            'firma_propietario',
            'firma_emisor',
            'firma_valido_desde',
            'firma_valido_hasta',
            'created_by',
            'updated_by',
            'created_at',
            'updated_at'
        )
        ->first();

    // Metadatos de la firma (sin exponer contenido)
    $firmaMeta = null;
    if ($empresa && $empresa->ruta_firma) {
        $firmaMeta = ['exists' => false];
        // Probar en el disco por defecto y en 'private'/'local' por compatibilidad
        foreach ([config('filesystems.default'), 'private', 'local'] as $disk) {
            if (!$disk) continue;
            try {
                if (Storage::disk($disk)->exists($empresa->ruta_firma)) {
                    $size = Storage::disk($disk)->size($empresa->ruta_firma);
                    $mtime = Storage::disk($disk)->lastModified($empresa->ruta_firma);
                    $firmaMeta = [
                        'exists'        => true,
                        'disk'          => $disk,
                        'path'          => $empresa->ruta_firma,                 // solo informativo
                        'filename'      => basename($empresa->ruta_firma),
                        'size'          => $size,
                        'size_human'    => $this->humanSize($size),
                        'last_modified' => gmdate('c', $mtime),
                    ];
                    break;
                }
            } catch (\Throwable $e) {
                // Ignorar para no romper share en caso de error de disco
            }
        }
    }

    return array_merge(parent::share($request), [
        'auth' => [
            'user' => $user,
        ],

        'flash' => [
            'success' => fn () => $request->session()->get('success'),
            'error'   => fn () => $request->session()->get('error'),
            'info'    => fn () => $request->session()->get('info'),
        ],

        // Capacidades rápidas para el front
        'ability' => [
            'isAdmin'          => $user?->role === 'Administrador',
            'canManageEmpresa' => $user?->role === 'Administrador',
        ],

        // Datos de empresa para bloquear flujos si hace falta
        'empresa' => [
            'exists' => (bool) $empresa,
            'basic'  => $empresa ? [
                'id'                    => $empresa->id,
                'nombre_comercial'      => $empresa->nombre_comercial,
                'razon_social'          => $empresa->razon_social,
                'ruc'                   => $empresa->ruc,
                'correo'                => $empresa->correo,
                'telefono'              => $empresa->telefono,
                'direccion'             => $empresa->direccion,
                'obligado_contabilidad' => (bool) $empresa->obligado_contabilidad,
                'tipo_contribuyente'    => $empresa->tipo_contribuyente,
                'regimen'               => $empresa->regimen,
                'ambiente'              => (int) $empresa->ambiente,
                'firma_propietario'     => $empresa->firma_propietario,
                'firma_emisor'          => $empresa->firma_emisor,
                'firma_valido_desde'    => $empresa->firma_valido_desde ? $empresa->firma_valido_desde->toIso8601String() : null,
                'firma_valido_hasta'    => $empresa->firma_valido_hasta ? $empresa->firma_valido_hasta->toIso8601String() : null,
                'updated_at'            => optional($empresa->updated_at)->toIso8601String(),
            ] : null,
            'firma' => $firmaMeta, // solo metadatos; no es descargable
        ],

        // Útil para mostrar un banner o bloquear navegación hasta configurar empresa
        'guards' => [
            'mustSetupEmpresa' => !$empresa,
        ],
    ]);
}

/**
 * Convierte bytes a tamaño legible (B, KB, MB, GB, TB).
 */
protected function humanSize(int $bytes): string
{
    $units = ['B','KB','MB','GB','TB'];
    $i = 0;
    while ($bytes >= 1024 && $i < count($units) - 1) {
        $bytes /= 1024;
        $i++;
    }
    return number_format($bytes, $i ? 2 : 0) . ' ' . $units[$i];
}

}
