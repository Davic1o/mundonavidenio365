<?php

namespace App\Services;

use App\Models\Venta;
use App\Models\VentaProducto;
use App\Models\NotaCredito;
use App\Models\NotaCreditoDetalle;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Log;

class SriFacturaService
{
    /**
     * Genera la cadena XML para la Factura (esquema 1.1.0 SRI)
     */
    public function generarFacturaXMLString(Venta $venta, array $cfg): string
    {
        $cliente = $venta->cliente;
        $items = VentaProducto::with('producto')->where('venta_id', $venta->id)->get();
        $secu = str_pad($venta->secuencial, 9, '0', STR_PAD_LEFT);

        $doc = new \DOMDocument('1.0', 'UTF-8');
        $doc->formatOutput = false;

        $factura = $doc->createElement('factura');
        $factura->setAttribute('id', 'comprobante');
        $factura->setAttribute('version', '1.1.0');
        $doc->appendChild($factura);

        /* ========== infoTributaria ========== */
        $infoTributaria = $doc->createElement('infoTributaria');
        $factura->appendChild($infoTributaria);

        $infoTributaria->appendChild($doc->createElement('ambiente', (string)($cfg['ambiente'] ?? '1')));
        $infoTributaria->appendChild($doc->createElement('tipoEmision', '1'));
        $infoTributaria->appendChild($doc->createElement('razonSocial', htmlspecialchars((string)($cfg['razonSocial'] ?? 'Mundo Navideño 365'), ENT_QUOTES, 'UTF-8')));
        $infoTributaria->appendChild($doc->createElement('nombreComercial', htmlspecialchars((string)($cfg['nombreComercial'] ?? 'Mundo Navideño 365'), ENT_QUOTES, 'UTF-8')));
        $infoTributaria->appendChild($doc->createElement('ruc', (string)($cfg['ruc'] ?? '1790000000001')));
        $infoTributaria->appendChild($doc->createElement('claveAcceso', (string)$venta->autorizacion));
        $infoTributaria->appendChild($doc->createElement('codDoc', '01'));
        $infoTributaria->appendChild($doc->createElement('estab', (string)$venta->estab));
        $infoTributaria->appendChild($doc->createElement('ptoEmi', (string)$venta->pto_emision));
        $infoTributaria->appendChild($doc->createElement('secuencial', $secu));
        $infoTributaria->appendChild($doc->createElement('dirMatriz', htmlspecialchars((string)($cfg['dirMatriz'] ?? ''), ENT_QUOTES, 'UTF-8')));

        $esCF = $this->isConsumidorFinalId($cliente?->ci_o_ruc ?? '');
        $razonComprador = $esCF ? 'CONSUMIDOR FINAL' : (string)($cliente?->nombres ?? 'CONSUMIDOR FINAL');
        $identComprador = $esCF ? '9999999999999' : (string)($cliente?->ci_o_ruc ?? '9999999999999');

        /* ========== infoFactura ========== */
        $infoFactura = $doc->createElement('infoFactura');
        $factura->appendChild($infoFactura);

        $dt = new \DateTime($venta->fecha ?? 'now');
        $infoFactura->appendChild($doc->createElement('fechaEmision', $dt->format('d/m/Y')));
        $infoFactura->appendChild($doc->createElement('dirEstablecimiento', htmlspecialchars((string)($cfg['dirEstablecimiento'] ?? ''), ENT_QUOTES, 'UTF-8')));
        $infoFactura->appendChild($doc->createElement('obligadoContabilidad', 'NO'));

        $tipoIdent = '07';
        if (!$esCF) {
            $digits = preg_replace('/\D/', '', $identComprador);
            if (strlen($digits) === 13) $tipoIdent = '04'; // RUC
            elseif (strlen($digits) === 10) $tipoIdent = '05'; // Cédula
            else $tipoIdent = '06'; // Pasaporte/Otro
        }

        $infoFactura->appendChild($doc->createElement('tipoIdentificacionComprador', $tipoIdent));
        $infoFactura->appendChild($doc->createElement('razonSocialComprador', htmlspecialchars($razonComprador, ENT_QUOTES, 'UTF-8')));
        $infoFactura->appendChild($doc->createElement('identificacionComprador', $identComprador));

        $totSinImp  = number_format((float)$venta->subtotal, 2, '.', '');
        $totalDesc  = number_format((float)($venta->descuento ?? 0), 2, '.', '');
        $importeTot = number_format((float)$venta->total, 2, '.', '');

        $infoFactura->appendChild($doc->createElement('totalSinImpuestos', $totSinImp));
        $infoFactura->appendChild($doc->createElement('totalDescuento', $totalDesc));

        /* totalConImpuestos */
        $totalConImpuestos = $doc->createElement('totalConImpuestos');
        $infoFactura->appendChild($totalConImpuestos);

        $imp0 = (float)($venta->impuesto_0 ?? 0);
        $imp15 = (float)($venta->impuesto_15 ?? 0);

        if ($imp0 > 0 || $imp15 <= 0) {
            $totalImp0 = $doc->createElement('totalImpuesto');
            $totalImp0->appendChild($doc->createElement('codigo', '2'));
            $totalImp0->appendChild($doc->createElement('codigoPorcentaje', '0'));
            $totalImp0->appendChild($doc->createElement('baseImponible', $totSinImp));
            $totalImp0->appendChild($doc->createElement('valor', '0.00'));
            $totalConImpuestos->appendChild($totalImp0);
        }

        if ($imp15 > 0) {
            $totalImp15 = $doc->createElement('totalImpuesto');
            $totalImp15->appendChild($doc->createElement('codigo', '2'));
            $totalImp15->appendChild($doc->createElement('codigoPorcentaje', '4')); // 15% IVA
            $totalImp15->appendChild($doc->createElement('baseImponible', $totSinImp));
            $totalImp15->appendChild($doc->createElement('valor', number_format($imp15, 2, '.', '')));
            $totalConImpuestos->appendChild($totalImp15);
        }

        $infoFactura->appendChild($doc->createElement('propina', '0.00'));
        $infoFactura->appendChild($doc->createElement('importeTotal', $importeTot));
        $infoFactura->appendChild($doc->createElement('moneda', 'DOLAR'));

        /* pagos */
        $pagosNode = $doc->createElement('pagos');
        $infoFactura->appendChild($pagosNode);

        $vp = DB::table('venta_pagos')->where('venta_id', $venta->id)->get();
        if ($vp->isEmpty()) {
            $pagoNode = $doc->createElement('pago');
            $pagoNode->appendChild($doc->createElement('formaPago', '01'));
            $pagoNode->appendChild($doc->createElement('total', $importeTot));
            $pagosNode->appendChild($pagoNode);
        } else {
            foreach ($vp as $p) {
                $pagoNode = $doc->createElement('pago');
                $pagoNode->appendChild($doc->createElement('formaPago', (string)($p->codigo ?? '01')));
                $pagoNode->appendChild($doc->createElement('total', number_format((float)$p->valor, 2, '.', '')));
                $pagosNode->appendChild($pagoNode);
            }
        }

        /* ========== detalles ========== */
        $detalles = $doc->createElement('detalles');
        $factura->appendChild($detalles);

        foreach ($items as $it) {
            $det = $doc->createElement('detalle');
            $detalles->appendChild($det);

            $cod = (string)($it->producto?->codigo ?? $it->producto_id);
            $nom = (string)($it->producto?->nombre ?? 'PRODUCTO');

            $det->appendChild($doc->createElement('codigoPrincipal', htmlspecialchars($cod, ENT_QUOTES, 'UTF-8')));
            $det->appendChild($doc->createElement('descripcion', htmlspecialchars($nom, ENT_QUOTES, 'UTF-8')));
            $det->appendChild($doc->createElement('cantidad', number_format((float)$it->cantidad, 4, '.', '')));

            $cant = (float)$it->cantidad ?: 1.0;
            $precioBruto = (float)$it->precio;
            $dscBruto    = (float)($it['descuento'] ?? 0);
            $ivaPct      = (int)($it['iva'] ?? 15) === 0 ? 0 : 15;
            $div         = $ivaPct === 15 ? 1.15 : 1.0;

            $pBaseLine = $precioBruto / $div;
            $dBaseLine = $dscBruto / $div;

            $det->appendChild($doc->createElement('precioUnitario', number_format($pBaseLine, 4, '.', '')));
            $det->appendChild($doc->createElement('descuento', number_format($dBaseLine, 2, '.', '')));

            $totSinImpLinea = max(0, ($cant * $pBaseLine) - $dBaseLine);
            $det->appendChild($doc->createElement('precioTotalSinImpuesto', number_format($totSinImpLinea, 2, '.', '')));

            $impdet = $doc->createElement('impuestos');
            $det->appendChild($impdet);

            $imp = $doc->createElement('impuesto');
            $impdet->appendChild($imp);
            $imp->appendChild($doc->createElement('codigo', '2'));

            if ($ivaPct === 0) {
                $imp->appendChild($doc->createElement('codigoPorcentaje', '0'));
                $imp->appendChild($doc->createElement('tarifa', '0'));
                $imp->appendChild($doc->createElement('baseImponible', number_format($totSinImpLinea, 2, '.', '')));
                $imp->appendChild($doc->createElement('valor', '0.00'));
            } else {
                $imp->appendChild($doc->createElement('codigoPorcentaje', '4')); // 15%
                $imp->appendChild($doc->createElement('tarifa', '15'));
                $imp->appendChild($doc->createElement('baseImponible', number_format($totSinImpLinea, 2, '.', '')));
                $valIvaLine = max(0, $totSinImpLinea * 0.15);
                $imp->appendChild($doc->createElement('valor', number_format($valIvaLine, 2, '.', '')));
            }
        }

        /* ========== infoAdicional ========== */
        $infoAdicional = $doc->createElement('infoAdicional');
        $factura->appendChild($infoAdicional);

        if (!empty($cliente?->correo)) {
            $campoEmail = $doc->createElement('campoAdicional', htmlspecialchars((string)$cliente->correo, ENT_QUOTES, 'UTF-8'));
            $campoEmail->setAttribute('nombre', 'Email');
            $infoAdicional->appendChild($campoEmail);
        }
        if (!empty($cliente?->telefono)) {
            $campoTel = $doc->createElement('campoAdicional', htmlspecialchars((string)$cliente->telefono, ENT_QUOTES, 'UTF-8'));
            $campoTel->setAttribute('nombre', 'Telefono');
            $infoAdicional->appendChild($campoTel);
        }

        return $doc->saveXML();
    }

