/**
 * CotizacionesComponent — Vista admin de cotizaciones recibidas.
 */
const CotizacionesComponent = {
    _filtroEstado: 'todas',
    _detalle: null,

    async render(containerId) {
        console.log('[Cotizaciones] render() start — containerId:', containerId);
        const container = document.getElementById(containerId);
        if (!container) { console.error('[Cotizaciones] ERROR: container not found:', containerId); return; }
        container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando cotizaciones…</p></div>`;
        console.log('[Cotizaciones] spinner set, calling _cargar...');
        await this._cargar(container);
    },

    async _cargar(container) {
        console.log('[Cotizaciones] _cargar() start');
        try {
            console.log('[Cotizaciones] calling EvergreenAPI.getCotizaciones()...');
            const res = await EvergreenAPI.getCotizaciones();
            console.log('[Cotizaciones] response received:', res);
            const todas = res.data || [];
            const totales = res.totales || {};
            console.log('[Cotizaciones] rendering vista with', todas.length, 'items');
            this._renderVista(container, todas, totales);
            console.log('[Cotizaciones] _renderVista() completed');
        } catch (e) {
            console.error('[Cotizaciones] error:', e);
            container.innerHTML = `<div class="card"><p style="color:var(--color-danger)">Error al cargar cotizaciones: ${e.message}</p></div>`;
        }
    },

    _estadoBadge(estado) {
        const map = {
            nueva:                  { color: '#2196f3', bg: '#e3f2fd', label: 'Nueva' },
            en_revision:            { color: '#ff9800', bg: '#fff3e0', label: 'En revisión' },
            cotizada:               { color: '#9c27b0', bg: '#f3e5f5', label: 'Cotizada' },
            aprobada:               { color: '#4caf50', bg: '#e8f5e9', label: 'Aprobada ✓' },
            rechazada:              { color: '#f44336', bg: '#ffebee', label: 'Rechazada' },
            borrador:               { color: '#78909c', bg: '#eceff1', label: 'Borrador' },
            enviada:                { color: '#0288d1', bg: '#e1f5fe', label: 'Enviada' },
            convertida_produccion:  { color: '#1565c0', bg: '#e8eaf6', label: '🔧 En Producción' },
            facturada:              { color: '#2e7d32', bg: '#e8f5e9', label: '🧾 Facturada' },
        };
        const s = map[estado] || { color: '#888', bg: '#f5f5f5', label: estado };
        return `<span style="background:${s.bg};color:${s.color};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;white-space:nowrap;">${s.label}</span>`;
    },

    _renderVista(container, todas, totales) {
        const filtro = this._filtroEstado;
        const lista = filtro === 'todas' ? todas : todas.filter(c => c.estado === filtro);

        const estadoCards = [
            { key: 'nueva',       label: 'Nuevas',       icon: 'inbox',     color: '#2196f3' },
            { key: 'en_revision', label: 'En Revisión',  icon: 'eye',       color: '#ff9800' },
            { key: 'cotizada',    label: 'Cotizadas',    icon: 'file-text', color: '#9c27b0' },
            { key: 'aprobada',    label: 'Aprobadas',    icon: 'check-circle', color: '#4caf50' },
            { key: 'rechazada',   label: 'Rechazadas',   icon: 'x-circle',  color: '#f44336' },
        ];

        container.dataset.view = 'lista';
        container.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:20px;">

            <!-- Tarjetas de estado -->
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px;">
                ${estadoCards.map(s => `
                <div class="card" style="padding:16px;cursor:pointer;border-left:4px solid ${s.color};transition:transform 0.15s;"
                     onclick="CotizacionesComponent._setFiltro('${s.key}',this)"
                     data-estado="${s.key}">
                    <div style="font-size:22px;font-weight:800;color:${s.color};">${totales[s.key] || 0}</div>
                    <div style="font-size:12px;color:#666;margin-top:2px;">${s.label}</div>
                </div>`).join('')}
            </div>

            <!-- Filtros de pestaña -->
            <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                <span style="font-size:12px;color:#888;margin-right:4px;">Filtrar:</span>
                ${[['todas','Todas'],['nueva','Nuevas'],['en_revision','En revisión'],['cotizada','Cotizadas'],['aprobada','Aprobadas'],['rechazada','Rechazadas']].map(([k,l]) => `
                <button onclick="CotizacionesComponent._setFiltro('${k}')" data-ftab="${k}"
                    style="padding:5px 14px;border-radius:20px;border:1.5px solid ${filtro===k?'var(--color-moss-green)':'#ddd'};
                           background:${filtro===k?'var(--color-moss-green)':'transparent'};
                           color:${filtro===k?'white':'#555'};font-size:12px;font-weight:600;cursor:pointer;">${l}</button>
                `).join('')}
                <button onclick="CotizacionesComponent.render('cotizaciones-container')"
                    style="margin-left:auto;padding:5px 12px;border-radius:20px;border:1.5px solid #ddd;background:transparent;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:5px;">
                    <i data-lucide="refresh-cw" style="width:12px;height:12px;"></i> Actualizar
                </button>
            </div>

            <!-- Tabla -->
            <div class="card" style="overflow:auto;">
                ${lista.length === 0 ? `
                <div style="text-align:center;padding:48px;color:#aaa;">
                    <i data-lucide="inbox" style="width:40px;height:40px;display:block;margin:0 auto 12px;color:#ddd;"></i>
                    No hay cotizaciones ${filtro === 'todas' ? '' : 'con este estado'} aún.
                </div>` : `
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead>
                        <tr style="border-bottom:2px solid #f0ece4;text-align:left;">
                            <th style="padding:10px 14px;color:#666;font-weight:600;white-space:nowrap;">#</th>
                            <th style="padding:10px 14px;color:#666;font-weight:600;">Fecha</th>
                            <th style="padding:10px 14px;color:#666;font-weight:600;">Cliente</th>
                            <th style="padding:10px 14px;color:#666;font-weight:600;">Producto</th>
                            <th style="padding:10px 14px;color:#666;font-weight:600;">Fuente</th>
                            <th style="padding:10px 14px;color:#666;font-weight:600;">Imgs</th>
                            <th style="padding:10px 14px;color:#666;font-weight:600;">Estado</th>
                            <th style="padding:10px 14px;color:#666;font-weight:600;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${lista.map(c => `
                        <tr style="border-bottom:1px solid #f7f3ee;transition:background 0.1s;" onmouseover="this.style.background='#fafaf8'" onmouseout="this.style.background=''">
                            <td style="padding:10px 14px;color:#aaa;font-size:11px;">#${c.id}</td>
                            <td style="padding:10px 14px;white-space:nowrap;">${(c.fecha_creacion||'').slice(0,16)}</td>
                            <td style="padding:10px 14px;">
                                <div style="font-weight:600;">${c.nombre_cliente}</div>
                                <div style="font-size:11px;color:#888;">${c.email}</div>
                            </td>
                            <td style="padding:10px 14px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                                ${c.producto_nombre || '<span style="color:#bbb;font-style:italic;">Sin producto</span>'}
                            </td>
                            <td style="padding:10px 14px;">
                                <span style="font-size:11px;background:${c.fuente==='b2b'?'#e8f5e9':'#f3e5f5'};color:${c.fuente==='b2b'?'#388e3c':'#7b1fa2'};padding:2px 8px;border-radius:10px;font-weight:600;">
                                    ${c.fuente === 'b2b' ? 'B2B' : 'Público'}
                                </span>
                            </td>
                            <td style="padding:10px 14px;text-align:center;color:${c.total_imagenes>0?'#5f7830':'#bbb'};">
                                ${c.total_imagenes > 0 ? `📎 ${c.total_imagenes}` : '—'}
                            </td>
                            <td style="padding:10px 14px;">${this._estadoBadge(c.estado)}</td>
                            <td style="padding:10px 14px;white-space:nowrap;">
                                <button onclick="CotizacionesComponent.abrirDetalle(${c.id})"
                                    class="btn btn-secondary" style="padding:5px 10px;font-size:11px;"
                                    title="Ver detalle">
                                    <i data-lucide="eye" style="width:12px;height:12px;"></i>
                                </button>
                                <button onclick="CotizacionesComponent._abrirModalEdicionDesdeTabla(${c.id})"
                                    class="btn btn-secondary" style="padding:5px 10px;font-size:11px;margin-left:4px;"
                                    title="Editar">
                                    <i data-lucide="pencil" style="width:12px;height:12px;"></i>
                                </button>
                                <button onclick="CotizacionesComponent._borrarCotizacion(${c.id}, ${c.orden_produccion_id || 'null'})"
                                    class="btn" style="padding:5px 10px;font-size:11px;margin-left:4px;background:#fee2e2;border:1px solid #fca5a5;color:#b91c1c;border-radius:6px;cursor:pointer;"
                                    title="Eliminar">
                                    <i data-lucide="trash-2" style="width:12px;height:12px;"></i>
                                </button>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>`}
            </div>
        </div>`;

        lucide.createIcons();
    },

    _setFiltro(estado) {
        this._filtroEstado = estado;
        const container = document.getElementById('cotizaciones-container');
        if (container) this.render('cotizaciones-container');
    },

    async abrirDetalle(id) {
        const container = document.getElementById('cotizaciones-container');
        container.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Cargando detalle…</p></div>`;
        try {
            const res = await EvergreenAPI.getDetalleCotizacion(id);
            this._detalle = res.data;
            this._renderDetalle(container, res.data);
        } catch (e) {
            container.innerHTML = `<div class="card"><p style="color:var(--color-danger)">Error: ${e.message}</p></div>`;
        }
    },

    _renderDetalle(container, c) {
        const imagenes = c.imagenes || [];
        const estados = ['nueva','en_revision','cotizada','aprobada','rechazada','borrador','enviada','convertida_produccion','facturada'];
        const etiquetas = {
            nueva:'Nueva', en_revision:'En revisión', cotizada:'Cotizada',
            aprobada:'Aprobada', rechazada:'Rechazada',
            borrador:'Borrador', enviada:'Enviada',
            convertida_produccion:'En Producción', facturada:'Facturada',
        };

        container.dataset.view = 'detalle';
        container.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:16px;">
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
                <button onclick="CotizacionesComponent.render('cotizaciones-container')"
                    class="btn btn-secondary" style="padding:6px 14px;font-size:13px;display:flex;align-items:center;gap:6px;">
                    <i data-lucide="arrow-left" style="width:14px;height:14px;"></i> Volver
                </button>
                <h3 style="margin:0;font-size:17px;">Cotización #${c.id}</h3>
                ${this._estadoBadge(c.estado)}
                <button onclick="CotizacionesComponent._abrirModalEdicion(${c.id})"
                    class="btn btn-secondary" style="padding:6px 14px;font-size:13px;display:flex;align-items:center;gap:6px;margin-left:auto;">
                    <i data-lucide="pencil" style="width:13px;height:13px;"></i> Editar Cotización
                </button>
                <span style="font-size:12px;color:#aaa;">${(c.fecha_creacion||'').slice(0,16)}</span>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                <!-- Info cliente -->
                <div class="card" style="padding:20px;">
                    <h4 style="font-size:13px;font-weight:700;color:var(--color-moss-green);margin:0 0 14px;display:flex;align-items:center;gap:6px;">
                        <i data-lucide="user" style="width:14px;height:14px;"></i> Datos del Cliente
                    </h4>
                    <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;">
                        <div><span style="color:#888;">Nombre:</span> <strong>${c.nombre_cliente}</strong></div>
                        <div><span style="color:#888;">Email:</span> <a href="mailto:${c.email}" style="color:var(--color-moss-green);">${c.email}</a></div>
                        ${c.telefono ? `<div><span style="color:#888;">Teléfono:</span> ${c.telefono}</div>` : ''}
                        ${c.presupuesto_aprox ? `<div><span style="color:#888;">Presupuesto:</span> $${parseFloat(c.presupuesto_aprox).toFixed(2)}</div>` : ''}
                        ${c.tipo_evento ? `<div><span style="color:#888;">Evento:</span> <span style="background:#f0f7e6;color:#5f7830;padding:2px 9px;border-radius:10px;font-size:11px;font-weight:600;">🎉 ${c.tipo_evento}</span></div>` : ''}
                        <div><span style="color:#888;">Fuente:</span>
                            <span style="font-size:11px;background:${c.fuente==='b2b'?'#e8f5e9':'#f3e5f5'};color:${c.fuente==='b2b'?'#388e3c':'#7b1fa2'};padding:2px 8px;border-radius:10px;font-weight:600;margin-left:4px;">
                                ${c.fuente === 'b2b' ? 'B2B' : 'Público'}
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Producto + Estado -->
                <div class="card" style="padding:20px;">
                    <h4 style="font-size:13px;font-weight:700;color:var(--color-moss-green);margin:0 0 14px;display:flex;align-items:center;gap:6px;">
                        <i data-lucide="package" style="width:14px;height:14px;"></i> Producto & Estado
                    </h4>
                    <div style="display:flex;flex-direction:column;gap:10px;font-size:13px;">
                        ${c.producto_nombre
                            ? `<div><span style="color:#888;">Producto:</span> <strong>${c.producto_nombre}</strong><br>
                               <span style="font-size:11px;color:#aaa;">SKU: ${c.producto_sku||'—'}</span></div>`
                            : `<div style="color:#aaa;font-style:italic;">Sin producto específico</div>`}
                        <div>
                            <label style="font-size:12px;font-weight:600;color:#444;display:block;margin-bottom:5px;">Cambiar estado:</label>
                            <select id="cotiz-estado-select" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid #ddd;font-size:13px;font-family:var(--font-primary);">
                                ${estados.map(s => `<option value="${s}" ${c.estado===s?'selected':''}>${etiquetas[s]}</option>`).join('')}
                            </select>
                            <button id="btn-guardar-estado" onclick="CotizacionesComponent._guardarEstado(${c.id})"
                                class="btn btn-primary" style="width:100%;margin-top:8px;padding:8px;font-size:12px;">
                                Guardar Estado
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Personalización del cliente (se carga async abajo) -->
            <div id="cotiz-personal-wrap" style="display:none;" class="card" style="padding:20px;border:2px solid #c5d9a8;">
                <h4 style="font-size:13px;font-weight:700;color:var(--color-moss-green);margin:0 0 14px;display:flex;align-items:center;gap:6px;padding:20px 20px 0;">
                    <i data-lucide="sparkles" style="width:14px;height:14px;"></i> Personalización del Cliente
                </h4>
                <div id="cotiz-personal-inner" style="padding:0 20px 20px;display:flex;flex-direction:column;gap:8px;"></div>
            </div>

            <!-- Descripción -->
            <div class="card" style="padding:20px;">
                <h4 style="font-size:13px;font-weight:700;color:var(--color-moss-green);margin:0 0 10px;display:flex;align-items:center;gap:6px;">
                    <i data-lucide="align-left" style="width:14px;height:14px;"></i> Descripción / Notas Adicionales
                </h4>
                ${c.descripcion ? `<p style="font-size:13px;color:#333;line-height:1.7;margin:0;white-space:pre-wrap;">${c.descripcion}</p>` : `<p style="font-size:13px;color:#aaa;font-style:italic;margin:0;">Sin descripción adicional.</p>`}
            </div>

            <!-- Notas internas -->
            <div class="card" style="padding:20px;">
                <h4 style="font-size:13px;font-weight:700;color:var(--color-moss-green);margin:0 0 10px;display:flex;align-items:center;gap:6px;">
                    <i data-lucide="lock" style="width:14px;height:14px;"></i> Notas Internas
                </h4>
                <textarea id="cotiz-notas-input" style="width:100%;min-height:80px;padding:10px;border:1px solid #e0d9ce;border-radius:8px;font-size:13px;font-family:var(--font-primary);resize:vertical;box-sizing:border-box;"
                    placeholder="Notas solo visibles para el admin…">${c.notas_internas || ''}</textarea>
                <button onclick="CotizacionesComponent._guardarNotas(${c.id})"
                    class="btn btn-secondary" style="margin-top:8px;padding:7px 16px;font-size:12px;">
                    Guardar Notas
                </button>
                <span id="cotiz-notas-ok" style="display:none;font-size:11px;color:#5f7830;margin-left:10px;">✓ Guardado</span>
            </div>

            <!-- Imágenes -->
            ${imagenes.length > 0 ? `
            <div class="card" style="padding:20px;">
                <h4 style="font-size:13px;font-weight:700;color:var(--color-moss-green);margin:0 0 14px;display:flex;align-items:center;gap:6px;">
                    <i data-lucide="image" style="width:14px;height:14px;"></i> Imágenes de Referencia (${imagenes.length})
                </h4>
                <div style="display:flex;flex-wrap:wrap;gap:12px;">
                    ${imagenes.map(img => {
                        const url = window.location.origin + img.ruta_publica;
                        if (img.es_pdf) {
                            return `<a href="${url}" target="_blank"
                                style="display:flex;align-items:center;gap:8px;padding:10px 16px;background:#fff5f5;border:1.5px solid #ffcdd2;border-radius:10px;text-decoration:none;color:#c62828;font-size:12px;font-weight:600;">
                                <i data-lucide="file-text" style="width:16px;height:16px;"></i> ${img.nombre_archivo}
                            </a>`;
                        }
                        return `<a href="${url}" target="_blank" title="Ver imagen completa">
                            <img src="${url}" alt="${img.nombre_archivo}"
                                style="width:100px;height:100px;object-fit:cover;border-radius:10px;border:2px solid #f0ece4;transition:transform 0.15s;"
                                onmouseover="this.style.transform='scale(1.06)'" onmouseout="this.style.transform=''"
                                onerror="this.parentElement.innerHTML='<span style=\\'color:#aaa;font-size:11px;\\'>Sin vista</span>'">
                        </a>`;
                    }).join('')}
                </div>
            </div>` : ''}

            <!-- Card Estimación de Precio -->
            <div class="card" style="padding:20px;border-left:4px solid ${c.precio_estimado ? '#5f7830' : '#e8a44a'};">
                <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:${c.precio_estimado ? '14px' : '0'};">
                    <h4 style="font-size:13px;font-weight:700;color:${c.precio_estimado ? '#5f7830' : '#b07d2e'};margin:0;display:flex;align-items:center;gap:6px;">
                        <i data-lucide="${c.precio_estimado ? 'badge-dollar-sign' : 'calculator'}" style="width:14px;height:14px;"></i>
                        ${c.precio_estimado ? 'Estimación de Precio' : 'Sin estimación aún'}
                    </h4>
                    <button onclick="CotizacionesComponent._abrirModalEstimacion(${c.id})"
                        class="btn btn-primary" style="padding:6px 14px;font-size:12px;display:flex;align-items:center;gap:5px;background:#5f7830;border-color:#4a5e24;">
                        <i data-lucide="${c.precio_estimado ? 'pencil' : 'calculator'}" style="width:13px;height:13px;"></i>
                        ${c.precio_estimado ? 'Editar estimación' : 'Estimar Precio'}
                    </button>
                </div>
                ${c.precio_estimado ? `
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:${c.notas_estimacion ? '12px' : '0'};">
                    <div style="background:#f8faf3;border-radius:8px;padding:10px 14px;border:1px solid #d4e6a0;">
                        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#888;letter-spacing:0.5px;">Costo estimado</div>
                        <div style="font-size:18px;font-weight:800;color:#333;margin-top:3px;">$${parseFloat(c.costo_estimado).toFixed(2)}</div>
                    </div>
                    <div style="background:#f8faf3;border-radius:8px;padding:10px 14px;border:1px solid #d4e6a0;">
                        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#888;letter-spacing:0.5px;">Precio sugerido</div>
                        <div style="font-size:18px;font-weight:800;color:var(--color-moss-green);margin-top:3px;">$${parseFloat(c.precio_estimado).toFixed(2)}</div>
                    </div>
                    <div style="background:#f8faf3;border-radius:8px;padding:10px 14px;border:1px solid #d4e6a0;">
                        <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:#888;letter-spacing:0.5px;">Margen objetivo</div>
                        <div style="font-size:18px;font-weight:800;color:#5f7830;margin-top:3px;">${Math.round((c.margen_estimado||0)*100)}%</div>
                    </div>
                </div>
                ${c.notas_estimacion ? `<div style="font-size:12px;color:#666;background:#f5f7f0;border-radius:6px;padding:8px 12px;font-style:italic;">${c.notas_estimacion}</div>` : ''}
                ` : ''}
            </div>

            <!-- Panel de Acciones: Aprobar / Producción / Factura -->
            <div class="card" id="cotiz-acciones-panel" style="padding:20px;border-left:4px solid #5f7830;">
                <h4 style="font-size:13px;font-weight:700;color:#5f7830;margin:0 0 14px;display:flex;align-items:center;gap:6px;">
                    <i data-lucide="zap" style="width:14px;height:14px;"></i> Acciones
                </h4>

                <!-- Links a recursos ya creados -->
                <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:${['aprobada','convertida_produccion','facturada'].includes(c.estado) ? '14px' : '0'};" id="cotiz-recursos-creados">
                    ${c.orden_produccion_id ? `
                    <a href="#" onclick="event.preventDefault();AppRouter.navigate('produccion')" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:#e8eaf6;color:#1565c0;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;">
                        🔧 Ver Orden de Producción
                    </a>` : ''}
                    ${c.estado === 'facturada' ? `
                    <a href="#" onclick="event.preventDefault();AppRouter.navigate('facturas')" style="display:inline-flex;align-items:center;gap:6px;padding:6px 14px;background:#e8f5e9;color:#2e7d32;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;">
                        🧾 Ver Factura
                    </a>` : ''}
                </div>

                <!-- Botones de acción según estado -->
                <div style="display:flex;gap:10px;flex-wrap:wrap;" id="cotiz-btn-acciones">
                    ${!['aprobada','convertida_produccion','facturada'].includes(c.estado) ? `
                    <button id="btn-cotiz-aprobar" onclick="CotizacionesComponent._aprobar(${c.id})"
                        style="padding:9px 20px;background:#4caf50;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:7px;">
                        <i data-lucide="check-circle" style="width:15px;height:15px;"></i> Aprobar Cotización
                    </button>` : ''}

                    ${c.estado === 'aprobada' ? `
                    <button id="btn-cotiz-prod" onclick="CotizacionesComponent._crearProduccion(${c.id})"
                        style="padding:9px 20px;background:#1565c0;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:7px;">
                        <i data-lucide="wrench" style="width:15px;height:15px;"></i> Crear Producción
                    </button>
                    <button id="btn-cotiz-fac" onclick="CotizacionesComponent._crearFactura(${c.id})"
                        style="padding:9px 20px;background:#2e7d32;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:7px;">
                        <i data-lucide="file-text" style="width:15px;height:15px;"></i> Crear Factura
                    </button>
                    <button id="btn-cotiz-ambos" onclick="CotizacionesComponent._crearAmbos(${c.id})"
                        style="padding:9px 20px;background:#5f7830;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:7px;">
                        <i data-lucide="layers" style="width:15px;height:15px;"></i> Crear Producción + Factura
                    </button>` : ''}

                    ${c.estado === 'convertida_produccion' ? `
                    <button id="btn-cotiz-fac" onclick="CotizacionesComponent._crearFactura(${c.id})"
                        style="padding:9px 20px;background:#2e7d32;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:7px;">
                        <i data-lucide="file-text" style="width:15px;height:15px;"></i> Crear Factura
                    </button>` : ''}

                    ${c.estado === 'facturada' ? `
                    <span style="font-size:13px;color:#2e7d32;font-weight:600;">✓ Cotización completamente procesada</span>` : ''}
                </div>

                <div id="cotiz-accion-msg" style="margin-top:10px;font-size:12.5px;display:none;padding:8px 14px;border-radius:8px;"></div>
            </div>
        </div>`;

        lucide.createIcons();

        // Cargar respuestas de personalización de forma asíncrona
        (async () => {
            try {
                const pRes = await EvergreenAPI.getPersonalizacionCotizacion(c.id);
                const respuestas = pRes.data || [];
                if (respuestas.length === 0) return;
                const wrap = document.getElementById('cotiz-personal-wrap');
                const inner = document.getElementById('cotiz-personal-inner');
                if (!wrap || !inner) return;
                inner.innerHTML = respuestas.map(r => {
                    const isArchivo = r.tipo === 'archivo' && r.archivo_ruta;
                    const valorHtml = isArchivo
                        ? `<a href="${r.archivo_ruta}" target="_blank" style="color:var(--color-moss-green);font-weight:600;text-decoration:none;">📎 Ver archivo adjunto</a>`
                        : `<span style="color:#222;font-weight:600;">${r.valor || '—'}</span>`;
                    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;background:#f6faf0;border-radius:8px;font-size:13px;">
                        <span style="color:#666;">${r.etiqueta}</span>
                        ${valorHtml}
                    </div>`;
                }).join('');
                wrap.style.display = 'block';
                lucide.createIcons();
            } catch (_) {}
        })();
    },

    async _guardarEstado(id) {
        const select = document.getElementById('cotiz-estado-select');
        const btn = document.getElementById('btn-guardar-estado');
        if (!select || !btn) return;
        const estado = select.value;
        btn.disabled = true;
        btn.textContent = '…';
        try {
            await EvergreenAPI.actualizarEstadoCotizacion(id, estado);
            const container = document.getElementById('cotizaciones-container');
            await this.abrirDetalle(id);
        } catch (e) {
            alert('Error al guardar estado: ' + e.message);
            btn.disabled = false;
            btn.textContent = 'Guardar Estado';
        }
    },

    _accionMsg(msg, isError = false) {
        const el = document.getElementById('cotiz-accion-msg');
        if (!el) return;
        el.textContent = msg;
        el.style.display = 'block';
        el.style.background = isError ? '#fff5f5' : '#f1f8e9';
        el.style.color = isError ? '#c0392b' : '#2e7d32';
        el.style.border = `1px solid ${isError ? '#ffd0cc' : '#c8e6c9'}`;
    },

    _setBtnsLoading(label) {
        ['btn-cotiz-aprobar','btn-cotiz-prod','btn-cotiz-fac','btn-cotiz-ambos'].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.disabled = true; el.style.opacity = '0.6'; }
        });
        this._accionMsg(`⏳ ${label}`);
    },

    async _aprobar(id) {
        if (!confirm('¿Marcar esta cotización como Aprobada?')) return;
        this._setBtnsLoading('Aprobando…');
        try {
            await EvergreenAPI.aprobarCotizacion(id);
            await this.abrirDetalle(id);
        } catch (e) { this._accionMsg('Error: ' + e.message, true); }
    },

    async _crearProduccion(id) {
        if (!confirm('¿Crear orden de producción desde esta cotización?\n\nSe creará en estado "En diseño".')) return;
        this._setBtnsLoading('Creando orden de producción…');
        try {
            const res = await EvergreenAPI.crearProduccionDesdeCotizacion(id);
            await this.abrirDetalle(id);
            this._accionMsg(`✓ Orden ${res.codigo_orden} creada en Producción Láser.`);
        } catch (e) { this._accionMsg('Error: ' + e.message, true); }
    },

    async _crearFactura(id) {
        if (!confirm('¿Crear factura desde esta cotización?\n\nSe generará con el precio estimado. Puedes editarla luego en Facturación.')) return;
        this._setBtnsLoading('Creando factura…');
        try {
            const res = await EvergreenAPI.crearFacturaDesdeCotizacion(id);
            await this.abrirDetalle(id);
            this._accionMsg(`✓ Factura ${res.numero_factura} creada en Facturación.`);
        } catch (e) { this._accionMsg('Error: ' + e.message, true); }
    },

    async _crearAmbos(id) {
        if (!confirm('¿Crear orden de producción Y factura desde esta cotización?\n\nAmbos documentos se vincularán entre sí.')) return;
        this._setBtnsLoading('Creando producción y factura…');
        try {
            const res = await EvergreenAPI.crearProduccionYFactura(id);
            await this.abrirDetalle(id);
            this._accionMsg(`✓ Orden ${res.codigo_orden} + Factura ${res.numero_factura} creadas.`);
        } catch (e) { this._accionMsg('Error: ' + e.message, true); }
    },

    async _enviarAProduccion(id, btn) {
        // Compatibilidad con referencias antiguas
        await this._crearProduccion(id);
    },

    async _abrirModalEdicionDesdeTabla(cotizacionId) {
        // Carga el detalle completo antes de abrir el modal
        try {
            const res = await EvergreenAPI.getDetalleCotizacion(cotizacionId);
            this._detalle = res.data;
        } catch (e) {
            alert('Error al cargar cotización: ' + e.message);
            return;
        }
        this._abrirModalEdicion(cotizacionId);
    },

    async _borrarCotizacion(cotizacionId, ordenProduccionId) {
        if (ordenProduccionId) {
            alert('No se puede borrar una cotización ya enviada a producción.');
            return;
        }
        if (!confirm('¿Seguro que deseas eliminar esta cotización?\n\nEsta acción no se puede deshacer.')) return;
        try {
            await EvergreenAPI.eliminarCotizacion(cotizacionId);
            await this.render('cotizaciones-container');
        } catch (e) {
            alert('Error al eliminar: ' + e.message);
        }
    },

    _abrirModalEdicion(cotizacionId) {
        const c = this._detalle || {};
        const estados = ['nueva','en_revision','cotizada','aprobada','rechazada'];
        const etiquetas = { nueva:'Nueva', en_revision:'En revisión', cotizada:'Cotizada', aprobada:'Aprobada', rechazada:'Rechazada' };

        const existing = document.getElementById('cotiz-editar-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'cotiz-editar-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;';

        overlay.innerHTML = `
        <div style="background:white;border-radius:14px;padding:28px;max-width:640px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.25);">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
                <h3 style="margin:0;font-size:16px;font-weight:700;">Editar Cotización #${cotizacionId}</h3>
                <button onclick="document.getElementById('cotiz-editar-overlay').remove()"
                    style="background:none;border:none;font-size:20px;cursor:pointer;color:#888;line-height:1;">✕</button>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div>
                    <label style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.4px;">Nombre cliente</label>
                    <input id="edit-nombre" type="text" value="${c.nombre_cliente || ''}"
                        style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #ddd;border-radius:7px;font-size:13px;font-family:var(--font-primary);box-sizing:border-box;">
                </div>
                <div>
                    <label style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.4px;">Email</label>
                    <input id="edit-email" type="email" value="${c.email || ''}"
                        style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #ddd;border-radius:7px;font-size:13px;font-family:var(--font-primary);box-sizing:border-box;">
                </div>
                <div>
                    <label style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.4px;">Teléfono</label>
                    <input id="edit-telefono" type="text" value="${c.telefono || ''}"
                        style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #ddd;border-radius:7px;font-size:13px;font-family:var(--font-primary);box-sizing:border-box;">
                </div>
                <div>
                    <label style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.4px;">Presupuesto aprox.</label>
                    <input id="edit-presupuesto" type="number" step="0.01" value="${c.presupuesto_aprox || ''}"
                        style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #ddd;border-radius:7px;font-size:13px;font-family:var(--font-primary);box-sizing:border-box;">
                </div>
                <div>
                    <label style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.4px;">Estado</label>
                    <select id="edit-estado" style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #ddd;border-radius:7px;font-size:13px;font-family:var(--font-primary);box-sizing:border-box;">
                        ${estados.map(s => `<option value="${s}" ${c.estado===s?'selected':''}>${etiquetas[s]}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.4px;">Costo estimado ($)</label>
                    <input id="edit-costo" type="number" step="0.01" value="${c.costo_estimado || ''}"
                        style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #ddd;border-radius:7px;font-size:13px;font-family:var(--font-primary);box-sizing:border-box;">
                </div>
                <div>
                    <label style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.4px;">Precio estimado ($)</label>
                    <input id="edit-precio" type="number" step="0.01" value="${c.precio_estimado || ''}"
                        style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #ddd;border-radius:7px;font-size:13px;font-family:var(--font-primary);box-sizing:border-box;">
                </div>
                <div>
                    <label style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.4px;">Margen objetivo (%)</label>
                    <input id="edit-margen" type="number" step="1" min="0" max="100" value="${c.margen_estimado != null ? Math.round(c.margen_estimado * 100) : ''}"
                        style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #ddd;border-radius:7px;font-size:13px;font-family:var(--font-primary);box-sizing:border-box;">
                </div>
            </div>

            <div style="margin-top:12px;">
                <label style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.4px;">Descripción del proyecto</label>
                <textarea id="edit-descripcion" rows="3"
                    style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #ddd;border-radius:7px;font-size:13px;font-family:var(--font-primary);resize:vertical;box-sizing:border-box;">${c.descripcion || ''}</textarea>
            </div>
            <div style="margin-top:12px;">
                <label style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.4px;">Notas internas</label>
                <textarea id="edit-notas-internas" rows="2"
                    style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #ddd;border-radius:7px;font-size:13px;font-family:var(--font-primary);resize:vertical;box-sizing:border-box;">${c.notas_internas || ''}</textarea>
            </div>
            <div style="margin-top:12px;">
                <label style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;letter-spacing:0.4px;">Notas de estimación</label>
                <textarea id="edit-notas-estimacion" rows="2"
                    style="width:100%;margin-top:4px;padding:8px 10px;border:1px solid #ddd;border-radius:7px;font-size:13px;font-family:var(--font-primary);resize:vertical;box-sizing:border-box;">${c.notas_estimacion || ''}</textarea>
            </div>

            <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:20px;">
                <button onclick="document.getElementById('cotiz-editar-overlay').remove()"
                    class="btn btn-secondary" style="padding:9px 20px;font-size:13px;">Cancelar</button>
                <button id="btn-guardar-edicion" onclick="CotizacionesComponent._guardarEdicion(${cotizacionId})"
                    class="btn btn-primary" style="padding:9px 22px;font-size:13px;background:#5f7830;border-color:#4a5e24;">
                    <i data-lucide="save" style="width:13px;height:13px;"></i> Guardar Cambios
                </button>
            </div>
        </div>`;

        document.body.appendChild(overlay);
        lucide.createIcons();
    },

    async _guardarEdicion(cotizacionId) {
        const btn = document.getElementById('btn-guardar-edicion');
        if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

        const margenRaw = parseFloat(document.getElementById('edit-margen')?.value);
        const costoRaw  = parseFloat(document.getElementById('edit-costo')?.value);
        const precioRaw = parseFloat(document.getElementById('edit-precio')?.value);
        const presupRaw = parseFloat(document.getElementById('edit-presupuesto')?.value);

        const data = {
            nombre_cliente:   document.getElementById('edit-nombre')?.value.trim() || null,
            email:            document.getElementById('edit-email')?.value.trim() || null,
            telefono:         document.getElementById('edit-telefono')?.value.trim() || null,
            descripcion:      document.getElementById('edit-descripcion')?.value.trim() || null,
            presupuesto_aprox: isNaN(presupRaw) ? null : presupRaw,
            estado:           document.getElementById('edit-estado')?.value || null,
            notas_internas:   document.getElementById('edit-notas-internas')?.value.trim() || null,
            costo_estimado:   isNaN(costoRaw)  ? null : costoRaw,
            precio_estimado:  isNaN(precioRaw) ? null : precioRaw,
            margen_estimado:  isNaN(margenRaw) ? null : margenRaw / 100,
            notas_estimacion: document.getElementById('edit-notas-estimacion')?.value.trim() || null,
        };

        // Limpiar nulos para que el backend no sobreescriba campos no editados
        Object.keys(data).forEach(k => { if (data[k] === null || data[k] === '') delete data[k]; });

        try {
            await EvergreenAPI.editarCotizacion(cotizacionId, data);
            document.getElementById('cotiz-editar-overlay')?.remove();
            const container = document.getElementById('cotizaciones-container');
            if (container && container.dataset.view === 'detalle') {
                await this.abrirDetalle(cotizacionId);
            } else {
                await this.render('cotizaciones-container');
            }
        } catch (e) {
            alert('Error al guardar: ' + e.message);
            if (btn) { btn.disabled = false; btn.textContent = 'Guardar Cambios'; }
        }
    },

    async _abrirModalEstimacion(cotizacionId) {
        // Cargar tarifas globales y datos actuales
        let tarifas = { tarifa_hora_laser: 15.0, tarifa_hora_labor: 18.0 };
        try {
            const cfgRes = await EvergreenAPI.getConfiguracion();
            if (cfgRes.data) tarifas = cfgRes.data;
        } catch(e) { /* usar defaults */ }
        this._tarifasEstimacion = tarifas;

        const c = this._detalle || {};
        const prev = {
            tipo: 'llavero',
            complejidad: 'simple',
            capas: 1,
            corte: 1.5,
            grabado: 1.0,
            pintura: 0,
            ensamblaje: 0,
            materiales: parseFloat(c.presupuesto_aprox || 0),
            ajuste: 0,
            margen: 60,
            notas: c.notas_estimacion || '',
        };

        // Overlay modal
        let overlay = document.getElementById('cotiz-estimar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'cotiz-estimar-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:9000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:40px 16px;';
            document.body.appendChild(overlay);
        }

        const _row = (label, id, value, step='0.1', min='0', extra='') =>
            `<div style="display:flex;flex-direction:column;gap:3px;">
                <label style="font-size:12px;font-weight:600;color:#555;">${label}</label>
                <input type="number" id="${id}" value="${value}" step="${step}" min="${min}" ${extra}
                    oninput="CostosComponent && CotizacionesComponent._recalcular('${cotizacionId}')"
                    style="padding:8px 10px;border-radius:6px;border:1px solid #ddd;font-family:var(--font-primary);font-size:13px;">
            </div>`;

        overlay.innerHTML = `
        <div style="background:white;border-radius:14px;width:100%;max-width:640px;box-shadow:0 20px 60px rgba(0,0,0,0.2);overflow:hidden;">
            <!-- Header -->
            <div style="background:#f7f3ee;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #ede8df;">
                <strong style="font-size:15px;color:var(--color-moss-green);display:flex;align-items:center;gap:7px;">
                    <i data-lucide="calculator" style="width:16px;height:16px;"></i> Estimar Precio — Cotización #${cotizacionId}
                </strong>
                <button onclick="document.getElementById('cotiz-estimar-overlay').remove()"
                    style="background:none;border:none;font-size:20px;cursor:pointer;color:#999;line-height:1;">&times;</button>
            </div>

            <div style="padding:20px;display:flex;flex-direction:column;gap:16px;">

                <!-- Tipo y complejidad -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div style="display:flex;flex-direction:column;gap:3px;">
                        <label style="font-size:12px;font-weight:600;color:#555;">Tipo de Producto</label>
                        <select id="est-tipo" oninput="CotizacionesComponent._recalcular('${cotizacionId}')"
                            style="padding:8px 10px;border-radius:6px;border:1px solid #ddd;font-family:var(--font-primary);font-size:13px;">
                            <option value="llavero">Llavero</option>
                            <option value="garita">Garita</option>
                            <option value="shadow_box">Shadow Box</option>
                            <option value="ornamento">Ornamento</option>
                            <option value="portada_libreta">Portada de Libreta</option>
                            <option value="personalizado">Personalizado</option>
                            <option value="otro">Otro</option>
                        </select>
                    </div>
                    <div style="display:flex;flex-direction:column;gap:3px;">
                        <label style="font-size:12px;font-weight:600;color:#555;">Complejidad <span style="color:#aaa;font-weight:400;">(×1.0 / ×1.3 / ×1.6)</span></label>
                        <select id="est-complejidad" oninput="CotizacionesComponent._recalcular('${cotizacionId}')"
                            style="padding:8px 10px;border-radius:6px;border:1px solid #ddd;font-family:var(--font-primary);font-size:13px;">
                            <option value="simple">Simple (×1.0)</option>
                            <option value="media">Media (×1.3)</option>
                            <option value="compleja">Compleja (×1.6)</option>
                        </select>
                    </div>
                </div>

                <!-- Tiempos láser -->
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    ${_row('Tiempo Corte Láser (min)', 'est-corte', prev.corte)}
                    ${_row('Tiempo Grabado Láser (min)', 'est-grabado', prev.grabado)}
                </div>

                <!-- Pintura -->
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
                    ${_row('Tiempo Pintura / Capa (min)', 'est-pintura', prev.pintura)}
                    ${_row('Capas de Pintura', 'est-capas', prev.capas, '1', '1')}
                    ${_row('Tiempo Ensamblaje (min)', 'est-ensamblaje', prev.ensamblaje)}
                </div>

                <!-- Resina -->
                <div style="border:1px solid #e8d5c4;border-radius:8px;padding:12px;background:#fffaf7;">
                    <label style="display:flex;align-items:center;gap:8px;font-weight:600;font-size:13px;cursor:pointer;margin-bottom:10px;">
                        <input type="checkbox" id="est-usa-resina" style="width:15px;height:15px;accent-color:var(--color-moss-green);"
                            onchange="document.getElementById('est-resina-fields').style.display=this.checked?'grid':'none';CotizacionesComponent._recalcular('${cotizacionId}')">
                        Usar Resina
                    </label>
                    <div id="est-resina-fields" style="display:none;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;">
                        ${_row('Cantidad (ml)', 'est-resina-ml', 0, '1', '0')}
                        ${_row('Costo/ml ($)', 'est-resina-costo-ml', 0, '0.001', '0')}
                        ${_row('Labor activa (min)', 'est-resina-activo', 0, '1', '0')}
                        ${_row('Curado (min, ref)', 'est-resina-curado', 0, '5', '0')}
                    </div>
                </div>

                <!-- Materiales + ajuste + margen -->
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;">
                    ${_row('Costo Materiales ($)', 'est-materiales', prev.materiales.toFixed(2), '0.01', '0')}
                    ${_row('Ajuste Manual / Extras ($)', 'est-ajuste', prev.ajuste, '0.10', '0')}
                    <div style="display:flex;flex-direction:column;gap:3px;">
                        <label style="font-size:12px;font-weight:600;color:#555;">Margen Retail (%)</label>
                        <input type="number" id="est-margen" value="${prev.margen}" step="1" min="0" max="95"
                            oninput="CotizacionesComponent._recalcular('${cotizacionId}')"
                            style="padding:8px 10px;border-radius:6px;border:1px solid #ddd;font-family:var(--font-primary);font-size:13px;">
                    </div>
                    <div style="display:flex;flex-direction:column;gap:3px;">
                        <label style="font-size:12px;font-weight:600;color:#555;">Margen Wholesale (%) <span style="color:#aaa;font-weight:400;">opt</span></label>
                        <input type="number" id="est-margen-wholesale" value="30" step="1" min="0" max="80"
                            oninput="CotizacionesComponent._recalcular('${cotizacionId}')"
                            style="padding:8px 10px;border-radius:6px;border:1px solid #ddd;font-family:var(--font-primary);font-size:13px;">
                    </div>
                </div>

                <!-- Tarifas en uso -->
                <div style="font-size:11px;color:#999;background:#f9f9f9;border-radius:6px;padding:6px 10px;">
                    Tarifas globales: Láser $${tarifas.tarifa_hora_laser.toFixed(2)}/hr · Labor $${tarifas.tarifa_hora_labor.toFixed(2)}/hr
                    <span style="margin-left:8px;font-style:italic;">(editable en Costos y Precios)</span>
                </div>

                <!-- Desglose en tiempo real -->
                <div id="est-desglose" style="background:#f8faf3;border:1px solid #d4e6a0;border-radius:8px;padding:14px;font-size:13px;display:flex;flex-direction:column;gap:6px;">
                    <div style="text-align:center;color:#aaa;font-style:italic;">Introduce valores para ver el desglose</div>
                </div>

                <!-- Notas -->
                <div style="display:flex;flex-direction:column;gap:4px;">
                    <label style="font-size:12px;font-weight:600;color:#555;">Notas de Estimación</label>
                    <textarea id="est-notas" rows="2"
                        style="padding:8px 10px;border-radius:6px;border:1px solid #ddd;font-family:var(--font-primary);font-size:13px;resize:vertical;"
                        placeholder="Observaciones sobre esta estimación…">${prev.notas}</textarea>
                </div>

                <!-- Acciones -->
                <div style="display:flex;gap:10px;justify-content:flex-end;">
                    <button onclick="document.getElementById('cotiz-estimar-overlay').remove()"
                        class="btn btn-secondary" style="padding:8px 18px;font-size:13px;">Cancelar</button>
                    <button id="btn-guardar-estimacion" onclick="CotizacionesComponent._guardarEstimacion(${cotizacionId})"
                        class="btn btn-primary" style="padding:8px 20px;font-size:13px;background:#5f7830;border-color:#4a5e24;">
                        <i data-lucide="save" style="width:13px;height:13px;"></i> Guardar Estimación
                    </button>
                </div>

            </div>
        </div>`;

        overlay.style.display = 'flex';
        lucide.createIcons();

        // Cálculo inicial
        this._recalcular(cotizacionId);
    },

    _recalcular(cotizacionId) {
        const tarifas = this._tarifasEstimacion || { tarifa_hora_laser: 15, tarifa_hora_labor: 18 };
        const tLaser = tarifas.tarifa_hora_laser || 15;
        const tLabor = tarifas.tarifa_hora_labor || 18;

        const corte      = parseFloat(document.getElementById('est-corte')?.value) || 0;
        const grabado    = parseFloat(document.getElementById('est-grabado')?.value) || 0;
        const pintura    = parseFloat(document.getElementById('est-pintura')?.value) || 0;
        const capas      = parseInt(document.getElementById('est-capas')?.value) || 1;
        const ensamblaje = parseFloat(document.getElementById('est-ensamblaje')?.value) || 0;
        const materiales = parseFloat(document.getElementById('est-materiales')?.value) || 0;
        const ajuste     = parseFloat(document.getElementById('est-ajuste')?.value) || 0;
        const margen     = parseFloat(document.getElementById('est-margen')?.value) || 0;
        const complejidad = document.getElementById('est-complejidad')?.value || 'simple';
        const factor = complejidad === 'compleja' ? 1.6 : complejidad === 'media' ? 1.3 : 1.0;
        const margenWholesale = parseFloat(document.getElementById('est-margen-wholesale')?.value) || 0;
        // Resina
        const usaResina      = document.getElementById('est-usa-resina')?.checked ? 1 : 0;
        const resinaMl       = parseFloat(document.getElementById('est-resina-ml')?.value) || 0;
        const resinaCosto    = parseFloat(document.getElementById('est-resina-costo-ml')?.value) || 0;
        const resinaActivo   = parseFloat(document.getElementById('est-resina-activo')?.value) || 0;
        const resinaCurado   = parseFloat(document.getElementById('est-resina-curado')?.value) || 0;

        const costoLaser        = (corte + grabado) / 60 * tLaser;
        const pinturaTotal      = pintura * capas;
        const costoPintura      = pinturaTotal / 60 * tLabor * factor;
        const costoEnsamble     = ensamblaje / 60 * tLabor;
        const costoResinaMat    = usaResina ? resinaMl * resinaCosto : 0;
        const costoResinaLabor  = usaResina ? resinaActivo / 60 * tLabor : 0;
        const costoResinaTotal  = costoResinaMat + costoResinaLabor;
        const costoTotal        = materiales + costoLaser + costoPintura + costoEnsamble + ajuste + costoResinaTotal;
        const factorM           = 1 - (margen / 100);
        const precioSugerido    = factorM > 0 ? costoTotal / factorM : costoTotal;
        const ganancia          = precioSugerido - costoTotal;
        const factorWS          = 1 - (margenWholesale / 100);
        const precioWholesale   = factorWS > 0 ? costoTotal / factorWS : costoTotal;
        const gananciaWS        = precioWholesale - costoTotal;

        const fmt = v => `$${v.toFixed(2)}`;
        const row = (label, val, sub) =>
            `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid #e8f0d8;">
                <span style="color:#555;">${label}${sub ? `<span style="font-size:10px;color:#aaa;margin-left:6px;">${sub}</span>` : ''}</span>
                <span style="font-weight:600;">${fmt(val)}</span>
            </div>`;

        const desglose = document.getElementById('est-desglose');
        if (!desglose) return;

        let html = '';
        html += row('Materiales', materiales);
        html += row(`Láser`, costoLaser, `${corte}+${grabado} min · $${tLaser}/hr`);
        if (pinturaTotal > 0)  html += row(`Pintura`, costoPintura, `${pinturaTotal.toFixed(1)} min · ×${factor}`);
        if (ensamblaje > 0)    html += row(`Ensamblaje`, costoEnsamble, `${ensamblaje} min`);
        if (usaResina) {
            if (costoResinaMat > 0)   html += row(`Resina material`, costoResinaMat, `${resinaMl}ml × $${resinaCosto}/ml`);
            if (costoResinaLabor > 0) html += row(`Resina labor activa`, costoResinaLabor, `${resinaActivo} min`);
            if (resinaCurado > 0)     html += `<div style="display:flex;justify-content:space-between;padding:3px 0;color:#aaa;font-size:11px;"><span>⏱ Curado (ref): ${resinaCurado} min</span><span>—</span></div>`;
        }
        if (ajuste > 0)        html += row(`Ajuste manual`, ajuste);

        html += `<div style="display:flex;justify-content:space-between;padding:6px 0;margin-top:4px;font-weight:800;font-size:14px;color:var(--color-moss-green);">
            <span>COSTO TOTAL</span><span>${fmt(costoTotal)}</span>
        </div>`;
        html += `<div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px;color:#c0392b;">
            <span>Retail (${margen}% margen)</span><span>${fmt(precioSugerido)}</span>
        </div>`;
        html += `<div style="display:flex;justify-content:space-between;font-size:12px;color:#5f7830;margin-top:2px;">
            <span>Ganancia Retail</span><span>${fmt(ganancia)}</span>
        </div>`;
        if (margenWholesale > 0) {
            html += `<div style="display:flex;justify-content:space-between;font-weight:700;font-size:14px;color:#1976d2;margin-top:8px;border-top:1px dashed #cde;padding-top:8px;">
                <span>Wholesale (${margenWholesale}% margen)</span><span>${fmt(precioWholesale)}</span>
            </div>`;
            html += `<div style="display:flex;justify-content:space-between;font-size:12px;color:#64b5f6;margin-top:2px;">
                <span>Ganancia Wholesale</span><span>${fmt(gananciaWS)}</span>
            </div>`;
        }

        desglose.innerHTML = html;

        // Exportar resultado para que _guardarEstimacion lo lea
        this._ultimaEstimacion = { costoTotal, precioSugerido, margen };
    },

    async _guardarEstimacion(cotizacionId) {
        this._recalcular(cotizacionId);
        const est = this._ultimaEstimacion;
        if (!est) return;

        const notas = document.getElementById('est-notas')?.value || '';
        const btn   = document.getElementById('btn-guardar-estimacion');
        if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

        try {
            const payload = {
                costo_estimado:  Math.round(est.costoTotal    * 100) / 100,
                precio_estimado: Math.round(est.precioSugerido * 100) / 100,
                margen_estimado: est.margen / 100,
                notas_estimacion: notas || null,
            };
            console.log('[guardarEstimacion] cotizacionId:', cotizacionId, 'payload:', payload);
            await EvergreenAPI.guardarEstimacionCotizacion(cotizacionId, payload);
            document.getElementById('cotiz-estimar-overlay')?.remove();
            await this.abrirDetalle(cotizacionId);
        } catch (e) {
            alert('Error al guardar estimación: ' + e.message);
            if (btn) { btn.disabled = false; btn.textContent = 'Guardar Estimación'; }
        }
    },

    async _guardarNotas(id) {
        const textarea = document.getElementById('cotiz-notas-input');
        const ok = document.getElementById('cotiz-notas-ok');
        if (!textarea) return;
        try {
            await EvergreenAPI.actualizarNotasCotizacion(id, textarea.value);
            if (ok) { ok.style.display = 'inline'; setTimeout(() => { ok.style.display = 'none'; }, 2500); }
        } catch (e) {
            alert('Error al guardar notas: ' + e.message);
        }
    }
};
