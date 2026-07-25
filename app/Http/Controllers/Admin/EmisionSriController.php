<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Carbon;

// Modelos
use App\Models\Venta;
use App\Models\Cliente;
use App\Models\VentaProducto;
use App\Models\VentaPago;
use App\Models\VentaTarjeta;

// Firma
use RobRichards\XMLSecLibs\XMLSecurityKey;

class EmisionSriController extends Controller
{
    /* ==========
     * ENDPOINT ÚNICO
     * ========== */
    public function emitir(Request $r, int $ventaId)
    {
        $venta   = Venta::findOrFail($ventaId);
        $empresa = $this->empresaInfo();
        $cfg     = $this->configEmisor();

        // 1) Asegurar numeración + claveAcceso
        try {
            $this->asegurarNumeracionYClave($venta, $cfg);
        } catch (\Throwable $e) {
            return back()->with('error', 'Numeración/clave: '.$e->getMessage());
        }

        // 2) Generar XML (si no existe)
        try {
            $xmlEmitido = $this->construirXmlFactura($venta, $empresa, $cfg);
        } catch (\Throwable $e) {
            $this->debugWrite($venta->autorizacion, 'xml_exception.txt', $e->getMessage()."\n\n".$e->getTraceAsString());
            return back()->with('error', 'Error al generar XML: '.$e->getMessage());
        }

        // 3) Firmar XAdES-BES
        $rutaFirma = $empresa['ruta_firma_electronica'] ?? null;
        $claveFirma= $empresa['clave_firma_electronica'] ?? null;
        if (!$rutaFirma || !$claveFirma) {
            return back()->with('error', 'Falta ruta y/o clave de firma electrónica en EMPRESAS.');
        }
        try {
            $p12 = $this->storageAbsPath($rutaFirma);
            $xmlFirmado = $this->firmarXmlXadesBes($xmlEmitido, $p12, (string)$claveFirma);
        } catch (\Throwable $e) {
            $err = $this->debugWrite($venta->autorizacion, 'firma_exception.txt', $e->getMessage()."\n\n".$e->getTraceAsString());
            return back()->with('error', 'Error al firmar: '.$e->getMessage())->with('debug', $err);
        }

        // 4) Enviar a SRI: Recepción + Autorización
        try {
            $res = $this->enviarASri($xmlFirmado, $venta->autorizacion, $cfg['ambiente']);
        } catch (\Throwable $e) {
            $err = $this->debugWrite($venta->autorizacion, 'sri_exception.txt', $e->getMessage()."\n\n".$e->getTraceAsString());
            return back()->with('error', 'Error SRI: '.$e->getMessage())->with('debug', $err);
        }

        // 5) Actualizar venta según respuesta
        $estadoRecep = strtoupper((string)$res['recepcion']);
        $estadoAut   = strtoupper((string)($res['autorizacion'] ?? ''));
        $newState    = ($estadoRecep !== 'RECIBIDA') ? 'devuelta' : (($estadoAut === 'AUTORIZADO') ? 'autorizada' : 'no_autorizada');

        $this->actualizarVentaConSri($venta, [
            'estado'                  => $newState,
            'sri_estado_recepcion'    => $estadoRecep,
            'sri_estado_autorizacion' => $estadoAut,
            'sri_numero_autorizacion' => $res['numAut'] ?? null,
            'sri_fecha_autorizacion'  => $res['fechaAut'] ?? null,
        ]);

        $msg = 'Recepción: '.$estadoRecep.($estadoAut ? ' | Autorización: '.$estadoAut : '');
        return redirect()
            ->route('admin.ventas.show', $venta->id)
            ->with('success', $msg)
            ->with('sri_paths', $res['paths']);
    }

    /* ==========
     * Helpers de negocio
     * ========== */

    private function asegurarNumeracionYClave(Venta $venta, array $cfg): void
    {
        if ($venta->estab && $venta->pto_emision && $venta->secuencial && $venta->autorizacion) {
            return; // ya está listo
        }

        $estab  = $cfg['estab'];
        $ptoEmi = $cfg['ptoEmi'];

        DB::transaction(function () use ($venta, $estab, $ptoEmi, $cfg) {
            $secuencial = $this->siguienteSecuencialConLock($estab, $ptoEmi);
            $venta->estab       = $estab;
            $venta->pto_emision = $ptoEmi;
            $venta->secuencial  = $secuencial;
            $venta->numero      = $estab.'-'.$ptoEmi.'-'.$secuencial;
            $venta->fecha       = Carbon::now()->toDateTimeString();
            $venta->estado      = 'emitida';
            $venta->autorizacion= $this->generarClaveAccesoOficial(
                Carbon::now(), $cfg, '01', $secuencial, $estab, $ptoEmi
            );
            $venta->save();

            // Incrementar secuencial en la empresa para que el usuario vea el siguiente disponible
            $nextInt = (int)$secuencial + 1;
            DB::table('empresas')->update(['secuencial_factura' => str_pad((string)$nextInt, 9, '0', STR_PAD_LEFT)]);
        });
    }

