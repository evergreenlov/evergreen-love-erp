from fastapi import APIRouter, HTTPException, Depends
import datetime

from database import get_db_connection
from auth import get_current_admin

router = APIRouter(prefix="/api", tags=["dashboard"])


def _ivu_periodo_actual():
    """Devuelve (fecha_inicio, fecha_fin) del período IVU vigente.
    Ciclo: día 20 de un mes → día 19 del mes siguiente.
    """
    today = datetime.date.today()
    if today.day >= 20:
        inicio = today.replace(day=20)
        # fin = día 19 del mes siguiente
        primer_dia_siguiente = (today.replace(day=1) + datetime.timedelta(days=32)).replace(day=1)
        fin = primer_dia_siguiente.replace(day=19)
    else:
        # estamos entre el 1 y el 19 → el período empezó el 20 del mes anterior
        primer_dia_mes = today.replace(day=1)
        mes_anterior = (primer_dia_mes - datetime.timedelta(days=1))
        inicio = mes_anterior.replace(day=20)
        fin = today.replace(day=19)
    return str(inicio), str(fin)


def _mes_actual_rango():
    """Devuelve (primer_día, último_día) del mes calendario actual."""
    today = datetime.date.today()
    primer = today.replace(day=1)
    # último día: primer día del mes siguiente menos 1
    siguiente = (primer + datetime.timedelta(days=32)).replace(day=1)
    ultimo = siguiente - datetime.timedelta(days=1)
    return str(primer), str(ultimo)


