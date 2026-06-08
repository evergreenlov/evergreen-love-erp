/**
 * Componente Catálogo Clientes - muestra los productos disponibles al público.
 * Usa la API GET /api/productos para obtener lista de productos con campos:
 *   id, sku, nombre, precio_final, foto_ruta (url de foto), categoria.
 * Renderiza tarjetas elegantes con tipografía Inter, colores oliva y efecto glassmorphism.
 */
const CatalogoComponent = {
    productos: [],
    currentFilter: 'all',

    async render(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="card" style="margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 16px;">
                    <div>
                        <h3 class="card-title" style="margin: 0 0 4px 0;">Catálogo de Productos</h3>
                        <p style="color: #6c757d; font-size: 14.5px; margin: 0;">
                            Explora nuestro catálogo de productos láser. Cada tarjeta muestra foto, nombre y precio.
                        </p>
                    </div>
                    <div>
                        <button class="btn btn-secondary" id="btn-compartir-catalogo-pub" style="padding: 8px 14px; font-size: 13px; display: inline-flex; gap: 6px; align-items: center;" onclick="CatalogoComponent.abrirEnlaceCatalogo()">
                            <i data-lucide="share-2"></i> Compartir Enlace Catálogo
                        </button>
                    </div>
                </div>

                <!-- Sub-pestañas / Filtros -->
                <div style="display: flex; gap: 16px; margin-bottom: 20px; border-bottom: 1.5px solid #eae5dc; padding-bottom: 8px;">
                    <button class="sub-tab-btn" id="btn-filter-all" style="padding: 6px 12px; border: none; background: none; font-weight: ${this.currentFilter === 'all' ? '600' : '500'}; font-size: 13.5px; color: ${this.currentFilter === 'all' ? 'var(--color-moss-green)' : '#8c8270'}; border-bottom: ${this.currentFilter === 'all' ? '2.5px solid var(--color-moss-green)' : 'none'}; cursor: pointer; outline:none; transition: all 0.2s;" onclick="CatalogoComponent.setFilter('all')">
                        Todos los Productos
                    </button>
                    <button class="sub-tab-btn" id="btn-filter-custom" style="padding: 6px 12px; border: none; background: none; font-weight: ${this.currentFilter === 'custom' ? '600' : '500'}; font-size: 13.5px; color: ${this.currentFilter === 'custom' ? 'var(--color-moss-green)' : '#8c8270'}; border-bottom: ${this.currentFilter === 'custom' ? '2.5px solid var(--color-moss-green)' : 'none'}; cursor: pointer; outline:none; transition: all 0.2s;" onclick="CatalogoComponent.setFilter('custom')">
                        Productos Actualizables / Personalizables
                    </button>
                </div>

                <div id="catalogo-cards" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 260px)); gap: 24px;"></div>
            </div>
            <div id="product-edit-modal" style="display: none;"></div>
            <div id="simulador-modal" class="modal-overlay" style="display: none;"></div>

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
        await this.loadProductos();
        this.renderCards();
    },
    async loadProductos() {
        try {
            const res = await EvergreenAPI.getProductos();
            this.productos = res.data || [];
        } catch (e) {
            console.error('Error cargando productos:', e);
            const cardsDiv = document.getElementById('catalogo-cards');
            cardsDiv.innerHTML = `<p style="color: var(--color-danger);">No se pudieron cargar los productos.</p>`;
        }
    },
    setFilter(filter) {
        this.currentFilter = filter;
        const btnAll = document.getElementById('btn-filter-all');
        const btnCustom = document.getElementById('btn-filter-custom');
        
        if (filter === 'all') {
            btnAll.style.fontWeight = '600';
            btnAll.style.color = 'var(--color-moss-green)';
            btnAll.style.borderBottom = '2.5px solid var(--color-moss-green)';
            
            btnCustom.style.fontWeight = '500';
            btnCustom.style.color = '#8c8270';
            btnCustom.style.borderBottom = 'none';
        } else {
            btnCustom.style.fontWeight = '600';
            btnCustom.style.color = 'var(--color-moss-green)';
            btnCustom.style.borderBottom = '2.5px solid var(--color-moss-green)';
            
            btnAll.style.fontWeight = '500';
            btnAll.style.color = '#8c8270';
            btnAll.style.borderBottom = 'none';
        }
        
        this.renderCards();
    },
    personalizarProducto(productoId) {
        const prod = this.productos.find(p => p.id === productoId);
        if (prod && typeof PersonalizadosComponent !== 'undefined') {
            PersonalizadosComponent.openSimuladorModal(prod);
        } else {
            alert("El configurador no está disponible en este momento.");
        }
    },
    renderCards() {
        const cardsDiv = document.getElementById('catalogo-cards');
        let filteredProds = this.productos;
        
        if (this.currentFilter === 'custom') {
            filteredProds = this.productos.filter(p => Number(p.personalizado) === 1);
        }

        if (!filteredProds.length) {
            cardsDiv.innerHTML = `<p style="color:#8c8c8c; grid-column: 1 / -1; text-align: center; padding: 40px;">No hay productos disponibles en esta sección.</p>`;
            return;
        }

        const isPublic = window.location.pathname.includes('catalogo_publico.html');

        const cardHtml = filteredProds.map(p => {
            const adminOverlayHtml = !isPublic ? `
                <div style="position: absolute; top: 8px; right: 8px; display: flex; gap: 6px; z-index: 10;">
                    <button onclick="event.stopPropagation(); CatalogoComponent.openEditModal(${p.id})" style="background: rgba(255,255,255,0.95); border: 1px solid var(--color-gray-border); width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--color-soft-black); box-shadow: var(--shadow-sm); transition: transform 0.2s; padding:0; outline: none;" onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'" title="Editar Producto">
                        <i data-lucide="pencil" style="width: 13px; height: 13px;"></i>
                    </button>
                    <button onclick="event.stopPropagation(); CatalogoComponent.deleteProduct(${p.id})" style="background: rgba(255,255,255,0.95); border: 1px solid #fee2e2; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--color-danger); box-shadow: var(--shadow-sm); transition: transform 0.2s; padding:0; outline: none;" onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='scale(1)'" title="Eliminar Producto">
                        <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
                    </button>
                </div>
            ` : '';

            const fotoImg = p.foto_ruta 
                ? `<div style="width:100%; height:130px; background:var(--color-gray-light); display:flex; align-items:center; justify-content:center; border-bottom: 1px solid rgba(0,0,0,0.05); overflow:hidden; position:relative;">
                    <img src="${getFullImageUrl(p.foto_ruta)}" alt="${p.nombre}" style="max-width:100%; max-height:100%; object-fit:contain; display:block;">
                    ${adminOverlayHtml}
                   </div>` 
                : `<div style="width:100%; height:130px; background:#f5f5f5; display:flex; align-items:center; justify-content:center; color:#999; font-size:13px; border-bottom: 1px solid rgba(0,0,0,0.05); position:relative;">
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
                        <i data-lucide="sparkles" style="width:14px; height:14px;"></i> Personalizar & Pedir
                   </button>`
                : `<button onclick="Carrito.agregar(${p.id})" style="width:100%; background: var(--color-moss-green); color: white; border:none; padding:10px; border-radius:8px; cursor:pointer; font-family: var(--font-primary); font-weight: 600; font-size: 13px; display:flex; align-items:center; justify-content:center; gap: 8px; transition: all 0.2s; box-shadow: 0 2px 8px rgba(95, 120, 48, 0.15);">
                        <i data-lucide="shopping-cart" style="width:14px; height:14px;"></i> Añadir al pedido
                   </button>`;

            return `
                <div class="card catalog-card" style="display: flex; flex-direction: column; width: 100%; padding: 0; background: #ffffff; border-radius: var(--radius-lg); overflow:hidden; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 4px 16px rgba(0,0,0,0.04); border: 1px solid rgba(237, 230, 216, 0.6); position: relative; height: 345px;">
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
            c.addEventListener('mouseenter', () => {
                c.style.transform = 'translateY(-6px)';
                c.style.boxShadow = '0 12px 30px rgba(95, 120, 48, 0.12)';
                c.style.borderColor = 'var(--color-moss-green)';
            });
            c.addEventListener('mouseleave', () => {
                c.style.transform = 'translateY(0)';
                c.style.boxShadow = '0 4px 16px rgba(0,0,0,0.04)';
                c.style.borderColor = 'rgba(237, 230, 216, 0.6)';
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
    }
};
