<?php

namespace App\Services;

trait TraitXadesbes{

    /**
     * Version.
     *
     * @var string
     */
    public $version = '1.0';

    /**
     * Encoding.
     *
     * @var string
     */
    public $encoding = 'UTF-8';

    /**
     * Certs.
     *
     * @var array
     */
    protected $certs;

    /**
     * Attributes.
     *
     * @var array
     */
    protected $attributes;

    /**
     * Read certs.
     */
    protected function readCerts()
    {
        if (is_null($this->pathCertificate) || is_null($this->passwors)) {
            throw new \Exception('Class '.get_class($this).': requires the certificate path and password.');
        }

        $p12content = file_get_contents($this->pathCertificate);
        
        // Limpiamos errores previos
        while (openssl_error_string());

        $success = openssl_pkcs12_read($p12content, $this->certs, $this->passwors);

        if (!$success) {
            $error = openssl_error_string();
            // Si el error indica algoritmos no soportados (OpenSSL 3.0+)
            if ($error && (strpos($error, 'unsupported') !== false || strpos($error, '0308010C') !== false)) {
                try {
                    $this->retryWithLegacy($p12content);
                } catch (\Exception $e) {
                    // Si falla el intento con variables de entorno, probamos con el CLI como último recurso
                    if (!$this->retryWithCLI()) {
                        throw $e;
                    }
                }
            } else {
                throw new \Exception('Class '.get_class($this).': Failure signing data: ' . ($error ?: 'Unknown OpenSSL error'));
            }
        }
    }

    /**
     * Intenta cargar el proveedor legacy de OpenSSL 3 para certificados antiguos mediante variables de entorno.
     */
    private function retryWithLegacy($p12content)
    {
        $tempDir = sys_get_temp_dir();
        $confPath = $tempDir . DIRECTORY_SEPARATOR . 'openssl_legacy.cnf';
        
        if (!file_exists($confPath)) {
            $confContent = "openssl_conf = openssl_init\n\n" .
                          "[openssl_init]\n" .
                          "providers = provider_sect\n\n" .
                          "[provider_sect]\n" .
                          "default = default_sect\n" .
                          "legacy = legacy_sect\n\n" .
                          "[default_sect]\n" .
                          "activate = 1\n\n" .
                          "[legacy_sect]\n" .
                          "activate = 1\n";
            @file_put_contents($confPath, $confContent);
        }
        
        putenv("OPENSSL_CONF=" . $confPath);
        
        if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
            $searchPaths = [
                'C:\\xampp\\php\\extras\\ssl',
                'C:\\xampp\\php',
                'C:\\Program Files\\Common Files\\SSL',
            ];
            foreach ($searchPaths as $path) {
                if (file_exists($path . DIRECTORY_SEPARATOR . 'legacy.dll')) {
                    putenv("OPENSSL_MODULES=" . $path);
                    break;
                }
            }
        }

