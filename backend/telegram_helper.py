import os
import urllib.request
import urllib.parse
import json

def load_env_variables():
    """Carga variables de entorno desde un archivo .env si existe."""
    # Buscar .env en la carpeta raíz o en la carpeta backend
    possible_paths = [
        os.path.join(os.path.dirname(__file__), ".env"),
        os.path.join(os.path.dirname(__file__), "..", ".env"),
        os.path.abspath(".env")
    ]
    for env_path in possible_paths:
        if os.path.exists(env_path):
            try:
                with open(env_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if line and not line.startswith("#"):
                            key_val = line.split("=", 1)
                            if len(key_val) == 2:
                                key = key_val[0].strip()
                                val = key_val[1].strip()
                                # Limpiar comillas si tiene
                                if val.startswith('"') and val.endswith('"'):
                                    val = val[1:-1]
                                if val.startswith("'") and val.endswith("'"):
                                    val = val[1:-1]
                                os.environ[key] = val
                print(f"Variables de entorno cargadas desde {env_path}")
                break
            except Exception as e:
                print(f"Error al leer archivo .env: {str(e)}")

def enviar_alerta_telegram(mensaje: str):
    """Envía un mensaje de texto formateado en Markdown al chat de Telegram configurado."""
    load_env_variables()
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    
    if not token or not chat_id:
        print("Aviso: Notificaciones de Telegram desactivadas. Configure TELEGRAM_BOT_TOKEN y TELEGRAM_CHAT_ID en su archivo .env.")
        return
        
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": mensaje,
        "parse_mode": "Markdown"
    }
    try:
        data = json.dumps(payload).encode('utf-8')
        req = urllib.request.Request(
            url, 
            data=data, 
            headers={'Content-Type': 'application/json'}
        )
        # Timeout corto de 5s para que no bloquee el hilo de ejecución del servidor
        with urllib.request.urlopen(req, timeout=5) as response:
            response.read()
            print("Notificación de Telegram enviada exitosamente.")
    except Exception as e:
        print(f"Error al enviar notificación a Telegram: {str(e)}")
