<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Cliente;

class ClientesController extends Controller
{
    /** GET /admin/clientes/buscar?q= */
    public function buscar(Request $r)
    {
        $q = trim((string)$r->query('q', ''));
        if ($q === '') return response()->json([]);

        $rows = Cliente::query()
            ->select('id','nombres','ci_o_ruc','telefono','direccion','correo')
            ->where(function ($w) use ($q) {
                $w->where('nombres', 'like', "%{$q}%")
                  ->orWhere('ci_o_ruc', 'like', "%{$q}%");
            })
            ->orderBy('nombres')
            ->limit(20)
            ->get();

        return response()->json($rows);
    }

    /** POST /admin/clientes/crear */
    public function crear(Request $r)
    {
        $data = $r->validate([
            'nombres'   => 'required|string|max:255',
            'ci_o_ruc'  => 'required|string|max:20|unique:clientes,ci_o_ruc',
            'telefono'  => 'nullable|string|max:50',
            'direccion' => 'nullable|string|max:255',
            'correo'    => 'nullable|email|max:255',
        ]);

        // Normaliza (mayúsculas/minúsculas)
        $data['nombres']   = mb_strtoupper(trim($data['nombres']));
        $data['direccion'] = isset($data['direccion']) ? mb_strtoupper(trim($data['direccion'])) : null;
        $data['ci_o_ruc']  = isset($data['ci_o_ruc']) ? trim($data['ci_o_ruc']) : null;
        $data['correo']    = isset($data['correo'])   ? mb_strtolower(trim($data['correo'])) : null;

        // Duplicados por ci_o_ruc o correo
        $dup = Cliente::query()
            ->when($data['ci_o_ruc'], fn($q)=>$q->orWhere('ci_o_ruc', $data['ci_o_ruc']))
            ->when($data['correo'],   fn($q)=>$q->orWhere('correo',   $data['correo']))
            ->first();

        if ($dup) {
            // Ya existe: lo devolvemos para que lo selecciones (sin error)
            return response()->json([
                'id'        => $dup->id,
                'nombres'   => $dup->nombres,
                'ci_o_ruc'  => $dup->ci_o_ruc,
                'telefono'  => $dup->telefono,
                'direccion' => $dup->direccion,
                'correo'    => $dup->correo,
                'existed'   => true,
            ], 200);
        }

        $cli = Cliente::create($data);

        return response()->json($cli->only([
            'id','nombres','ci_o_ruc','telefono','direccion','correo'
        ]) + ['existed' => false], 201);
    }

    public function editar(Request $r)
    {

      //  dd($r->all());
        $data = $r->validate([
            'id'        => 'integer|exists:clientes,id',
            'nombres'   => 'string|max:255',
            'ci_o_ruc'  => 'nullable|string|max:20,',
            'telefono'  => 'nullable|string|max:50',
            'direccion' => 'nullable|string|max:255',
            'correo'    => 'nullable|email|max:255,' ,
        ]);

        $cli = Cliente::findOrFail($data['id']);
       // dd($cli);

        foreach (['nombres','ci_o_ruc','telefono','direccion','correo'] as $f) {
            if (array_key_exists($f, $data)) {
                $val = $data[$f];
                if ($f === 'nombres' || $f === 'direccion') {
                    $val = mb_strtoupper(trim($val));
                } elseif ($f === 'correo') {
                    $val = mb_strtolower(trim($val));
                }
                $cli->{$f} = $val;
            }
        }
        $cli->save();

        }
}