@router.get("/dashboard/ejecutivo")
def dashboard_ejecutivo(current_user: dict = Depends(get_current_admin)):
    """KPIs, alertas y listas recientes para el dashboard ejecutivo."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ivu_inicio, ivu_fin = _ivu_periodo_actual()
        mes_inicio, mes_fin = _mes_actual_rango()

        # ── KPIs: Cotizaciones ─────────────────────────────────────────────
        cursor.execute("""
            SELECT
                SUM(CASE WHEN estado = 'nueva'     THEN 1 ELSE 0 END) AS nuevas,
                SUM(CASE WHEN estado = 'aprobada'  THEN 1 ELSE 0 END) AS aprobadas,
                SUM(CASE WHEN estado = 'aprobada'
                         AND orden_produccion_id IS NOT NULL THEN 1 ELSE 0 END) AS convertidas,
                SUM(CASE WHEN estado = 'en_revision' THEN 1 ELSE 0 END) AS en_revision
            FROM cotizaciones
        """)
        row = cursor.fetchone()
        cot = dict(row) if row else {}
        cotizaciones_nuevas     = cot.get("nuevas", 0) or 0
        cotizaciones_aprobadas  = cot.get("aprobadas", 0) or 0
        cotizaciones_convertidas = cot.get("convertidas", 0) or 0
        # aprobadas pendientes de convertir
        cotizaciones_por_convertir = cotizaciones_aprobadas - cotizaciones_convertidas

        # ── KPIs: Órdenes de producción ────────────────────────────────────
        cursor.execute("""
            SELECT
                SUM(CASE WHEN estado IN ('En diseño','Cortando','Grabando','Pintura/Acabado')
                         THEN 1 ELSE 0 END) AS en_produccion,
                SUM(CASE WHEN estado = 'Listo'     THEN 1 ELSE 0 END) AS listas,
                SUM(CASE WHEN estado = 'Pendiente' THEN 1 ELSE 0 END) AS pendientes,
                SUM(CASE WHEN fecha_entrega IS NOT NULL
                         AND fecha_entrega < date('now')
                         AND estado NOT IN ('Listo','Entregado')
                         THEN 1 ELSE 0 END) AS atrasadas
            FROM ordenes_produccion
        """)
        row = cursor.fetchone()
        ord_ = dict(row) if row else {}
        ordenes_en_produccion = ord_.get("en_produccion", 0) or 0
        ordenes_listas        = ord_.get("listas", 0) or 0
        ordenes_atrasadas     = ord_.get("atrasadas", 0) or 0

        # ── KPIs: Facturas ─────────────────────────────────────────────────
        cursor.execute("""
            SELECT
                COUNT(CASE WHEN estado = 'Pendiente' THEN 1 END)         AS pendientes_count,
                SUM(CASE WHEN estado = 'Pendiente' THEN total ELSE 0 END) AS pendientes_monto
            FROM facturas
        """)
        row = cursor.fetchone()
        fac = dict(row) if row else {}
        facturas_pendientes_count = fac.get("pendientes_count", 0) or 0
        facturas_pendientes_monto = round(fac.get("pendientes_monto", 0.0) or 0.0, 2)

        # ── KPIs: Ventas del mes (por fecha_emision, no Anulada) ───────────
        cursor.execute("""
            SELECT
                COALESCE(SUM(CASE WHEN estado != 'Anulada' THEN subtotal ELSE 0 END), 0) AS ventas_subtotal,
                COALESCE(SUM(CASE WHEN estado != 'Anulada' THEN total    ELSE 0 END), 0) AS ventas_total
            FROM facturas
            WHERE fecha_emision >= ? AND fecha_emision <= ?
        """, (mes_inicio, mes_fin))
        row = cursor.fetchone()
        ventas_mes = round((dict(row) if row else {}).get("ventas_subtotal", 0.0) or 0.0, 2)

        # ── KPIs: Gastos del mes ───────────────────────────────────────────
        cursor.execute("""
            SELECT COALESCE(SUM(monto), 0) AS total_gastos
            FROM gastos
            WHERE fecha >= ? AND fecha <= ?
        """, (mes_inicio, mes_fin))
        row = cursor.fetchone()
        gastos_mes = round((dict(row) if row else {}).get("total_gastos", 0.0) or 0.0, 2)

        ganancia_estimada = round(ventas_mes - gastos_mes, 2)

        # ── KPIs: IVU del período vigente ──────────────────────────────────
        cursor.execute("""
            SELECT
                COALESCE(SUM(CASE WHEN estado != 'Anulada' THEN ivu_estatal  ELSE 0 END), 0) AS ivu_estatal,
                COALESCE(SUM(CASE WHEN estado != 'Anulada' THEN ivu_municipal ELSE 0 END), 0) AS ivu_municipal
            FROM facturas
            WHERE fecha_emision >= ? AND fecha_emision <= ?
        """, (ivu_inicio, ivu_fin))
        row = cursor.fetchone()
        ivu_d = dict(row) if row else {}
        ivu_estatal   = round(ivu_d.get("ivu_estatal", 0.0) or 0.0, 2)
        ivu_municipal = round(ivu_d.get("ivu_municipal", 0.0) or 0.0, 2)
        ivu_total     = round(ivu_estatal + ivu_municipal, 2)

        # ── Alertas ────────────────────────────────────────────────────────
        cursor.execute("""
            SELECT COUNT(*) AS cnt FROM gastos
            WHERE recibo_ruta IS NULL OR recibo_ruta = ''
        """)
        gastos_sin_recibo = (cursor.fetchone() or {})["cnt"] or 0

        cursor.execute("""
            SELECT COUNT(*) AS cnt FROM cotizaciones
            WHERE estado = 'nueva'
              AND fecha_creacion <= datetime('now', '-48 hours', 'localtime')
        """)
        cotizaciones_sin_revisar = (cursor.fetchone() or {})["cnt"] or 0

        cursor.execute("""
            SELECT COUNT(*) AS cnt FROM materiales
            WHERE cantidad <= cantidad_minima_alerta
        """)
        stock_bajo = (cursor.fetchone() or {})["cnt"] or 0

        # ── Lista: Últimas 5 cotizaciones ──────────────────────────────────
        cursor.execute("""
            SELECT id, nombre_cliente, email, estado, fecha_creacion,
                   orden_produccion_id
            FROM cotizaciones
            ORDER BY id DESC LIMIT 5
        """)
        ultimas_cotizaciones = [dict(r) for r in cursor.fetchall()]

        # ── Lista: Últimas 5 órdenes ───────────────────────────────────────
        cursor.execute("""
            SELECT o.id, o.codigo_orden, o.cliente, o.estado, o.fecha_creacion,
                   o.fecha_entrega, o.cotizacion_id
            FROM ordenes_produccion o
            ORDER BY o.id DESC LIMIT 5
        """)
        ultimas_ordenes = []
        for r in cursor.fetchall():
            d = dict(r)
            # Extraer nombre legible del string de cliente (hasta primer " | " o 40 chars)
            cliente_raw = d.get("cliente", "")
            nombre_corto = cliente_raw.split(" | ")[0].replace("[COTIZACIÓN #", "Cotización #").replace("[PEDIDO B2B] Cliente: ", "").replace("[PERSONALIZADO] ", "")[:50]
            d["cliente_corto"] = nombre_corto
            ultimas_ordenes.append(d)

        # ── Lista: Facturas pendientes ─────────────────────────────────────
        cursor.execute("""
            SELECT f.id, f.numero_factura, f.fecha_emision, f.fecha_vencimiento,
                   f.total, f.estado,
                   COALESCE(c.nombre, f.cliente_nombre_manual, 'Cliente Directo') AS cliente_nombre
            FROM facturas f
            LEFT JOIN clientes c ON c.id = f.cliente_id
            WHERE f.estado = 'Pendiente'
            ORDER BY f.fecha_vencimiento ASC, f.id ASC
        """)
        facturas_pendientes_lista = [dict(r) for r in cursor.fetchall()]

        return {
            "status": "success",
            "periodo": {
                "mes": {"desde": mes_inicio, "hasta": mes_fin},
                "ivu": {"desde": ivu_inicio, "hasta": ivu_fin},
            },
            "kpis": {
                "cotizaciones_nuevas":       cotizaciones_nuevas,
                "cotizaciones_aprobadas":    cotizaciones_aprobadas,
                "cotizaciones_por_convertir": cotizaciones_por_convertir,
                "ordenes_en_produccion":     ordenes_en_produccion,
                "ordenes_listas":            ordenes_listas,
                "facturas_pendientes_count": facturas_pendientes_count,
                "facturas_pendientes_monto": facturas_pendientes_monto,
                "ventas_mes":                ventas_mes,
                "gastos_mes":                gastos_mes,
                "ganancia_estimada":         ganancia_estimada,
                "ivu_estatal":               ivu_estatal,
                "ivu_municipal":             ivu_municipal,
                "ivu_total":                 ivu_total,
            },
            "alertas": {
                "gastos_sin_recibo":       gastos_sin_recibo,
                "ordenes_atrasadas":       ordenes_atrasadas,
                "cotizaciones_sin_revisar": cotizaciones_sin_revisar,
                "stock_bajo":              stock_bajo,
            },
            "listas": {
                "ultimas_cotizaciones":    ultimas_cotizaciones,
                "ultimas_ordenes":         ultimas_ordenes,
                "facturas_pendientes":     facturas_pendientes_lista,
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en dashboard: {str(e)}")
    finally:
        conn.close()
