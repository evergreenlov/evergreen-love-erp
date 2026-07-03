/**
 * Dashboard Ejecutivo — Evergreen Love
 */
const DashboardComponent = {

    async render(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando dashboard…</p></div>`;
        try {
            const data = await EvergreenAPI.getDashboardEjecutivo();
            this._renderVista(container, data);
        } catch (e) {
            container.innerHTML = `
                <div class="card" style="border-left:4px solid var(--color-danger);padding:20px;">
                    <strong style="color:var(--color-danger);">Error al cargar dashboard</strong>
                    <p style="font-size:13px;color:#555;margin-top:6px;">${e.message}</p>
                    <button onclick="DashboardComponent.render('dashboard-container')"
                        class="btn btn-secondary" style="margin-top:12px;font-size:12px;">Reintentar</button>
                </div>`;
        }
    },

    _fmt(n) {
        if (n == null) return '0';
        return Number(n).toLocaleString('en-US');
    },

    _fmtMoney(n) {
        if (n == null) return '$0.00';
        return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    _estadoBadgeOrden(estado) {
        const map = {
            'Pendiente':       { bg: '#f5f5f5', color: '#888' },
            'En diseño':       { bg: '#e3f2fd', color: '#1565c0' },
            'Cortando':        { bg: '#fff8e1', color: '#f57f17' },
            'Grabando':        { bg: '#fff3e0', color: '#e65100' },
            'Pintura/Acabado': { bg: '#fce4ec', color: '#880e4f' },
            'Listo':           { bg: '#e8f5e9', color: '#2e7d32' },
            'Entregado':       { bg: '#ede7f6', color: '#4527a0' },
        };
        const s = map[estado] || { bg: '#f5f5f5', color: '#888' };
        return `<span style="background:${s.bg};color:${s.color};padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;">${estado}</span>`;
    },

    _estadoBadgeCotiz(estado) {
        const map = {
            nueva:       { bg: '#e3f2fd', color: '#1565c0' },
            en_revision: { bg: '#fff3e0', color: '#e65100' },
            cotizada:    { bg: '#f3e5f5', color: '#7b1fa2' },
            aprobada:    { bg: '#e8f5e9', color: '#2e7d32' },
            rechazada:   { bg: '#ffebee', color: '#c62828' },
        };
        const labels = { nueva:'Nueva', en_revision:'En revisión', cotizada:'Cotizada', aprobada:'Aprobada', rechazada:'Rechazada' };
        const s = map[estado] || { bg: '#f5f5f5', color: '#888' };
        return `<span style="background:${s.bg};color:${s.color};padding:2px 8px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;">${labels[estado] || estado}</span>`;
    },

    _renderVista(container, data) {
        const kpi = data.kpis || {};
        const alerta = data.alertas || {};
        const listas = data.listas || {};
        const periodo = data.periodo || {};

        // ── KPI cards ────────────────────────────────────────────────────
        const kpiCards = [
            // Cotizaciones
            { label: 'Cotizaciones Nuevas',    value: this._fmt(kpi.cotizaciones_nuevas),    icon: 'inbox',        color: kpi.cotizaciones_nuevas > 0 ? '#1565c0' : '#888',  bg: kpi.cotizaciones_nuevas > 0 ? '#e3f2fd' : '#f5f5f5', tab: 'cotizaciones' },
            { label: 'Cotizaciones Aprobadas', value: this._fmt(kpi.cotizaciones_aprobadas), icon: 'check-circle', color: '#2e7d32', bg: '#e8f5e9', tab: 'cotizaciones' },
            { label: 'Por Convertir a Orden',  value: this._fmt(kpi.cotizaciones_por_convertir), icon: 'zap',      color: kpi.cotizaciones_por_convertir > 0 ? '#e65100' : '#888', bg: kpi.cotizaciones_por_convertir > 0 ? '#fff3e0' : '#f5f5f5', tab: 'cotizaciones' },
            // Producción
            { label: 'En Producción',          value: this._fmt(kpi.ordenes_en_produccion),  icon: 'scissors',     color: '#7b1fa2', bg: '#f3e5f5', tab: 'produccion' },
            { label: 'Órdenes Listas',         value: this._fmt(kpi.ordenes_listas),         icon: 'package-check',color: '#2e7d32', bg: '#e8f5e9', tab: 'produccion' },
            { label: 'Facturas Pendientes',    value: this._fmt(kpi.facturas_pendientes_count) + ' · ' + this._fmtMoney(kpi.facturas_pendientes_monto), icon: 'file-text', color: kpi.facturas_pendientes_count > 0 ? '#c62828' : '#888', bg: kpi.facturas_pendientes_count > 0 ? '#ffebee' : '#f5f5f5', tab: 'facturas' },
            // Financiero
            { label: 'Ventas del Mes',         value: this._fmtMoney(kpi.ventas_mes),        icon: 'trending-up',  color: '#1b5e20', bg: '#e8f5e9', tab: null },
            { label: 'Gastos del Mes',         value: this._fmtMoney(kpi.gastos_mes),        icon: 'trending-down',color: '#b71c1c', bg: '#ffebee', tab: null },
            { label: 'Ganancia Estimada',      value: this._fmtMoney(kpi.ganancia_estimada), icon: 'dollar-sign',  color: kpi.ganancia_estimada >= 0 ? '#1b5e20' : '#b71c1c', bg: kpi.ganancia_estimada >= 0 ? '#e8f5e9' : '#ffebee', tab: null },
            { label: 'IVU Devengado (período)',value: this._fmtMoney(kpi.ivu_total),         icon: 'landmark',     color: '#4527a0', bg: '#ede7f6', tab: null },
        ];

        const kpiHTML = kpiCards.map(k => `
            <div class="card" style="padding:16px;display:flex;align-items:center;gap:14px;cursor:${k.tab ? 'pointer' : 'default'};transition:box-shadow 0.15s;"
                 ${k.tab ? `onclick="window.location.hash='${k.tab}'"` : ''}
                 onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,0.10)'"
                 onmouseout="this.style.boxShadow=''">
                <div style="width:44px;height:44px;border-radius:12px;background:${k.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                    <i data-lucide="${k.icon}" style="width:20px;height:20px;color:${k.color};"></i>
                </div>
                <div style="min-width:0;">
                    <div style="font-size:11px;color:#999;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:2px;">${k.label}</div>
                    <div style="font-size:18px;font-weight:800;color:#222;line-height:1.1;">${k.value}</div>
                </div>
            </div>`).join('');

        // ── Alertas ───────────────────────────────────────────────────────
        const alertItems = [];
        if (alerta.cotizaciones_sin_revisar > 0)
            alertItems.push({ icon: 'inbox',          color: '#1565c0', text: `${alerta.cotizaciones_sin_revisar} cotización(es) nueva(s) sin revisar por más de 48h`, tab: 'cotizaciones' });
        if (alerta.gastos_sin_recibo > 0)
            alertItems.push({ icon: 'receipt',        color: '#e65100', text: `${alerta.gastos_sin_recibo} gasto(s) sin recibo adjunto`, tab: 'facturas' });
        if (alerta.ordenes_atrasadas > 0)
            alertItems.push({ icon: 'clock',          color: '#c62828', text: `${alerta.ordenes_atrasadas} orden(es) atrasada(s) con fecha de entrega vencida`, tab: 'produccion' });
        if (alerta.stock_bajo > 0)
            alertItems.push({ icon: 'alert-triangle', color: '#f57f17', text: `${alerta.stock_bajo} material(es) por debajo del nivel mínimo de alerta`, tab: 'inventario' });

        const alertasHTML = alertItems.length > 0
            ? `<div style="display:flex;flex-direction:column;gap:8px;">
                ${alertItems.map(a => `
                    <div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:#fffbf0;border-left:4px solid ${a.color};border-radius:0 8px 8px 0;cursor:pointer;"
                         onclick="window.location.hash='${a.tab}'">
                        <i data-lucide="${a.icon}" style="width:16px;height:16px;color:${a.color};flex-shrink:0;"></i>
                        <span style="font-size:13px;color:#333;">${a.text}</span>
                        <i data-lucide="chevron-right" style="width:14px;height:14px;color:#bbb;margin-left:auto;"></i>
                    </div>`).join('')}
               </div>`
            : `<div style="display:flex;align-items:center;gap:10px;padding:12px 16px;background:#f0fdf4;border-left:4px solid #2e7d32;border-radius:0 8px 8px 0;">
                   <i data-lucide="check-circle" style="width:16px;height:16px;color:#2e7d32;flex-shrink:0;"></i>
                   <span style="font-size:13px;color:#1b5e20;font-weight:600;">Todo en orden — sin alertas activas.</span>
               </div>`;

        // ── Lista: últimas cotizaciones ───────────────────────────────────
        const cotizRows = (listas.ultimas_cotizaciones || []).map(c => `
            <tr style="border-bottom:1px solid #f7f3ee;" onmouseover="this.style.background='#fafaf8'" onmouseout="this.style.background=''">
                <td style="padding:8px 10px;font-size:12px;color:#aaa;">#${c.id}</td>
                <td style="padding:8px 10px;font-size:13px;font-weight:600;">${c.nombre_cliente}</td>
                <td style="padding:8px 10px;">${this._estadoBadgeCotiz(c.estado)}</td>
                <td style="padding:8px 10px;font-size:11px;color:#999;">${(c.fecha_creacion || '').slice(0,10)}</td>
            </tr>`).join('') || `<tr><td colspan="4" style="text-align:center;padding:20px;color:#bbb;font-size:13px;">Sin cotizaciones</td></tr>`;

        // ── Lista: últimas órdenes ────────────────────────────────────────
        const ordenRows = (listas.ultimas_ordenes || []).map(o => `
            <tr style="border-bottom:1px solid #f7f3ee;" onmouseover="this.style.background='#fafaf8'" onmouseout="this.style.background=''">
                <td style="padding:8px 10px;font-size:12px;color:#aaa;white-space:nowrap;">${o.codigo_orden}</td>
                <td style="padding:8px 10px;font-size:12px;max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${o.cliente}">${o.cliente_corto}</td>
                <td style="padding:8px 10px;">${this._estadoBadgeOrden(o.estado)}</td>
                <td style="padding:8px 10px;font-size:11px;color:#999;">${(o.fecha_creacion || '').slice(0,10)}</td>
            </tr>`).join('') || `<tr><td colspan="4" style="text-align:center;padding:20px;color:#bbb;font-size:13px;">Sin órdenes</td></tr>`;

        // ── Lista: facturas pendientes ─────────────────────────────────────
        const factRows = (listas.facturas_pendientes || []).map(f => {
            const venc = f.fecha_vencimiento || '';
            const vencida = venc && venc < new Date().toISOString().slice(0,10);
            return `
            <tr style="border-bottom:1px solid #f7f3ee;" onmouseover="this.style.background='#fafaf8'" onmouseout="this.style.background=''">
                <td style="padding:8px 10px;font-size:12px;color:#aaa;">${f.numero_factura || '—'}</td>
                <td style="padding:8px 10px;font-size:12px;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${f.cliente_nombre}">${f.cliente_nombre}</td>
                <td style="padding:8px 10px;font-size:13px;font-weight:700;color:#c62828;">${this._fmtMoney(f.total)}</td>
                <td style="padding:8px 10px;font-size:11px;${vencida ? 'color:#c62828;font-weight:700;' : 'color:#999;'}">${venc ? venc.slice(0,10) : '—'}</td>
            </tr>`;
        }).join('') || `<tr><td colspan="4" style="text-align:center;padding:20px;color:#bbb;font-size:13px;">Sin facturas pendientes</td></tr>`;

        // ── Render ────────────────────────────────────────────────────────
        container.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:20px;">

            <!-- Header -->
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
                <div>
                    <h2 style="font-family:var(--font-serif);font-size:22px;color:var(--color-moss-green);margin:0;">Dashboard Ejecutivo</h2>
                    <div style="font-size:12px;color:#aaa;margin-top:2px;">
                        Mes: ${periodo.mes?.desde || ''} → ${periodo.mes?.hasta || ''} &nbsp;·&nbsp;
                        IVU: ${periodo.ivu?.desde || ''} → ${periodo.ivu?.hasta || ''}
                    </div>
                </div>
                <button onclick="DashboardComponent.render('dashboard-container')"
                    class="btn btn-secondary" style="padding:7px 16px;font-size:12px;display:flex;align-items:center;gap:6px;">
                    <i data-lucide="refresh-cw" style="width:13px;height:13px;"></i> Actualizar
                </button>
            </div>

            <!-- KPI Grid: 2 cols en móvil, 5 en desktop -->
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px;">
                ${kpiHTML}
            </div>

            <!-- Alertas -->
            <div class="card" style="padding:16px;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#bbb;margin-bottom:10px;display:flex;align-items:center;gap:6px;">
                    <i data-lucide="bell" style="width:13px;height:13px;"></i> Alertas
                </div>
                ${alertasHTML}
            </div>

            <!-- Accesos Rápidos: catálogos -->
            <div class="card" style="padding:20px 20px 16px;background:linear-gradient(135deg,#f8faf3 0%,#f5f0e8 100%);border:1.5px solid #d8e8b8;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <div style="width:28px;height:28px;border-radius:8px;background:var(--color-moss-green);display:flex;align-items:center;justify-content:center;">
                            <i data-lucide="share-2" style="width:14px;height:14px;color:#fff;"></i>
                        </div>
                        <span style="font-size:14px;font-weight:700;color:#333;font-family:var(--font-primary);">Compartir Catálogos</span>
                    </div>
                    <span style="font-size:10px;color:#aaa;font-style:italic;">toca para copiar enlace</span>
                </div>

                <!-- Fila 1: Catálogo Público -->
                <div style="background:#fff;border-radius:12px;border:1px solid #e0eccc;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;cursor:pointer;"
                    onclick="(() => { const u = window.location.origin + '/catalogo_publico.html'; navigator.clipboard?.writeText(u).then(() => { const t = document.getElementById('dash-copy-toast'); t.textContent='✓ Enlace copiado'; t.style.display='block'; setTimeout(()=>t.style.display='none',2500); }).catch(() => alert(u)); })()">
                    <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#6f9a2e,#8ab83a);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <i data-lucide="shopping-bag" style="width:18px;height:18px;color:#fff;"></i>
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:13px;font-weight:700;color:#2d3a1f;">Catálogo Público</div>
                        <div style="font-size:11px;color:#8c8270;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${window.location.origin}/catalogo_publico.html</div>
                    </div>
                    <div style="display:flex;gap:6px;flex-shrink:0;">
                        <span style="font-size:10px;font-weight:600;background:#e8f5d0;color:#4a7a0f;padding:3px 8px;border-radius:20px;">Copiar</span>
                        <a href="${window.location.origin}/catalogo_publico.html" target="_blank" onclick="event.stopPropagation()"
                            style="font-size:10px;font-weight:600;background:#f5f5f5;color:#555;padding:3px 8px;border-radius:20px;text-decoration:none;">Abrir</a>
                    </div>
                </div>

                <!-- Fila 2: Catálogo B2B -->
                <div style="background:#fff;border-radius:12px;border:1px solid #dce6f8;padding:12px 14px;margin-bottom:8px;display:flex;align-items:center;gap:12px;cursor:pointer;"
                    onclick="(() => { const u = window.location.origin + '/catalogo_b2b.html'; navigator.clipboard?.writeText(u).then(() => { const t = document.getElementById('dash-copy-toast'); t.textContent='✓ Enlace copiado'; t.style.display='block'; setTimeout(()=>t.style.display='none',2500); }).catch(() => alert(u)); })()">
                    <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,#3a62a0,#4a7fc1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <i data-lucide="briefcase" style="width:18px;height:18px;color:#fff;"></i>
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:13px;font-weight:700;color:#1e2d4a;">Catálogo B2B</div>
                        <div style="font-size:11px;color:#8c8270;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${window.location.origin}/catalogo_b2b.html</div>
                    </div>
                    <div style="display:flex;gap:6px;flex-shrink:0;">
                        <span style="font-size:10px;font-weight:600;background:#dce6f8;color:#3a62a0;padding:3px 8px;border-radius:20px;">Copiar</span>
                        <button onclick="event.stopPropagation();window.location.hash='clientes'"
                            style="font-size:10px;font-weight:600;background:#f5f5f5;color:#555;padding:3px 8px;border-radius:20px;border:none;cursor:pointer;">Clientes</button>
                    </div>
                </div>

                <!-- Toast de confirmación -->
                <div id="dash-copy-toast" style="display:none;background:#2d3a1f;color:#fff;font-size:12px;font-weight:600;padding:8px 16px;border-radius:20px;text-align:center;margin-top:6px;">✓ Enlace copiado</div>
            </div>

            <!-- Listas recientes: 3 columnas -->
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">

                <!-- Últimas cotizaciones -->
                <div class="card" style="padding:0;overflow:hidden;">
                    <div style="padding:14px 16px 10px;display:flex;align-items:center;justify-content:space-between;">
                        <span style="font-size:13px;font-weight:700;color:#333;">Últimas Cotizaciones</span>
                        <button onclick="window.location.hash='cotizaciones'"
                            class="btn btn-secondary" style="padding:3px 10px;font-size:11px;">Ver todas</button>
                    </div>
                    <table style="width:100%;border-collapse:collapse;">
                        <tbody>${cotizRows}</tbody>
                    </table>
                </div>

                <!-- Últimas órdenes -->
                <div class="card" style="padding:0;overflow:hidden;">
                    <div style="padding:14px 16px 10px;display:flex;align-items:center;justify-content:space-between;">
                        <span style="font-size:13px;font-weight:700;color:#333;">Últimas Órdenes</span>
                        <button onclick="window.location.hash='produccion'"
                            class="btn btn-secondary" style="padding:3px 10px;font-size:11px;">Ver todas</button>
                    </div>
                    <table style="width:100%;border-collapse:collapse;">
                        <tbody>${ordenRows}</tbody>
                    </table>
                </div>

                <!-- Facturas pendientes -->
                <div class="card" style="padding:0;overflow:hidden;">
                    <div style="padding:14px 16px 10px;display:flex;align-items:center;justify-content:space-between;">
                        <span style="font-size:13px;font-weight:700;color:#333;">Facturas Pendientes</span>
                        <button onclick="window.location.hash='facturas'"
                            class="btn btn-secondary" style="padding:3px 10px;font-size:11px;">Ver todas</button>
                    </div>
                    <table style="width:100%;border-collapse:collapse;">
                        <tbody>${factRows}</tbody>
                    </table>
                </div>

            </div>
        </div>`;

        lucide.createIcons();
    }
};
