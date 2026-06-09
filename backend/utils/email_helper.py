import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_receipt_email(email_to: str, order_data: dict):
    """
    Envía un recibo de compra premium en formato HTML al cliente.
    order_data debe contener:
      - nombre_contacto: str
      - telefono_contacto: str
      - numero_factura: str
      - subtotal: float
      - ivu_estatal: float
      - ivu_municipal: float
      - total: float
      - metodo_pago: str
      - notas: str
      - items: list de dicts con {nombre_producto, cantidad, precio_unitario}
    """
    # 1. Cargar configuraciones SMTP desde variables de entorno
    smtp_host = os.environ.get("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASSWORD", "")
    from_name = os.environ.get("SMTP_FROM_NAME", "Evergreen Love")

    if not smtp_user or not smtp_pass:
        print("⚠️ Advertencia: No se han configurado las credenciales SMTP (SMTP_USER y SMTP_PASSWORD). El correo de recibo no pudo ser enviado.")
        return False

    # 2. Construir cuerpo del mensaje
    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"Recibo de tu Pedido {order_data['numero_factura']} — Evergreen Love"
    msg["From"] = f"{from_name} <{smtp_user}>"
    msg["To"] = email_to

    # 3. Formatear desglose de artículos para la tabla HTML
    items_html = ""
    for item in order_data.get("items", []):
        subtotal_item = item["cantidad"] * item["precio_unitario"]
        items_html += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #ede6d8; font-size: 14px; color: #2d2d2d;">{item['nombre_producto']}</td>
            <td style="padding: 12px; border-bottom: 1px solid #ede6d8; font-size: 14px; color: #2d2d2d; text-align: center;">{item['cantidad']}</td>
            <td style="padding: 12px; border-bottom: 1px solid #ede6d8; font-size: 14px; color: #2d2d2d; text-align: right;">${item['precio_unitario']:.2f}</td>
            <td style="padding: 12px; border-bottom: 1px solid #ede6d8; font-size: 14px; font-weight: 600; color: #5f5a30; text-align: right;">${subtotal_item:.2f}</td>
        </tr>
        """

    # 4. Determinar instrucciones de pago
    metodo = order_data.get("metodo_pago", "ATH Movil")
    if "ATH" in metodo:
        instrucciones_pago = """
        <div style="background-color: #fdfaf5; border-left: 4px solid #8a8244; padding: 16px; border-radius: 4px; margin-top: 24px;">
            <h4 style="margin: 0 0 6px 0; color: #5f5a30; font-size: 15px;">Instrucciones para Pago Móvil (ATH Móvil):</h4>
            <p style="margin: 0; font-size: 13.5px; color: #555; line-height: 1.5;">
                Por favor, envía el total de <strong>${total:.2f}</strong> a través de ATH Móvil al número:
                <br><strong style="font-size: 16px; color: #2d2d2d;">(787) 960-1431</strong>
                <br>Incluye en la nota tu nombre y número de recibo: <strong>{numero_factura}</strong>.
            </p>
        </div>
        """
    elif "Paypal" in metodo or "PayPal" in metodo:
        instrucciones_pago = """
        <div style="background-color: #fdfaf5; border-left: 4px solid #8a8244; padding: 16px; border-radius: 4px; margin-top: 24px;">
            <h4 style="margin: 0 0 6px 0; color: #5f5a30; font-size: 15px;">Instrucciones para PayPal:</h4>
            <p style="margin: 0; font-size: 13.5px; color: #555; line-height: 1.5;">
                Por favor, transfiere el total de <strong>${total:.2f}</strong> vía PayPal a la cuenta:
                <br><strong style="font-size: 16px; color: #2d2d2d;">evergreenlov@gmail.com</strong>
                <br>Incluye tu número de recibo <strong>{numero_factura}</strong> en las notas del envío.
            </p>
        </div>
        """
    else: # Efectivo / Recogido
        instrucciones_pago = """
        <div style="background-color: #fdfaf5; border-left: 4px solid #8a8244; padding: 16px; border-radius: 4px; margin-top: 24px;">
            <h4 style="margin: 0 0 6px 0; color: #5f5a30; font-size: 15px;">Recogida en Taller (Efectivo / Opciones de pago):</h4>
            <p style="margin: 0; font-size: 13.5px; color: #555; line-height: 1.5;">
                Tu pedido estará disponible para recogida en el taller. Nos comunicaremos contigo al teléfono <strong>{telefono_contacto}</strong> para coordinar la entrega y el método de pago en persona.
            </p>
        </div>
        """
    instrucciones_pago = instrucciones_pago.format(
        total=order_data['total'],
        numero_factura=order_data['numero_factura'],
        telefono_contacto=order_data.get('telefono_contacto', '')
    )

    # 5. Generar la plantilla HTML completa del recibo
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recibo de Compra</title>
        <style>
            body {{
                font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                background-color: #f6f5f0;
                margin: 0;
                padding: 0;
                -webkit-font-smoothing: antialiased;
            }}
            .container {{
                max-width: 600px;
                margin: 30px auto;
                background-color: #ffffff;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.05);
                overflow: hidden;
                border: 1px solid #eae5dc;
            }}
            .header {{
                background-color: #5f5a30;
                padding: 30px 40px;
                text-align: center;
            }}
            .header h1 {{
                color: #ffffff;
                margin: 0;
                font-size: 24px;
                font-weight: 500;
                letter-spacing: 1px;
            }}
            .header p {{
                color: #eae5dc;
                margin: 5px 0 0;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 2px;
            }}
            .content {{
                padding: 40px;
            }}
            .intro {{
                margin-bottom: 25px;
            }}
            .intro h2 {{
                color: #5f5a30;
                margin: 0 0 10px 0;
                font-size: 18px;
            }}
            .intro p {{
                color: #666666;
                font-size: 14.5px;
                line-height: 1.6;
                margin: 0;
            }}
            .details-table {{
                width: 100%;
                border-collapse: collapse;
                margin-top: 15px;
            }}
            .details-table th {{
                background-color: #fdfaf5;
                color: #5f5a30;
                font-weight: 600;
                text-align: left;
                padding: 10px 12px;
                font-size: 13px;
                border-bottom: 2px solid #ede6d8;
            }}
            .totals-section {{
                margin-top: 20px;
                border-top: 2px solid #ede6d8;
                padding-top: 15px;
            }}
            .totals-row {{
                display: flex;
                justify-content: flex-end;
                margin-bottom: 8px;
                font-size: 14px;
                color: #666666;
            }}
            .totals-row .label {{
                width: 150px;
                text-align: right;
                padding-right: 15px;
            }}
            .totals-row .val {{
                width: 100px;
                text-align: right;
            }}
            .totals-row.grand-total {{
                font-size: 18px;
                font-weight: 700;
                color: #5f5a30;
                margin-top: 12px;
            }}
            .footer {{
                background-color: #faf9f6;
                padding: 24px 40px;
                text-align: center;
                border-top: 1px solid #ede6d8;
                font-size: 12px;
                color: #a89880;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>EVERGREEN LOVE</h1>
                <p>Detalle de tu Pedido</p>
            </div>
            <div class="content">
                <div class="intro">
                    <h2>¡Gracias por tu compra, {order_data['nombre_contacto']}!</h2>
                    <p>Hemos recibido correctamente tu solicitud de pedido. A continuación encontrarás el recibo detallado de los artículos solicitados y los pasos para concretar tu pago.</p>
                </div>
                
                <div style="margin-bottom: 20px; font-size: 13.5px; color: #666;">
                    <strong>Número de Recibo:</strong> {order_data['numero_factura']}<br>
                    <strong>Fecha:</strong> {datetime.datetime.now().strftime("%d/%m/%Y")}<br>
                    <strong>Método de Pago Seleccionado:</strong> {order_data.get('metodo_pago', 'ATH Movil')}
                </div>

                <table class="details-table">
                    <thead>
                        <tr>
                            <th style="text-align: left;">Artículo</th>
                            <th style="width: 50px; text-align: center;">Cant</th>
                            <th style="width: 80px; text-align: right;">Precio</th>
                            <th style="width: 90px; text-align: right;">Subtotal</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items_html}
                    </tbody>
                </table>

                <div class="totals-section">
                    <div class="totals-row">
                        <div class="label">Subtotal</div>
                        <div class="val">${order_data['subtotal']:.2f}</div>
                    </div>
                    <div class="totals-row">
                        <div class="label">IVU Estatal (10.5%)</div>
                        <div class="val">${order_data['ivu_estatal']:.2f}</div>
                    </div>
                    <div class="totals-row">
                        <div class="label">IVU Municipal (1.0%)</div>
                        <div class="val">${order_data['ivu_municipal']:.2f}</div>
                    </div>
                    <div class="totals-row grand-total">
                        <div class="label">Total</div>
                        <div class="val">${order_data['total']:.2f}</div>
                    </div>
                </div>

                {instrucciones_pago}
            </div>
            <div class="footer">
                Evergreen Love &copy; {datetime.datetime.now().strftime("%Y")} | Coordinación y Diseño Láser Premium
                <br>Para cualquier duda o cambio, escríbenos directamente a través de WhatsApp.
            </div>
        </div>
    </body>
    </html>
    """

    # datetime import handles fallback locally inside the function template
    import datetime

    # 6. Conectarse al servidor SMTP y enviar el correo
    try:
        msg.attach(MIMEText(html, "html"))

        # Iniciar conexión SMTP
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()  # Upgrade connection to secure TLS
        server.login(smtp_user, smtp_pass)
        
        # Enviar correo
        server.sendmail(smtp_user, email_to, msg.as_string())
        server.quit()
        
        print(f"✅ Recibo enviado con éxito al correo {email_to}")
        return True
    except Exception as e:
        print(f"❌ Error al enviar recibo por correo a {email_to}: {str(e)}")
        return False
