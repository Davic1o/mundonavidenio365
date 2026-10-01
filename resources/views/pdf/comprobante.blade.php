<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Comprobante Electrónico</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            font-size: 12px;
            color: #333;
            margin: 0;
            padding: 0;
        }
        .header {
            width: 100%;
            margin-bottom: 20px;
        }
        .header td {
            vertical-align: top;
        }
        .box {
            border: 1px solid #ccc;
            border-radius: 5px;
            padding: 10px;
            margin-bottom: 15px;
        }
        .title {
            font-size: 16px;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .info-table {
            width: 100%;
            border-collapse: collapse;
        }
        .info-table th, .info-table td {
            text-align: left;
            padding: 4px;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }
        .items-table th, .items-table td {
            border: 1px solid #ccc;
            padding: 6px;
            text-align: center;
        }
        .items-table th {
            background-color: #f5f5f5;
        }
        .items-table td.left {
            text-align: left;
        }
        .items-table td.right {
            text-align: right;
        }
        .totals-table {
            width: 40%;
            float: right;
            border-collapse: collapse;
        }
        .totals-table th, .totals-table td {
            border: 1px solid #ccc;
            padding: 6px;
        }
        .totals-table th {
            text-align: left;
            background-color: #f5f5f5;
        }
        .totals-table td {
            text-align: right;
        }
        .clear {
            clear: both;
        }
    </style>
</head>
<body>
    <table class="header">
        <tr>
            <td style="width: 48%;">
                <div class="box" style="text-align: center; min-height: 160px; padding: 6px;">
                    @if(file_exists(public_path('logo.png')))
                        <div style="display: inline-block; background-color: #ffffff; padding: 4px 8px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 6px;">
                            <img src="{{ public_path('logo.png') }}" alt="Logo" style="max-height: 45px; max-width: 180px; display: block;" />
                        </div>
                    @endif
                    <h2 style="font-size: 13px; margin: 2px 0;">{{ $empresa['nombre_comercial'] ?? 'Empresa' }}</h2>
                    <p style="margin: 2px 0;"><strong>Razón Social:</strong> {{ $empresa['razon_social'] ?? '' }}</p>
                    <p style="margin: 2px 0;"><strong>Dirección:</strong> {{ $empresa['direccion'] ?? '' }}</p>
                    <p style="margin: 2px 0;"><strong>Teléfono:</strong> {{ $empresa['telefono'] ?? '' }}</p>
                    <p style="margin: 2px 0;"><strong>Correo:</strong> {{ $empresa['correo'] ?? '' }}</p>
                    <p style="margin: 2px 0;"><strong>Obligado a llevar contabilidad:</strong> {{ isset($empresa['obligado_a_llevar_contabilidad']) && $empresa['obligado_a_llevar_contabilidad'] ? 'SI' : 'NO' }}</p>
                </div>
            </td>
            <td style="width: 4%;"></td>
            <td style="width: 48%;">
                <div class="box" style="height: 160px;">
                    <div class="title">RUC: {{ $empresa['ruc'] ?? '' }}</div>
                    <div class="title">{{ $tipoComprobante ?? 'FACTURA' }}</div>
                    <p style="margin: 5px 0;"><strong>No.</strong> {{ $comprobante->numero ?? ($comprobante->estab . '-' . $comprobante->pto_emision . '-' . str_pad($comprobante->secuencial, 9, '0', STR_PAD_LEFT)) }}</p>
                    <p style="margin: 5px 0;"><strong>NÚMERO DE AUTORIZACIÓN:</strong></p>
                    <p style="margin: 5px 0; font-size: 11px; word-wrap: break-word;">{{ $comprobante->autorizacion }}</p>
                    <p style="margin: 5px 0;"><strong>FECHA Y HORA DE AUTORIZACIÓN:</strong> {{ \Carbon\Carbon::parse($comprobante->updated_at)->format('Y-m-d H:i:s') }}</p>
                    <p style="margin: 5px 0;"><strong>AMBIENTE:</strong> {{ (isset($empresa['ambiente']) && $empresa['ambiente'] == 2) ? 'PRODUCCIÓN' : 'PRUEBAS' }}</p>
                    <p style="margin: 5px 0;"><strong>EMISIÓN:</strong> NORMAL</p>
                    <p style="margin: 5px 0;"><strong>CLAVE DE ACCESO:</strong></p>
                    <p style="margin: 5px 0; font-size: 11px;">{{ $comprobante->autorizacion }}</p>
                </div>
            </td>
        </tr>
    </table>

    <div class="box">
        <table class="info-table">
            <tr>
                <td style="width: 15%;"><strong>Razón Social / Nombres:</strong></td>
                <td style="width: 50%;">{{ $cliente->nombres ?? ($cliente->nombre ?? 'CONSUMIDOR FINAL') }}</td>
                <td style="width: 15%;"><strong>Identificación:</strong></td>
                <td style="width: 20%;">{{ $cliente->ci_o_ruc ?? '9999999999999' }}</td>
            </tr>
            <tr>
                <td><strong>Fecha Emisión:</strong></td>
                <td>{{ \Carbon\Carbon::parse($comprobante->fecha)->format('d/m/Y') }}</td>
                <td><strong>Dirección:</strong></td>
                <td>{{ $cliente->direccion ?? '' }}</td>
            </tr>
        </table>
    </div>

    <table class="items-table">
        <thead>
            <tr>
                <th>Cod. Principal</th>
                <th>Cantidad</th>
                <th>Descripción</th>
                <th>Precio Unitario</th>
                <th>Descuento</th>
                <th>Precio Total</th>
            </tr>
        </thead>
        <tbody>
            @foreach($detalles as $detalle)
            <tr>
                <td>{{ $detalle->producto->codigo ?? '' }}</td>
                <td>{{ $detalle->cantidad }}</td>
                <td class="left">{{ $detalle->producto->nombre ?? 'Producto/Servicio' }}</td>
                <td class="right">{{ number_format($detalle->precio, 2) }}</td>
                <td class="right">{{ number_format($detalle->descuento, 2) }}</td>
                <td class="right">{{ number_format($detalle->precio_total, 2) }}</td>
            </tr>
            @endforeach
        </tbody>
    </table>

    <div>
        <div style="float: left; width: 55%;">
            <div class="box">
                <div class="title">Información Adicional</div>
                <table class="info-table">
                    @if(!empty($cliente?->telefono))
                    <tr>
                        <td style="width: 30%;"><strong>Teléfono:</strong></td>
                        <td>{{ $cliente->telefono ?? '' }}</td>
                    </tr>
                    @endif
                    @if(!empty($cliente?->correo))
                    <tr>
                        <td style="width: 30%;"><strong>Email:</strong></td>
                        <td>{{ $cliente->correo ?? '' }}</td>
                    </tr>
                    @endif
                    <tr>
                        <td style="width: 30%;"><strong>RUC Proveedor:</strong></td>
                        <td>{{ \App\Services\SriFacturaService::RUC_PROVEEDOR }}</td>
                    </tr>
                </table>
            </div>
            
            <div class="box">
                <div class="title">Formas de Pago</div>
                <table class="info-table">
                    @forelse($pagos ?? [] as $pago)
                    <tr>
                        <td>{{ $pago->nombre ?? 'Otros con Utilización del Sistema Financiero' }}</td>
                        <td style="text-align: right;">${{ number_format($pago->valor, 2) }}</td>
                    </tr>
                    @empty
                    <tr>
                        <td>Otros con Utilización del Sistema Financiero</td>
                        <td style="text-align: right;">${{ number_format($comprobante->total, 2) }}</td>
                    </tr>
                    @endforelse
                </table>
            </div>
        </div>

        <table class="totals-table">
            <tr>
                <th>SUBTOTAL 15%</th>
                <td>{{ number_format($comprobante->subtotal - ($comprobante->impuesto_0 ?? 0), 2) }}</td>
            </tr>
            <tr>
                <th>SUBTOTAL 0%</th>
                <td>{{ number_format($comprobante->impuesto_0 ?? 0, 2) }}</td>
            </tr>
            <tr>
                <th>DESCUENTO</th>
                <td>{{ number_format($comprobante->descuento, 2) }}</td>
            </tr>
            <tr>
                <th>SUBTOTAL</th>
                <td>{{ number_format($comprobante->subtotal, 2) }}</td>
            </tr>
            <tr>
                <th>IVA 15%</th>
                <td>{{ number_format($comprobante->impuesto_15, 2) }}</td>
            </tr>
            <tr>
                <th>VALOR TOTAL</th>
                <td><strong>{{ number_format($comprobante->total, 2) }}</strong></td>
            </tr>
        </table>
        <div class="clear"></div>
    </div>
</body>
</html>
