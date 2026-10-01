<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ComprobanteAutorizadoMail extends Mailable
{
    use Queueable, SerializesModels;

    public $comprobante;
    public $empresa;
    public $pdfContent;
    public $tipoComprobante;

    /**
     * Create a new message instance.
     *
     * @return void
     */
    public function __construct($comprobante, $empresa, $pdfContent, $tipoComprobante = 'FACTURA')
    {
        $this->comprobante = $comprobante;
        $this->empresa = $empresa;
        $this->pdfContent = $pdfContent;
        $this->tipoComprobante = $tipoComprobante;
    }

    /**
     * Get the message envelope.
     *
     * @return \Illuminate\Mail\Mailables\Envelope
     */
    public function envelope()
    {
        $numero = $this->comprobante->numero ?? ($this->comprobante->estab . '-' . $this->comprobante->pto_emision . '-' . str_pad($this->comprobante->secuencial, 9, '0', STR_PAD_LEFT));
        
        return new Envelope(
            subject: 'Nuevo Comprobante Electrónico ' . $this->tipoComprobante . ' ' . $numero,
        );
    }

    /**
     * Get the message content definition.
     *
     * @return \Illuminate\Mail\Mailables\Content
     */
    public function content()
    {
        // Usaremos una vista en línea muy sencilla
        return new Content(
            htmlString: '<p>Estimado(a) Cliente,</p><p>Adjuntamos a este correo el documento PDF correspondiente a su comprobante electrónico (<strong>' . $this->tipoComprobante . '</strong>) emitido por <strong>' . ($this->empresa['nombre_comercial'] ?? 'Nuestra Empresa') . '</strong>.</p><p>Gracias por su preferencia.</p>',
        );
    }

    /**
     * Get the attachments for the message.
     *
     * @return array
     */
    public function attachments()
    {
        $numero = $this->comprobante->numero ?? ($this->comprobante->estab . '-' . $this->comprobante->pto_emision . '-' . str_pad($this->comprobante->secuencial, 9, '0', STR_PAD_LEFT));
        $filename = strtolower($this->tipoComprobante) . '_' . $numero . '.pdf';

        return [
            Attachment::fromData(fn () => $this->pdfContent, $filename)
                    ->withMime('application/pdf'),
        ];
    }
}
