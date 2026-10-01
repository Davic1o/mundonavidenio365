<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Empresa;
use Illuminate\Http\Request;
// OJO: ya no usamos Storage para escribir/borrar
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Str;
use Inertia\Inertia;

class EmpresaController extends Controller
{
    public function index()
    {
        $empresa = Empresa::first();

        // Si existe firma pero no hay metadata (migración o carga previa), intentar extraerla
        if ($empresa && $empresa->ruta_firma_electronica && !$empresa->firma_propietario && $empresa->clave_firma_electronica) {
            $absPath = $this->relToAbs($empresa->ruta_firma_electronica);
            if (is_file($absPath)) {
                $bytes = file_get_contents($absPath);
                $metadata = $this->extractCertMetadata($bytes, $empresa->clave_firma_electronica);
                if ($metadata) {
                    $empresa->update($metadata);
                }
            }
        }

        return Inertia::render('Admin/Empresa/Index', [
            'empresa' => $empresa ? $empresa->makeHidden(['clave_firma_electronica']) : null,
        ]);
    }

    /**
     * Crea/actualiza la única empresa.
     * Firma: prioriza base64 (firma_b64 + firma_nombre). Fallback opcional por archivo.
     * Guarda PRIVADO en storage/app/firmas (sin Flysystem, sin finfo).
     */
    /**
     * Crea/actualiza la única empresa.
     */
    public function store(Request $request)
    {
        return $this->guardarEmpresaProcess($request);
    }

    public function update(Request $request)
    {
        return $this->guardarEmpresaProcess($request);
    }

    protected function guardarEmpresaProcess(Request $request)
    {
        // Auto-pad con ceros a la izquierda en caso de que el usuario envíe números cortos (ej: "1" -> "001" o "5" -> "000000005")
        if ($request->has('establecimiento')) {
            $request->merge(['establecimiento' => str_pad(preg_replace('/\D/', '', (string)$request->input('establecimiento')), 3, '0', STR_PAD_LEFT)]);
        }
        if ($request->has('punto_emision')) {
            $request->merge(['punto_emision' => str_pad(preg_replace('/\D/', '', (string)$request->input('punto_emision')), 3, '0', STR_PAD_LEFT)]);
        }
        if ($request->has('secuencial_factura')) {
            $request->merge(['secuencial_factura' => str_pad(preg_replace('/\D/', '', (string)$request->input('secuencial_factura')), 9, '0', STR_PAD_LEFT)]);
        }
        if ($request->has('secuencial_nota_credito')) {
            $request->merge(['secuencial_nota_credito' => str_pad(preg_replace('/\D/', '', (string)$request->input('secuencial_nota_credito')), 9, '0', STR_PAD_LEFT)]);
        }
        if ($request->has('ruc')) {
            $request->merge(['ruc' => trim((string)$request->input('ruc'))]);
        }

        $existing = Empresa::first();

        $data = $request->validate([
            'nombre_comercial'               => ['required','string','max:255'],
            'razon_social'                   => ['required','string','max:255'],
            'obligado_a_llevar_contabilidad' => ['required','boolean'],
            'tipo_contribuyente'             => ['nullable','string','max:100'],
            'regimen'                        => ['nullable','string','max:100'],
            'ambiente'                       => ['required','integer','in:1,2'],
            'establecimiento'                => ['required','string','size:3','regex:/^[0-9]{3}$/'],
            'punto_emision'                  => ['required','string','size:3','regex:/^[0-9]{3}$/'],
            'secuencial_factura'             => ['required','string','size:9','regex:/^[0-9]{9}$/'],
            'secuencial_nota_credito'        => ['required','string','size:9','regex:/^[0-9]{9}$/'],
            'direccion'                      => ['nullable','string','max:255'],
            'telefono'                       => ['nullable','string','max:50'],
            'correo'                         => ['nullable','email','max:255'],
            'ruc'                            => [
                'required','string','size:13','regex:/^[0-9]+$/',
                $existing ? Rule::unique('empresas','ruc')->ignore($existing->id) : 'unique:empresas,ruc',
            ],
            'firma_b64'                      => ['nullable','string'],
            'firma_nombre'                   => ['nullable','required_with:firma_b64','string','max:255'],
            'firma'                          => ['nullable','file','max:10240'],
            'clave_firma_electronica'        => ['nullable','string'],
        ]);

        if ($existing && ($data['clave_firma_electronica'] ?? '') === '') {
            unset($data['clave_firma_electronica']);
        }

        $resultadoFirma = $this->handleFirma($request, $data['ruc'], $existing?->ruta_firma_electronica);

        if ($resultadoFirma['path']) {
            $data['ruta_firma_electronica'] = $resultadoFirma['path'];
            if ($resultadoFirma['metadata']) {
                $data = array_merge($data, $resultadoFirma['metadata']);
            }
        } elseif ($existing && !empty($existing->ruta_firma_electronica) && !empty($data['clave_firma_electronica'])) {
            // Si no cambió el archivo pero se ingresó una clave de firma, re-intentar extraer la metadata del certificado
            $absPath = $this->relToAbs($existing->ruta_firma_electronica);
            if (is_file($absPath)) {
                $bytes = file_get_contents($absPath);
                $meta = $this->extractCertMetadata($bytes, $data['clave_firma_electronica']);
                if ($meta) {
                    $data = array_merge($data, $meta);
                }
            }
        }

        $userId = auth()->id();

        if ($existing) {
            $existing->fill($data);
            $existing->updated_by = $userId;
            $existing->save();

            return back()->with('success', 'Empresa actualizada correctamente.');
        }

        Empresa::create($data + [
            'created_by' => $userId,
            'updated_by' => $userId,
        ]);

        return back()->with('success', 'Empresa creada correctamente.');
    }