    /**
     * Procesa la firma y emisión de la factura ante los WebServices del SRI.
     * Limpia los archivos temporales y sólo conserva el XML autorizado final en aprobados.
     */
    public function procesarFacturaSRI(Venta $venta, array $empresaInfo, array $stockMov): array
    {
        $ambiente = (int)($empresaInfo['ambiente'] ?? 1);

        // Endpoints SRI según el ambiente configurado en la empresa:
        // ambiente=1 -> Pruebas  -> celcer.sri.gob.ec
        // ambiente=2 -> Producción -> cel.sri.gob.ec
        if ($ambiente === 2) {
            $webRecepcion = 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl';
            $webAutoriza  = 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl';
        } else {
            $webRecepcion = 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl';
            $webAutoriza  = 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl';
        }

        Log::info("SRI Factura -> Ambiente: {$ambiente} " . ($ambiente === 2 ? '(PRODUCCIÓN)' : '(PRUEBAS)') . " | Recepción: {$webRecepcion}");

        // 0. Si el comprobante NO está AUTORIZADO, actualizar siempre a la configuración vigente de la empresa (estab, pto_emision, fecha y claveAcceso de 49 dígitos)
        if (strtoupper((string)($venta->sri_estado_autorizacion ?? '')) !== 'AUTORIZADO') {
            $empEstab  = !empty($empresaInfo['establecimiento']) ? str_pad((string)$empresaInfo['establecimiento'], 3, '0', STR_PAD_LEFT) : '001';
            $empPtoEmi = !empty($empresaInfo['punto_emision']) ? str_pad((string)$empresaInfo['punto_emision'], 3, '0', STR_PAD_LEFT) : '001';

            $fechaEmisionObj = \Carbon\Carbon::now();
            $venta->fecha = $fechaEmisionObj->toDateTimeString();

            $venta->estab = $empEstab;
            $venta->pto_emision = $empPtoEmi;

            if (empty($venta->secuencial)) {
                $venta->secuencial = $empresaInfo['secuencial_factura'] ?? '000000001';
            }

            $secPad = str_pad((string)$venta->secuencial, 9, '0', STR_PAD_LEFT);
            $venta->numero = $venta->estab . '-' . $venta->pto_emision . '-' . $secPad;

            $codigoNum = (strlen((string)$venta->autorizacion) === 49) ? substr((string)$venta->autorizacion, 39, 8) : null;
            $venta->autorizacion = $this->generarClaveAcceso(
                $fechaEmisionObj,
                $empresaInfo['ruc'] ?? '1790000000001',
                (string)($empresaInfo['ambiente'] ?? '1'),
                $venta->estab,
                $venta->pto_emision,
                $venta->secuencial,
                '01',
                $codigoNum
            );
            $venta->save();
        }

        // 1. Generar XML String
        $venta->load(['cliente']);
        $xmlString = $this->generarFacturaXMLString($venta, [
            'razonSocial'        => $empresaInfo['razon_social'] ?? ($empresaInfo['nombre_comercial'] ?? 'Mundo Navideño 365'),
            'nombreComercial'    => $empresaInfo['nombre_comercial'] ?? ($empresaInfo['razon_social'] ?? 'Mundo Navideño 365'),
            'ruc'                => $empresaInfo['ruc'] ?? '1790000000001',
            'dirMatriz'          => $empresaInfo['direccion'] ?? '',
            'dirEstablecimiento' => $empresaInfo['direccion'] ?? '',
            'ambiente'           => $ambiente,
        ]);

        // 2. Firmar XML
        $pathCertificateDb = $empresaInfo['ruta_firma_electronica'] ?? '';
        $rawPath = storage_path('app/' . $pathCertificateDb);
        if (!file_exists($rawPath)) {
            $this->revertirStockSiCorresponde($stockMov);
            return [
                'success' => false,
                'message' => 'Archivo de firma electrónica no encontrado en: ' . $rawPath
            ];
        }

        $pathCertificate = 'file://' . realpath($rawPath);
        $sriSigner = new SignDOcumentToSRI(
            'factura',
            $pathCertificate,
            $empresaInfo['clave_firma_electronica'] ?? '',
            $xmlString,
            SignDOcumentToSRI::ALGO_SHA1,
            null
        );

        $xmlFirmado = $sriSigner->xml;
        $tempDir = storage_path('app/sri/xml/');
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0777, true);
        }

        $tempXmlPath = $tempDir . $venta->autorizacion . '.xml';
        $tempRecepPath = $tempDir . $venta->autorizacion . '_recep.xml';
        file_put_contents($tempXmlPath, $xmlFirmado);

        $venta->estado = 'Firmada';
        $venta->save();

        // 3. Enviar a Recepción SRI
        try {
            $resRecep = $this->peticionRecepcionSRI($webRecepcion, $xmlFirmado);

            if (in_array($resRecep['estado'], ['DEVUELTA', 'NO AUTORIZADO'], true)) {
                $this->limpiarArchivosTemporales([$tempXmlPath, $tempRecepPath]);
                $this->revertirStockSiCorresponde($stockMov);

                $venta->estado = 'Devuelta';
                $venta->save();

                return [
                    'success' => false,
                    'message' => 'El comprobante fue devuelto por el SRI: ' . $resRecep['mensaje']
                ];
            }
        } catch (\Throwable $e) {
            $this->limpiarArchivosTemporales([$tempXmlPath, $tempRecepPath]);
            $this->revertirStockSiCorresponde($stockMov);
            return [
                'success' => false,
                'message' => 'Error de conexión en Recepción SRI: ' . $e->getMessage()
            ];
        }

        // 4. Consultar Autorización SRI
        try {
            $resAut = $this->peticionAutorizacionSRI($webAutoriza, $venta->autorizacion);

            $directorioAprobados = storage_path('app/public/facturas/aprobados/');
            if (!file_exists($directorioAprobados)) {
                mkdir($directorioAprobados, 0777, true);
            }

            $nombreArchivoAprobado = $directorioAprobados . 'FC' . $venta->estab . '-' . $venta->pto_emision . '-' . $venta->secuencial . '.xml';

            if ($resAut['estado'] !== 'AUTORIZADO') {
                $this->limpiarArchivosTemporales([$tempXmlPath, $tempRecepPath]);
                $this->revertirStockSiCorresponde($stockMov);

                $venta->estado = $resAut['estado'] ?: 'No autorizado';
                $venta->save();

                return [
                    'success' => false,
                    'message' => 'El comprobante no fue autorizado por el SRI: ' . $resAut['mensaje']
                ];
            }

            // Guardar XML final autorizado
            file_put_contents($nombreArchivoAprobado, $resAut['xmlResponse']);

            $venta->estado = 'AUTORIZADO';
            if (Schema::hasColumn('ventas', 'sri_xml_path')) {
                $venta->sri_xml_path = 'facturas/aprobados/FC' . $venta->estab . '-' . $venta->pto_emision . '-' . $venta->secuencial . '.xml';
            }
            $venta->save();

            // Enviar comprobante por correo únicamente cuando está AUTORIZADO por el SRI
            $correoEnviado = $this->enviarComprobantePorCorreo($venta, $empresaInfo, 'Factura', $nombreArchivoAprobado);
            $msgMail = $correoEnviado ? ' y enviada por correo al cliente.' : '.';

            // Limpieza exitosa de archivos temporales intermediarios
            $this->limpiarArchivosTemporales([$tempXmlPath, $tempRecepPath]);
            $this->limpiarBorradoresAntiguos();

            return [
                'success' => true,
                'message' => 'Venta emitida y AUTORIZADA correctamente' . $msgMail
            ];

        } catch (\Throwable $e) {
            $this->limpiarArchivosTemporales([$tempXmlPath, $tempRecepPath]);
            $this->revertirStockSiCorresponde($stockMov);
            return [
                'success' => false,
                'message' => 'Error de conexión en Autorización SRI: ' . $e->getMessage()
            ];
        }
    }

    /**
     * Limpia los archivos XML temporales indicados
     */
    public function limpiarArchivosTemporales(array $files): void
    {
        foreach ($files as $file) {
            if (file_exists($file)) {
                @unlink($file);
            }
        }
    }

    /**
     * Limpia archivos XML temporales antiguos en storage/app/sri/xml/
     */
    public function limpiarBorradoresAntiguos(): void
    {
        $dir = storage_path('app/sri/xml/');
        if (is_dir($dir)) {
            $files = glob($dir . '*');
            foreach ($files as $file) {
                if (is_file($file)) {
                    @unlink($file);
                }
            }
        }
    }

    protected function revertirStockSiCorresponde(array &$stockMov): void
    {
        if (!empty($stockMov['aplico']) && !empty($stockMov['items'])) {
            foreach ($stockMov['items'] as $it) {
                DB::table('productos')
                    ->where('id', $it['producto_id'])
                    ->increment('cantidad_total', $it['cantidad']);
            }
            $stockMov['aplico'] = false;
        }
    }

    protected function extraerMensajeSRI($result): string
    {
        try {
            $comprobantes = $result->RespuestaRecepcionComprobante->comprobantes->comprobante ?? null;
            if ($comprobantes) {
                $mensajes = $comprobantes->mensajes->mensaje ?? [];
                if (!is_array($mensajes)) $mensajes = [$mensajes];
                $msgs = [];
                foreach ($mensajes as $m) {
                    $msgs[] = ($m->mensaje ?? '') . ' ' . ($m->informacionAdicional ?? '');
                }
                return implode(' | ', array_filter($msgs));
            }
        } catch (\Throwable $e) {}
        return 'Consulte los detalles en el portal del SRI.';
    }

    protected function extraerMensajeAutorizacionSRI($result): string
    {
        try {
            $autorizaciones = $result->RespuestaAutorizacionComprobante->autorizaciones->autorizacion ?? null;
            if ($autorizaciones) {
                $mensajes = $autorizaciones->mensajes->mensaje ?? [];
                if (!is_array($mensajes)) $mensajes = [$mensajes];
                $msgs = [];
                foreach ($mensajes as $m) {
                    $msgs[] = ($m->mensaje ?? '') . ' ' . ($m->informacionAdicional ?? '');
                }
                return implode(' | ', array_filter($msgs));
            }
        } catch (\Throwable $e) {}
        return 'Consulte los detalles en el portal del SRI.';
    }

    /**
     * Genera la cadena XML para la Nota de Crédito (esquema 1.1.0 SRI)
     */
    public function generarNotaCreditoXMLString(NotaCredito $nc, array $cfg): string
    {
        $venta    = $nc->venta;
        $cliente  = $nc->cliente;
        $detalles = DB::table('nota_credito_detalles')
            ->join('productos', 'productos.id', '=', 'nota_credito_detalles.producto_id')
            ->where('nota_credito_detalles.nota_credito_id', $nc->id)
            ->select('nota_credito_detalles.*', 'productos.nombre', 'productos.codigo')
            ->get();

        $secu = str_pad($nc->secuencial, 9, '0', STR_PAD_LEFT);

        $doc = new \DOMDocument('1.0', 'UTF-8');
        $doc->formatOutput = false;

        $root = $doc->createElement('notaCredito');
        $root->setAttribute('id', 'comprobante');
        $root->setAttribute('version', '1.1.0');
        $doc->appendChild($root);

        // ===== infoTributaria
        $it = $doc->createElement('infoTributaria');
        $root->appendChild($it);
        $it->appendChild($doc->createElement('ambiente', (string)($cfg['ambiente'] ?? '1')));
        $it->appendChild($doc->createElement('tipoEmision', '1'));
        $it->appendChild($doc->createElement('razonSocial', htmlspecialchars((string)($cfg['razonSocial'] ?? ''), ENT_QUOTES, 'UTF-8')));
        $it->appendChild($doc->createElement('nombreComercial', htmlspecialchars((string)($cfg['nombreComercial'] ?? ''), ENT_QUOTES, 'UTF-8')));
        $it->appendChild($doc->createElement('ruc', (string)($cfg['ruc'] ?? '1790000000001')));
        $it->appendChild($doc->createElement('claveAcceso', (string)$nc->autorizacion));
        $it->appendChild($doc->createElement('codDoc', '04'));
        $it->appendChild($doc->createElement('estab', (string)$nc->estab));
        $it->appendChild($doc->createElement('ptoEmi', (string)$nc->pto_emision));
        $it->appendChild($doc->createElement('secuencial', $secu));
        $it->appendChild($doc->createElement('dirMatriz', htmlspecialchars((string)($cfg['dirMatriz'] ?? ''), ENT_QUOTES, 'UTF-8')));

        $esCF = $this->isConsumidorFinalId($cliente?->ci_o_ruc ?? '');
        $razonComprador = $esCF ? 'CONSUMIDOR FINAL' : (string)($cliente?->nombres ?? 'CONSUMIDOR FINAL');
        $identComprador = $esCF ? '9999999999999' : (string)($cliente?->ci_o_ruc ?? '9999999999999');

        // ===== infoNotaCredito
        $inf = $doc->createElement('infoNotaCredito');
        $root->appendChild($inf);

        $inf->appendChild($doc->createElement('fechaEmision', \Carbon\Carbon::parse($nc->fecha)->format('d/m/Y')));
        $inf->appendChild($doc->createElement('dirEstablecimiento', htmlspecialchars((string)($cfg['dirEstablecimiento'] ?? ''), ENT_QUOTES, 'UTF-8')));

        $tipoIdent = '07';
        if (!$esCF) {
            $digits = preg_replace('/\D/', '', $identComprador);
            if (strlen($digits) === 13) $tipoIdent = '04';
            elseif (strlen($digits) === 10) $tipoIdent = '05';
            else $tipoIdent = '06';
        }

        $inf->appendChild($doc->createElement('tipoIdentificacionComprador', $tipoIdent));
        $inf->appendChild($doc->createElement('razonSocialComprador', htmlspecialchars($razonComprador, ENT_QUOTES, 'UTF-8')));
        $inf->appendChild($doc->createElement('identificacionComprador', $identComprador));
        $inf->appendChild($doc->createElement('obligadoContabilidad', 'NO'));
        $inf->appendChild($doc->createElement('codDocModificado', '01'));
        $inf->appendChild($doc->createElement('numDocModificado', $venta->estab . '-' . $venta->pto_emision . '-' . str_pad($venta->secuencial, 9, '0', STR_PAD_LEFT)));
        $inf->appendChild($doc->createElement('fechaEmisionDocSustento', \Carbon\Carbon::parse($venta->fecha)->format('d/m/Y')));

        $sumBase15 = 0.00;
        $sumIva15  = 0.00;
        $sumBase0  = 0.00;

        foreach ($detalles as $d) {
            $cant = (float)$d->cantidad;
            $precioConIva = (float)$d->precio;
            $descConIva   = (float)($d->descuento ?? 0);
            $lineaBruta   = max(0.0, $cant * $precioConIva - $descConIva);

            if ((int)$d->iva === 15) {
                $base = round($lineaBruta / 1.15, 2);
                $iva  = round($base * 0.15, 2);
                $sumBase15 += $base;
                $sumIva15  += $iva;
            } else {
                $sumBase0 += round($lineaBruta, 2);
            }
        }

        $totalSinImpuestos = round($sumBase0 + $sumBase15, 2);
        $importeTotal      = round($totalSinImpuestos + $sumIva15, 2);

        $inf->appendChild($doc->createElement('totalSinImpuestos', number_format($totalSinImpuestos, 2, '.', '')));
        $inf->appendChild($doc->createElement('valorModificacion', number_format($importeTotal, 2, '.', '')));
        $inf->appendChild($doc->createElement('moneda', 'DOLAR'));

        $tci = $doc->createElement('totalConImpuestos');
        if ($sumBase0 > 0) {
            $ti0 = $doc->createElement('totalImpuesto');
            $ti0->appendChild($doc->createElement('codigo', '2'));
            $ti0->appendChild($doc->createElement('codigoPorcentaje', '0'));
            $ti0->appendChild($doc->createElement('baseImponible', number_format($sumBase0, 2, '.', '')));
            $ti0->appendChild($doc->createElement('valor', '0.00'));
            $tci->appendChild($ti0);
        }
        if ($sumBase15 > 0 || $sumIva15 > 0) {
            $ti15 = $doc->createElement('totalImpuesto');
            $ti15->appendChild($doc->createElement('codigo', '2'));
            $ti15->appendChild($doc->createElement('codigoPorcentaje', '4'));
            $ti15->appendChild($doc->createElement('baseImponible', number_format($sumBase15, 2, '.', '')));
            $ti15->appendChild($doc->createElement('valor', number_format($sumIva15, 2, '.', '')));
            $tci->appendChild($ti15);
        }
        $inf->appendChild($tci);

        $inf->appendChild($doc->createElement('motivo', htmlspecialchars((string)($nc->motivo ?? 'Devolución de mercadería'), ENT_QUOTES, 'UTF-8')));

        // ===== detalles
        $detNode = $doc->createElement('detalles');
        $root->appendChild($detNode);

        foreach ($detalles as $d) {
            $cantidad  = (float)$d->cantidad;
            $pUnitBrut = (float)$d->precio;
            $descBrut  = (float)($d->descuento ?? 0);

            $pUnitBase = round($pUnitBrut / 1.15, 6);
            $descBase  = round($descBrut / 1.15, 6);
            $totalSinImpLinea = round($cantidad * $pUnitBase - $descBase, 2);

            $det = $doc->createElement('detalle');
            $det->appendChild($doc->createElement('codigoInterno', htmlspecialchars((string)($d->codigo ?? $d->producto_id), ENT_QUOTES, 'UTF-8')));
            $det->appendChild($doc->createElement('descripcion', htmlspecialchars((string)($d->nombre ?? 'Producto'), ENT_QUOTES, 'UTF-8')));
            $det->appendChild($doc->createElement('cantidad', number_format($cantidad, 6, '.', '')));
            $det->appendChild($doc->createElement('precioUnitario', number_format($pUnitBase, 6, '.', '')));
            $det->appendChild($doc->createElement('descuento', number_format($descBase, 2, '.', '')));
            $det->appendChild($doc->createElement('precioTotalSinImpuesto', number_format($totalSinImpLinea, 2, '.', '')));

            $imps = $doc->createElement('impuestos');
            $imp  = $doc->createElement('impuesto');
            if ((int)$d->iva === 15) {
                $imp->appendChild($doc->createElement('codigo', '2'));
                $imp->appendChild($doc->createElement('codigoPorcentaje', '4'));
                $imp->appendChild($doc->createElement('tarifa', '15'));
                $imp->appendChild($doc->createElement('baseImponible', number_format($totalSinImpLinea, 2, '.', '')));
                $imp->appendChild($doc->createElement('valor', number_format(round($totalSinImpLinea * 0.15, 2), 2, '.', '')));
            } else {
                $imp->appendChild($doc->createElement('codigo', '2'));
                $imp->appendChild($doc->createElement('codigoPorcentaje', '0'));
                $imp->appendChild($doc->createElement('tarifa', '0'));
                $imp->appendChild($doc->createElement('baseImponible', number_format($totalSinImpLinea, 2, '.', '')));
                $imp->appendChild($doc->createElement('valor', '0.00'));
            }
            $imps->appendChild($imp);
            $det->appendChild($imps);

            $detNode->appendChild($det);
        }

        return $doc->saveXML();
    }

    /**
     * Procesa la firma y emisión de la Nota de Crédito ante el SRI.
     */
    public function procesarNotaCreditoSRI(NotaCredito $nc, array $empresaInfo): array
    {
        $ambiente = (int)($empresaInfo['ambiente'] ?? 1);

        // Endpoints SRI según el ambiente configurado en la empresa:
        // ambiente=1 -> Pruebas  -> celcer.sri.gob.ec
        // ambiente=2 -> Producción -> cel.sri.gob.ec
        if ($ambiente === 2) {
            $webRecepcion = 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl';
            $webAutoriza  = 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl';
        } else {
            $webRecepcion = 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl';
            $webAutoriza  = 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl';
        }

        Log::info("SRI Nota de Crédito -> Ambiente: {$ambiente} " . ($ambiente === 2 ? '(PRODUCCIÓN)' : '(PRUEBAS)') . " | Recepción: {$webRecepcion}");

        // 0. Si el comprobante NO está AUTORIZADO, actualizar siempre a la configuración vigente de la empresa (estab, pto_emision, fecha y claveAcceso de 49 dígitos)
        $estNC = strtoupper((string)($nc->estado ?? ''));
        if ($estNC !== 'AUTORIZADO') {
            $empEstab  = !empty($empresaInfo['establecimiento']) ? str_pad((string)$empresaInfo['establecimiento'], 3, '0', STR_PAD_LEFT) : '001';
            $empPtoEmi = !empty($empresaInfo['punto_emision']) ? str_pad((string)$empresaInfo['punto_emision'], 3, '0', STR_PAD_LEFT) : '001';

            $fechaEmisionObj = \Carbon\Carbon::now();
            $nc->fecha = $fechaEmisionObj->toDateTimeString();

            $nc->estab = $empEstab;
            $nc->pto_emision = $empPtoEmi;

            if (empty($nc->secuencial)) {
                $nc->secuencial = $empresaInfo['secuencial_nota_credito'] ?? '000000001';
            }

            $secPad = str_pad((string)$nc->secuencial, 9, '0', STR_PAD_LEFT);
            $nc->numero = $nc->estab . '-' . $nc->pto_emision . '-' . $secPad;

            $codigoNum = (strlen((string)$nc->autorizacion) === 49) ? substr((string)$nc->autorizacion, 39, 8) : null;
            $nc->autorizacion = $this->generarClaveAcceso(
                $fechaEmisionObj,
                $empresaInfo['ruc'] ?? '1790000000001',
                (string)($empresaInfo['ambiente'] ?? '1'),
                $nc->estab,
                $nc->pto_emision,
                $nc->secuencial,
                '04',
                $codigoNum
            );
            $nc->save();
        }

        // 1. Generar XML String
        $nc->load(['venta', 'cliente']);
        $xmlString = $this->generarNotaCreditoXMLString($nc, [
            'razonSocial'        => $empresaInfo['razon_social'] ?? ($empresaInfo['nombre_comercial'] ?? 'Mundo Navideño 365'),
            'nombreComercial'    => $empresaInfo['nombre_comercial'] ?? ($empresaInfo['razon_social'] ?? 'Mundo Navideño 365'),
            'ruc'                => $empresaInfo['ruc'] ?? '1790000000001',
            'dirMatriz'          => $empresaInfo['direccion'] ?? '',
            'dirEstablecimiento' => $empresaInfo['direccion'] ?? '',
            'ambiente'           => $ambiente,
        ]);

        // 2. Firmar XML
        $pathCertificateDb = $empresaInfo['ruta_firma_electronica'] ?? '';
        $rawPath = storage_path('app/' . $pathCertificateDb);
        if (!file_exists($rawPath)) {
            return [
                'success' => false,
                'message' => 'Archivo de firma electrónica no encontrado en: ' . $rawPath
            ];
        }

        $pathCertificate = 'file://' . realpath($rawPath);
        $sriSigner = new SignDOcumentToSRI(
            'notaCredito',
            $pathCertificate,
            $empresaInfo['clave_firma_electronica'] ?? '',
            $xmlString,
            SignDOcumentToSRI::ALGO_SHA1,
            null
        );

        $xmlFirmado = $sriSigner->xml;
        $tempDir = storage_path('app/sri/xml/');
        if (!is_dir($tempDir)) {
            mkdir($tempDir, 0777, true);
        }

        $tempXmlPath = $tempDir . $nc->autorizacion . '.xml';
        $tempRecepPath = $tempDir . $nc->autorizacion . '_recep.xml';
        file_put_contents($tempXmlPath, $xmlFirmado);

        $nc->estado = 'Firmada';
        $nc->save();

        // 3. Enviar a Recepción SRI
        try {
            $resRecep = $this->peticionRecepcionSRI($webRecepcion, $xmlFirmado);

            if (in_array($resRecep['estado'], ['DEVUELTA', 'NO AUTORIZADO'], true)) {
                $this->limpiarArchivosTemporales([$tempXmlPath, $tempRecepPath]);

                $nc->estado = 'Devuelta';
                $nc->save();

                return [
                    'success' => false,
                    'message' => 'La nota de crédito fue devuelta por el SRI: ' . $resRecep['mensaje']
                ];
            }
        } catch (\Throwable $e) {
            $this->limpiarArchivosTemporales([$tempXmlPath, $tempRecepPath]);
            return [
                'success' => false,
                'message' => 'Error de conexión en Recepción SRI: ' . $e->getMessage()
            ];
        }

        // 4. Consultar Autorización SRI
        try {
            $resAut = $this->peticionAutorizacionSRI($webAutoriza, $nc->autorizacion);

            $directorioAprobados = storage_path('app/public/notas_credito/aprobados/');
            if (!file_exists($directorioAprobados)) {
                mkdir($directorioAprobados, 0777, true);
            }

            $nombreArchivoAprobado = $directorioAprobados . 'NC' . $nc->estab . '-' . $nc->pto_emision . '-' . $nc->secuencial . '.xml';

            if ($resAut['estado'] !== 'AUTORIZADO') {
                $this->limpiarArchivosTemporales([$tempXmlPath, $tempRecepPath]);

                $nc->estado = $resAut['estado'] ?: 'No autorizado';
                $nc->save();

                return [
                    'success' => false,
                    'message' => 'La nota de crédito no fue autorizada por el SRI: ' . $resAut['mensaje']
                ];
            }

            // Guardar XML final autorizado
            file_put_contents($nombreArchivoAprobado, $resAut['xmlResponse']);

            // Reingresar stock de productos devueltos en la NC (+1)
            $itemsNC = DB::table('nota_credito_detalles')
                ->where('nota_credito_id', $nc->id)
                ->get();

            foreach ($itemsNC as $it) {
                if ($it->cantidad > 0) {
                    DB::table('productos')
                        ->where('id', $it->producto_id)
                        ->increment('cantidad_total', $it->cantidad);
                }
            }

            $nc->estado = 'AUTORIZADO';
            $nc->save();

            // Enviar comprobante por correo únicamente cuando está AUTORIZADO por el SRI
            $correoEnviado = $this->enviarComprobantePorCorreo($nc, $empresaInfo, 'Nota de Crédito', $nombreArchivoAprobado);
            $msgMail = $correoEnviado ? ' y enviada por correo al cliente.' : '.';

            // Limpieza exitosa de archivos temporales intermediarios
            $this->limpiarArchivosTemporales([$tempXmlPath, $tempRecepPath]);
            $this->limpiarBorradoresAntiguos();

            return [
                'success' => true,
                'message' => 'Nota de Crédito emitida y AUTORIZADA correctamente' . $msgMail
            ];

        } catch (\Throwable $e) {
            $this->limpiarArchivosTemporales([$tempXmlPath, $tempRecepPath]);
            return [
                'success' => false,
                'message' => 'Error de conexión en Autorización SRI: ' . $e->getMessage()
            ];
        }
    }

    protected function isConsumidorFinalId(string $raw): bool
    {
        $c = trim($raw);
        if ($c === '') return true;
        if (preg_match('/^9{5,13}$/', $c)) return true;
        if (strcaseflexEquals($c, 'consumidor final')) return true;
        return false;
    }

    public function generarClaveAcceso(
        \DateTimeInterface $fecha,
        string $ruc,
        string $ambiente,
        string $estab,
        string $ptoEmi,
        $secuencial,
        string $tipoComprobante = '01',
        ?string $codigoNumerico = null
    ): string {
        $fechaStr       = $fecha->format('dmY');
        $rucClean       = str_pad(preg_replace('/\D/', '', $ruc), 13, '0', STR_PAD_LEFT);
        $ambienteClean  = (string)($ambiente ?: '1');
        $estabClean     = str_pad((string)$estab, 3, '0', STR_PAD_LEFT);
        $ptoEmiClean    = str_pad((string)$ptoEmi, 3, '0', STR_PAD_LEFT);
        $secuClean      = str_pad((string)$secuencial, 9, '0', STR_PAD_LEFT);
        $tipoEmision    = '1';
        $codigoNumerico = $codigoNumerico !== null
            ? str_pad(preg_replace('/\D/', '', $codigoNumerico), 8, '0', STR_PAD_LEFT)
            : str_pad((string)random_int(0, 99999999), 8, '0', STR_PAD_LEFT);

        $base = $fechaStr
              . $tipoComprobante
              . $rucClean
              . $ambienteClean
              . $estabClean
              . $ptoEmiClean
              . $secuClean
              . $codigoNumerico
              . $tipoEmision;

        $dv = $this->modulo11SRI($base);
        return $base . $dv;
    }

    public function modulo11SRI(string $cadena48): string
    {
        $coef = [2, 3, 4, 5, 6, 7];
        $sum = 0;
        $coefIdx = 0;

        for ($i = strlen($cadena48) - 1; $i >= 0; $i--) {
            $dig = (int)$cadena48[$i];
            $sum += $dig * $coef[$coefIdx];
            $coefIdx = ($coefIdx + 1) % 6;
        }

        $res = $sum % 11;
        $dv = 11 - $res;

        if ($dv === 11) return '0';
        if ($dv === 10) return '1';
        return (string)$dv;
    }

    /**
     * Envía por correo electrónico el comprobante autorizado (XML adjunto + cuerpo HTML) al cliente.
     * Se ejecuta ÚNICAMENTE cuando el estado ante el SRI es 'AUTORIZADO'.
     */
    public function enviarComprobantePorCorreo($documento, array $empresaInfo, string $tipoDoc = 'Factura', ?string $xmlPath = null): bool
    {
        try {
            $cliente = $documento->cliente ?? null;
            $correoDestino = trim((string)($cliente->correo ?? $cliente->email ?? ''));

            if (empty($correoDestino) || !filter_var($correoDestino, FILTER_VALIDATE_EMAIL)) {
                Log::info("No se envió correo para {$tipoDoc} #{$documento->numero}: Cliente sin correo válido.");
                return false;
            }

            $nombreEmpresa = $empresaInfo['nombre_comercial'] ?? $empresaInfo['razon_social'] ?? 'Mundo Navideño 365';
            $fromAddress   = config('mail.from.address') ?: 'no-reply@mundonavidenio.com';
            $fromName      = $nombreEmpresa;

            $numeroDoc   = $documento->numero ?? ($documento->estab . '-' . $documento->pto_emision . '-' . $documento->secuencial);
            $fechaDoc    = \Carbon\Carbon::parse($documento->fecha ?? now())->format('d/m/Y H:i');
            $totalDoc    = number_format((float)($documento->total ?? 0), 2, '.', ',');
            $claveAcceso = $documento->autorizacion ?? '—';
            $nombreCliente = $cliente->nombres ?? $cliente->nombre ?? 'Estimado(a) Cliente';

            $asunto = "{$tipoDoc} Electrónica N° {$numeroDoc} - {$nombreEmpresa}";

            $htmlContent = "
            <!DOCTYPE html>
            <html lang='es'>
            <head>
                <meta charset='UTF-8'>
                <style>
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
                    .header { background: #0f172a; color: #ffffff; padding: 25px; text-align: center; }
                    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
                    .header p { margin: 5px 0 0; font-size: 13px; color: #94a3b8; }
                    .badge { display: inline-block; background: #10b981; color: #ffffff; font-size: 11px; font-weight: bold; padding: 4px 12px; border-radius: 20px; margin-top: 10px; text-transform: uppercase; }
                    .content { padding: 30px 25px; }
                    .saludo { font-size: 15px; font-weight: 600; color: #1e293b; margin-bottom: 15px; }
                    .texto { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 20px; }
                    .details-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin-bottom: 25px; }
                    .details-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
                    .details-row:last-child { border-bottom: none; }
                    .label { color: #64748b; font-weight: 500; }
                    .value { color: #0f172a; font-weight: 700; }
                    .total-row { font-size: 16px; color: #10b981; font-weight: bold; border-top: 2px solid #cbd5e1; padding-top: 10px; margin-top: 5px; }
                    .footer { background: #f1f5f9; padding: 15px 25px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; }
                </style>
            </head>
            <body>
                <div class='container'>
                    <div class='header'>
                        <h1>{$nombreEmpresa}</h1>
                        <p>Servicio de Facturación Electrónica SRI</p>
                        <span class='badge'>🟢 Comprobante Autorizado</span>
                    </div>
                    <div class='content'>
                        <div class='saludo'>Hola, {$nombreCliente}</div>
                        <div class='texto'>
                            Le informamos que su <strong>{$tipoDoc} Electrónica N° {$numeroDoc}</strong> ha sido generada y <strong>AUTORIZADA</strong> exitosamente por el Servicio de Rentas Internas (SRI). Adjunto a este correo encontrará el archivo XML firmado.
                        </div>
                        <div class='details-box'>
                            <div class='details-row'><span class='label'>Tipo Comprobante:</span> <span class='value'>{$tipoDoc}</span></div>
                            <div class='details-row'><span class='label'>Número Comprobante:</span> <span class='value'>{$numeroDoc}</span></div>
                            <div class='details-row'><span class='label'>Fecha de Emisión:</span> <span class='value'>{$fechaDoc}</span></div>
                            <div class='details-row'><span class='label'>Clave de Acceso SRI:</span> <span class='value' style='font-family: monospace; font-size: 11px;'>{$claveAcceso}</span></div>
                            <div class='details-row total-row'><span class='label' style='color:#0f172a;'>Monto Total:</span> <span class='value'>\${$totalDoc} USD</span></div>
                        </div>
                    </div>
                    <div class='footer'>
                        Este es un mensaje automático generado por {$nombreEmpresa}. Por favor no responda a este correo.
                    </div>
                </div>
            </body>
            </html>
            ";

            \Illuminate\Support\Facades\Mail::send([], [], function ($message) use ($correoDestino, $asunto, $htmlContent, $fromAddress, $fromName, $xmlPath, $numeroDoc, $tipoDoc) {
                $message->from($fromAddress, $fromName)
                        ->to($correoDestino)
                        ->subject($asunto)
                        ->html($htmlContent);

                if ($xmlPath && file_exists($xmlPath)) {
                    $prefix = ($tipoDoc === 'Nota de Crédito') ? 'NC_' : 'Factura_';
                    $filename = $prefix . preg_replace('/[^A-Za-z0-9\-]/', '', $numeroDoc) . '.xml';
                    $message->attach($xmlPath, [
                        'as' => $filename,
                        'mime' => 'text/xml',
                    ]);
                }
            });

            Log::info("Correo de {$tipoDoc} N° {$numeroDoc} enviado con éxito a: {$correoDestino}");
            return true;
        } catch (\Throwable $e) {
            Log::error("No se pudo enviar el correo del comprobante a cliente: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Petición de Recepción al SRI: Pruebas PRIMERO con cURL HTTP, y si falla usa SoapClient como respaldo.
     */
    protected function peticionRecepcionSRI(string $webRecepcion, string $xmlFirmado): array
    {
        // 1. Intentar PRIMERO con cURL HTTP
        try {
            $cleanUrl = strtok($webRecepcion, '?');
            $b64Xml = base64_encode($xmlFirmado);
            $payload = '<?xml version="1.0" encoding="UTF-8"?>' .
                '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion">' .
                '<soapenv:Header/><soapenv:Body><ec:validarComprobante><xml>' . $b64Xml . '</xml></ec:validarComprobante></soapenv:Body>' .
                '</soapenv:Envelope>';

            $responseXml = $this->ejecutarCurlHttp($cleanUrl, $payload);

            $estado = 'DEVUELTA';
            if (preg_match('/<estado>(.*?)<\/estado>/is', $responseXml, $m)) {
                $estado = strtoupper(trim($m[1]));
            }

            $mensaje = '';
            if ($estado !== 'RECIBIDA') {
                $msgs = [];
                if (preg_match_all('/<mensaje>(.*?)<\/mensaje>/is', $responseXml, $m1)) {
                    $msgs[] = implode(' ', array_map('trim', $m1[1]));
                }
                if (preg_match_all('/<informacionAdicional>(.*?)<\/informacionAdicional>/is', $responseXml, $m2)) {
                    $msgs[] = implode(' ', array_map('trim', $m2[1]));
                }
                $mensaje = implode(' | ', array_filter($msgs)) ?: 'El comprobante fue devuelto por el SRI.';
            }

            return ['estado' => $estado, 'mensaje' => $mensaje];

        } catch (\Throwable $curlException) {
            Log::warning("cURL Recepción falló, intentando respaldo SoapClient: " . $curlException->getMessage());

            // 2. Respaldo SoapClient si cURL falla y la extensión existe
            if (class_exists('SoapClient')) {
                $options = ['trace' => 1, 'connection_timeout' => 200];
                $wsRecep = new \SoapClient($webRecepcion, $options);
                $resultRecep = $wsRecep->validarComprobante(['xml' => base64_encode($xmlFirmado)]);
                $estadoRecep = strtoupper((string)($resultRecep->RespuestaRecepcionComprobante->estado ?? ''));
                $mensaje = ($estadoRecep !== 'RECIBIDA') ? $this->extraerMensajeSRI($resultRecep) : '';
                return ['estado' => $estadoRecep, 'mensaje' => $mensaje];
            }

            throw $curlException;
        }
    }

    /**
     * Petición de Autorización al SRI: Pruebas PRIMERO con cURL HTTP, y si falla usa SoapClient como respaldo.
     */
    protected function peticionAutorizacionSRI(string $webAutoriza, string $claveAcceso): array
    {
        // 1. Intentar PRIMERO con cURL HTTP
        try {
            $cleanUrl = strtok($webAutoriza, '?');
            $payload = '<?xml version="1.0" encoding="UTF-8"?>' .
                '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">' .
                '<soapenv:Header/><soapenv:Body><ec:autorizacionComprobante><claveAccesoComprobante>' . $claveAcceso . '</claveAccesoComprobante></ec:autorizacionComprobante></soapenv:Body>' .
                '</soapenv:Envelope>';

            $responseXml = $this->ejecutarCurlHttp($cleanUrl, $payload);

            $estado = 'NO AUTORIZADO';
            if (preg_match('/<estado>(.*?)<\/estado>/is', $responseXml, $m)) {
                $estado = strtoupper(trim($m[1]));
            }

            $mensaje = '';
            if ($estado !== 'AUTORIZADO') {
                $msgs = [];
                if (preg_match_all('/<mensaje>(.*?)<\/mensaje>/is', $responseXml, $m1)) {
                    $msgs[] = implode(' ', array_map('trim', $m1[1]));
                }
                if (preg_match_all('/<informacionAdicional>(.*?)<\/informacionAdicional>/is', $responseXml, $m2)) {
                    $msgs[] = implode(' ', array_map('trim', $m2[1]));
                }
                $mensaje = implode(' | ', array_filter($msgs)) ?: 'El comprobante no fue autorizado por el SRI.';
            }

            // Extraer el XML autorizado del comprobante desde el envelope SOAP
            $xmlAutorizado = $responseXml;
            if (preg_match('/<comprobante>(.*?)<\/comprobante>/is', $responseXml, $mc)) {
                // El comprobante viene como CDATA o texto dentro de la respuesta SOAP
                $inner = trim($mc[1]);
                // Decodificar CDATA si existe
                if (preg_match('/<\!\[CDATA\[(.*?)\]\]>/is', $inner, $cd)) {
                    $inner = trim($cd[1]);
                }
                if (!empty($inner)) {
                    $xmlAutorizado = $inner;
                }
            }

            return ['estado' => $estado, 'xmlResponse' => $xmlAutorizado, 'mensaje' => $mensaje];

        } catch (\Throwable $curlException) {
            Log::warning("cURL Autorización falló, intentando respaldo SoapClient: " . $curlException->getMessage());

            // 2. Respaldo SoapClient si cURL falla y la extensión existe
            if (class_exists('SoapClient')) {
                $options = ['trace' => 1, 'connection_timeout' => 200];
                $clientA = new \SoapClient($webAutoriza, $options);
                $resultA = $clientA->autorizacionComprobante([
                    'claveAccesoComprobante' => $claveAcceso
                ]);
                $estadoAut = strtoupper((string)($resultA->RespuestaAutorizacionComprobante->autorizaciones->autorizacion->estado ?? ''));
                $xmlResponse = $clientA->__getLastResponse();
                $mensaje = ($estadoAut !== 'AUTORIZADO') ? $this->extraerMensajeAutorizacionSRI($resultA) : '';
                return ['estado' => $estadoAut, 'xmlResponse' => $xmlResponse, 'mensaje' => $mensaje];
            }

            throw $curlException;
        }
    }

    protected function ejecutarCurlHttp(string $url, string $payload): string
    {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_TIMEOUT, 45);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 15);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: text/xml; charset=utf-8',
            'SOAPAction: ""',
            'Content-Length: ' . strlen($payload),
            'Expect:',
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($response === false || !empty($err)) {
            throw new \Exception("Error en cURL HTTP al conectar con el SRI (HTTP {$httpCode}): " . ($err ?: 'Respuesta vacía'));
        }

        if (empty(trim((string)$response))) {
            throw new \Exception("El SRI retornó una respuesta vacía (HTTP {$httpCode}).");
        }

        Log::debug("SRI cURL response (HTTP {$httpCode}): " . substr((string)$response, 0, 500));

        return (string)$response;
    }
}

function strcaseflexEquals($a, $b) {
    return mb_strtolower(trim($a)) === mb_strtolower(trim($b));
}