        while (openssl_error_string());
        if (!openssl_pkcs12_read($p12content, $this->certs, $this->passwors)) {
            throw new \Exception('Class '.get_class($this).': Failure signing data after legacy attempt: ' . openssl_error_string());
        }
    }

    /**
     * Fallback final: usa la línea de comandos para extraer los certificados si PHP falla.
     */
    private function retryWithCLI()
    {
        $exePaths = [
            'C:\\xampp\\apache\\bin\\openssl.exe',
            'C:\\xampp\\php\\extras\\openssl\\openssl.exe',
            'C:\\xampp\\php\\openssl.exe',
            'openssl',
        ];
        
        $exe = null;
        foreach ($exePaths as $path) {
            if ($path === 'openssl' || file_exists($path)) {
                $exe = $path;
                break;
            }
        }
        
        if (!$exe) return false;

        // Quitar file:// si existe para que el comando openssl lo entienda
        $cleanPath = str_replace('file://', '', $this->pathCertificate);
        // Escapar caracteres simples en el password para el shell
        $safePass = str_replace('"', '\"', $this->passwors);

        $certOut = shell_exec("\"$exe\" pkcs12 -in \"$cleanPath\" -clcerts -nokeys -passin pass:\"$safePass\" -legacy 2>&1");
        $keyOut = shell_exec("\"$exe\" pkcs12 -in \"$cleanPath\" -nocerts -nodes -passin pass:\"$safePass\" -legacy 2>&1");

        if ($certOut && strpos($certOut, 'BEGIN CERTIFICATE') !== false && $keyOut && strpos($keyOut, 'BEGIN PRIVATE KEY') !== false) {
            $this->certs = [
                'cert' => $certOut,
                'pkey' => $keyOut,
                'extracerts' => []
            ];
            return true;
        }

        return false;
    }

    /**
     * X509 export.
     */
    protected function x509Export()
    {
        if (!empty($this->certs)) {
            openssl_x509_export($this->certs['cert'], $stringCert);

            return str_replace([PHP_EOL, '-----BEGIN CERTIFICATE-----', '-----END CERTIFICATE-----'], '', $stringCert);
        }

        throw new \Exception('Class '.get_class($this).': Error openssl x509 export.');
    }

    /**
     * Identifiers references.
     */

     protected function identifiersReferences()
     {
         foreach ($this->ids as $key => $value) {
             $this->$key = "{$value}". $this->aleatorioReferences(6);
         }
     }

     function aleatorioReferences($digits)
     {
         return rand(pow(10, $digits - 1), pow(10, $digits) - 1);
     }

    /**
     * Remove child.
     *
     * @param string $tagName
     */
    protected function removeChild($tagName, $item = 0)
    {
        if (is_null($tag = $this->domDocument->documentElement->getElementsByTagName($tagName)->item($item))) {
            return;
        }

        $this->domDocument->documentElement->removeChild($tag);
    }

    /**
     * Get tag.
     *
     * @param string $tagName
     * @param int    $item
     *
     * @return mixed
     */
    protected function getTag($tagName, $item = 0, $attribute = NULL, $attribute_value = NULL)
    {
        $tag = $this->domDocument->documentElement->getElementsByTagName($tagName);

        if (is_null($tag->item(0))) {
            throw new \Exception('Class '.get_class($this).": The tag name {$tagName} does not exist.");
        }

        if($attribute)
            if($attribute_value){
                $tag->item($item)->setAttribute($attribute, $attribute_value);
                return;
            }
            else
                return $tag->item($item)->getAttribute($attribute);
        else
            return $tag->item($item);
    }

    protected function ValueXML($stringXML, $xpath)
    {
        if(substr($xpath, 0, 1) != '/')
            return NULL;
        $search = substr($xpath, 1, strpos(substr($xpath, 1), '/'));
        $posinicio = strpos($stringXML, "<".$search);
        if($posinicio == 0)
           return false;
        $posinicio = strpos($stringXML, ">", $posinicio) + 1;
        $posCierre = strpos($stringXML, "</".$search.">", $posinicio);
        if($posCierre == 0)
            return true;
        $valorXML = substr($stringXML, $posinicio, $posCierre - $posinicio);
        if(strcmp(substr($xpath, strpos($xpath, $search) + strlen($search)), '/') != 0)
            return $this->ValueXML($valorXML, substr($xpath, strpos($xpath, $search) + strlen($search)));
        else
            return $valorXML;
    }

    /**
     * Get query.
     *
     * @param string $query
     * @param bool   $validate
     * @param int    $item
     *
     * @return mixed
     */
    protected function getQuery($query, $validate = true, $item = 0)
    {
        $tag = $this->domXPath->query($query);

        if (($validate) && (null == $tag->item(0))) {
            throw new \Exception('Class '.get_class($this).": The query {$query} does not exist.");
        }
        if (is_null($item)) {
            return $tag;
        }

        return $tag->item($item);
    }

    /**
     * Join array.
     *
     * @param array  $array
     * @param bool   $formatNS
     * @param string $join
     *
     * @return string
     */
    protected function joinArray(array $array, $formatNS = true, $join = ' ')
    {
        return implode($join, array_map(function ($value, $key) use ($formatNS) {
            return ($formatNS) ? "{$key}=\"$value\"" : "{$key}=$value";
        }, $array, array_keys($array)));
    }

    /**
     */
    public function __set($name, $value)
    {
        $this->attributes[$name] = $value;
    }

    /**
     * Get.

     */
    public function __get($name)
    {
        if (is_string($name) && array_key_exists($name, $this->attributes)) {
            return $this->attributes[$name];
        }

        return null; // Retorna null si el atributo no existe
    }
}
