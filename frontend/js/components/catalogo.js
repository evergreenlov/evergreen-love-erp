/**
 * Componente Catálogo Clientes - muestra los productos disponibles al público.
 * Usa la API GET /api/productos para obtener lista de productos con campos:
 *   id, sku, nombre, precio_final, foto_ruta (url de foto), categoria.
 * Renderiza tarjetas elegantes con tipografía Inter, colores oliva y efecto glassmorphism.
 */
const CatalogoComponent = {
    productos: [],
    currentFilter: 'all',

    _tipoLabels: {
        canva:           'Canvas',
        llavero:         'Llaveros',
        garita:          'Garitas',
        shadow_box:      'Shadow Box',
        ornamento:       'Ornamentos',
        portada_libreta: 'Libretas',
        lapicero:        'Lapiceros',
        barco:           'Barcos',
        base_soporte:    'Bases / Soportes',
        macrame:         'Macramé',
        madera:          'Madera',
        catalogo:        'Catálogo',
        personalizado:   'Personalizados',
        otro:            'Otros',
    },

    async render(containerId) {
        const container = document.getElementById(containerId);
        const isAdmin = !!document.querySelector('.sidebar');
        container.innerHTML = `
            <div class="card" style="margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 16px;">
                    <div>
                        <h3 class="card-title" style="margin: 0 0 4px 0;">Catálogo de Productos</h3>
                        <p style="color: #6c757d; font-size: 14.5px; margin: 0;">
                            Explora nuestro catálogo de productos láser. Cada tarjeta muestra foto, nombre y precio.
                        </p>
                    </div>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        ${isAdmin ? `
                        <button class="btn btn-secondary" id="btn-config-cloudflare-catalogo" style="border-color: #f38020; color: #f38020; padding: 8px 14px; font-size: 13px; display: inline-flex; gap: 6px; align-items: center;">
                            <i data-lucide="cloud"></i> Integrar Cloudflare R2
                        </button>
                        <button class="btn btn-secondary" id="btn-compartir-catalogo-pub" style="padding: 8px 14px; font-size: 13px; display: inline-flex; gap: 6px; align-items: center;" onclick="CatalogoComponent.abrirEnlaceCatalogo()">
                            <i data-lucide="share-2"></i> Compartir Enlace Catálogo
                        </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Sub-pestañas / Filtros — se construyen dinámicamente en renderFilterTabs() -->
                <div id="catalogo-filter-bar" style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:20px; border-bottom:1.5px solid #eae5dc; padding-bottom:10px;"></div>

                <div id="catalogo-cards" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 260px)); gap: 24px;"></div>
            </div>
            <div id="product-edit-modal" style="display: none;"></div>
            <div id="simulador-modal" class="modal-overlay" style="display: none;"></div>

            <!-- Modal de Configuración de Cloudflare R2 -->
            <div id="cloudflare-config-modal-catalogo" class="modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(62, 62, 62, 0.4); backdrop-filter: blur(4px); z-index: 3000; justify-content: center; align-items: center;"></div>

            <!-- MODAL: ENLACE CATÁLOGO PÚBLICO -->
            <div id="catalogo-pub-share-modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.45); backdrop-filter:blur(4px); z-index:3000; align-items:center; justify-content:center;">
                <div style="background:white; border-radius:16px; padding:28px 28px 24px; max-width:480px; width:90%; box-shadow:0 12px 40px rgba(0,0,0,0.18); text-align: left;">
                    <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                        <i data-lucide="globe" style="width:20px;height:20px;color:var(--color-moss-green);"></i>
                        <h3 style="margin:0; font-size:16px; color:var(--color-moss-green);">Enlace del Catálogo Público</h3>
                    </div>
                    <p style="font-size:13px; color:#8c8270; margin:0 0 16px;">Comparte este enlace con cualquier cliente para que explore tu catálogo de productos y realice pedidos. No requiere código de cliente ni acceso especial.</p>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <input id="catalogo-pub-share-url" type="text" readonly style="flex:1; padding:10px 12px; border:1.5px solid #e0d9ce; border-radius:8px; font-size:12px; color:#444; background:#fdfaf5; font-family:monospace; cursor:pointer;" onclick="this.select()">
                        <button id="btn-copy-catalogo-pub-share" onclick="CatalogoComponent.copiarEnlace()" style="padding:10px 14px; background:var(--color-moss-green); color:white; border:none; border-radius:8px; cursor:pointer; font-size:13px; font-weight:600; white-space:nowrap; display:flex; align-items:center; gap:6px;">
                            <i data-lucide="copy" style="width:14px;height:14px;"></i> Copiar
                        </button>
                    </div>
                    <p style="font-size:11px; color:#a89880; margin:8px 0 0;">💡 Tip: También puedes hacer clic en el enlace para seleccionarlo y copiarlo manualmente.</p>
                    <div style="margin-top:16px; display:flex; gap:10px; justify-content:flex-end;">
                        <a id="catalogo-pub-share-open" href="#" target="_blank" rel="noopener" style="display:inline-flex; align-items:center; gap:6px; padding:9px 16px; border:1.5px solid var(--color-moss-green); color:var(--color-moss-green); border-radius:8px; font-size:13px; font-weight:600; text-decoration:none;">
                            <i data-lucide="external-link" style="width:14px;height:14px;"></i> Abrir
                        </a>
                        <button onclick="document.getElementById('catalogo-pub-share-modal').style.display='none'" style="padding:9px 16px; background:#f5f5f5; border:none; border-radius:8px; font-size:13px; cursor:pointer;">Cerrar</button>
                    </div>
                </div>
            </div>
        `;
        lucide.createIcons();

        const btnConfigR2 = document.getElementById('btn-config-cloudflare-catalogo');
        if (btnConfigR2) {
            btnConfigR2.addEventListener('click', () => this.openCloudflareConfigModal());
        }

        await this.loadProductos();
        this.renderFilterTabs();
        this.renderCards();
    },

    openCloudflareConfigModal() {
        const modal = document.getElementById('cloudflare-config-modal-catalogo');
        const accountId = localStorage.getItem('evergreen_cloudflare_account_id') || '';
        const apiToken = localStorage.getItem('evergreen_cloudflare_api_token') || '';
        const bucket = localStorage.getItem('evergreen_cloudflare_bucket') || '';
        const deliveryUrl = localStorage.getItem('evergreen_cloudflare_delivery_url') || '';

        modal.innerHTML = `
            <div class="modal-card card" style="max-width: 480px; width: 90%; margin: 0; position: relative; background: white; border-radius: 12px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); text-align: left;">
                <h3 class="card-title" style="display: flex; align-items: center; gap: 6px; color: #f38020; margin-top: 0;">
                    <i data-lucide="cloud"></i> Configurar Cloudflare R2
                </h3>
                <p style="color: #6c757d; font-size: 13px; margin-bottom: 16px; line-height: 1.4;">
                    Configura tu bucket de Cloudflare R2 para almacenar las imágenes del catálogo en la nube. Esto guardará las imágenes de forma permanente.
                </p>
                
                <form id="cloudflare-config-form-catalogo" style="display: flex; flex-direction: column; gap: 14px;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; font-size: 13px;">Account ID (ID de Cuenta)</label>
                        <input type="text" id="cf-account-id" value="${accountId}" placeholder="Ej. 1a2b3c4d5e6f7g8h9i0j..." style="padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); font-size: 13px;">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; font-size: 13px;">API Token (Token de API de R2)</label>
                        <input type="password" id="cf-api-token" value="${apiToken}" placeholder="Token de Cloudflare con permisos de edición R2" style="padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); font-size: 13px;">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; font-size: 13px;">Bucket Name (Nombre del Bucket)</label>
                        <input type="text" id="cf-bucket" value="${bucket}" placeholder="Ej. evergreen-fotos" style="padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); font-size: 13px;">
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; font-size: 13px;">Delivery URL (URL Pública / Dominio R2)</label>
                        <input type="url" id="cf-delivery-url" value="${deliveryUrl}" placeholder="Ej. https://pub-xxxxxx.r2.dev" style="padding: 8px 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); font-size: 13px;">
                    </div>
                    <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 10px;">
                        <button type="button" class="btn btn-secondary" onclick="document.getElementById('cloudflare-config-modal-catalogo').style.display='none'">Cancelar</button>
                        <button type="submit" class="btn btn-primary" style="background: #f38020; border-color: #f38020; color: white;">Guardar Configuración</button>
                    </div>
                </form>
            </div>
        `;
        modal.style.display = 'flex';
        lucide.createIcons();

        document.getElementById('cloudflare-config-form-catalogo').addEventListener('submit', (e) => {
            e.preventDefault();
            const idVal = document.getElementById('cf-account-id').value.trim();
            const tokenVal = document.getElementById('cf-api-token').value.trim();
            const bucketVal = document.getElementById('cf-bucket').value.trim();
            const deliveryVal = document.getElementById('cf-delivery-url').value.trim();

            if (idVal && tokenVal && bucketVal) {
                localStorage.setItem('evergreen_cloudflare_account_id', idVal);
                localStorage.setItem('evergreen_cloudflare_api_token', tokenVal);
                localStorage.setItem('evergreen_cloudflare_bucket', bucketVal);
                if (deliveryVal) {
                    localStorage.setItem('evergreen_cloudflare_delivery_url', deliveryVal);
                } else {
                    localStorage.removeItem('evergreen_cloudflare_delivery_url');
                }
                alert("Configuración de Cloudflare R2 guardada correctamente.");
            } else {
                localStorage.removeItem('evergreen_cloudflare_account_id');
                localStorage.removeItem('evergreen_cloudflare_api_token');
                localStorage.removeItem('evergreen_cloudflare_bucket');
                localStorage.removeItem('evergreen_cloudflare_delivery_url');
                alert("Configuración de Cloudflare R2 eliminada. Las subidas se mantendrán locales.");
            }
            modal.style.display = 'none';
        });
    },

    async loadProductos() {
        try {
            const isAdmin = !!document.querySelector('.sidebar');
            const res = isAdmin
                ? await EvergreenAPI.getProductos()
                : await fetch(`${API_BASE_URL}/productos/publico`).then(r => r.json());
            this.productos = res.data || [];
        } catch (e) {
            console.error('Error cargando productos:', e);
            const cardsDiv = document.getElementById('catalogo-cards');
            cardsDiv.innerHTML = `<p style="color: var(--color-danger);">No se pudieron cargar los productos.</p>`;
        }
    },
    _TABS: [
        { value: 'all',          label: 'Todos' },
        { value: 'canva',        label: 'Canvas' },
        { value: 'macrame',      label: 'Macramé' },
        { value: 'madera',       label: 'Madera' },
        { value: 'catalogo',     label: 'Catálogo' },
        { value: 'personalizado', label: 'Personalizados' },
    ],

    renderFilterTabs() {
        const bar = document.getElementById('catalogo-filter-bar');
        if (!bar) return;
        bar.innerHTML = this._TABS.map(({ value, label }) => {
            const active = this.currentFilter === value;
            return `<button
                class="sub-tab-btn"
                data-filter="${value}"
                onclick="CatalogoComponent.setFilter('${value}')"
                style="padding:6px 16px; border-radius:20px; font-size:13px; font-weight:${active ? '600' : '500'}; cursor:pointer; outline:none; transition:all 0.18s;
                       background:${active ? 'var(--color-moss-green)' : 'transparent'};
                       color:${active ? '#fff' : '#8c8270'};
                       border:1.5px solid ${active ? 'var(--color-moss-green)' : '#ddd'};
                       box-shadow:${active ? '0 2px 8px rgba(95,120,48,0.2)' : 'none'};">
                ${label}
            </button>`;
        }).join('');
    },

    setFilter(filter) {
        this.currentFilter = filter;
        this.renderFilterTabs();
        this.renderCards();
    },
    personalizarProducto(productoId) {
        const prod = this.productos.find(p => p.id === productoId);
        if (typeof CotizacionModal !== 'undefined') {
            CotizacionModal.open({
                productoId: prod ? prod.id : null,
                productoNombre: prod ? prod.nombre : null,
                precioFinal: prod ? prod.precio_final : null,
                preciosVolumen: prod ? {
                    p1:  prod.precio_final || null,
                    p12: prod.precio_wholesale_12 || null,
                    p24: prod.precio_wholesale_24 || null,
                    p50: prod.precio_wholesale_50 || null,
                } : null,
                imagenUrl: prod ? (prod.foto_ruta || null) : null,
                galeria: prod ? (prod.galeria || []) : [],
                fuente: 'publico'
            });
        } else if (prod && typeof PersonalizadosComponent !== 'undefined') {
            PersonalizadosComponent.openSimuladorModal(prod);
        } else {
            alert("El configurador no está disponible en este momento.");
        }
    },
    renderCards() {
        const cardsDiv = document.getElementById('catalogo-cards');
        let filteredProds = this.productos;

        if (this.currentFilter === 'personalizado') {
            filteredProds = this.productos.filter(p => Number(p.personalizado) === 1 || p.tipo_producto === 'personalizado');
        } else if (this.currentFilter !== 'all') {
            filteredProds = this.productos.filter(p => p.tipo_producto === this.currentFilter);
        }

        if (!filteredProds.length) {
            cardsDiv.innerHTML = `<p style="color:#8c8c8c; grid-column: 1 / -1; text-align: center; padding: 40px;">No hay productos disponibles en esta sección.</p>`;
            return;
        }

        const isPublic = window.location.pathname.includes('catalogo_publico.html');

        const cardHtml = filteredProds.map(p => {
            const adminOverlayHtml = !isPublic ? `
                <div style="position: absolute; top: 10px; right: 10px; display: flex; gap: 6px; z-index: 10;">
                    <button onclick="event.stopPropagation(); CatalogoComponent.openEditModal(${p.id})" style="background: rgba(255,255,255,0.8); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.4); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--color-soft-black); box-shadow: 0 4px 12px rgba(0,0,0,0.08); transition: transform 0.2s; padding:0; outline: none;" onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'" title="Editar Producto">
                        <i data-lucide="pencil" style="width: 14px; height: 14px;"></i>
                    </button>
                    <button onclick="event.stopPropagation(); CatalogoComponent.deleteProduct(${p.id})" style="background: rgba(255,255,255,0.8); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); border: 1px solid rgba(255, 255, 255, 0.4); width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--color-danger); box-shadow: 0 4px 12px rgba(0,0,0,0.08); transition: transform 0.2s; padding:0; outline: none;" onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'" title="Eliminar Producto">
                        <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
                    </button>
                </div>
            ` : '';

            // Badge elegante para productos personalizables
            const customBadgeHtml = Number(p.personalizado) === 1 ? `
                <div style="position: absolute; top: 10px; left: 10px; z-index: 9;">
                    <span style="background: linear-gradient(135deg, var(--color-terracotta), #e27c4c); color: white; font-size: 10px; font-weight: 700; padding: 4px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 4px 10px rgba(198, 95, 47, 0.25);">
                        <i data-lucide="sparkles" style="width:10px;height:10px;"></i> Personalizar
                    </span>
                </div>
            ` : '';
            const qvData = JSON.stringify(p).replace(/'/g, "\\'");
            const fotoImg = p.foto_ruta
                ? `<div style="width:100%; height:175px; background: linear-gradient(135deg, #fdfbf7 0%, #f5f0e6 100%); display:flex; align-items:center; justify-content:center; border-bottom: 1px solid rgba(237, 230, 216, 0.5); overflow:hidden; position:relative; padding: 8px; box-sizing: border-box; cursor:zoom-in;" onclick="CatalogoComponent.openQuickView(${qvData.replace(/"/g,'&quot;')})">
                    ${customBadgeHtml}
                    <img src="${getFullImageUrl(p.foto_ruta)}" alt="${p.nombre}" style="max-width:100%; max-height:100%; object-fit:contain; display:block; transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1);">
                    ${adminOverlayHtml}
                   </div>`
                : `<div style="width:100%; height:175px; background: linear-gradient(135deg, #fbfbfb 0%, #f0f0f0 100%); display:flex; align-items:center; justify-content:center; color:#ac9f8a; font-size:12.5px; font-style: italic; border-bottom: 1px solid rgba(237, 230, 216, 0.5); position:relative; gap: 6px;">
                    ${customBadgeHtml}
                    <i data-lucide="image" style="width:18px; height:18px; opacity:0.6;"></i>
                    Sin foto disponible
                    ${adminOverlayHtml}
                   </div>`;

            const price = p.precio_final ? `$${p.precio_final.toFixed(2)}` : `$${p.precio_sugerido.toFixed(2)}`;
            
            const adminActionsHtml = !isPublic ? `
                <label class="btn btn-secondary" style="margin-top:8px; width:100%; padding:6px; font-size:12px; cursor:pointer; text-align:center; display:block; border: 1px solid var(--color-gray-border); border-radius: 4px; background: white; color: var(--color-soft-black);">
                    <i data-lucide="upload" style="width:14px; height:14px; vertical-align:middle; margin-right:4px;"></i> Subir Foto
                    <input type="file" style="display:none;" accept="image/*" onchange="CatalogoComponent.uploadPhoto(${p.id}, this)">
                </label>
            ` : '';

            const skuHtml = p.sku ? `<p style="margin:0 0 6px 0; color: var(--color-soft-black); font-size: 12px; opacity: 0.8;">${p.sku}</p>` : '';
            const descHtml = p.shopify_descripcion 
                ? `<p style="margin:0 0 12px 0; color: #736b5c; font-size: 12.5px; font-style: italic; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; text-overflow: ellipsis; height: 35px;">${p.shopify_descripcion}</p>` 
                : '<div style="height:35px;"></div>';

            const actionBtn = Number(p.personalizado) === 1 
                ? `<button onclick="CatalogoComponent.personalizarProducto(${p.id})" style="width:100%; background: var(--color-terracotta); color: white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-family: var(--font-primary); font-weight: 600; font-size: 13px; display:flex; align-items:center; justify-content:center; gap: 8px; transition: all 0.2s; box-shadow: 0 2px 8px rgba(198, 95, 47, 0.15);">
                        <i data-lucide="sparkles" style="width:14px; height:14px;"></i> Personalizar & Cotizar
                   </button>`
                : `<button onclick="Carrito.agregar(${p.id})" style="width:100%; background: var(--color-moss-green); color: white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-family: var(--font-primary); font-weight: 600; font-size: 13px; display:flex; align-items:center; justify-content:center; gap: 8px; transition: all 0.2s; box-shadow: 0 2px 8px rgba(95, 120, 48, 0.15);">
                        <i data-lucide="shopping-cart" style="width:14px; height:14px;"></i> Añadir al pedido
                   </button>`;

            return `
                <div class="card catalog-card" style="display: flex; flex-direction: column; width: 100%; padding: 0; background: #ffffff; border-radius: var(--radius-lg); overflow:hidden; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 4px 16px rgba(0,0,0,0.04); border: 1px solid rgba(237, 230, 216, 0.6); position: relative; height: 380px;">
                    ${fotoImg}
                    <div style="padding:16px; text-align:center; display: flex; flex-direction: column; flex: 1; justify-content: space-between; box-sizing: border-box;">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                            <h4 style="font-family: var(--font-primary); margin:0; font-weight:600; color: var(--color-moss-green); font-size: 15px; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${p.nombre}">${p.nombre}</h4>
                            ${skuHtml}
                            ${descHtml}
                        </div>
                        <div>
                            <p style="margin:0 0 8px 0; font-weight:700; color: var(--color-moss-green); font-size: 17px;">${price}</p>
                            ${actionBtn}
                            <button class="pub-qv-ver-btn" onclick="CatalogoComponent.openQuickView(${qvData.replace(/"/g,'&quot;')})">
                                <i data-lucide="eye" style="width:13px;height:13px;"></i> Ver detalles
                            </button>
                            ${adminActionsHtml}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        cardsDiv.innerHTML = cardHtml;
        
        lucide.createIcons();

        // hover animation
        const cards = cardsDiv.querySelectorAll('.catalog-card');
        cards.forEach(c => {
            const img = c.querySelector('img');
            c.addEventListener('mouseenter', () => {
                c.style.transform = 'translateY(-6px)';
                c.style.boxShadow = '0 12px 30px rgba(95, 120, 48, 0.12)';
                c.style.borderColor = 'var(--color-moss-green)';
                if (img) img.style.transform = 'scale(1.08)';
            });
            c.addEventListener('mouseleave', () => {
                c.style.transform = 'translateY(0)';
                c.style.boxShadow = '0 4px 16px rgba(0,0,0,0.04)';
                c.style.borderColor = 'rgba(237, 230, 216, 0.6)';
                if (img) img.style.transform = 'scale(1)';
            });
        });
    },

    async uploadPhoto(productoId, inputElement) {
        if (!inputElement.files || inputElement.files.length === 0) return;
        const file = inputElement.files[0];
        try {
            await EvergreenAPI.subirFoto(file, null, productoId, 'referencia');
            alert('Foto subida con éxito.');
            await this.loadProductos();
            this.renderCards();
        } catch (error) {
            console.error('Error al subir la foto:', error);
            alert('Hubo un error al subir la foto.');
        }
    },

    async openEditModal(productoId) {
        // Redirigir al usuario a la pestaña de Costos y Precios con el producto cargado en la calculadora
        if (typeof CostosComponent !== 'undefined') {
            CostosComponent.editingProductoId = productoId;
        }
        window.location.hash = 'costos';
    },

    async deleteProduct(productoId) {
        if (!confirm("¿Estás seguro de que deseas eliminar este producto permanentemente del catálogo? Esta acción no se puede deshacer y también eliminará sus componentes costeados asociados.")) return;
        try {
            await EvergreenAPI.deleteProducto(productoId);
            await this.loadProductos();
            this.renderCards();
        } catch (error) {
            console.error("Error al eliminar el producto:", error);
            alert("Hubo un error al eliminar el producto.");
        }
    },

    abrirEnlaceCatalogo() {
        const serverBase = window.location.origin || 'http://192.168.86.30:8000';
        const url = `${serverBase}/catalogo_publico.html`;
        document.getElementById('catalogo-pub-share-url').value = url;
        document.getElementById('catalogo-pub-share-open').href = url;
        const modal = document.getElementById('catalogo-pub-share-modal');
        modal.style.display = 'flex';
        lucide.createIcons();
    },

    async copiarEnlace() {
        const input = document.getElementById('catalogo-pub-share-url');
        try {
            await navigator.clipboard.writeText(input.value);
            const btn = document.getElementById('btn-copy-catalogo-pub-share');
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
    },

    // ── QUICK VIEW ────────────────────────────────────────────────────────────
    _qvReady: false,

    _initQuickView() {
        if (this._qvReady) return;
        this._qvReady = true;

        // CSS
        const style = document.createElement('style');
        style.textContent = `
            #pub-qv-overlay {
                display:none; position:fixed; inset:0;
                background:rgba(0,0,0,0.55); backdrop-filter:blur(6px);
                z-index:9000; padding:20px; overflow-y:auto;
                align-items:flex-start; justify-content:center;
            }
            #pub-qv-overlay.open { display:flex; }
            #pub-qv-modal {
                background:white; border-radius:24px;
                width:100%; max-width:860px; margin:auto; overflow:hidden;
                box-shadow:0 24px 80px rgba(0,0,0,0.22);
                display:grid; grid-template-columns:1fr 1fr; min-height:420px;
                animation:pub-qv-in 0.25s cubic-bezier(0.34,1.56,0.64,1);
            }
            @keyframes pub-qv-in {
                from{opacity:0;transform:scale(0.93) translateY(20px);}
                to  {opacity:1;transform:scale(1) translateY(0);}
            }
            #pub-qv-img-col {
                background:linear-gradient(135deg,#f7f3ee,#ede6da);
                display:flex; flex-direction:column; align-items:center;
                justify-content:center; padding:32px; position:relative; min-height:340px;
            }
            #pub-qv-img { max-width:100%; max-height:320px; object-fit:contain; border-radius:12px; }
            #pub-qv-img-ph {
                display:none; flex-direction:column; align-items:center;
                gap:10px; color:#c8bba8; font-size:13px;
            }
            #pub-qv-thumbs {
                display:flex; gap:8px; flex-wrap:wrap;
                justify-content:center; margin-top:14px;
            }
            .pub-qv-thumb {
                width:54px; height:54px; object-fit:contain; border-radius:8px;
                border:2px solid transparent; background:white; cursor:pointer;
                padding:2px; transition:border-color 0.15s, transform 0.15s;
            }
            .pub-qv-thumb:hover { transform:scale(1.08); }
            .pub-qv-thumb.active { border-color:var(--color-moss-green); }
            #pub-qv-close {
                position:absolute; top:14px; right:14px;
                width:34px; height:34px; background:rgba(255,255,255,0.85);
                border:none; border-radius:50%; cursor:pointer;
                display:flex; align-items:center; justify-content:center;
                font-size:18px; color:#555;
                box-shadow:0 2px 8px rgba(0,0,0,0.12); transition:background 0.15s; z-index:10;
            }
            #pub-qv-close:hover { background:white; color:#222; }
            #pub-qv-info {
                padding:36px 32px; display:flex; flex-direction:column; gap:14px; overflow-y:auto;
            }
            #pub-qv-badge {
                display:none; background:var(--color-terracotta,#c0634c); color:white;
                font-size:10px; font-weight:700; letter-spacing:0.7px; text-transform:uppercase;
                padding:4px 10px; border-radius:20px; width:fit-content;
                align-items:center; gap:4px;
            }
            #pub-qv-badge.visible { display:flex; }
            #pub-qv-nombre {
                font-family:var(--font-secondary); font-size:22px; font-weight:700;
                color:#1e1e1e; line-height:1.3; margin:0;
            }
            #pub-qv-sku { font-size:11.5px; color:#b0a090; }
            #pub-qv-price { font-size:32px; font-weight:800; color:var(--color-moss-green); line-height:1; }
            #pub-qv-desc { font-size:14px; color:#444; line-height:1.6; margin:0; }
            #pub-qv-medidas {
                display:none; font-size:13px; color:#555;
                background:#f7f3ee; border-radius:8px; padding:10px 14px;
            }
            #pub-qv-medidas.visible { display:block; }
            #pub-qv-btn {
                width:100%; padding:13px; border:none; border-radius:12px;
                background:var(--color-moss-green); color:white;
                font-family:var(--font-primary); font-size:14px; font-weight:700;
                cursor:pointer; display:flex; align-items:center; justify-content:center;
                gap:8px; transition:filter 0.2s, transform 0.2s; margin-top:auto;
            }
            #pub-qv-btn:hover { filter:brightness(1.08); transform:translateY(-1px); }
            #pub-qv-btn.personalizar { background:var(--color-terracotta,#c0634c); }
            .pub-qv-ver-btn {
                width:100%; margin-top:8px; padding:7px;
                background:transparent; color:#8c8270;
                border:1.5px solid #ddd; border-radius:8px;
                font-family:var(--font-primary); font-size:12px; font-weight:600;
                cursor:pointer; display:flex; align-items:center; justify-content:center;
                gap:5px; transition:all 0.2s;
            }
            .pub-qv-ver-btn:hover { border-color:var(--color-moss-green); color:var(--color-moss-green); }
            #pub-qv-related { display:none; border-top:1px solid #f0ece4; padding-top:14px; }
            #pub-qv-related-label {
                font-size:10.5px; font-weight:700; text-transform:uppercase;
                letter-spacing:0.6px; color:#8c8270; margin-bottom:10px;
            }
            #pub-qv-rel-grid {
                display:grid; grid-template-columns:repeat(4,1fr); gap:8px;
            }
            .pub-qv-rel-card { cursor:pointer; text-align:center; }
            .pub-qv-rel-img-wrap {
                aspect-ratio:1; background:#f7f3ee; border-radius:8px; overflow:hidden;
                margin-bottom:5px; display:flex; align-items:center; justify-content:center;
                transition:transform 0.15s, box-shadow 0.15s;
            }
            .pub-qv-rel-card:hover .pub-qv-rel-img-wrap {
                transform:translateY(-2px); box-shadow:0 4px 12px rgba(0,0,0,0.12);
            }
            .pub-qv-rel-img-wrap img { width:100%; height:100%; object-fit:contain; }
            .pub-qv-rel-name {
                font-size:10.5px; font-weight:600; color:#333; line-height:1.3;
                display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;
            }
            .pub-qv-rel-price { font-size:11px; color:var(--color-moss-green); font-weight:700; margin-top:2px; }
            @media(max-width:680px){
                #pub-qv-modal { grid-template-columns:1fr; border-radius:20px; }
                #pub-qv-img-col { min-height:220px; padding:24px; }
                #pub-qv-img { max-height:200px; }
                #pub-qv-info { padding:24px 20px; }
                #pub-qv-nombre { font-size:18px; }
                #pub-qv-price { font-size:26px; }
                #pub-qv-rel-grid { grid-template-columns:repeat(2,1fr); }
            }
        `;
        document.head.appendChild(style);

        // HTML del modal
        const overlay = document.createElement('div');
        overlay.id = 'pub-qv-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.innerHTML = `
            <div id="pub-qv-modal">
                <div id="pub-qv-img-col">
                    <button id="pub-qv-close" aria-label="Cerrar">✕</button>
                    <img id="pub-qv-img" src="" alt="" style="display:none;">
                    <div id="pub-qv-img-ph">
                        <i data-lucide="image" style="width:56px;height:56px;"></i>
                        Sin imagen
                    </div>
                    <div id="pub-qv-thumbs"></div>
                </div>
                <div id="pub-qv-info">
                    <div id="pub-qv-badge">
                        <i data-lucide="sparkles" style="width:11px;height:11px;"></i> Personalizable
                    </div>
                    <h2 id="pub-qv-nombre"></h2>
                    <div id="pub-qv-sku"></div>
                    <div id="pub-qv-price"></div>
                    <hr style="border:none;border-top:1px solid #f0ece4;margin:0;">
                    <p id="pub-qv-desc"></p>
                    <div id="pub-qv-medidas">
                        <i data-lucide="ruler" style="width:12px;height:12px;display:inline;margin-right:4px;"></i>
                        <span id="pub-qv-medidas-txt"></span>
                    </div>
                    <div id="pub-qv-related">
                        <div id="pub-qv-related-label">También te puede gustar</div>
                        <div id="pub-qv-rel-grid"></div>
                    </div>
                    <button id="pub-qv-btn">
                        <i id="pub-qv-btn-icon" data-lucide="shopping-cart" style="width:15px;height:15px;"></i>
                        <span id="pub-qv-btn-lbl">Añadir al pedido</span>
                    </button>
                </div>
            </div>`;
        document.body.appendChild(overlay);

        // Cerrar
        const closeQV = () => {
            overlay.classList.remove('open');
            document.body.style.overflow = '';
            this._qvItem = null;
        };
        document.getElementById('pub-qv-close').addEventListener('click', closeQV);
        overlay.addEventListener('click', e => { if (e.target === overlay) closeQV(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeQV(); });

        // Botón acción
        document.getElementById('pub-qv-btn').addEventListener('click', () => {
            const p = this._qvItem;
            if (!p) return;
            closeQV();
            if (Number(p.personalizado) === 1) {
                this.personalizarProducto(p.id);
            } else {
                if (typeof Carrito !== 'undefined') Carrito.agregar(p.id);
            }
        });

        lucide.createIcons();
    },

    _qvItem: null,
    _relacionados: [],

    _getRelacionados(p, max = 4) {
        const all = this.productos || [];
        const tags = (p.shopify_tags || '').toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
        const tagSet = new Set(tags);
        const candidates = all.filter(item => item.id !== p.id);
        if (candidates.length === 0) return [];
        const scored = candidates.map(item => {
            const itags = (item.shopify_tags || '').toLowerCase().split(',').map(t => t.trim()).filter(Boolean);
            return { item, score: itags.filter(t => tagSet.has(t)).length };
        }).sort((a, b) => b.score - a.score);
        const withMatch = scored.filter(s => s.score > 0).slice(0, max);
        const fallback  = scored.filter(s => s.score === 0).slice(0, max - withMatch.length);
        return [...withMatch, ...fallback].map(s => s.item);
    },

    openQuickView(p) {
        this._initQuickView();
        this._qvItem = p;

        const imgEl  = document.getElementById('pub-qv-img');
        const ph     = document.getElementById('pub-qv-img-ph');
        const thumbs = document.getElementById('pub-qv-thumbs');
        const badge  = document.getElementById('pub-qv-badge');
        const btn    = document.getElementById('pub-qv-btn');
        const btnIcon= document.getElementById('pub-qv-btn-icon');
        const btnLbl = document.getElementById('pub-qv-btn-lbl');

        // Helper imagen principal
        const setMain = (src) => {
            imgEl.src = getFullImageUrl(src);
            imgEl.alt = p.nombre;
            imgEl.style.display = 'block';
            ph.style.display = 'none';
            imgEl.onerror = () => { imgEl.style.display='none'; ph.style.display='flex'; };
        };

        // Galería
        const fotos = (p.fotos && p.fotos.length > 0) ? p.fotos : p.foto_ruta ? [p.foto_ruta] : [];
        if (fotos.length > 0) {
            setMain(fotos[0]);
        } else {
            imgEl.style.display = 'none';
            ph.style.display = 'flex';
        }
        thumbs.innerHTML = '';
        if (fotos.length > 1) {
            fotos.forEach((ruta, idx) => {
                const t = document.createElement('img');
                t.src = getFullImageUrl(ruta);
                t.className = 'pub-qv-thumb' + (idx === 0 ? ' active' : '');
                t.onerror = () => t.style.display = 'none';
                t.addEventListener('click', () => {
                    setMain(ruta);
                    thumbs.querySelectorAll('.pub-qv-thumb').forEach(el => el.classList.remove('active'));
                    t.classList.add('active');
                });
                thumbs.appendChild(t);
            });
        }

        // Texto
        document.getElementById('pub-qv-nombre').textContent = p.nombre;
        document.getElementById('pub-qv-sku').textContent = p.sku ? 'SKU: ' + p.sku : '';
        const precio = p.precio_final || p.precio_sugerido || 0;
        document.getElementById('pub-qv-price').textContent = '$' + precio.toFixed(2);
        const descEl = document.getElementById('pub-qv-desc');
        if (p.shopify_descripcion) {
            descEl.innerHTML = `<span style="display:block; border-left:3px solid var(--color-moss-green); padding-left:12px; color:#4a4438; font-size:13.5px; line-height:1.7; font-style:italic;">${p.shopify_descripcion}</span>`;
        } else {
            descEl.innerHTML = '';
        }

        // Medidas
        const medEl = document.getElementById('pub-qv-medidas');
        if (p.ancho && p.alto && parseFloat(p.ancho) > 0 && parseFloat(p.alto) > 0) {
            document.getElementById('pub-qv-medidas-txt').textContent = `${p.ancho}" × ${p.alto}"`;
            medEl.classList.add('visible');
        } else {
            medEl.classList.remove('visible');
        }

        // Badge
        Number(p.personalizado) === 1 ? badge.classList.add('visible') : badge.classList.remove('visible');

        // Botón
        if (Number(p.personalizado) === 1) {
            btn.className = 'personalizar';
            btn.id = 'pub-qv-btn';
            btnIcon.setAttribute('data-lucide', 'sparkles');
            btnLbl.textContent = 'Personalizar & Cotizar';
        } else {
            btn.className = '';
            btn.id = 'pub-qv-btn';
            btnIcon.setAttribute('data-lucide', 'shopping-cart');
            btnLbl.textContent = 'Añadir al pedido';
        }

        // Productos relacionados
        const relEl  = document.getElementById('pub-qv-related');
        const relGrid = document.getElementById('pub-qv-rel-grid');
        this._relacionados = this._getRelacionados(p);
        if (this._relacionados.length > 0) {
            relGrid.innerHTML = this._relacionados.map((r, idx) => {
                const foto   = (r.fotos && r.fotos.length > 0) ? r.fotos[0] : r.foto_ruta;
                const precio = r.precio_final || 0;
                return `<div class="pub-qv-rel-card" data-rel-idx="${idx}">
                    <div class="pub-qv-rel-img-wrap">
                        ${foto
                            ? `<img src="${getFullImageUrl(foto)}" alt="${r.nombre}" onerror="this.style.display='none'">`
                            : '<i data-lucide="image" style="width:24px;height:24px;color:#ccc;"></i>'}
                    </div>
                    <div class="pub-qv-rel-name">${r.nombre}</div>
                    <div class="pub-qv-rel-price">$${precio.toFixed(2)}</div>
                </div>`;
            }).join('');
            relGrid.querySelectorAll('.pub-qv-rel-card').forEach(card => {
                card.addEventListener('click', () => {
                    const idx = parseInt(card.dataset.relIdx, 10);
                    this.openQuickView(this._relacionados[idx]);
                });
            });
            relEl.style.display = 'block';
        } else {
            relEl.style.display = 'none';
        }

        document.getElementById('pub-qv-overlay').classList.add('open');
        document.body.style.overflow = 'hidden';
        lucide.createIcons();
    }
};
