/**
 * Componente Tablero Kanban de Producción Láser (Real)
 */
const ProduccionComponent = {
    ordenes: [],
    productos: [],
    _allGroups: [],   // populated by renderColumnCards for modal lookup

    // Agrupa órdenes por su código base y por su columna Kanban para que los productos con estados en diferentes columnas se dividan correctamente,
    // pero mantengan el agrupamiento si están en la misma columna de producción.
    groupOrdenes(ordenesList) {
        const groups = {};
        ordenesList.forEach(o => {
            let baseCode = o.codigo_orden;
            if (o.pedido_b2b_id) {
                // B2B orders (new and old) share pedido_b2b_id — use it as the canonical group key
                baseCode = o.pedido_b2b_id;
            } else if (o.codigo_orden.startsWith('EVL-PUB-') || o.codigo_orden.startsWith('EVL-B2B-')) {
                const parts = o.codigo_orden.split('-');
                if (parts.length >= 3) {
                    baseCode = parts.slice(0, 3).join('-');
                }
            }

            // Determinar la columna Kanban correspondiente según su estado
            let columnId = 'pendiente';
            if (o.estado === 'En diseño') {
                columnId = 'diseno';
            } else if (['Cortando', 'Grabando'].includes(o.estado)) {
                columnId = 'laser';
            } else if (['Pintura/Acabado', 'Listo', 'Entregado'].includes(o.estado)) {
                columnId = 'terminado';
            }

            const groupKey = `${baseCode}_${columnId}`;
            
            if (!groups[groupKey]) {
                groups[groupKey] = {
                    codigo_orden: baseCode,
                    cliente: o.cliente,
                    fecha_creacion: o.fecha_creacion,
                    fecha_entrega: o.fecha_entrega,
                    estado: o.estado,
                    columnId: columnId,
                    material_descontado: o.material_descontado,
                    factura_id: null,
                    numero_factura: null,
                    items: []
                };
            }

            groups[groupKey].items.push(o);

            if (o.material_descontado === 0) {
                groups[groupKey].material_descontado = 0;
            }
            if (o.factura_id) {
                groups[groupKey].factura_id = o.factura_id;
                groups[groupKey].numero_factura = o.numero_factura || null;
            }
        });
        return Object.values(groups);
    },

    async render(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Cargando órdenes de producción láser...</p>
            </div>
        `;

        try {
            // Consultar órdenes y productos
            const [ordenesRes, productosRes] = await Promise.all([
                EvergreenAPI.getOrdenes(),
                EvergreenAPI.getProductos()
            ]);

            this.ordenes = ordenesRes.data || [];
            this.productos = productosRes.data || [];
            this._allGroups = [];   // reset before renderColumnCards populates it

            // Agrupar órdenes por persona/pedido completo y etapa
            const grouped = this.groupOrdenes(this.ordenes);

            // Filtrar órdenes agrupadas por columnas del Kanban
            const pendientes = grouped.filter(o => o.columnId === 'pendiente');
            const diseno = grouped.filter(o => o.columnId === 'diseno');
            const corteGrabado = grouped.filter(o => o.columnId === 'laser');
            const acabadoListo = grouped.filter(o => o.columnId === 'terminado');

            container.innerHTML = `
                <div class="card" style="margin-bottom: 24px;">
                    <h3 class="card-title">Seguimiento de Producción y Control de Almacén</h3>
                    <p style="color: #6c757d; font-size: 14.5px; margin-bottom: 20px;">
                        Controla el estado de las órdenes láser. **Al mover una orden al estado 'Cortando' (o superior), el sistema descontará automáticamente del inventario la madera y los herrajes correspondientes.**
                    </p>
                    <div style="display: flex; gap: 12px; margin-bottom: 10px;">
                        <button class="btn btn-primary" id="btn-new-orden-kanban"><i data-lucide="plus"></i> Nueva Orden</button>
                    </div>
                </div>

                <!-- Tablero Kanban de Producción -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px; overflow-x: auto; align-items: start;">
                    
                    <!-- Columna: Pendiente -->
                    <div class="card" style="background-color: var(--color-gray-light); min-height: 450px; padding: 16px; border: 1px solid var(--color-gray-border);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h4 style="font-weight: 600; color: var(--color-soft-black);">Por Hacer (${pendientes.length})</h4>
                            <span class="badge badge-pending">En cola</span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            ${this.renderColumnCards(pendientes)}
                        </div>
                    </div>

                    <!-- Columna: En Diseño -->
                    <div class="card" style="background-color: var(--color-gray-light); min-height: 450px; padding: 16px; border: 1px solid var(--color-gray-border);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h4 style="font-weight: 600; color: var(--color-soft-black);">En Diseño (${diseno.length})</h4>
                            <span class="badge badge-pending" style="background-color: #E0F2FE; color: #0369A1;">Diseño</span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            ${this.renderColumnCards(diseno)}
                        </div>
                    </div>

                    <!-- Columna: Cortando / Grabando -->
                    <div class="card" style="background-color: var(--color-gray-light); min-height: 450px; padding: 16px; border: 1px solid var(--color-gray-border);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h4 style="font-weight: 600; color: var(--color-soft-black);">En Láser (${corteGrabado.length})</h4>
                            <span class="badge badge-progress">Máquina</span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            ${this.renderColumnCards(corteGrabado)}
                        </div>
                    </div>

                    <!-- Columna: Acabado / Listo -->
                    <div class="card" style="background-color: var(--color-gray-light); min-height: 450px; padding: 16px; border: 1px solid var(--color-gray-border);">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h4 style="font-weight: 600; color: var(--color-soft-black);">Terminado (${acabadoListo.length})</h4>
                            <span class="badge badge-success">Listos</span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 12px;">
                            ${this.renderColumnCards(acabadoListo)}
                        </div>
                    </div>

                </div>

                <!-- Modal de Registro de Orden -->
                <div id="orden-save-modal" class="modal-overlay" style="display: none;"></div>
            `;

            lucide.createIcons();
            this.setupListeners();

        } catch (error) {
            container.innerHTML = `
                <div class="alert-card">
                    <i data-lucide="alert-octagon"></i>
                    <div>
                        <div class="alert-title">Error de Carga</div>
                        <div class="alert-desc">${error.message}</div>
                    </div>
                </div>
            `;
            lucide.createIcons();
        }
    },

    renderColumnCards(cards) {
        if (cards.length === 0) {
            return `<div style="text-align:center;color:#8c8270;font-size:13px;padding:30px 10px;border:1px dashed var(--color-gray-border);border-radius:var(--radius-md);font-style:italic;background:var(--color-white);">Columna vacía</div>`;
        }

        const ESTADO_BADGE = {
            'Pendiente':       { bg:'#f3f4f6', color:'#6b7280', label:'Pendiente' },
            'En diseño':       { bg:'#e0f2fe', color:'#0369a1', label:'En Diseño' },
            'Cortando':        { bg:'#fef3c7', color:'#92400e', label:'Cortando' },
            'Grabando':        { bg:'#fef3c7', color:'#92400e', label:'Grabando' },
            'Pintura/Acabado': { bg:'#ede9fe', color:'#5b21b6', label:'Acabado' },
            'Listo':           { bg:'#dcfce7', color:'#166534', label:'✓ Listo' },
            'Entregado':       { bg:'#d1fae5', color:'#065f46', label:'✓ Entregado' },
        };

        let cardsHTML = '';
        cards.forEach(c => {
            // Store in global array for modal lookup
            const idx = this._allGroups.length;
            this._allGroups.push(c);

            const idsList  = c.items.map(item => item.id).join(',');
            const totalQty = c.items.reduce((s, item) => s + item.cantidad, 0);
            const fecha    = (c.fecha_creacion || '').split(' ')[0];

            const grupoEstado = c.estado || c.items[0]?.estado || 'Pendiente';
            const eb = ESTADO_BADGE[grupoEstado] || { bg:'#f3f4f6', color:'#888', label: grupoEstado };
            const estadoBadge = `<span style="background:${eb.bg};color:${eb.color};padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap;">${eb.label}</span>`;

            // Parse client name only (short)
            const cl = this._parseCliente(c.cliente);
            const tipoBadge = cl.tipo === 'b2b'
                ? `<span style="background:#e8f5e9;color:#2e7d32;font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:10px;margin-left:5px;">B2B</span>`
                : cl.tipo === 'publico'
                ? `<span style="background:#fff3e0;color:#e65100;font-size:9.5px;font-weight:700;padding:1px 6px;border-radius:10px;margin-left:5px;">PÚB</span>`
                : '';

            // Item state selects (kept for existing listener to attach to)
            const itemSelectsHTML = c.items.map(item => `
                <select class="change-item-state-select" data-id="${item.id}" style="display:none;">
                    <option value="Pendiente"       ${item.estado==='Pendiente'?'selected':''}>Pendiente</option>
                    <option value="En diseño"       ${item.estado==='En diseño'?'selected':''}>En diseño</option>
                    <option value="Cortando"        ${item.estado==='Cortando'?'selected':''}>Cortando</option>
                    <option value="Grabando"        ${item.estado==='Grabando'?'selected':''}>Grabando</option>
                    <option value="Pintura/Acabado" ${item.estado==='Pintura/Acabado'?'selected':''}>Pintura/Acabado</option>
                    <option value="Listo"           ${item.estado==='Listo'?'selected':''}>Listo</option>
                    <option value="Entregado"       ${item.estado==='Entregado'?'selected':''}>Entregado</option>
                </select>
                <input type="checkbox" class="order-item-checklist-checkbox" data-item-id="${item.id}" ${item.completado?'checked':''} style="display:none;">`
            ).join('');

            cardsHTML += `
            <div style="background:white;border-radius:12px;box-shadow:0 1px 5px rgba(0,0,0,0.07);overflow:hidden;border:1px solid #ede8df;">

                <!-- Encabezado -->
                <div style="background:#f7f3ee;padding:8px 12px;display:flex;justify-content:space-between;align-items:center;gap:8px;border-bottom:1px solid #ede8df;">
                    <code style="font-size:11.5px;font-weight:700;color:var(--color-moss-green);">${c.codigo_orden}</code>
                    <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;">
                        ${estadoBadge}
                        <span style="font-size:10px;color:#bbb;">${fecha}</span>
                    </div>
                </div>

                <!-- Cliente (nombre corto + tipo) -->
                <div style="padding:8px 12px;border-bottom:1px solid #f3ede5;display:flex;align-items:center;">
                    <span style="font-size:12.5px;font-weight:600;color:#333;">${cl.nombre}</span>
                    ${tipoBadge}
                </div>

                <!-- Resumen -->
                <div style="padding:6px 12px;border-bottom:1px solid #f3ede5;display:flex;align-items:center;gap:10px;">
                    <span style="font-size:11.5px;color:#666;">${totalQty} artículo${totalQty!==1?'s':''}</span>
                    ${c.material_descontado===1
                        ? `<span style="font-size:10px;background:#dcfce7;color:#166534;padding:1px 7px;border-radius:10px;font-weight:600;">Stock OK</span>`
                        : `<span style="font-size:10px;background:#ffedd5;color:#9a3412;padding:1px 7px;border-radius:10px;font-weight:600;">Reservado</span>`}
                </div>

                <!-- Controles ocultos para listeners existentes -->
                <div style="display:none;">${itemSelectsHTML}</div>

                ${c.numero_factura ? `
                <!-- Factura vinculada -->
                <div style="padding:5px 12px;border-bottom:1px solid #f3ede5;display:flex;align-items:center;gap:6px;">
                    <i data-lucide="file-check" style="width:12px;height:12px;color:#2e7d32;"></i>
                    <span style="font-size:11px;color:#2e7d32;font-weight:600;">Factura: ${c.numero_factura}</span>
                </div>` : ''}

                <!-- Botones -->
                <div style="padding:8px 12px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
                    <button class="btn-ver-detalle" data-card-idx="${idx}"
                        style="flex:1;padding:5px 8px;font-size:11.5px;font-weight:600;background:#f0f4e8;color:var(--color-moss-green);border:1px solid #c8d9a0;border-radius:8px;cursor:pointer;">
                        Ver Detalle
                    </button>
                    ${c.factura_id ? `
                    <span style="padding:5px 8px;font-size:11px;font-weight:600;color:#888;background:#f5f5f5;border:1px solid #ddd;border-radius:6px;display:inline-flex;align-items:center;gap:3px;">
                        <i data-lucide="check-circle" style="width:11px;height:11px;"></i> Facturado
                    </span>` : `
                    <button class="btn btn-primary btn-facturar-orden"
                        style="padding:5px 8px;font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:3px;"
                        data-code="${c.codigo_orden}" data-ids="${idsList}">
                        <i data-lucide="file-text" style="width:11px;height:11px;"></i> Facturar
                    </button>`}
                    <button class="btn btn-secondary btn-delete-orden"
                        style="padding:5px 7px;font-size:11px;color:var(--color-danger);border-color:rgba(192,99,76,0.3);"
                        data-ids="${idsList}">
                        Eliminar
                    </button>
                </div>
            </div>`;
        });
        return cardsHTML;
    },

    _parseCliente(str) {
        if (!str) return { nombre: 'Sin cliente', telefono: '', email: '', tipo: '', nota: '' };
        if (!str.includes('|')) return { nombre: str.trim(), telefono: '', email: '', tipo: '', nota: '' };
        try {
            const parts = str.split('|').map(p => p.trim());
            const data = {};
            let tipo = '';
            let first = parts[0];
            if (first.includes('[PEDIDO B2B]'))     { tipo = 'b2b';     first = first.replace('[PEDIDO B2B]', '').trim(); }
            if (first.includes('[PEDIDO PÚBLICO]'))  { tipo = 'publico'; first = first.replace('[PEDIDO PÚBLICO]', '').trim(); }
            if (first.includes(':')) { const kv = first.split(':'); data[kv[0].trim()] = kv.slice(1).join(':').trim(); }
            parts.slice(1).forEach(p => {
                if (p.includes(':')) { const kv = p.split(':'); data[kv[0].trim()] = kv.slice(1).join(':').trim(); }
            });
            return {
                nombre: data['Cliente'] || data['Contacto'] || 'Cliente',
                telefono: data['Tel'] || data['Teléfono'] || '',
                email: data['Email'] || '',
                tipo,
                nota: data['Nota'] || '',
                raw: data
            };
        } catch(e) { return { nombre: str.slice(0, 30), telefono: '', email: '', tipo: '', nota: '' }; }
    },

    async openDetalleModal(c) {
        // Inject modal container once
        let overlay = document.getElementById('prod-detalle-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'prod-detalle-overlay';
            overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.45);backdrop-filter:blur(4px);z-index:2000;display:flex;align-items:flex-start;justify-content:center;padding:40px 16px;box-sizing:border-box;overflow-y:auto;';
            overlay.addEventListener('click', e => { if (e.target === overlay) overlay.style.display = 'none'; });
            document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';

        const cl     = this._parseCliente(c.cliente);
        const fecha  = (c.fecha_creacion || '').split(' ')[0];
        const totalQty = c.items.reduce((s, i) => s + i.cantidad, 0);
        const idsList  = c.items.map(i => i.id).join(',');

        const ESTADO_BADGE = {
            'Pendiente':       { bg:'#f3f4f6', color:'#6b7280' },
            'En diseño':       { bg:'#e0f2fe', color:'#0369a1' },
            'Cortando':        { bg:'#fef3c7', color:'#92400e' },
            'Grabando':        { bg:'#fef3c7', color:'#92400e' },
            'Pintura/Acabado': { bg:'#ede9fe', color:'#5b21b6' },
            'Listo':           { bg:'#dcfce7', color:'#166534' },
            'Entregado':       { bg:'#d1fae5', color:'#065f46' },
        };

        // Gather unique product ids
        const prodIds = [...new Set(c.items.map(i => i.producto_id).filter(Boolean))];

        // Build product specs section
        const specsHTML = prodIds.map(pid => {
            const p = this.productos.find(x => x.id === pid);
            if (!p) return '';
            const fields = [
                p.sku         ? `<div><span style="color:#999;font-size:10px;">SKU</span><div style="font-size:12.5px;">${p.sku}</div></div>` : '',
                p.descripcion ? `<div><span style="color:#999;font-size:10px;">Descripción</span><div style="font-size:12px;color:#555;">${p.descripcion}</div></div>` : '',
                p.material_principal ? `<div><span style="color:#999;font-size:10px;">Material</span><div style="font-size:12.5px;">${p.material_principal}</div></div>` : '',
                p.medidas     ? `<div><span style="color:#999;font-size:10px;">Medidas</span><div style="font-size:12.5px;">${p.medidas}</div></div>` : '',
                p.precio_final ? `<div><span style="color:#999;font-size:10px;">Precio</span><div style="font-size:12.5px;font-weight:600;color:var(--color-moss-green);">$${Number(p.precio_final).toFixed(2)}</div></div>` : '',
            ].filter(Boolean).join('');
            if (!fields) return '';
            return `<div style="background:#fafaf8;border:1px solid #ede8df;border-radius:8px;padding:10px;margin-bottom:8px;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;color:#bbb;margin-bottom:8px;">${p.nombre}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">${fields}</div>
            </div>`;
        }).join('') || '<p style="color:#999;font-size:12px;">Sin especificaciones registradas.</p>';

        // Item rows with interactive selects
        const itemRows = c.items.map(item => {
            const eb = ESTADO_BADGE[item.estado] || { bg:'#f3f4f6', color:'#888' };
            return `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #f3ede5;">
                <input type="checkbox" class="order-item-checklist-checkbox" data-item-id="${item.id}" ${item.completado?'checked':''}
                    style="width:14px;height:14px;accent-color:var(--color-moss-green);cursor:pointer;flex-shrink:0;">
                <span style="flex:1;font-size:12.5px;${item.completado?'text-decoration:line-through;opacity:0.5;':''}">
                    <strong>${item.cantidad}×</strong> ${item.producto_nombre || 'Producto'}
                </span>
                <select class="change-item-state-select" data-id="${item.id}"
                    style="padding:3px 6px;border-radius:6px;border:1px solid #ddd;font-size:11px;background:white;cursor:pointer;">
                    <option value="Pendiente"       ${item.estado==='Pendiente'?'selected':''}>Pendiente</option>
                    <option value="En diseño"       ${item.estado==='En diseño'?'selected':''}>En diseño</option>
                    <option value="Cortando"        ${item.estado==='Cortando'?'selected':''}>Cortando</option>
                    <option value="Grabando"        ${item.estado==='Grabando'?'selected':''}>Grabando</option>
                    <option value="Pintura/Acabado" ${item.estado==='Pintura/Acabado'?'selected':''}>Pintura/Acabado</option>
                    <option value="Listo"           ${item.estado==='Listo'?'selected':''}>Listo</option>
                    <option value="Entregado"       ${item.estado==='Entregado'?'selected':''}>Entregado</option>
                </select>
            </div>`;
        }).join('');

        const tipoBadgeHtml = cl.tipo === 'b2b'
            ? `<span style="background:#e8f5e9;color:#2e7d32;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;">B2B</span>`
            : cl.tipo === 'publico'
            ? `<span style="background:#fff3e0;color:#e65100;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;">Pedido Público</span>`
            : '';

        overlay.innerHTML = `
        <div style="background:white;border-radius:16px;width:100%;max-width:560px;box-shadow:0 20px 60px rgba(0,0,0,0.2);overflow:hidden;margin-bottom:40px;">

            <!-- Header -->
            <div style="background:#f7f3ee;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #ede8df;">
                <div>
                    <code style="font-size:14px;font-weight:700;color:var(--color-moss-green);">${c.codigo_orden}</code>
                    <span style="font-size:11px;color:#aaa;margin-left:10px;">${fecha}</span>
                </div>
                <button id="btn-close-detalle" style="background:none;border:none;font-size:20px;cursor:pointer;color:#888;line-height:1;">&times;</button>
            </div>

            <div style="padding:16px 18px;display:flex;flex-direction:column;gap:16px;max-height:78vh;overflow-y:auto;">

                <!-- Cliente -->
                <div>
                    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#bbb;margin-bottom:6px;">Cliente</div>
                    <div style="background:#fafaf8;border:1px solid #ede8df;border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:4px;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <span style="font-size:14px;font-weight:700;color:#333;">${cl.nombre}</span>
                            ${tipoBadgeHtml}
                        </div>
                        ${cl.telefono && cl.telefono!=='N/A' ? `<div style="font-size:12px;color:#555;">📞 ${cl.telefono}</div>` : ''}
                        ${cl.email && cl.email!=='N/A' && cl.email!=='null' ? `<div style="font-size:12px;color:#555;">✉ ${cl.email}</div>` : ''}
                        ${cl.nota && !cl.nota.includes('IVU') ? `<div style="font-size:11.5px;color:#7a6742;font-style:italic;margin-top:4px;padding-top:4px;border-top:1px dashed #ede6d8;">📝 ${cl.nota}</div>` : ''}
                    </div>
                </div>

                <!-- Artículos -->
                <div>
                    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#bbb;margin-bottom:6px;">Artículos · ${totalQty} ud${totalQty!==1?'s':''}</div>
                    <div style="background:#fafaf8;border:1px solid #ede8df;border-radius:8px;padding:8px 12px;">
                        ${itemRows}
                    </div>
                </div>

                <!-- Especificaciones -->
                <div>
                    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#bbb;margin-bottom:6px;">Especificaciones del Producto</div>
                    ${specsHTML}
                </div>

                <!-- Fotos (cargadas async) -->
                <div>
                    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#bbb;margin-bottom:6px;">Fotos Asociadas</div>
                    <div id="prod-detalle-fotos" style="display:flex;flex-wrap:wrap;gap:8px;">
                        <span style="font-size:12px;color:#bbb;">Cargando fotos...</span>
                    </div>
                </div>

                <!-- Imágenes de cotización (si la orden proviene de una cotización) -->
                ${c.cotizacion_id ? `
                <div>
                    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#bbb;margin-bottom:6px;">
                        Imágenes de Cotización #${c.cotizacion_id}
                    </div>
                    <div id="prod-detalle-cotiz-fotos" style="display:flex;flex-wrap:wrap;gap:8px;">
                        <span style="font-size:12px;color:#bbb;">Cargando...</span>
                    </div>
                </div>` : ''}

            </div>

            <!-- Footer con acciones -->
            <div style="padding:12px 18px;border-top:1px solid #f0ece4;display:flex;gap:8px;flex-wrap:wrap;background:#fafaf8;">
                ${c.factura_id ? `
                <span style="padding:7px 12px;font-size:12px;font-weight:600;color:#2e7d32;background:#e8f5e9;border:1px solid #a5d6a7;border-radius:8px;display:inline-flex;align-items:center;gap:4px;">
                    <i data-lucide="check-circle" style="width:12px;height:12px;"></i> ${c.numero_factura || 'Facturado'}
                </span>` : `
                <button class="btn btn-primary btn-facturar-orden"
                    style="padding:7px 12px;font-size:12px;font-weight:600;display:inline-flex;align-items:center;gap:4px;"
                    data-code="${c.codigo_orden}" data-ids="${idsList}">
                    <i data-lucide="file-text" style="width:12px;height:12px;"></i> Facturar
                </button>`}
                <button class="btn btn-secondary btn-delete-orden"
                    style="padding:7px 10px;font-size:12px;color:var(--color-danger);border-color:rgba(192,99,76,0.3);"
                    data-ids="${idsList}">
                    Eliminar Orden
                </button>
                <button id="btn-close-detalle-2" style="margin-left:auto;background:none;border:1px solid #ddd;border-radius:8px;padding:7px 14px;font-size:12px;cursor:pointer;color:#666;">
                    Cerrar
                </button>
            </div>
        </div>`;

        lucide.createIcons();

        // Close handlers
        const close = () => { overlay.style.display = 'none'; };
        document.getElementById('btn-close-detalle').addEventListener('click', close);
        document.getElementById('btn-close-detalle-2').addEventListener('click', close);

        // Re-attach functional listeners inside modal
        overlay.querySelectorAll('.change-item-state-select').forEach(sel => {
            sel.addEventListener('change', async (e) => {
                const ordenId = parseInt(sel.getAttribute('data-id'));
                const nuevoEstado = e.target.value;
                try {
                    const res = await EvergreenAPI.updateOrdenEstado(ordenId, nuevoEstado);
                    if (res.message && res.message.includes('descontados')) {
                        alert('¡Materiales descontados del inventario!');
                    }
                    close();
                    this.render('produccion-container');
                } catch (err) {
                    alert('Error al actualizar estado: ' + err.message);
                }
            });
        });

        overlay.querySelectorAll('.order-item-checklist-checkbox').forEach(chk => {
            chk.addEventListener('change', async () => {
                const itemId = parseInt(chk.getAttribute('data-item-id'));
                try {
                    await EvergreenAPI.updateOrdenCompletado(itemId, chk.checked ? 1 : 0);
                    close();
                    this.render('produccion-container');
                } catch (err) {
                    alert('Error al actualizar checklist: ' + err.message);
                    chk.checked = !chk.checked;
                }
            });
        });

        overlay.querySelectorAll('.btn-facturar-orden').forEach(btn => {
            btn.addEventListener('click', () => {
                const baseCode = btn.getAttribute('data-code');
                const orderIds = btn.getAttribute('data-ids').split(',').map(Number);
                close();
                this._facturarOrden(baseCode, orderIds, btn);
            });
        });

        overlay.querySelectorAll('.btn-delete-orden').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ids = btn.getAttribute('data-ids').split(',').map(Number);
                if (confirm('¿Eliminar estos artículos de producción?')) {
                    try {
                        for (const id of ids) await EvergreenAPI.deleteOrden(id);
                        close();
                        this.render('produccion-container');
                    } catch (err) {
                        alert('Error al eliminar: ' + err.message);
                    }
                }
            });
        });

        // Load photos async
        const fotosContainer = document.getElementById('prod-detalle-fotos');
        try {
            const allFotos = [];
            for (const pid of prodIds) {
                const res = await EvergreenAPI.getFotosProducto(pid);
                const fotos = res.data || res || [];
                allFotos.push(...fotos);
            }
            if (allFotos.length === 0) {
                fotosContainer.innerHTML = '<span style="font-size:12px;color:#bbb;font-style:italic;">Sin fotos registradas.</span>';
            } else {
                fotosContainer.innerHTML = allFotos.map(f => {
                    const url = f.ruta_publica || `/fotos_import/${f.nombre_archivo}`;
                    const tipo = f.tipo_foto || '';
                    return `<a href="${url}" target="_blank" style="display:flex;flex-direction:column;align-items:center;gap:3px;text-decoration:none;">
                        <img src="${url}" alt="${tipo}" style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:1px solid #e0d9ce;">
                        <span style="font-size:9.5px;color:#999;text-transform:capitalize;">${tipo}</span>
                    </a>`;
                }).join('');
            }
        } catch(e) {
            fotosContainer.innerHTML = '<span style="font-size:11px;color:#bbb;">No se pudieron cargar las fotos.</span>';
        }

        // Load cotización images if this order came from a cotización
        if (c.cotizacion_id) {
            const cotizFotosContainer = document.getElementById('prod-detalle-cotiz-fotos');
            if (cotizFotosContainer) {
                try {
                    const res = await EvergreenAPI.getFotosCotizacion(c.cotizacion_id);
                    const imagenes = res.data || [];
                    if (imagenes.length === 0) {
                        cotizFotosContainer.innerHTML = '<span style="font-size:12px;color:#bbb;font-style:italic;">Sin imágenes en la cotización.</span>';
                    } else {
                        cotizFotosContainer.innerHTML = imagenes.map(img => {
                            const url = window.location.origin + img.ruta_publica;
                            if (img.es_pdf) {
                                return `<a href="${url}" target="_blank"
                                    style="display:flex;align-items:center;gap:6px;padding:8px 12px;background:#fff5f5;border:1.5px solid #ffcdd2;border-radius:8px;text-decoration:none;color:#c62828;font-size:11px;font-weight:600;">
                                    📄 ${img.nombre_archivo}
                                </a>`;
                            }
                            return `<a href="${url}" target="_blank" title="${img.nombre_archivo}">
                                <img src="${url}" alt="${img.nombre_archivo}"
                                    style="width:72px;height:72px;object-fit:cover;border-radius:8px;border:2px solid #bbdefb;"
                                    onerror="this.parentElement.innerHTML='<span style=\\'font-size:10px;color:#aaa;\\'>Sin vista</span>'">
                            </a>`;
                        }).join('');
                    }
                } catch(e) {
                    cotizFotosContainer.innerHTML = '<span style="font-size:11px;color:#bbb;">No se pudieron cargar las imágenes.</span>';
                }
            }
        }
    },

    setupListeners() {
        const btnNew = document.getElementById('btn-new-orden-kanban');
        if (btnNew) {
            btnNew.addEventListener('click', () => this.openNewOrdenModal());
        }

        // Ver Detalle
        document.querySelectorAll('.btn-ver-detalle').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.getAttribute('data-card-idx'));
                const card = this._allGroups[idx];
                if (card) this.openDetalleModal(card);
            });
        });

        // Botón de Facturar Orden desde Kanban
        document.querySelectorAll('.btn-facturar-orden').forEach(btn => {
            btn.addEventListener('click', () => {
                const baseCode = btn.getAttribute('data-code');
                const orderIds = btn.getAttribute('data-ids').split(',').map(Number);
                this._facturarOrden(baseCode, orderIds, btn);
            });
        });

        // Cambio de Estado select interactivo de cada producto individual
        document.querySelectorAll('.change-item-state-select').forEach(sel => {
            sel.addEventListener('change', async (e) => {
                const ordenId = parseInt(sel.getAttribute('data-id'));
                const nuevoEstado = e.target.value;

                try {
                    const res = await EvergreenAPI.updateOrdenEstado(ordenId, nuevoEstado);
                    if (res.message && res.message.includes("descontados")) {
                        alert("¡Materiales de este producto descontados del inventario!");
                    }
                    this.render('produccion-container');
                } catch (err) {
                    alert("Error al actualizar estado: " + err.message);
                    this.render('produccion-container');
                }
            });
        });

        // Borrar órdenes
        document.querySelectorAll('.btn-delete-orden').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ids = btn.getAttribute('data-ids').split(',').map(Number);
                if (confirm("¿Estás seguro de que deseas eliminar estos artículos de esta columna? Se cancelarán de producción.")) {
                    try {
                        for (const ordId of ids) {
                            await EvergreenAPI.deleteOrden(ordId);
                        }
                        this.render('produccion-container');
                    } catch (err) {
                        alert("Error al eliminar artículos: " + err.message);
                    }
                }
            });
        });

        // Checklist interactivo de productos
        document.querySelectorAll('.order-item-checklist-checkbox').forEach(chk => {
            chk.addEventListener('change', async (e) => {
                const itemId = parseInt(chk.getAttribute('data-item-id'));
                const checked = chk.checked ? 1 : 0;
                try {
                    await EvergreenAPI.updateOrdenCompletado(itemId, checked);
                    this.render('produccion-container');
                } catch (err) {
                    alert("Error al actualizar checklist: " + err.message);
                    chk.checked = !chk.checked;
                }
            });
        });
    },

    async _facturarOrden(baseCode, orderIds, btn) {
        const groupedItems = this.ordenes.filter(o => orderIds.includes(o.id));
        if (groupedItems.length === 0) return;
        const sampleOrder = groupedItems[0];

        if (!confirm(`¿Generar factura para la orden ${baseCode}?`)) return;

        if (btn) { btn.disabled = true; btn.textContent = 'Procesando...'; }
        try {
            if (sampleOrder.factura_id) {
                alert(`Esta orden ya tiene factura: ${sampleOrder.numero_factura || '#' + sampleOrder.factura_id}`);
                if (btn) { btn.disabled = false; btn.textContent = 'Facturar'; }
                return;
            }

            const clientsRes = await EvergreenAPI.getClientes();
            const clientsList = clientsRes.data || [];
            const cl = this._parseCliente(sampleOrder.cliente);
            const isB2B = (sampleOrder.cliente || '').includes('[PEDIDO B2B]');
            const matchedClient = isB2B
                ? clientsList.find(c => c.nombre.toLowerCase() === cl.nombre.toLowerCase())
                : null;
            const clienteId = matchedClient ? matchedClient.id : null;
            const clienteNombreManual = matchedClient ? null : (cl.nombre || 'Cliente Directo');

            const invoiceItems = groupedItems.map(item => {
                const prod = this.productos.find(p => p.id === item.producto_id);
                const precio = prod ? prod.precio_final : 0.0;
                const nombre = prod ? prod.nombre : (item.producto_nombre || 'Producto');
                return { producto_id: item.producto_id, nombre_producto: nombre, cantidad: item.cantidad, precio_unitario: precio, total: item.cantidad * precio };
            });

            const subtotal    = invoiceItems.reduce((s, i) => s + i.total, 0);
            const ivuEstatal  = subtotal * 0.105;
            const ivuMunicipal = subtotal * 0.01;
            const totalFactura = subtotal + ivuEstatal + ivuMunicipal;

            const res = await EvergreenAPI.createFactura({
                cliente_id: clienteId,
                cliente_nombre_manual: clienteNombreManual,
                fecha_emision: new Date().toISOString().split('T')[0],
                fecha_vencimiento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                subtotal: Math.round(subtotal * 100) / 100,
                ivu_estatal: Math.round(ivuEstatal * 100) / 100,
                ivu_municipal: Math.round(ivuMunicipal * 100) / 100,
                total: Math.round(totalFactura * 100) / 100,
                notas: `Orden ${baseCode}. Cliente: ${cl.nombre}.`,
                estado: 'Pendiente',
                items: invoiceItems,
                orden_produccion_id: sampleOrder.id,
                codigo_orden: baseCode,
            });
            alert(`¡Factura ${res.numero_factura} creada para ${cl.nombre}! Redirigiendo...`);
            window.location.hash = 'facturas';
        } catch (err) {
            alert('Error al generar la factura: ' + err.message);
            if (btn) { btn.disabled = false; btn.textContent = 'Facturar'; }
        }
    },

    openNewOrdenModal() {
        const modal = document.getElementById('orden-save-modal');

        if (this.productos.length === 0) {
            alert("Para crear una orden de producción, primero debes costear y registrar al menos un producto en la Calculadora de Costos.");
            return;
        }

        let productOptions = '';
        this.productos.forEach(p => {
            productOptions += `<option value="${p.id}">${p.nombre} (${p.sku})</option>`;
        });

        modal.innerHTML = `
            <div class="modal-card card" style="max-width: 450px; width: 90%; margin: 80px auto; position: relative;">
                <h3 class="card-title">Nueva Orden de Producción</h3>
                
                <form id="orden-save-form" style="display: flex; flex-direction: column; gap: 14px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Código Orden</label>
                            <input type="text" id="ord-codigo" required placeholder="Ej. EVL-1004" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Cliente</label>
                            <input type="text" id="ord-cliente" required placeholder="Ej. Juan Pérez" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; font-size: 13px;">Producto a Fabricar</label>
                        <select id="ord-producto-id" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                            ${productOptions}
                        </select>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Cantidad a Producir</label>
                            <input type="number" id="ord-cantidad" required value="1" min="1" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Estado Inicial</label>
                            <select id="ord-estado" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                                <option value="Pendiente">Pendiente (En cola)</option>
                                <option value="En diseño">En diseño</option>
                                <option value="Cortando">Cortando (Resta de stock)</option>
                            </select>
                        </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; font-size: 13px;">Fecha Entrega Prometida</label>
                        <input type="date" id="ord-fecha-entrega" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                    </div>

                    <div style="display: flex; gap: 12px; margin-top: 10px;">
                        <button type="button" class="btn btn-secondary" id="btn-close-ord-modal" style="flex: 1;">Cancelar</button>
                        <button type="submit" class="btn btn-primary" style="flex: 1;">Crear Orden</button>
                    </div>
                </form>
            </div>
        `;

        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(62, 62, 62, 0.4)';
        modal.style.backdropFilter = 'blur(4px)';
        modal.style.zIndex = '1000';
        modal.style.display = 'block';

        lucide.createIcons();

        // Autocompletar código de orden sugerido
        const inputCodigo = document.getElementById('ord-codigo');
        const ultimoCodigoNum = this.ordenes.length > 0
            ? parseInt(this.ordenes[0].codigo_orden.split("-")[1]) || 1000
            : 1000;
        inputCodigo.value = `EVL-${ultimoCodigoNum + 1}`;

        document.getElementById('btn-close-ord-modal').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        document.getElementById('orden-save-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const ordenData = {
                codigo_orden: document.getElementById('ord-codigo').value.trim(),
                cliente: document.getElementById('ord-cliente').value.trim(),
                producto_id: parseInt(document.getElementById('ord-producto-id').value),
                cantidad: parseInt(document.getElementById('ord-cantidad').value),
                estado: document.getElementById('ord-estado').value,
                fecha_entrega: document.getElementById('ord-fecha-entrega').value || null
            };

            try {
                const res = await EvergreenAPI.createOrden(ordenData);
                if (ordenData.estado === 'Cortando') {
                    alert("Orden de producción creada e inventario restado automáticamente.");
                }
                modal.style.display = 'none';
                this.render('produccion-container');
            } catch (err) {
                alert("Error al registrar la orden: " + err.message);
            }
        });
    }
};

function formatClienteInfo(clienteString) {
    if (!clienteString) return 'Sin cliente';
    if (!clienteString.includes('|') || (!clienteString.includes('[PEDIDO B2B]') && !clienteString.includes('[PEDIDO PÚBLICO]'))) {
        return `<span><strong>Cliente:</strong> ${clienteString}</span>`;
    }
    try {
        const parts = clienteString.split('|').map(p => p.trim());
        const data = {};
        let firstPart = parts[0];
        let isB2B = firstPart.includes('[PEDIDO B2B]');
        let isPub = firstPart.includes('[PEDIDO PÚBLICO]');
        
        let typeBadge = '';
        if (isB2B) {
            typeBadge = `<span style="background:var(--color-moss-green-light); color:var(--color-moss-green); font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; margin-bottom:4px; display:inline-block; text-transform:uppercase;">Pedido B2B</span>`;
            firstPart = firstPart.replace('[PEDIDO B2B]', '').trim();
        } else if (isPub) {
            typeBadge = `<span style="background:var(--color-terracotta-light); color:var(--color-terracotta); font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; margin-bottom:4px; display:inline-block; text-transform:uppercase;">Pedido Público</span>`;
            firstPart = firstPart.replace('[PEDIDO PÚBLICO]', '').trim();
        }
        
        if (firstPart.includes(':')) {
            const kv = firstPart.split(':');
            data[kv[0].trim()] = kv[1].trim();
        }
        
        parts.slice(1).forEach(part => {
            if (part.includes(':')) {
                const kv = part.split(':');
                const key = kv[0].trim();
                const val = kv[1].trim();
                data[key] = val;
            }
        });
        
        let nombre = data['Cliente'] || data['Contacto'] || 'Cliente';
        let telefono = data['Tel'] || data['Teléfono'] || '';
        let email = data['Email'] || '';
        let nota = data['Nota'] || '';
        
        let notaHtml = '';
        if (nota && nota !== 'Sin notas' && nota !== 'Ninguna') {
            if (nota.includes('IVU DETALLES')) {
                let ivuText = nota.replace('IVU DETALLES -', '').replace('[', '').replace(']', '').trim();
                notaHtml = `<div style="margin-top:4px; font-size:11px; background:#fbf9f5; border:1px solid #ede6d8; border-radius:6px; padding:6px 10px; color:#6d5f47; font-family:monospace; line-height:1.2;">
                    ${ivuText.split('|').map(l => l.trim()).join('<br>')}
                </div>`;
            } else {
                notaHtml = `<div style="margin-top:4px; font-style:italic; font-size:11.5px; color:#7a6742; padding-left:6px; border-left: 2px dashed #ede6d8; text-align: left;">
                    <strong>Nota:</strong> ${nota}
                </div>`;
            }
        }
        
        return `
            ${typeBadge}
            <div style="font-weight:700; color:var(--color-moss-green); font-size:13px; text-align: left;">${nombre}</div>
            ${telefono && telefono !== 'N/A' ? `<div style="font-size:11.5px; color:#555; display:flex; align-items:center; gap:4px; margin-top:2px; text-align: left;"><i data-lucide="phone" style="width:11px; height:11px; display:inline;"></i> ${telefono}</div>` : ''}
            ${email && email !== 'N/A' && email !== 'null' ? `<div style="font-size:11.5px; color:#555; display:flex; align-items:center; gap:4px; margin-top:1px; text-align: left;"><i data-lucide="mail" style="width:11px; height:11px; display:inline;"></i> ${email}</div>` : ''}
            ${notaHtml}
        `;
    } catch (err) {
        console.error("Error al formatear cliente:", err);
        return `<span>${clienteString}</span>`;
    }
}
