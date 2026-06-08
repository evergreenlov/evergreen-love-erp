/**
 * Componente de Gestión de Clientes B2B y Catálogos - Evergreen Love
 */
const ClientesComponent = {
    clientes: [],
    productos: [],
    selectedClienteId: null,
    catalogo: [],

    async render(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <style>
                .b2b-grid {
                    display: grid;
                    grid-template-columns: 1fr 1.3fr;
                    gap: 24px;
                    margin-bottom: 32px;
                }
                @media (max-width: 900px) {
                    .b2b-grid {
                        grid-template-columns: 1fr;
                    }
                }
                
                .client-item {
                    padding: 12px 16px;
                    border-radius: var(--radius-sm);
                    border: 1px solid var(--color-gray-border);
                    background-color: var(--color-gray-light);
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .client-item:hover {
                    border-color: var(--color-moss-green);
                    background-color: rgba(95, 90, 48, 0.05);
                }
                .client-item.active {
                    background-color: var(--color-moss-green);
                    color: var(--color-white);
                    border-color: var(--color-moss-green);
                }
                
                .catalog-item-card {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    border: 1px solid var(--color-gray-border);
                    border-radius: var(--radius-sm);
                    margin-bottom: 10px;
                }
            </style>

            <div class="b2b-grid">
                <!-- PANEL IZQUIERDO: Directorio de Clientes B2B -->
                <div class="card" style="display: flex; flex-direction: column; gap: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <h3 class="card-title" style="margin-bottom:0;">Clientes Comerciales B2B</h3>
                        <button class="btn btn-primary" id="btn-nuevo-cliente" style="padding: 6px 12px; font-size:12.5px;">
                            <i data-lucide="plus"></i> Registrar Cliente
                        </button>
                    </div>
                    <p style="color: #6c757d; font-size: 13.5px; margin-top:-6px;">Registra corporaciones, hoteles o tiendas para asignarles catálogos de precios especiales.</p>
                    
                    <div style="display: flex; flex-direction: column; gap: 10px; max-height: 480px; overflow-y: auto;" id="clientes-list-container">
                        <div class="loading-state">
                            <div class="spinner"></div>
                            <p>Cargando lista de clientes...</p>
                        </div>
                    </div>
                </div>

                <!-- PANEL DERECHO: Catálogo Exclusivo / Precios Mayoristas -->
                <div class="card" style="display: flex; flex-direction: column; gap: 16px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap:wrap; gap:10px;">
                        <div>
                            <h3 class="card-title" style="margin-bottom:2px;" id="client-catalog-title">Catálogo por Cliente</h3>
                            <span id="client-catalog-subtitle" style="font-size:13px; color:#6c757d;">Selecciona un cliente para ver y editar su catálogo y precios B2B.</span>
                        </div>
                        <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
                            <button class="btn btn-secondary" id="btn-catalogo-publico" style="padding: 6px 12px; font-size:12.5px; display:inline-flex; gap:6px; align-items:center;" onclick="abrirCatalogoPublicoLink()">
                                <i data-lucide="globe"></i> Catálogo Público
                            </button>
                            <button class="btn btn-secondary" id="btn-portal-b2b" style="padding: 6px 12px; font-size:12.5px; display:none; gap:6px;" onclick="abrirPortalB2B(event)">
                                <i data-lucide="share-2"></i> Compartir Enlace B2B
                            </button>
                            <button class="btn btn-primary" id="btn-asociar-producto-b2b" style="padding: 6px 12px; font-size:12.5px; display:none;">
                                <i data-lucide="link"></i> Asignar Producto
                            </button>
                        </div>
                    </div>

                    <div id="catalog-details-container">
                        <div class="loading-state" style="padding:60px 0;">
                            <i data-lucide="users" style="width:48px; height:48px; opacity:0.25; margin-bottom:12px;"></i>
                            <p>Seleccione un cliente comercial de la izquierda para administrar su catálogo.</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- MODAL: ENLACE PORTAL B2B -->
            <div id="b2b-link-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.45); backdrop-filter:blur(4px); z-index:3000; align-items:center; justify-content:center;">
                <div style="background:white; border-radius:16px; padding:28px 28px 24px; max-width:480px; width:90%; box-shadow:0 12px 40px rgba(0,0,0,0.18);">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                        <i data-lucide="share-2" style="width:20px;height:20px;color:var(--color-moss-green);"></i>
                        <h3 style="margin:0; font-size:16px; color:var(--color-moss-green);">Enlace del Catálogo B2B</h3>
                    </div>
                    <p style="font-size:13px; color:#8c8270; margin:0 0 16px;">Comparte este enlace con tu cliente. Al abrirlo verá directamente su catálogo personalizado con precios especiales y podrá hacer pedidos. El pedido aparecerá automáticamente en tu sección de <strong>Producción</strong>.</p>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <input id="b2b-link-url" type="text" readonly style="flex:1; padding:10px 12px; border:1.5px solid #e0d9ce; border-radius:8px; font-size:12px; color:#444; background:#fdfaf5; font-family:monospace; cursor:pointer;" onclick="this.select()">
                        <button id="btn-copy-b2b-link" onclick="copiarEnlaceB2B()" style="padding:10px 14px; background:var(--color-moss-green); color:white; border:none; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600; white-space:nowrap; display:flex; align-items:center; gap:6px;">
                            <i data-lucide="copy" style="width:14px;height:14px;"></i> Copiar
                        </button>
                    </div>
                    <p style="font-size:11px; color:#a89880; margin:8px 0 0;">💡 Tip: También puedes hacer clic en el enlace para seleccionarlo y copiarlo manualmente.</p>
                    <div style="margin-top:16px; display:flex; gap:10px; justify-content:flex-end;">
                        <a id="b2b-link-open" href="#" target="_blank" rel="noopener" style="display:inline-flex; align-items:center; gap:6px; padding:9px 16px; border:1.5px solid var(--color-moss-green); color:var(--color-moss-green); border-radius:8px; font-size:13px; font-weight:600; text-decoration:none;">
                            <i data-lucide="external-link" style="width:14px;height:14px;"></i> Abrir
                        </a>
                        <button onclick="document.getElementById('b2b-link-modal').style.display='none'" style="padding:9px 16px; background:#f5f5f5; border:none; border-radius:8px; font-size:13px; cursor:pointer;">Cerrar</button>
                    </div>
                </div>
            </div>

            <!-- MODAL: ENLACE CATÁLOGO PÚBLICO -->
            <div id="catalogo-publico-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.45); backdrop-filter:blur(4px); z-index:3000; align-items:center; justify-content:center;">
                <div style="background:white; border-radius:16px; padding:28px 28px 24px; max-width:480px; width:90%; box-shadow:0 12px 40px rgba(0,0,0,0.18);">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                        <i data-lucide="globe" style="width:20px;height:20px;color:var(--color-moss-green);"></i>
                        <h3 style="margin:0; font-size:16px; color:var(--color-moss-green);">Enlace del Catálogo Público</h3>
                    </div>
                    <p style="font-size:13px; color:#8c8270; margin:0 0 16px;">Comparte este enlace con cualquier cliente para que explore tu catálogo de productos y realice pedidos. No requiere código de cliente ni acceso especial.</p>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <input id="catalogo-publico-url" type="text" readonly style="flex:1; padding:10px 12px; border:1.5px solid #e0d9ce; border-radius:8px; font-size:12px; color:#444; background:#fdfaf5; font-family:monospace; cursor:pointer;" onclick="this.select()">
                        <button id="btn-copy-catalogo-publico" onclick="copiarEnlaceCatalogoPublico()" style="padding:10px 14px; background:var(--color-moss-green); color:white; border:none; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600; white-space:nowrap; display:flex; align-items:center; gap:6px;">
                            <i data-lucide="copy" style="width:14px;height:14px;"></i> Copiar
                        </button>
                    </div>
                    <p style="font-size:11px; color:#a89880; margin:8px 0 0;">💡 Tip: También puedes hacer clic en el enlace para seleccionarlo y copiarlo manualmente.</p>
                    <div style="margin-top:16px; display:flex; gap:10px; justify-content:flex-end;">
                        <a id="catalogo-publico-open" href="#" target="_blank" rel="noopener" style="display:inline-flex; align-items:center; gap:6px; padding:9px 16px; border:1.5px solid var(--color-moss-green); color:var(--color-moss-green); border-radius:8px; font-size:13px; font-weight:600; text-decoration:none;">
                            <i data-lucide="external-link" style="width:14px;height:14px;"></i> Abrir
                        </a>
                        <button onclick="document.getElementById('catalogo-publico-modal').style.display='none'" style="padding:9px 16px; background:#f5f5f5; border:none; border-radius:8px; font-size:13px; cursor:pointer;">Cerrar</button>
                    </div>
                </div>
            </div>

            <!-- MODAL REGISTRO CLIENTE -->
            <div id="cliente-modal" class="modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(62,62,62,0.4); backdrop-filter: blur(4px); z-index: 2000; justify-content: center; align-items: center;">
                <div class="card" style="width: 90%; max-width: 400px; padding: 24px; display: flex; flex-direction: column; gap: 16px; margin-top: 100px;">
                    <h3 class="card-title" style="margin-bottom:4px;">Registrar Cliente B2B</h3>
                    <form id="form-nuevo-cliente" style="display: flex; flex-direction: column; gap: 12px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Nombre Comercial</label>
                            <input type="text" id="cl-nombre" required placeholder="Ej. Restaurante El Morro" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Contacto Encargado</label>
                            <input type="text" id="cl-contacto" placeholder="Ej. Carlos Rivera (Gerente)" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Correo Electrónico</label>
                            <input type="email" id="cl-email" placeholder="carlos@elmorro.com" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Teléfono</label>
                            <input type="text" id="cl-telefono" placeholder="787-555-1234" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Notas adicionales</label>
                            <textarea id="cl-notas" placeholder="Observaciones de venta o acuerdos de envío..." style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); min-height:60px; resize:vertical;"></textarea>
                        </div>
                        <div style="display: flex; gap: 12px; margin-top: 10px;">
                            <button type="button" class="btn btn-secondary" id="btn-close-cl-modal" style="flex: 1;">Cancelar</button>
                            <button type="submit" class="btn btn-primary" style="flex: 1;">Registrar</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- MODAL ASOCIAR PRODUCTO AL CATÁLOGO -->
            <div id="asociar-modal" class="modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(62,62,62,0.4); backdrop-filter: blur(4px); z-index: 2000; justify-content: center; align-items: center;">
                <div class="card" style="width: 90%; max-width: 400px; padding: 24px; display: flex; flex-direction: column; gap: 16px; margin-top: 100px;">
                    <h3 class="card-title" style="margin-bottom:4px;">Asignar Producto y Precio Mayorista</h3>
                    <form id="form-asociar-producto" style="display: flex; flex-direction: column; gap: 12px;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Producto a Asignar</label>
                            <select id="asoc-producto-id" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); cursor:pointer;">
                                <!-- Se poblará dinámicamente -->
                            </select>
                            <span id="no-products-warning" style="display:none; font-size:11.5px; color:var(--color-terracotta); margin-top:4px; font-weight:500; line-height:1.4;">
                                ⚠️ No tienes productos guardados aún. Ve a la pestaña 'Costos' y presiona 'Guardar en Catálogo' para crear tu primer producto comercial.
                            </span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Precio Especial Mayorista ($)</label>
                            <input type="number" step="0.01" id="asoc-precio" required placeholder="0.00" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                            <span style="font-size:11px; color:#8c8270;" id="asoc-precio-sug"></span>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <label style="font-weight: 500; font-size: 13px;">Notas del Acuerdo B2B</label>
                            <input type="text" id="asoc-notas" placeholder="Ej. Lote de 50+ unidades" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary);">
                        </div>
                        <div style="display: flex; gap: 12px; margin-top: 10px;">
                            <button type="button" class="btn btn-secondary" id="btn-close-asoc-modal" style="flex: 1;">Cancelar</button>
                            <button type="submit" class="btn btn-primary" style="flex: 1;">Asignar</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        
        lucide.createIcons();
        await this.loadData();
        this.setupListeners();
    },

    async loadData() {
        try {
            const [resClientes, resProductos] = await Promise.all([
                EvergreenAPI.getClientes(),
                EvergreenAPI.getProductos()
            ]);
            
            this.clientes = resClientes.data || [];
            this.productos = resProductos.data || [];
            
            this.renderClientesList();
            this.populateProductosSelect();
        } catch (error) {
            console.error("Error al cargar datos B2B:", error);
        }
    },

    renderClientesList() {
        const container = document.getElementById('clientes-list-container');
        if (this.clientes.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: #8c8c8c; padding: 20px; font-style: italic; font-size: 13.5px; border: 1px dashed var(--color-gray-border); border-radius: var(--radius-sm);">
                    No hay clientes B2B registrados. Registre uno para comenzar.
                </div>
            `;
            return;
        }

        container.innerHTML = '';
        this.clientes.forEach(c => {
            const div = document.createElement('div');
            div.className = `client-item ${this.selectedClienteId === c.id ? 'active' : ''}`;
            div.dataset.id = c.id;
            
            div.innerHTML = `
                <div>
                    <strong style="display:block; font-size:14.5px;">${c.nombre}</strong>
                    <span style="font-size:12px; opacity:0.85; display:block; margin-top:2px;">${c.contacto || 'Sin contacto directo'}</span>
                </div>
                <button class="btn btn-delete-cliente" style="padding: 4px; border: none; background: none; box-shadow: none; color: ${this.selectedClienteId === c.id ? 'var(--color-white)' : 'var(--color-danger)'};" data-id="${c.id}">
                    <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
                </button>
            `;
            
            div.addEventListener('click', (e) => {
                // Prevenir que haga clic en el botón de borrar
                if (e.target.closest('.btn-delete-cliente')) return;
                
                this.selectedClienteId = c.id;
                this.renderClientesList(); // Refresh active state classes
                this.loadClienteCatalog();
            });
            
            container.appendChild(div);
        });
        
        // Agregar listeners para borrar cliente
        container.querySelectorAll('.btn-delete-cliente').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = parseInt(btn.getAttribute('data-id'));
                const cliente = this.clientes.find(c => c.id === id);
                if (confirm(`¿Estás seguro de que deseas eliminar al cliente "${cliente.nombre}"? Esto eliminará también su catálogo de precios especiales.`)) {
                    try {
                        await EvergreenAPI.deleteCliente(id);
                        if (this.selectedClienteId === id) {
                            this.selectedClienteId = null;
                            document.getElementById('btn-asociar-producto-b2b').style.display = 'none';
                            document.getElementById('btn-portal-b2b').style.display = 'none';
                            document.getElementById('catalog-details-container').innerHTML = `
                                <div class="loading-state" style="padding:60px 0;">
                                    <i data-lucide="users" style="width:48px; height:48px; opacity:0.25; margin-bottom:12px;"></i>
                                    <p>Seleccione un cliente comercial de la izquierda para administrar su catálogo.</p>
                                </div>
                            `;
                        }
                        await this.loadData();
                    } catch (err) {
                        alert("Error al eliminar cliente: " + err.message);
                    }
                }
            });
        });
        
        lucide.createIcons();
    },

    populateProductosSelect() {
        const select = document.getElementById('asoc-producto-id');
        const warning = document.getElementById('no-products-warning');
        if (!select) return;
        
        select.innerHTML = '<option value="">Seleccione un producto...</option>';
        if (this.productos.length === 0) {
            if (warning) warning.style.display = 'block';
            select.setAttribute('disabled', 'true');
        } else {
            if (warning) warning.style.display = 'none';
            select.removeAttribute('disabled');
            this.productos.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p.id;
                opt.dataset.costo = p.costo_total;
                opt.dataset.retail = p.precio_final;
                opt.textContent = `${p.nombre} (${p.sku})`;
                select.appendChild(opt);
            });
        }
    },

    async loadClienteCatalog() {
        const cliente = this.clientes.find(c => c.id === this.selectedClienteId);
        if (!cliente) return;

        // Mostrar botones de acción y títulos
        document.getElementById('btn-asociar-producto-b2b').style.display = 'inline-flex';
        document.getElementById('btn-portal-b2b').style.display = 'inline-flex';
        document.getElementById('client-catalog-title').innerText = `Catálogo de ${cliente.nombre}`;
        document.getElementById('client-catalog-subtitle').innerText = `Productos asignados con precios especiales mayoristas.`;

        const container = document.getElementById('catalog-details-container');
        container.innerHTML = `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Cargando catálogo del cliente...</p>
            </div>
        `;

        try {
            const res = await EvergreenAPI.getCatalogoCliente(this.selectedClienteId);
            if (res.status === 'success') {
                this.catalogo = res.data || [];
                this.renderCatalogList();
            }
        } catch (error) {
            console.error("Error al cargar catálogo de cliente:", error);
            container.innerHTML = `<div style="color:var(--color-danger); text-align:center; padding:20px;">Error al obtener catálogo.</div>`;
        }
    },

    renderCatalogList() {
        const container = document.getElementById('catalog-details-container');
        if (this.catalogo.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; color: #8c8c8c; padding: 40px 20px; font-style: italic; border: 1px dashed var(--color-gray-border); border-radius: var(--radius-sm); background-color: var(--color-gray-light);">
                    <i data-lucide="link-2" style="width: 32px; height: 32px; opacity:0.4; margin-bottom:8px; display:block; margin-left:auto; margin-right:auto;"></i>
                    Este cliente aún no tiene productos asociados en su catálogo especial.<br>
                    <button class="btn btn-primary" id="btn-empty-asoc" style="margin-top: 14px; margin-bottom: 6px; font-size:13px; font-weight:600; font-family:var(--font-primary); display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px;">
                        <i data-lucide="plus-circle" style="width:16px; height:16px;"></i> Asignar mi primer Producto B2B
                    </button>
                    <p style="font-size: 12px; color: #8c8270; font-style: normal; margin-top: 10px; font-weight: 500; max-width: 380px; margin-left: auto; margin-right: auto; line-height: 1.4;">
                        💡 <strong>Nota:</strong> Los productos disponibles se crean en la pestaña <strong>Costos</strong>. Realiza un cálculo de pieza y pulsa <i>"Guardar en Catálogo"</i> para que aparezcan aquí.
                    </p>
                </div>
            `;
            
            const btnEmptyAsoc = container.querySelector('#btn-empty-asoc');
            if (btnEmptyAsoc) {
                btnEmptyAsoc.addEventListener('click', () => {
                    const btnAsocHeader = document.getElementById('btn-asociar-producto-b2b');
                    if (btnAsocHeader) btnAsocHeader.click();
                });
            }
            
            lucide.createIcons();
            return;
        }

        container.innerHTML = '';
        this.catalogo.forEach(item => {
            const div = document.createElement('div');
            div.className = 'catalog-item-card card animate-fade-in';
            div.style.padding = '16px';
            
            const margen = ((item.precio_especial - item.costo_total) / item.precio_especial * 100).toFixed(0);
            const fotoHtml = item.foto_ruta
                ? `<img src="${item.foto_ruta}" alt="${item.producto_nombre}" 
                        style="width: 72px; height: 72px; object-fit: cover; border-radius: 6px; border: 1px solid var(--color-gray-border); flex-shrink: 0; background: #f5f5f5;"
                        onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                   <div style="display:none; width:72px; height:72px; border-radius:6px; border:1px dashed var(--color-gray-border); background:var(--color-gray-light); align-items:center; justify-content:center; flex-shrink:0;">
                       <i data-lucide="image" style="width:24px;height:24px;color:#ccc;"></i>
                   </div>`
                : `<div style="display:flex; width:72px; height:72px; border-radius:6px; border:1px dashed var(--color-gray-border); background:var(--color-gray-light); align-items:center; justify-content:center; flex-shrink:0;">
                       <i data-lucide="image" style="width:24px;height:24px;color:#ccc;"></i>
                   </div>`;

            div.innerHTML = `
                <div style="display:flex; align-items:flex-start; gap:14px;">
                    ${fotoHtml}
                    <div style="flex:1; min-width:0;">
                        <h4 style="font-weight:600; color:var(--color-soft-black); font-size:15px; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.producto_nombre}</h4>
                        <span style="font-size:11px; color:#8c8270; display:block; margin-bottom:8px;">SKU: <strong>${item.producto_sku}</strong></span>
                        <div style="display:flex; flex-wrap:wrap; gap:10px; font-size:12px; color:#555;">
                            <span>Costo Base: <strong>$${item.costo_total.toFixed(2)}</strong></span>
                            <span>Retail: <strong>$${item.precio_retail.toFixed(2)}</strong></span>
                            <span>Margen: <strong style="color:var(--color-success);">${margen}%</strong></span>
                        </div>
                        ${item.notas ? `<p style="font-size:11px; font-style:italic; margin-top:6px; color:var(--color-olive-brown);">📝 ${item.notas}</p>` : ''}
                    </div>
                    <div style="text-align:right; display:flex; flex-direction:column; align-items:flex-end; gap:6px; flex-shrink:0;">
                        <div style="font-size:20px; font-weight:700; color:var(--color-moss-green);">$${item.precio_especial.toFixed(2)}</div>
                        <span class="badge badge-success" style="font-size:9.5px; background-color:var(--color-moss-green-light); color:var(--color-moss-green); border:1px solid rgba(95,90,48,0.2);">Precio Pactado</span>
                        <button class="btn btn-secondary btn-delete-catalogo-item" style="padding:4px 8px; font-size:11px; margin-top:4px; border:none; background:none; box-shadow:none; color:var(--color-danger);" data-id="${item.id}">
                            Retirar
                        </button>
                    </div>
                </div>
            `;
            container.appendChild(div);

        });

        // Event listeners para retirar item
        container.querySelectorAll('.btn-delete-catalogo-item').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.getAttribute('data-id'));
                if (confirm("¿Estás seguro de que deseas retirar este producto del catálogo especial de este cliente?")) {
                    try {
                        await EvergreenAPI.deleteProductoCatalogoCliente(id);
                        await this.loadClienteCatalog();
                    } catch (err) {
                        alert("Error al retirar del catálogo: " + err.message);
                    }
                }
            });
        });

        lucide.createIcons();
    },

    setupListeners() {
        const btnNuevoCliente = document.getElementById('btn-nuevo-cliente');
        const modalCliente = document.getElementById('cliente-modal');
        const btnCloseCliente = document.getElementById('btn-close-cl-modal');
        const formCliente = document.getElementById('form-nuevo-cliente');

        const btnAsoc = document.getElementById('btn-asociar-producto-b2b');
        const modalAsoc = document.getElementById('asociar-modal');
        const btnCloseAsoc = document.getElementById('btn-close-asoc-modal');
        const formAsoc = document.getElementById('form-asociar-producto');
        const selectProd = document.getElementById('asoc-producto-id');
        const labelPrecioSug = document.getElementById('asoc-precio-sug');

        // Modal Nuevo Cliente
        if (btnNuevoCliente) {
            btnNuevoCliente.addEventListener('click', () => {
                modalCliente.style.display = 'flex';
            });
        }
        if (btnCloseCliente) {
            btnCloseCliente.addEventListener('click', () => {
                modalCliente.style.display = 'none';
            });
        }

        formCliente.addEventListener('submit', async (e) => {
            e.preventDefault();
            const clienteData = {
                nombre: document.getElementById('cl-nombre').value.trim(),
                contacto: document.getElementById('cl-contacto').value.trim() || null,
                email: document.getElementById('cl-email').value.trim() || null,
                telefono: document.getElementById('cl-telefono').value.trim() || null,
                notas: document.getElementById('cl-notas').value.trim() || null
            };

            try {
                const res = await EvergreenAPI.createCliente(clienteData);
                modalCliente.style.display = 'none';
                formCliente.reset();
                this.selectedClienteId = res.id;
                await this.loadData();
                this.loadClienteCatalog();
            } catch (err) {
                alert("Error al registrar cliente: " + err.message);
            }
        });

        // Modal Asignar Producto
        if (btnAsoc) {
            btnAsoc.addEventListener('click', () => {
                if (!this.selectedClienteId) return;
                modalAsoc.style.display = 'flex';
            });
        }
        if (btnCloseAsoc) {
            btnCloseAsoc.addEventListener('click', () => {
                modalAsoc.style.display = 'none';
                formAsoc.reset();
                labelPrecioSug.innerText = '';
            });
        }

        selectProd.addEventListener('change', (e) => {
            const opt = selectProd.options[selectProd.selectedIndex];
            if (opt && opt.value) {
                const costo = parseFloat(opt.dataset.costo);
                const retail = parseFloat(opt.dataset.retail);
                labelPrecioSug.innerHTML = `Precio sugerido: Costo base <strong>$${costo.toFixed(2)}</strong> | Precio Retail sugerido <strong>$${retail.toFixed(2)}</strong>`;
            } else {
                labelPrecioSug.innerText = '';
            }
        });

        formAsoc.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!this.selectedClienteId) return;

            const asocData = {
                cliente_id: this.selectedClienteId,
                producto_id: parseInt(selectProd.value),
                precio_especial: parseFloat(document.getElementById('asoc-precio').value),
                notas: document.getElementById('asoc-notas').value.trim() || null
            };

            try {
                await EvergreenAPI.addProductoCatalogoCliente(asocData);
                modalAsoc.style.display = 'none';
                formAsoc.reset();
                labelPrecioSug.innerText = '';
                await this.loadClienteCatalog();
            } catch (err) {
                alert("Error al asociar producto: " + err.message);
            }
        });
    }
};

