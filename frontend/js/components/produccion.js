/**
 * Componente Tablero Kanban de Producción Láser (Real)
 */
const ProduccionComponent = {
    ordenes: [],
    productos: [],

    // Agrupa órdenes por su código base y por su columna Kanban para que los productos con estados en diferentes columnas se dividan correctamente,
    // pero mantengan el agrupamiento si están en la misma columna de producción.
    groupOrdenes(ordenesList) {
        const groups = {};
        ordenesList.forEach(o => {
            let baseCode = o.codigo_orden;
            if (o.codigo_orden.startsWith('EVL-PUB-') || o.codigo_orden.startsWith('EVL-B2B-')) {
                const parts = o.codigo_orden.split('-');
                if (parts.length >= 3) {
                    baseCode = parts.slice(0, 3).join('-'); // e.g. EVL-PUB-12345678 o EVL-B2B-12345678
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
                    items: []
                };
            }
            
            groups[groupKey].items.push(o);
            
            if (o.material_descontado === 0) {
                groups[groupKey].material_descontado = 0;
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
            return `<div style="text-align: center; color: #8c8270; font-size: 13px; padding: 30px 10px; border: 1px dashed var(--color-gray-border); border-radius: var(--radius-md); font-style: italic; background: var(--color-white);">Columna vacía</div>`;
        }

        let cardsHTML = '';
        cards.forEach(c => {
            const hasDescounted = c.material_descontado === 1;
            const discountBadge = hasDescounted
                ? `<span style="color: var(--color-success); font-weight: 600; font-size: 11px; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="check-check" style="width: 12px; height: 12px;"></i> Stock Descontado</span>`
                : `<span style="color: var(--color-terracotta); font-weight: 500; font-size: 11px; display: inline-flex; align-items: center; gap: 3px;"><i data-lucide="info" style="width: 12px; height: 12px;"></i> Reservado en Almacén</span>`;

            const idsList = c.items.map(item => item.id).join(',');
            const totalQty = c.items.reduce((s, item) => s + item.cantidad, 0);

            cardsHTML += `
                <div class="card" style="padding: 14px; box-shadow: var(--shadow-sm); display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <strong style="color: var(--color-moss-green); font-size: 13.5px;">${c.codigo_orden}</strong>
                        <span style="font-size: 11.5px; color: #8c8270;">${c.fecha_creacion.split(" ")[0]}</span>
                    </div>
                    <div style="font-size: 12.5px; color: var(--color-soft-black); opacity: 0.85; display: flex; flex-direction: column; gap: 4px;">
                        <div style="background: #fdfdfb; border: 1px solid var(--color-gray-border); border-radius: var(--radius-sm); padding: 10px; display:flex; flex-direction:column; gap:2px; margin-bottom: 2px;">
                            ${formatClienteInfo(c.cliente)}
                        </div>
                        <div style="margin-top: 4px;">
                            <strong>Artículos:</strong>
                            <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px; padding-left: 8px; border-left: 2px solid var(--color-moss-green);">
                                ${c.items.map(item => {
                                    const isChecked = item.completado === 1;
                                    const textDecoration = isChecked ? 'line-through' : 'none';
                                    const opacity = isChecked ? '0.6' : '1';
                                    
                                    const itemStatusSelect = `
                                        <select class="change-item-state-select" data-id="${item.id}" style="padding: 2px 4px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); font-size: 11px; background: white; margin-left: auto; outline: none; cursor: pointer;">
                                            <option value="Pendiente" ${item.estado === 'Pendiente' ? 'selected' : ''}>Pendiente</option>
                                            <option value="En diseño" ${item.estado === 'En diseño' ? 'selected' : ''}>Diseño</option>
                                            <option value="Cortando" ${item.estado === 'Cortando' ? 'selected' : ''}>Cortar</option>
                                            <option value="Grabando" ${item.estado === 'Grabando' ? 'selected' : ''}>Grabar</option>
                                            <option value="Pintura/Acabado" ${item.estado === 'Pintura/Acabado' ? 'selected' : ''}>Acabado</option>
                                            <option value="Listo" ${item.estado === 'Listo' ? 'selected' : ''}>Listo</option>
                                            <option value="Entregado" ${item.estado === 'Entregado' ? 'selected' : ''}>Entregado</option>
                                        </select>
                                    `;
                                    
                                    return `
                                        <div style="font-size: 12.5px; line-height: 1.3; display: flex; align-items: center; justify-content: space-between; gap: 8px; opacity: ${opacity};">
                                            <div style="display: flex; align-items: center; gap: 6px; text-decoration: ${textDecoration}; min-width: 0; flex: 1;">
                                                <input type="checkbox" class="order-item-checklist-checkbox" data-item-id="${item.id}" ${isChecked ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px; accent-color: var(--color-moss-green); margin: 0; flex-shrink: 0;">
                                                <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.producto_nombre || 'Producto'}">
                                                    <strong>${item.cantidad}x</strong> ${item.producto_nombre || 'Producto'}
                                                </span>
                                            </div>
                                            ${itemStatusSelect}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                        <span style="margin-top: 4px;">Cantidad Total: <strong>${totalQty} uds</strong></span>
                    </div>
                    <div style="border-top: 1px solid var(--color-gray-border); padding-top: 8px; margin-top: 4px; display: flex; flex-direction: column; gap: 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                            ${discountBadge}
                            <button class="btn btn-primary btn-facturar-orden" style="padding: 4px 8px; font-size: 11px; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;" data-code="${c.codigo_orden}" data-ids="${idsList}">
                                <i class="fas fa-file-invoice-dollar" style="font-size: 12px;"></i> Facturar
                            </button>
                        </div>
                        <div style="display: flex; justify-content: flex-end;">
                            <button class="btn btn-secondary btn-delete-orden" style="padding: 0; border: none; font-size: 11px; color: var(--color-danger); background: none; box-shadow: none; margin: 0;" data-ids="${idsList}">
                                Eliminar de Columna
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        return cardsHTML;
    },

    setupListeners() {
        const btnNew = document.getElementById('btn-new-orden-kanban');
        if (btnNew) {
            btnNew.addEventListener('click', () => this.openNewOrdenModal());
        }

        // Botón de Facturar Orden desde Kanban
        document.querySelectorAll('.btn-facturar-orden').forEach(btn => {
            btn.addEventListener('click', async () => {
                const baseCode = btn.getAttribute('data-code');
                const orderIds = btn.getAttribute('data-ids').split(',').map(Number);
                
                // Buscar los items de esta orden agrupada
                const groupedItems = this.ordenes.filter(o => orderIds.includes(o.id));
                if (groupedItems.length === 0) return;
                
                const sampleOrder = groupedItems[0];
                
                if (confirm(`¿Deseas generar una factura para la orden ${baseCode}?`)) {
                    btn.disabled = true;
                    btn.textContent = 'Procesando...';
                    
                    try {
                        // 1. Obtener facturas existentes para evitar duplicados
                        const facturasRes = await EvergreenAPI.getFacturas();
                        const facturasList = facturasRes.data || [];
                        const existingFactura = facturasList.find(f => f.notas && f.notas.includes(baseCode));
                        
                        if (existingFactura) {
                            alert(`Esta orden ya cuenta con una factura asociada: ${existingFactura.numero_factura}`);
                            btn.disabled = false;
                            btn.innerHTML = '<i class="fas fa-file-invoice-dollar" style="font-size: 12px;"></i> Facturar';
                            return;
                        }
                        
                        // 2. Obtener clientes B2B para buscar coincidencia
                        const clientsRes = await EvergreenAPI.getClientes();
                        const clientsList = clientsRes.data || [];
                        
                        // Función auxiliar inline para limpiar nombre
                        function getCleanClientName(clienteStr) {
                            if (!clienteStr) return 'Cliente Público';
                            if (!clienteStr.includes('|')) return clienteStr.trim();
                            try {
                                const parts = clienteStr.split('|').map(p => p.trim());
                                const data = {};
                                let firstPart = parts[0];
                                firstPart = firstPart.replace('[PEDIDO B2B]', '').replace('[PEDIDO PÚBLICO]', '').trim();
                                if (firstPart.includes(':')) {
                                    const kv = firstPart.split(':');
                                    data[kv[0].trim()] = kv[1].trim();
                                }
                                parts.slice(1).forEach(part => {
                                    if (part.includes(':')) {
                                        const kv = part.split(':');
                                        data[kv[0].trim()] = kv[1].trim();
                                    }
                                });
                                return data['Cliente'] || data['Contacto'] || 'Cliente Público';
                            } catch(e) {
                                return 'Cliente Público';
                            }
                        }
                        
                        const cleanName = getCleanClientName(sampleOrder.cliente);
                        let matchedClient = clientsList.find(cl => cl.nombre.toLowerCase() === cleanName.toLowerCase());
                        
                        let clienteId = null;
                        if (matchedClient) {
                            clienteId = matchedClient.id;
                        } else {
                            let publicClient = clientsList.find(cl => cl.nombre === 'Cliente Público');
                            if (publicClient) {
                                clienteId = publicClient.id;
                            } else {
                                clienteId = 1; // Fallback
                            }
                        }
                        
                        // 3. Mapear items de la orden a items de factura buscando precios en la base de datos
                        const invoiceItems = groupedItems.map(item => {
                            const prod = this.productos.find(p => p.id === item.producto_id);
                            const precio = prod ? prod.precio_final : 0.0;
                            const nombre = prod ? prod.nombre : (item.producto_nombre || 'Producto');
                            return {
                                producto_id: item.producto_id,
                                nombre_producto: nombre,
                                cantidad: item.cantidad,
                                precio_unitario: precio,
                                total: item.cantidad * precio
                            };
                        });
                        
                        const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
                        const ivuEstatal = subtotal * 0.105;
                        const ivuMunicipal = subtotal * 0.01;
                        const totalFactura = subtotal + ivuEstatal + ivuMunicipal;
                        
                        const facturaData = {
                            cliente_id: clienteId,
                            fecha_emision: new Date().toISOString().split('T')[0],
                            fecha_vencimiento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                            subtotal: Math.round(subtotal * 100) / 100,
                            ivu_estatal: Math.round(ivuEstatal * 100) / 100,
                            ivu_municipal: Math.round(ivuMunicipal * 100) / 100,
                            total: Math.round(totalFactura * 100) / 100,
                            notas: `Factura generada automáticamente desde Producción Láser para la orden ${baseCode}. Cliente real: ${cleanName}.`,
                            estado: 'Pendiente',
                            items: invoiceItems
                        };
                        
                        const res = await EvergreenAPI.createFactura(facturaData);
                        alert(`¡Factura ${res.numero_factura} creada con éxito para ${cleanName}! Redirigiendo a facturas...`);
                        
                        // Redirigir a la pestaña de facturas mediante el hash de navegación
                        window.location.hash = 'facturas';
                    } catch (err) {
                        alert("Error al generar la factura: " + err.message);
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-file-invoice-dollar" style="font-size: 12px;"></i> Facturar';
                    }
                }
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
