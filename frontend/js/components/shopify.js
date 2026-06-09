/**
 * Componente Exportador y Catálogo por Cliente - Evergreen Love
 */
const ShopifyComponent = {
    productos: [],
    clientes: [],
    selectedClienteId: null,

    async render(containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = `
            <div class="card" style="margin-bottom: 24px;">
                <h3 class="card-title">Generador de Catálogo y Exportación a Shopify</h3>
                <p style="color: #6c757d; font-size: 14.5px; margin-bottom: 20px;">
                    Optimiza los metadatos de tus productos para SEO (títulos enriquecidos, alt text de fotos y tags automatizados) y expórtalos en un lote único. El archivo CSV generado cumple con el formato estándar de Shopify para que puedas subirlo directamente a tu tienda virtual.
                </p>
                <div style="display: flex; gap: 12px; margin-bottom: 20px; flex-wrap: wrap;">
                    <button class="btn btn-primary" id="btn-export-shopify-csv">
                        <i data-lucide="download"></i> Descargar CSV Shopify
                    </button>
                    <button class="btn btn-secondary" id="btn-seo-info">
                        <i data-lucide="sparkles"></i> Ver Diagnóstico SEO
                    </button>
                    <button class="btn btn-secondary" id="btn-config-cloudflare" style="border-color: #f38020; color: #f38020; display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="cloud"></i> Integrar Cloudflare R2
                    </button>
                    <button class="btn btn-secondary" id="btn-publicar-r2" style="border-color: var(--color-moss-green); color: var(--color-moss-green); display: flex; align-items: center; gap: 6px;">
                        <i data-lucide="share-2"></i> Publicar Catálogo en la Nube
                    </button>
                </div>
            </div>

            <!-- Tabla de Catálogo Listo para Shopify con Filtro B2B -->
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 14px; margin-bottom: 16px;">
                    <h3 class="card-title" style="font-size: 16px; margin-bottom: 0;">Productos Registrados en el Taller</h3>
                    
                    <!-- Filtro por Cliente B2B -->
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <label style="font-weight: 600; font-size: 13px; color: var(--color-soft-black);">Filtrar por Cliente:</label>
                        <select id="shopify-filter-cliente" style="padding: 6px 12px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); background-color: var(--color-white); font-family: var(--font-primary); cursor: pointer; min-width: 180px; font-size: 13px;">
                            <option value="">-- Catálogo General --</option>
                        </select>
                    </div>
                </div>

                <div class="table-container">
                    <table class="custom-table">
                        <thead>
                            <tr id="catalog-header-row">
                                <th>SKU</th>
                                <th>Nombre Comercial</th>
                                <th>Título SEO Shopify</th>
                                <th>Precio Venta</th>
                                <th>Costo de Producción</th>
                                <th>Tags Sugeridos</th>
                                <th>Alt Text Foto</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody id="shopify-catalog-body">
                            <tr>
                                <td colspan="8" style="text-align: center; color: #8c8c8c; padding: 30px;">Cargando catálogo de productos...</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Diagnóstico SEO Modal/Información (Oculto inicialmente) -->
            <div id="seo-diagnostic-box" class="card" style="display: none; margin-top: 24px; border-left: 4px solid var(--color-moss-green); background-color: var(--color-gray-light);">
                <h4 style="font-family: var(--font-serif); font-size: 16px; font-weight: 600; margin-bottom: 12px; color: var(--color-moss-green);">Diagnóstico SEO Integrado</h4>
                <div style="font-size: 13.5px; line-height: 1.6; color: var(--color-soft-black);">
                    <ul style="display: flex; flex-direction: column; gap: 8px;">
                        <li><strong>Handles Automatizados:</strong> Los handles de URL se limpian y formatean automáticamente (ej: <code>llavero-de-garita</code>) para prevenir URLs rotas en Shopify.</li>
                        <li><strong>Etiquetas de Imagen:</strong> El texto alternativo (Alt Text) de las imágenes finales se incluye en el CSV para mejorar el indexado en Google Imágenes.</li>
                        <li><strong>Estructura HTML:</strong> Las descripciones se formatean con tags HTML (<code>&lt;p&gt;</code>, <code>&lt;strong&gt;</code>) para mantener el formato premium en la descripción de Shopify.</li>
                        <li><strong>Costo Variant:</strong> Se exporta el <em>Cost per item</em> para que Shopify calcule automáticamente tus márgenes financieros por producto en tiempo real.</li>
                    </ul>
                </div>
            </div>

            <!-- Modal de Configuración de Cloudflare R2 -->
            <div id="cloudflare-config-modal" class="modal-overlay" style="display: none;"></div>
        `;
        
        lucide.createIcons();
        await this.loadData();
        this.setupListeners();
    },

    async loadData() {
        try {
            const [resProd, resCl] = await Promise.all([
                EvergreenAPI.getProductos(),
                EvergreenAPI.getClientes()
            ]);

            this.productos = resProd.data || [];
            this.clientes = resCl.data || [];

            this.populateClientesFilter();
            this.renderCatalog();
        } catch (error) {
            console.error("Error al cargar datos para Shopify:", error);
            const tbody = document.getElementById('shopify-catalog-body');
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: var(--color-danger); padding: 20px;">
                        No se pudo conectar con el servidor para obtener los productos.
                    </td>
                </tr>
            `;
        }
    },

    populateClientesFilter() {
        const select = document.getElementById('shopify-filter-cliente');
        select.innerHTML = '<option value="">-- Catálogo General --</option>';
        this.clientes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.nombre;
            if (this.selectedClienteId === c.id) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });
    },

    renderCatalog() {
        const tbody = document.getElementById('shopify-catalog-body');
        const headerRow = document.getElementById('catalog-header-row');

        // Restaurar cabeceras normales
        headerRow.innerHTML = `
            <th>Foto</th>
            <th>SKU</th>
            <th>Nombre Comercial</th>
            <th>Título SEO Shopify</th>
            <th>Precio Retail</th>
            <th>Costo Producción</th>
            <th>Estado</th>
            <th>Acciones</th>
        `;

        if (this.productos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: #8c8c8c; padding: 24px;">
                        No hay productos registrados en el catálogo general. Ve a la pestaña de <strong>Calculadora de Costos</strong> para registrar productos.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        this.productos.forEach(p => {
            const tr = document.createElement('tr');
            tr.className = 'animate-fade-in';
            
            const titleSeo = p.shopify_titulo ? p.shopify_titulo : p.nombre;
            const estadoBadge = p.personalizado === 1 
                ? '<span class="badge badge-pending">Personalizado</span>'
                : '<span class="badge badge-success">Listo</span>';
            const fotoImg = p.foto_ruta ? `<img src="${p.foto_ruta}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;">` : `<div style="width:40px;height:40px;background:#eee;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#999;">Sin foto</div>`;

            tr.innerHTML = `
                <td>${fotoImg}</td>
                <td><strong>${p.sku}</strong></td>
                <td>${p.nombre}</td>
                <td><em style="color:#7A6742;">${titleSeo}</em></td>
                <td style="font-weight:600; color:var(--color-moss-green);">$${p.precio_final.toFixed(2)}</td>
                <td>$${p.costo_total.toFixed(2)}</td>
                <td>${estadoBadge}</td>
                <td>
                    <label class="btn btn-secondary" style="padding:4px 8px; font-size:12px; cursor:pointer;">
                        Subir Foto
                        <input type="file" style="display:none;" accept="image/*" onchange="ShopifyComponent.uploadPhoto(${p.id}, this)">
                    </label>
                </td>
            tbody.appendChild(tr);
        });
    },

    renderClientCatalog(catalogo) {
        const tbody = document.getElementById('shopify-catalog-body');
        const headerRow = document.getElementById('catalog-header-row');

        // Modificar cabeceras para destacar precio pactado especial
        headerRow.innerHTML = `
            <th>SKU</th>
            <th>Nombre Comercial</th>
            <th>Precio Pactado B2B</th>
            <th>Precio Retail</th>
            <th>Costo Producción</th>
            <th>Margen B2B</th>
            <th>Acuerdo Comercial</th>
            <th>Acción</th>
        `;

        if (catalogo.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" style="text-align: center; color: #8c8c8c; padding: 24px; font-style: italic;">
                        Este cliente no tiene productos asignados en su catálogo exclusivo B2B.<br>
                        Puedes asignárselos en la pestaña de <strong>Clientes B2B</strong>.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';
        catalogo.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'animate-fade-in';
            
            const margen = ((item.precio_especial - item.costo_total) / item.precio_especial * 100).toFixed(0);
            
            tr.innerHTML = `
                <td><strong>${item.producto_sku}</strong></td>
                <td>${item.producto_nombre}</td>
                <td style="font-weight:700; color:var(--color-moss-green); font-size:15px;">$${item.precio_especial.toFixed(2)}</td>
                <td style="opacity:0.75;">$${item.precio_retail.toFixed(2)}</td>
                <td>$${item.costo_total.toFixed(2)}</td>
                <td style="font-weight:600; color: var(--color-success);">${margen}%</td>
                <td style="font-size:12px; font-style:italic; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.notes || 'Ninguna'}">${item.notes || '<span style="color:#b2a895;">Ninguna</span>'}</td>
                <td>
                    <button class="btn btn-secondary btn-delete-client-prod" style="padding: 2px 6px; font-size:11px; border:none; background:none; box-shadow:none; color:var(--color-danger);" data-id="${item.id}">
                        Retirar
                    </button>
                </td>
            `;
            
            tbody.appendChild(tr);
        });

        // Event listener para retirar item
        tbody.querySelectorAll('.btn-delete-client-prod').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.getAttribute('data-id'));
                if (confirm("¿Deseas retirar este producto de los precios especiales de este cliente?")) {
                    try {
                        await EvergreenAPI.deleteProductoCatalogoCliente(id);
                        // Recargar catálogo del cliente actual
                        const res = await EvergreenAPI.getCatalogoCliente(this.selectedClienteId);
                        this.renderClientCatalog(res.data || []);
                    } catch (err) {
                        alert("Error al retirar: " + err.message);
                    }
                }
            });
        });
    },

    setupListeners() {
        const btnExport = document.getElementById('btn-export-shopify-csv');
        const btnSeo = document.getElementById('btn-seo-info');
        const seoBox = document.getElementById('seo-diagnostic-box');
        const filterSelect = document.getElementById('shopify-filter-cliente');
        const btnConfigCloudflare = document.getElementById('btn-config-cloudflare');

        if (btnExport) {
            btnExport.addEventListener('click', () => {
                if (this.productos.length === 0) {
                    alert("No hay productos en el catálogo para exportar. Registre un producto primero.");
                    return;
                }
                
                // Redirigir directamente al endpoint de descarga del backend
                const exportUrl = `${API_BASE_URL}/shopify/exportar`;
                window.location.href = exportUrl;
            });
        }

        if (btnSeo && seoBox) {
            btnSeo.addEventListener('click', () => {
                if (seoBox.style.display === 'none') {
                    seoBox.style.display = 'block';
                    btnSeo.innerHTML = '<i data-lucide="sparkles"></i> Ocultar Diagnóstico';
                } else {
                    seoBox.style.display = 'none';
                    btnSeo.innerHTML = '<i data-lucide="sparkles"></i> Ver Diagnóstico SEO';
                }
                lucide.createIcons();
            });
        }

        if (filterSelect) {
            filterSelect.addEventListener('change', async (e) => {
                const id = e.target.value;
                if (id) {
                    this.selectedClienteId = parseInt(id);
                    // Cargar catálogo especial del cliente
                    const res = await EvergreenAPI.getCatalogoCliente(this.selectedClienteId);
                    this.renderClientCatalog(res.data || []);
                } else {
                    this.selectedClienteId = null;
                    this.renderCatalog();
                }
            });
        }

        if (btnConfigCloudflare) {
            btnConfigCloudflare.addEventListener('click', () => this.openCloudflareConfigModal());
        }

        const btnPublicarR2 = document.getElementById('btn-publicar-r2');
        if (btnPublicarR2) {
            btnPublicarR2.addEventListener('click', async () => {
                alert('En una integración real, este botón sincronizaría las imágenes de la carpeta local con Cloudflare R2 y publicaría un JSON público del catálogo. Verifica la ruta /api/shopify/publicar_web.');
            });
        }
    },

    openCloudflareConfigModal() {
        const modal = document.getElementById('cloudflare-config-modal');
        const accountId = localStorage.getItem('evergreen_cloudflare_account_id') || '';
        const apiToken = localStorage.getItem('evergreen_cloudflare_api_token') || '';
        const bucket = localStorage.getItem('evergreen_cloudflare_bucket') || '';
        const deliveryUrl = localStorage.getItem('evergreen_cloudflare_delivery_url') || '';

        modal.innerHTML = `
            <div class="modal-card card" style="max-width: 480px; width: 90%; margin: 100px auto; position: relative;">
                <h3 class="card-title" style="display: flex; align-items: center; gap: 6px; color: #f38020;">
                    <i data-lucide="cloud"></i> Configurar Cloudflare R2
                </h3>
                <p style="color: #6c757d; font-size: 13px; margin-bottom: 16px; line-height: 1.4;">
                    Configura tu bucket de Cloudflare R2 para almacenar las imágenes del taller en la nube. Esto generará enlaces públicos para Shopify.
                </p>
                
                <form id="cloudflare-config-form" style="display: flex; flex-direction: column; gap: 14px;">
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; font-size: 13px;">Account ID (ID de Cuenta)</label>
                        <input type="text" id="cf-account-id" value="${accountId}" placeholder="Ej. 1a2b3c4d5e6f7g8h9i0j..." style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); font-size: 13px;">
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; font-size: 13px;">API Token (Token de API de R2)</label>
                        <input type="password" id="cf-api-token" value="${apiToken}" placeholder="Token de Cloudflare con permisos de edición R2" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); font-size: 13px;">
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; font-size: 13px;">Bucket Name (Nombre del Bucket)</label>
                        <input type="text" id="cf-bucket" value="${bucket}" placeholder="Ej. evergreen-fotos" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); font-size: 13px;">
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label style="font-weight: 500; font-size: 13px;">Public Delivery URL (URL Pública / Dominio)</label>
                        <input type="url" id="cf-delivery-url" value="${deliveryUrl}" placeholder="Ej. https://pub-xxxxxx.r2.dev o dominio personalizado" style="padding: 10px; border-radius: var(--radius-sm); border: 1px solid var(--color-gray-border); font-family: var(--font-primary); font-size: 13px;">
                    </div>
                    
                    <div style="display: flex; gap: 12px; margin-top: 10px;">
                        <button type="button" class="btn btn-secondary" id="btn-close-cloudflare-modal" style="flex: 1;">Cancelar</button>
                        <button type="submit" class="btn btn-primary" style="flex: 1; background-color: #f38020; border-color: #f38020;">Guardar Configuración</button>
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

        document.getElementById('btn-close-cloudflare-modal').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        document.getElementById('cloudflare-config-form').addEventListener('submit', (e) => {
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
                alert("Configuración de Cloudflare R2 guardada correctamente de forma local en tu navegador.");
            } else {
                localStorage.removeItem('evergreen_cloudflare_account_id');
                localStorage.removeItem('evergreen_cloudflare_api_token');
                localStorage.removeItem('evergreen_cloudflare_bucket');
                localStorage.removeItem('evergreen_cloudflare_delivery_url');
                alert("Configuración de Cloudflare R2 eliminada. Las subidas se mantendrán puramente locales.");
            }
            modal.style.display = 'none';
        });
    },

    async uploadPhoto(productoId, inputElement) {
        if (!inputElement.files || inputElement.files.length === 0) return;
        const file = inputElement.files[0];
        try {
            await EvergreenAPI.subirFoto(file, null, productoId, 'referencia');
            alert('Foto subida con éxito.');
            await this.loadData();
        } catch (error) {
            console.error('Error al subir la foto:', error);
            alert('Hubo un error al subir la foto.');
        }
    }
};