    private function construirXmlFactura(Venta $venta, array $empresa, array $cfg): string
    {
        $xmlPath = Storage::path('sri/facturas/emitidas/'.$venta->autorizacion.'.xml');
        if (is_file($xmlPath)) return $xmlPath;

        $cliente = $venta->cliente_id ? Cliente::find($venta->cliente_id) : null;
        $items   = DB::table('venta_productos')
            ->join('productos','productos.id','=','venta_productos.producto_id')
            ->where('venta_productos.venta_id', $venta->id)
            ->select('venta_productos.*','productos.codigo as prod_codigo','productos.nombre as prod_nombre')
            ->get();
        $pagos   = VentaPago::where('venta_id', $venta->id)->get();
        $tarjeta = VentaTarjeta::where('venta_id', $venta->id)->first();

        $ivaDefault = (int)env('SRI_IVA_DEFAULT', 15);
        $codIva     = $this->mapIvaCodigoPorcentaje($ivaDefault);

        $descTotal = 0.0;
        $totalesPorIva = [];
        foreach ($items as $it) {
            $cant = (float)$it->cantidad; $precio=(float)$it->precio; $desc=(float)($it->descuento ?? 0);
            $linea = max(0, $cant*$precio - $desc); $descTotal += $desc;
            $valorIva = $ivaDefault>0 ? round($linea*($ivaDefault/100),2) : 0.0;

            if(!isset($totalesPorIva[$codIva])) $totalesPorIva[$codIva]=['base'=>0.0,'valor'=>0.0,'tarifa'=>$ivaDefault];
            $totalesPorIva[$codIva]['base']  += $linea;
            $totalesPorIva[$codIva]['valor'] += $valorIva;
        }
        $totalSinImp = array_sum(array_column($totalesPorIva,'base'));
        $ivaValor    = array_sum(array_column($totalesPorIva,'valor'));
        $importeTotal= $totalSinImp + $ivaValor;

        $doc = new \DOMDocument('1.0','UTF-8');
        $doc->preserveWhiteSpace=false; $doc->formatOutput=true;

        $root = $doc->createElement('factura');
        $root->setAttribute('id','comprobante');
        $root->setAttribute('version','1.1.0');
        $doc->appendChild($root);

        // infoTributaria
        $it = $doc->createElement('infoTributaria'); $root->appendChild($it);
        $it->appendChild($doc->createElement('ambiente', $cfg['ambiente']));
        $it->appendChild($doc->createElement('tipoEmision','1'));
        $it->appendChild($doc->createElement('razonSocial', $empresa['razon_social'] ?? $empresa['nombre_comercial']));
        if (!empty($empresa['nombre_comercial'])) $it->appendChild($doc->createElement('nombreComercial', $empresa['nombre_comercial']));
        $it->appendChild($doc->createElement('ruc', $empresa['ruc']));
        $it->appendChild($doc->createElement('claveAcceso', $venta->autorizacion));
        $it->appendChild($doc->createElement('codDoc','01'));
        $it->appendChild($doc->createElement('estab',$venta->estab));
        $it->appendChild($doc->createElement('ptoEmi',$venta->pto_emision));
        $it->appendChild($doc->createElement('secuencial',$venta->secuencial));
        $it->appendChild($doc->createElement('dirMatriz', $empresa['direccion'] ?? ''));

        // infoFactura
        $inf = $doc->createElement('infoFactura'); $root->appendChild($inf);
        $inf->appendChild($doc->createElement('fechaEmision', Carbon::parse($venta->fecha)->format('d/m/Y')));
        $inf->appendChild($doc->createElement('dirEstablecimiento', $empresa['direccion'] ?? ''));
        if ($empresa['obligado_contabilidad']) $inf->appendChild($doc->createElement('obligadoContabilidad', 'SI'));
        else $inf->appendChild($doc->createElement('obligadoContabilidad', 'NO'));
        $tipoId = $this->mapTipoIdentificacion($cliente->ci_o_ruc ?? null, $cliente->correo ?? null);
        $inf->appendChild($doc->createElement('tipoIdentificacionComprador', $tipoId));
        $inf->appendChild($doc->createElement('razonSocialComprador', $cliente->nombres ?? 'CONSUMIDOR FINAL'));
        $inf->appendChild($doc->createElement('identificacionComprador', $cliente->ci_o_ruc ?? '9999999999999'));
        $inf->appendChild($doc->createElement('totalSinImpuestos', $this->nf($totalSinImp)));
        $inf->appendChild($doc->createElement('totalDescuento', $this->nf($descTotal)));

        $tci = $doc->createElement('totalConImpuestos'); $inf->appendChild($tci);
        foreach ($totalesPorIva as $codigoPorcentaje => $agg) {
            $ti = $doc->createElement('totalImpuesto');
            $ti->appendChild($doc->createElement('codigo','2'));
            $ti->appendChild($doc->createElement('codigoPorcentaje', (string)$codigoPorcentaje));
            $ti->appendChild($doc->createElement('baseImponible', $this->nf($agg['base'])));
            $ti->appendChild($doc->createElement('valor', $this->nf($agg['valor'])));
            $tci->appendChild($ti);
        }
        $inf->appendChild($doc->createElement('propina','0.00'));
        $inf->appendChild($doc->createElement('importeTotal', $this->nf($importeTotal)));
        $inf->appendChild($doc->createElement('moneda','DOLAR'));

        // pagos
        $pagos = $pagos; // ya arriba
        if (($pagos && $pagos->count()>0) || $tarjeta) {
            $pagosNode = $doc->createElement('pagos'); $inf->appendChild($pagosNode);
            foreach ($pagos as $p) {
                $pago = $doc->createElement('pago');
                $pago->appendChild($doc->createElement('formaPago', $this->mapFormaPago($p->codigo, $p->nombre)));
                $pago->appendChild($doc->createElement('total', $this->nf($p->valor)));
                $pago->appendChild($doc->createElement('plazo','0'));
                $pago->appendChild($doc->createElement('unidadTiempo','dias'));
                $pagosNode->appendChild($pago);
            }
            if ($tarjeta) {
                $pago = $doc->createElement('pago');
                $pago->appendChild($doc->createElement('formaPago','19'));
                $pago->appendChild($doc->createElement('total', $this->nf($tarjeta->monto)));
                $pago->appendChild($doc->createElement('plazo', (string)($tarjeta->plazo ?? 0)));
                $pago->appendChild($doc->createElement('unidadTiempo','dias'));
                $pagosNode->appendChild($pago);
            }
        }

        // detalles
        $detalles = $doc->createElement('detalles'); $root->appendChild($detalles);
        foreach ($items as $it) {
            $detalle = $doc->createElement('detalle'); $detalles->appendChild($detalle);
            $cant=(float)$it->cantidad; $precio=(float)$it->precio; $desc=(float)($it->descuento??0);
            $linea = max(0, $cant*$precio - $desc);
            $valorIvaLinea = $ivaDefault>0 ? round($linea*($ivaDefault/100),2) : 0.0;

            $detalle->appendChild($doc->createElement('codigoPrincipal', (string)($it->prod_codigo ?? $it->producto_id)));
            $detalle->appendChild($doc->createElement('descripcion', (string)($it->prod_nombre ?? 'Producto')));
            $detalle->appendChild($doc->createElement('cantidad', $this->nf($cant,6)));
            $detalle->appendChild($doc->createElement('precioUnitario', $this->nf($precio)));
            $detalle->appendChild($doc->createElement('descuento', $this->nf($desc)));
            $detalle->appendChild($doc->createElement('precioTotalSinImpuesto', $this->nf($linea)));

            $impN = $doc->createElement('impuestos'); $detalle->appendChild($impN);
            $imp = $doc->createElement('impuesto');
            $imp->appendChild($doc->createElement('codigo','2'));
            $imp->appendChild($doc->createElement('codigoPorcentaje', (string)$codIva));
            $imp->appendChild($doc->createElement('tarifa', $this->nf($ivaDefault,2)));
            $imp->appendChild($doc->createElement('baseImponible', $this->nf($linea)));
            $imp->appendChild($doc->createElement('valor', $this->nf($valorIvaLinea)));
            $impN->appendChild($imp);
        }

        // infoAdicional
        $infoAd = $doc->createElement('infoAdicional'); $root->appendChild($infoAd);
        if (!empty($cliente?->telefono)) { $x=$doc->createElement('campoAdicional',$cliente->telefono); $x->setAttribute('nombre','Teléfono'); $infoAd->appendChild($x); }
        if (!empty($cliente?->correo))   { $x=$doc->createElement('campoAdicional',$cliente->correo);   $x->setAttribute('nombre','Email');    $infoAd->appendChild($x); }
        if (!empty($empresa['email']))   { $x=$doc->createElement('campoAdicional',$empresa['email']);  $x->setAttribute('nombre','EmailEmisor'); $infoAd->appendChild($x); }

        // Guardar
        $dir = 'sri/facturas/emitidas';
        if (!Storage::disk('local')->exists($dir)) Storage::disk('local')->makeDirectory($dir);
        Storage::disk('local')->put($dir.'/'.$venta->autorizacion.'.xml', $doc->saveXML());

        return Storage::path($dir.'/'.$venta->autorizacion.'.xml');
    }

