<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\LabelPreference;
use App\Models\LabelPreset;
use Illuminate\Http\Request;

class EtiquetasSettingsController extends Controller
{
    public function store(Request $request)
    {
        $user = $request->user();

        $data = $request->validate([
            'preset_slug' => ['nullable','string'],
            'config'      => ['nullable','array'],
        ]);

        // Si viene preset_slug, validamos que exista y esté activo (opcional)
        if (!empty($data['preset_slug'])) {
            $exists = LabelPreset::activos()->where('slug', $data['preset_slug'])->exists();
            if (!$exists) {
                return back()->withErrors(['preset_slug' => 'El preset indicado no existe o está inactivo.']);
            }
        }

        LabelPreference::updateOrCreate(
            ['user_id' => $user->id],
            [
                'preset_slug' => $data['preset_slug'] ?? null,
                'config'      => $data['config']      ?? null,
            ]
        );

        return back()->with('success', 'Preferencias de etiquetas guardadas.');
    }

    public function destroy(Request $request)
    {
        $user = $request->user();

        LabelPreference::where('user_id', $user->id)->delete();

        return back()->with('success', 'Preferencias de etiquetas eliminadas.');
    }
}
