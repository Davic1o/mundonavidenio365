<?php

namespace App\Services;


abstract class Sign
{
    use TraitXadesbes;

    /**
     * Abstract loadXML.
     *
  * @return void
 */
abstract protected function loadXML();

    /**
     * Construct.
     *
     * @param string $pathCertificate
     * @param string $passwors
     * @param string $xmlString
     */
    public function __construct($pathCertificate = null, $passwors = null, $xmlString = null)
    {
        $this->pathCertificate = $pathCertificate;
        $this->passwors = $passwors;
        $this->xmlString = $xmlString;

        $this->readCerts();
        $this->identifiersReferences();

        if (!is_null($xmlString)) {
            $this->sign();
        }
    }


    /**
     * Get document.
     *
     * @return \DOMDocument
     */
    public function getDocument()
    {
        return $this->domDocument;
    }

    /**
     * Sign.
     *
 * @param string|null $string El contenido XML que se desea firmar. Si es null, usa el contenido actual.
 *
 * @return $this Retorna la instancia actual de la clase para permitir el encadenamiento de métodos.
 */
public function sign($string = null)
{
    if ($string !== null) {
        $this->xmlString = $string;
    }

    if ($this->xmlString !== null) {
        $this->loadXML();
        $this->xml = $this->domDocument->saveXML();
    }

    return $this;
}
}