    /* ==========
     * Firma XAdES-BES (RSA-SHA1)
     * ========== */
    private function firmarXmlXadesBes(string $xmlPath, string $p12Path, string $p12Pass): string
    {
        if (!is_file($xmlPath)) throw new \RuntimeException("No existe XML: $xmlPath");
        if (!is_file($p12Path)) throw new \RuntimeException("No existe .p12: $p12Path");
        if ($p12Pass==='')      throw new \RuntimeException("Clave de firma vacía.");

        $pfx = file_get_contents($p12Path);
        $certs=[];
        if (!openssl_pkcs12_read($pfx, $certs, $p12Pass)) {
            throw new \RuntimeException("No se pudo leer el .p12 (clave o archivo inválido).");
        }
        $privateKeyPem = $certs['pkey'];
        $certPem       = $certs['cert'];

        $x509  = openssl_x509_read($certPem);
        openssl_x509_export($x509, $certOut);
        $certDer = trim(str_replace(["-----BEGIN CERTIFICATE-----","-----END CERTIFICATE-----","\r","\n"], '', $certOut));
        $certDerBin = base64_decode($certDer);

        $parsed = openssl_x509_parse($x509);
        $issuerName  = '';
        if (!empty($parsed['issuer'])) {
            $parts=[];
            foreach(array_reverse($parsed['issuer']) as $k=>$v){ $parts[]=$k.'='.$v; }
            $issuerName = implode(', ',$parts);
        }
        $serialNumber = isset($parsed['serialNumber']) ? $parsed['serialNumber']
                         : (isset($parsed['serialNumberHex']) ? hexdec($parsed['serialNumberHex']) : '0');

        $doc = new \DOMDocument('1.0','UTF-8'); $doc->preserveWhiteSpace=false; $doc->formatOutput=false; $doc->load($xmlPath);
        $root = $doc->documentElement;
        if (!$root->hasAttribute('id')) $root->setAttribute('id','comprobante');

        $DS    = 'http://www.w3.org/2000/09/xmldsig#';
        $XADES = 'http://uri.etsi.org/01903/v1.3.2#';

        $sigNode = $doc->createElementNS($DS, 'ds:Signature'); $sigNode->setAttribute('Id','Signature-1');

        // SignedInfo
        $signedInfo = $doc->createElementNS($DS, 'ds:SignedInfo');
        $cm = $doc->createElementNS($DS,'ds:CanonicalizationMethod'); $cm->setAttribute('Algorithm','http://www.w3.org/2001/10/xml-exc-c14n#'); $signedInfo->appendChild($cm);
        $sm = $doc->createElementNS($DS,'ds:SignatureMethod');        $sm->setAttribute('Algorithm','http://www.w3.org/2000/09/xmldsig#rsa-sha1'); $signedInfo->appendChild($sm);

        // Reference a #comprobante
        $refComp = $doc->createElementNS($DS,'ds:Reference'); $refComp->setAttribute('URI','#comprobante');
        $trs = $doc->createElementNS($DS,'ds:Transforms');
        $t1 = $doc->createElementNS($DS,'ds:Transform'); $t1->setAttribute('Algorithm','http://www.w3.org/2000/09/xmldsig#enveloped-signature'); $trs->appendChild($t1);
        $t2 = $doc->createElementNS($DS,'ds:Transform'); $t2->setAttribute('Algorithm','http://www.w3.org/2001/10/xml-exc-c14n#'); $trs->appendChild($t2);
        $refComp->appendChild($trs);
        $dm = $doc->createElementNS($DS,'ds:DigestMethod'); $dm->setAttribute('Algorithm','http://www.w3.org/2000/09/xmldsig#sha1'); $refComp->appendChild($dm);
        $digestComp = base64_encode(sha1($root->C14N(true,false), true));
        $refComp->appendChild($doc->createElementNS($DS,'ds:DigestValue', $digestComp));
        $signedInfo->appendChild($refComp);

        // XAdES SignedProperties
        $obj = $doc->createElementNS($DS,'ds:Object');
        $qp  = $doc->createElementNS($XADES,'xades:QualifyingProperties'); $qp->setAttribute('Target','#Signature-1');
        $sp  = $doc->createElementNS($XADES,'xades:SignedProperties'); $sp->setAttribute('Id','SignedProperties-1');

        $ssp = $doc->createElementNS($XADES,'xades:SignedSignatureProperties');
        $ssp->appendChild($doc->createElementNS($XADES,'xades:SigningTime', gmdate('c')));

        $sc  = $doc->createElementNS($XADES,'xades:SigningCertificate');
        $certEl = $doc->createElementNS($XADES,'xades:Cert');

        $cd = $doc->createElementNS($XADES,'xades:CertDigest');
        $cd->appendChild($doc->createElementNS($DS,'ds:DigestMethod'))->setAttribute('Algorithm','http://www.w3.org/2000/09/xmldsig#sha1');
        $cd->appendChild($doc->createElementNS($DS,'ds:DigestValue', base64_encode(sha1($certDerBin,true))));
        $certEl->appendChild($cd);

        $is = $doc->createElementNS($XADES,'xades:IssuerSerial');
        $is->appendChild($doc->createElementNS($DS,'ds:X509IssuerName', $issuerName));
        $is->appendChild($doc->createElementNS($DS,'ds:X509SerialNumber', (string)$serialNumber));
        $certEl->appendChild($is);

        $sc->appendChild($certEl);
        $ssp->appendChild($sc);

        $spi = $doc->createElementNS($XADES,'xades:SignaturePolicyIdentifier');
        $spi->appendChild($doc->createElementNS($XADES,'xades:SignaturePolicyImplied'));
        $ssp->appendChild($spi);

        $sp->appendChild($ssp);
        $qp->appendChild($sp);
        $obj->appendChild($qp);

        // Reference a SignedProperties
        $refSP = $doc->createElementNS($DS,'ds:Reference'); $refSP->setAttribute('Type','http://uri.etsi.org/01903#SignedProperties'); $refSP->setAttribute('URI','#SignedProperties-1');
        $refSP->appendChild($doc->createElementNS($DS,'ds:DigestMethod'))->setAttribute('Algorithm','http://www.w3.org/2000/09/xmldsig#sha1');
        $digestSP = base64_encode(sha1($sp->C14N(true,false), true));
        $refSP->appendChild($doc->createElementNS($DS,'ds:DigestValue', $digestSP));
        $signedInfo->appendChild($refSP);

        $sigNode->appendChild($signedInfo);

        // KeyInfo
        $ki = $doc->createElementNS($DS,'ds:KeyInfo');
        $x509Data = $doc->createElementNS($DS,'ds:X509Data');
        $x509Data->appendChild($doc->createElementNS($DS,'ds:X509Certificate', $certDer));
        $ki->appendChild($x509Data);
        $sigNode->appendChild($ki);

        // Object
        $sigNode->appendChild($obj);

        // SignatureValue
        $siC14n = $signedInfo->C14N(true,false);
        $key = new XMLSecurityKey(XMLSecurityKey::RSA_SHA1, ['type'=>'private']);
        $key->loadKey($privateKeyPem);
        $signatureValue = base64_encode($key->signData($siC14n));
        $sigNode->appendChild($doc->createElementNS($DS,'ds:SignatureValue', $signatureValue));

        $root->appendChild($sigNode);

        // Guardar
        $dir = 'sri/facturas/firmadas';
        if (!Storage::disk('local')->exists($dir)) Storage::disk('local')->makeDirectory($dir);
        $out = $dir.'/'.basename($xmlPath);
        Storage::disk('local')->put($out, $doc->saveXML());
        return Storage::path($out);
    }