    /**
     * Procesa la firma:
     * - Si llega firma_b64 + firma_nombre => reconstruye y guarda PRIVADO.
     * - Si no, usa el archivo (si se envió) como fallback.
     * - Borra la firma anterior si se reemplaza.
     * Devuelve array ['path' => string|null, 'metadata' => array|null]
     */
    protected function handleFirma(Request $request, string $ruc, ?string $prevPath = null): array
    {
        $ts = time();
        $path = null;
        $metadata = null;
        $clave = $request->input('clave_firma_electronica');

        // 1) Base64 (preferido)
        if ($request->filled('firma_b64') && $request->filled('firma_nombre')) {
            $raw = base64_decode($request->input('firma_b64'), true);
            if ($raw === false || strlen($raw) === 0) {
                throw ValidationException::withMessages(['firma' => 'La cadena base64 es inválida o está vacía.']);
            }

            $ext = strtolower(pathinfo($request->input('firma_nombre'), PATHINFO_EXTENSION) ?: 'p12');
            if (!in_array($ext, ['p12','pfx'])) {
                throw ValidationException::withMessages(['firma' => 'Extensión no permitida (usa .p12 o .pfx).']);
            }

            $path = "firmas/firma_{$ruc}_{$ts}.{$ext}";
            $this->writePrivate($path, $raw);
            $this->deletePrivate($prevPath);
            
            if ($clave) {
                $metadata = $this->extractCertMetadata($raw, $clave);
            }
        }
        // 2) Fallback: archivo normal
        elseif ($request->hasFile('firma')) {
            $file = $request->file('firma');
            if ($file && $file->isValid() && $file->getSize() > 0) {
                $ext = strtolower($file->getClientOriginalExtension() ?: 'p12');
                if (!in_array($ext, ['p12','pfx'])) {
                    throw ValidationException::withMessages(['firma' => 'Sube un .p12 o .pfx.']);
                }
                $path = "firmas/firma_{$ruc}_{$ts}.{$ext}";
                $bytes   = file_get_contents($file->getRealPath());
                $this->writePrivate($path, $bytes);
                $this->deletePrivate($prevPath);

                if ($clave) {
                    $metadata = $this->extractCertMetadata($bytes, $clave);
                }
            }
        }

        return ['path' => $path, 'metadata' => $metadata];
    }

    /**
     * Extrae información del certificado P12.
     */
    protected function extractCertMetadata(string $p12raw, string $password): ?array
    {
        try {
            if (openssl_pkcs12_read($p12raw, $certs, $password)) {
                $certData = openssl_x509_parse($certs['cert']);
                if ($certData) {
                    return [
                        'firma_propietario'  => $certData['subject']['CN'] ?? 'Desconocido',
                        'firma_emisor'       => $certData['issuer']['CN'] ?? 'Desconocido',
                        'firma_valido_desde' => gmdate('Y-m-d H:i:s', $certData['validFrom_time_t']),
                        'firma_valido_hasta' => gmdate('Y-m-d H:i:s', $certData['validTo_time_t']),
                    ];
                }
            }
        } catch (\Exception $e) {
            // No hacemos nada, simplemente no extraemos metadata
        }
        return null;
    }

    /**
     * Escribe bytes en storage/app SIN usar Storage/Flysystem (evita finfo).
     */
    protected function writePrivate(string $relativePath, string $bytes, bool $strictPerms = true): void
    {
        $abs = $this->relToAbs($relativePath);
        $dir = dirname($abs);

        if (!is_dir($dir)) {
            @mkdir($dir, 0775, true);
        }
        if (@file_put_contents($abs, $bytes) === false) {
            throw new \RuntimeException('No se pudo escribir el archivo de firma.');
        }
        if ($strictPerms) {
            @chmod($abs, 0600); // sólo dueño
        }
    }

    /**
     * Elimina un archivo privado si existe (sin Storage).
     */
    protected function deletePrivate(?string $relativePath): void
    {
        if (!$relativePath) return;
        $abs = $this->relToAbs($relativePath);
        if (is_file($abs)) {
            @unlink($abs);
        }
    }

    /**
     * Convierte ruta relativa (dentro de storage/app) a ruta absoluta.
     */
    protected function relToAbs(string $relativePath): string
    {
        return rtrim(storage_path('app/'.ltrim($relativePath, '/')), DIRECTORY_SEPARATOR);
    }
}