// Muestra el modal con el enlace del portal B2B del cliente seleccionado
function abrirPortalB2B() {
    const id = ClientesComponent.selectedClienteId;
    if (!id) return;
    // Usar la IP local de la red para que funcione desde teléfonos en el mismo WiFi
    const serverBase = 'http://192.168.86.30:8000';
    const url = `${serverBase}/catalogo_b2b.html?cliente=${id}`;
    document.getElementById('b2b-link-url').value = url;
    document.getElementById('b2b-link-open').href = url;
    const modal = document.getElementById('b2b-link-modal');
    modal.style.display = 'flex';
    lucide.createIcons();
}

// Muestra el modal con el enlace del catálogo público
function abrirCatalogoPublicoLink() {
    const serverBase = window.location.origin || 'http://192.168.86.30:8000';
    const url = `${serverBase}/catalogo_publico.html`;
    document.getElementById('catalogo-publico-url').value = url;
    document.getElementById('catalogo-publico-open').href = url;
    const modal = document.getElementById('catalogo-publico-modal');
    modal.style.display = 'flex';
    lucide.createIcons();
}

// Copia el enlace B2B al portapapeles
async function copiarEnlaceB2B() {
    const input = document.getElementById('b2b-link-url');
    try {
        await navigator.clipboard.writeText(input.value);
        const btn = document.getElementById('btn-copy-b2b-link');
        const original = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="check" style="width:14px;height:14px;"></i> ¡Copiado!';
        btn.style.background = '#27ae60';
        lucide.createIcons();
        setTimeout(() => {
            btn.innerHTML = original;
            btn.style.background = '';
            lucide.createIcons();
        }, 2000);
    } catch {
        input.select();
        document.execCommand('copy');
    }
}

// Copia el enlace del catálogo público al portapapeles
async function copiarEnlaceCatalogoPublico() {
    const input = document.getElementById('catalogo-publico-url');
    try {
        await navigator.clipboard.writeText(input.value);
        const btn = document.getElementById('btn-copy-catalogo-publico');
        const original = btn.innerHTML;
        btn.innerHTML = '<i data-lucide="check" style="width:14px;height:14px;"></i> ¡Copiado!';
        btn.style.background = '#27ae60';
        lucide.createIcons();
        setTimeout(() => {
            btn.innerHTML = original;
            btn.style.background = '';
            lucide.createIcons();
        }, 2000);
    } catch {
        input.select();
        document.execCommand('copy');
    }
}