    /* ==========
     * Envío SRI
     * ========== */
    private function enviarASri(string $xmlFirmadoPath, string $claveAcceso, string $ambiente): array
    {
        $urls = $this->sriWsdl($ambiente);
        $soapOpts = [
            'cache_wsdl'=>WSDL_CACHE_NONE,'trace'=>1,'exceptions'=>true,
            'stream_context'=>stream_context_create(['ssl'=>['verify_peer'=>false,'verify_peer_name'=>false,'allow_self_signed'=>true]]),
        ];

        // Recepción
        $cliRec = new \SoapClient($urls['recepcion'], $soapOpts);
        $xmlContent = file_get_contents($xmlFirmadoPath);
        $soapXml = new \SoapVar($xmlContent, XSD_BASE64BINARY);

        try {
            $respRec = $cliRec->validarComprobante(['xml'=>$soapXml]);
        } catch (\Throwable $e) {
            $this->debugWrite($claveAcceso,'recepcion_exception.txt', $e->getMessage()."\n\n".$e->getTraceAsString());
            if (method_exists($cliRec,'__getLastRequest')) {
                $this->debugWrite($claveAcceso,'recepcion_last_request.xml',(string)$cliRec->__getLastRequest());
                $this->debugWrite($claveAcceso,'recepcion_last_response.xml',(string)$cliRec->__getLastResponse());
            }
            throw $e;
        }

        $estadoRecep = (string)($respRec->RespuestaRecepcionComprobante->estado ?? '');
        $detallesRecep = $respRec->RespuestaRecepcionComprobante->comprobantes->comprobante->mensajes->mensaje ?? null;
        $this->debugWrite($claveAcceso,'recepcion_response.json', json_encode($respRec, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
        if (method_exists($cliRec,'__getLastRequest')) {
            $this->debugWrite($claveAcceso,'recepcion_last_request.xml',(string)$cliRec->__getLastRequest());
            $this->debugWrite($claveAcceso,'recepcion_last_response.xml',(string)$cliRec->__getLastResponse());
        }
        if (strtoupper($estadoRecep) !== 'RECIBIDA') {
            return [
                'recepcion'=>$estadoRecep ?: 'SIN_RESPUESTA',
                'autorizacion'=>null,
                'paths'=>['recepcion'=>Storage::path("sri/debug/{$claveAcceso}/recepcion_response.json"),'autorizacion'=>null],
                'mensajes'=>['recepcion'=>$detallesRecep],
            ];
        }

        // Autorización
        $cliAut = new \SoapClient($urls['autorizacion'], $soapOpts);
        try {
            $respAut = $cliAut->autorizacionComprobante(['claveAccesoComprobante'=>$claveAcceso]);
        } catch (\Throwable $e) {
            $this->debugWrite($claveAcceso,'autorizacion_exception.txt', $e->getMessage()."\n\n".$e->getTraceAsString());
            if (method_exists($cliAut,'__getLastRequest')) {
                $this->debugWrite($claveAcceso,'autorizacion_last_request.xml',(string)$cliAut->__getLastRequest());
                $this->debugWrite($claveAcceso,'autorizacion_last_response.xml',(string)$cliAut->__getLastResponse());
            }
            throw $e;
        }

        $aut = $respAut->autorizaciones->autorizacion[0] ?? $respAut->autorizaciones->autorizacion ?? null;
        $estadoAut = (string)($aut->estado ?? '');
        $numAut    = (string)($aut->numeroAutorizacion ?? $claveAcceso);
        $fechaAut  = (string)($aut->fechaAutorizacion ?? '');
        $mensAut   = $aut->mensajes->mensaje ?? null;
        $compCdata = (string)($aut->comprobante ?? '');

        // Guardar XML de autorización
        $autDir = 'sri/facturas/autorizadas';
        if (!Storage::disk('local')->exists($autDir)) Storage::disk('local')->makeDirectory($autDir);
        $autPath = Storage::path($autDir.'/'.$claveAcceso.'.xml');

        $autDoc = new \DOMDocument('1.0','UTF-8');
        $autEl  = $autDoc->createElement('autorizacion'); $autDoc->appendChild($autEl);
        $autEl->appendChild($autDoc->createElement('estado', $estadoAut));
        $autEl->appendChild($autDoc->createElement('numeroAutorizacion', $numAut));
        if ($fechaAut!=='') $autEl->appendChild($autDoc->createElement('fechaAutorizacion', $fechaAut));
        $comp = $autDoc->createElement('comprobante'); $comp->appendChild($autDoc->createCDATASection($compCdata)); $autEl->appendChild($comp);
        file_put_contents($autPath, $autDoc->saveXML());

        $this->debugWrite($claveAcceso,'autorizacion_response.json', json_encode($respAut, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE));
        if (method_exists($cliAut,'__getLastRequest')) {
            $this->debugWrite($claveAcceso,'autorizacion_last_request.xml',(string)$cliAut->__getLastRequest());
            $this->debugWrite($claveAcceso,'autorizacion_last_response.xml',(string)$cliAut->__getLastResponse());
        }

        return [
            'recepcion'=>$estadoRecep,
            'autorizacion'=>$estadoAut ?: 'SIN_RESPUESTA',
            'numAut'=>$numAut,
            'fechaAut'=>$fechaAut,
            'paths'=>[
                'recepcion'=>Storage::path("sri/debug/{$claveAcceso}/recepcion_response.json"),
                'autorizacion'=>$autPath
            ],
            'mensajes'=>['recepcion'=>$detallesRecep, 'autorizacion'=>$mensAut],
        ];
    }

    /* ==========
     * Utilidades/Configuración
     * ========== */

    private function nf($n, $dec=2): string { return number_format((float)$n, $dec, '.', ''); }

    private function mapFormaPago($codigo=null,$nombre=null): string
    {
        $nombre = strtoupper((string)$nombre); $codigo = (string)$codigo;
        if ($codigo==='01' || str_contains($nombre,'EFECTIVO')) return '01';
        if ($codigo==='16' || str_contains($nombre,'DÉBITO') || str_contains($nombre,'DEBITO')) return '16';
        if ($codigo==='19' || str_contains($nombre,'CRÉDITO') || str_contains($nombre,'CREDITO')) return '19';
        if ($codigo==='20' || str_contains($nombre,'TRANSFER')) return '20';
        return '01';
    }

    private function mapIvaCodigoPorcentaje(int $iva): string
    {
        if ($iva<=0) return '0';
        if ($iva===12) return '2';
        if ($iva===14) return '3';
        if ($iva===15) return (string)env('SRI_COD_IVA_15','4');
        return (string)env('SRI_COD_IVA_15','4');
    }

    private function mapTipoIdentificacion(?string $id, ?string $correo): string
    {
        $id = preg_replace('/\D+/','',(string)$id);
        if ($id && strlen($id)===13) return '04';
        if ($id && strlen($id)===10) return '05';
        if ($id && strlen($id)>0)    return '06';
        return '07';
    }

    private function empresaInfo(): array
    {
        if (Schema::hasTable('empresas')) {
            $e = DB::table('empresas')->select(
                'ruc','telefono','correo','nombre_comercial','razon_social','direccion','ambiente','obligado_a_llevar_contabilidad',
                'establecimiento','punto_emision','secuencial_factura',
                DB::raw(Schema::hasColumn('empresas','ruta_firma_electronica') ? 'ruta_firma_electronica' : 'NULL as ruta_firma_electronica'),
                DB::raw(Schema::hasColumn('empresas','clave_firma_electronica') ? 'clave_firma_electronica' : 'NULL as clave_firma_electronica')
            )->first();
            if ($e) {
                return [
                    'nombre_comercial'=>$e->nombre_comercial ?: (config('app.name') ?? 'Mi Empresa'),
                    'razon_social'=>$e->razon_social ?: ($e->nombre_comercial ?: (config('app.name') ?? 'Mi Empresa')),
                    'ruc'=>$e->ruc ?: env('SRI_RUC','0000000000001'),
                    'telefono'=>$e->telefono ?: null,
                    'email'=>$e->correo ?: null,
                    'direccion'=>$e->direccion ?: null,
                    'ambiente'=>(string)($e->ambiente ?? '1'),
                    'obligado_contabilidad'=>(bool)($e->obligado_a_llevar_contabilidad ?? false),
                    'establecimiento'=>$e->establecimiento ?? '001',
                    'punto_emision'=>$e->punto_emision ?? '001',
                    'secuencial_factura'=>$e->secuencial_factura ?? '000000001',
                    'ruta_firma_electronica'=>$e->ruta_firma_electronica ?: env('SRI_FIRMA_PATH'),
                    'clave_firma_electronica'=>$e->clave_firma_electronica ?: env('SRI_FIRMA_PASS'),
                ];
            }
        }
        return [
            'ambiente'=>env('SRI_AMBIENTE','1'),
            'obligado_contabilidad'=>env('SRI_OBLIGADO_CONTAB', false),
            'establecimiento'=>'001',
            'punto_emision'=>'001',
            'secuencial_factura'=>'000000001',
            'ruta_firma_electronica'=>env('SRI_FIRMA_PATH'),
            'clave_firma_electronica'=>env('SRI_FIRMA_PASS'),
        ];
    }

    private function configEmisor(): array
    {
        $info = $this->empresaInfo();
        return [
            'ruc'=>$info['ruc'],
            'ambiente'=>$info['ambiente'],
            'estab'=>$info['establecimiento'],
            'ptoEmi'=>$info['punto_emision'],
            'base_secuencial'=>$info['secuencial_factura'],
        ];
    }

    private function sriWsdl(string $ambiente): array
    {
        return $ambiente==='2'
            ? [
                'recepcion'=>'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl',
                'autorizacion'=>'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl',
            ]
            : [
                'recepcion'=>'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl',
                'autorizacion'=>'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl',
            ];
    }

    private function storageAbsPath(string $path): string
    {
        if ($path==='') return $path;
        if (preg_match('~^([A-Za-z]:\\\\|/)~',$path)===1) return $path;
        return Storage::path($path);
    }

    private function debugWrite(string $clave, string $name, string $content): string
    {
        $dir = "sri/debug/{$clave}";
        if (!Storage::disk('local')->exists($dir)) Storage::disk('local')->makeDirectory($dir);
        $path = "{$dir}/{$name}";
        Storage::disk('local')->put($path, $content);
        return Storage::path($path);
    }

    private function siguienteSecuencialConLock(string $estab, string $ptoEmi): string
    {
        $info = $this->empresaInfo();
        $base = (int)($info['secuencial_factura'] ?? 1);

        $last = DB::table('ventas')
            ->where('estab',$estab)->where('pto_emision',$ptoEmi)
            ->whereNotNull('secuencial')->lockForUpdate()
            ->orderByDesc('secuencial')->value('secuencial');
        
        $lastInt = $last ? (int)$last : 0;
        $nextInt = max($base, $lastInt + 1);

        return str_pad((string)$nextInt, 9, '0', STR_PAD_LEFT);
    }

    private function dvModulo11(string $num): int
    {
        $sum=0; $mult=2;
        for($i=strlen($num)-1;$i>=0;$i--){ $sum+=intval($num[$i])*$mult; $mult++; if($mult>7)$mult=2; }
        $mod=11-($sum%11); if($mod===11) return 0; if($mod===10) return 1; return $mod;
    }

    private function generarClaveAccesoOficial(\DateTimeInterface $fecha, array $cfg, string $tipoDoc, string $secuencial, string $estab, string $ptoEmi): string
    {
        $ddmmaaaa = $fecha->format('dmY');
        $ruc      = str_pad(preg_replace('/\D+/','',(string)$cfg['ruc']),13,'0',STR_PAD_LEFT);
        $ambiente = (string)$cfg['ambiente'];
        $serie    = str_pad($estab,3,'0',STR_PAD_LEFT).str_pad($ptoEmi,3,'0',STR_PAD_LEFT);
        $secuenc  = str_pad($secuencial,9,'0',STR_PAD_LEFT);
        $codNum   = str_pad((string)random_int(0,99999999),8,'0',STR_PAD_LEFT);
        $tipoEmi  = '1';
        $base = $ddmmaaaa.$tipoDoc.$ruc.$ambiente.$serie.$secuenc.$codNum.$tipoEmi;
        return $base.$this->dvModulo11($base);
    }

    private function actualizarVentaConSri(Venta $venta, array $data): void
    {
        $updates=[];
        foreach ($data as $col=>$val) {
            if (Schema::hasColumn('ventas', $col)) $updates[$col]=$val;
            // fallback comunes
            if ($col==='estado') $updates['estado']=$val;
            if ($col==='sri_numero_autorizacion' && Schema::hasColumn('ventas','numero_autorizacion')) {
                $updates['numero_autorizacion']=$val;
            }
        }
        if (!empty($updates)) {
            DB::table('ventas')->where('id',$venta->id)->update($updates);
            $venta->refresh();
        }
    }
}
