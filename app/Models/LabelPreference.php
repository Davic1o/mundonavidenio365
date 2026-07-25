<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LabelPreference extends Model
{
    protected $fillable = ['user_id', 'preset_slug', 'config'];

    protected $casts = [
        'config' => 'array',
    ];
}
