// Carrito UI Helper - Evergreen Love (Versión Pública)
// Este script maneja la lógica de estado del carrito y la inyección dinámica de la interfaz (CSS y HTML) 
// para el catálogo público de retail (catalogo_publico.html).

const Carrito = {
    cart: [],
    isSummaryExpanded: false,

    // Obtiene o crea un session_id único en localStorage
    getSessionId() {
        let sid = localStorage.getItem('session_id');
        if (!sid) {
            sid = 'sid-' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('session_id', sid);
        }
        return sid;
    },

    // Inicializa la interfaz de usuario inyectando el CSS y el HTML en el DOM
    init() {
        this.injectStyles();
        this.injectHTML();
        this.setupListeners();
        this.syncBadge();
    },

    // Inyecta dinámicamente las hojas de estilo del carrito y sus modales
    injectStyles() {
        if (document.getElementById('carrito-injected-styles')) return;

        const styles = document.createElement('style');
        styles.id = 'carrito-injected-styles';
        styles.textContent = `
            #cart-overlay {
                display: none;
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.4);
                backdrop-filter: blur(4px);
                z-index: 2000;
            }
            #cart-panel {
                position: fixed;
                top: 0; right: -480px;
                width: 440px;
                max-width: 95vw;
                height: 100vh;
                background: white;
                z-index: 2001;
                display: flex;
                flex-direction: column;
                transition: right 0.3s cubic-bezier(0.4,0,0.2,1);
                box-shadow: -4px 0 30px rgba(0,0,0,0.15);
            }
            #cart-panel.open { right: 0; }
            .cart-header {
                padding: 20px 24px;
                border-bottom: 1px solid #f0ece4;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .cart-header h3 { margin: 0; font-size: 17px; color: var(--color-moss-green); }
            #btn-close-cart {
                background: none;
                border: none;
                cursor: pointer;
                color: #999;
                padding: 4px;
                border-radius: 6px;
            }
            #btn-close-cart:hover { background: #f5f5f5; }
            #cart-items { flex: 1; overflow-y: auto; padding: 16px 24px; }
            .cart-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 12px 0;
                border-bottom: 1px solid #f5f0e8;
            }
            .cart-item img {
                width: 56px; height: 56px;
                object-fit: cover;
                border-radius: 8px;
                border: 1px solid #eee;
                flex-shrink: 0;
            }
            .cart-item-placeholder {
                width: 56px; height: 56px;
                border-radius: 8px;
                background: #f5f0e8;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
            }
            .cart-item-info { flex: 1; }
            .cart-item-name { font-size: 13px; font-weight: 600; color: #2d2d2d; }
            .cart-item-sub { font-size: 12px; color: #8c8270; margin-top: 2px; }
            .cart-item-price { font-size: 14px; font-weight: 700; color: var(--color-moss-green); }
            .btn-remove-item {
                background: none;
                border: none;
                cursor: pointer;
                color: #ccc;
                padding: 4px;
                border-radius: 6px;
            }
            .btn-remove-item:hover { color: #e74c3c; background: #fff0f0; }
            #cart-empty {
                text-align: center;
                color: #c8bba8;
                padding: 60px 20px;
                font-style: italic;
            }
            .cart-footer {
                padding: 20px 24px;
                border-top: 1px solid #f0ece4;
                background: #fdfaf5;
            }
            .cart-total-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
            }
            .cart-total-row span:first-child { font-size: 15px; font-weight: 600; color: #2d2d2d; }
            .cart-total-row .total-amount { font-size: 22px; font-weight: 700; color: var(--color-moss-green); }
            #btn-pedir {
                width: 100%;
                padding: 14px;
                background: linear-gradient(135deg, #5f5a30, #8a8244);
                color: white;
                border: none;
                border-radius: 12px;
                font-family: var(--font-primary);
                font-size: 15px;
                font-weight: 600;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
                transition: all 0.2s;
            }
            #btn-pedir:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(95,90,48,0.35); }
            #btn-pedir:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

            #order-overlay {
                display: none;
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.5);
                backdrop-filter: blur(6px);
                z-index: 3000;
                align-items: center;
                justify-content: center;
            }
            #order-overlay.open { display: flex; }
            #order-modal {
                background: white;
                border-radius: 20px;
                padding: 32px;
                width: 90%;
                max-width: 480px;
                max-height: 90vh;
                overflow-y: auto;
                box-shadow: 0 20px 60px rgba(0,0,0,0.2);
                animation: slideUp 0.3s ease;
            }
            @keyframes slideUp {
                from { transform: translateY(30px); opacity: 0; }
                to   { transform: translateY(0);    opacity: 1; }
            }
            #order-modal h3 {
                font-family: var(--font-secondary);
                color: var(--color-moss-green);
                margin: 0 0 6px;
                font-size: 20px;
            }
            #order-modal p { font-size: 13px; color: #8c8270; margin: 0 0 24px; }
            .form-group { margin-bottom: 14px; }
            .form-group label { display: block; font-size: 13px; font-weight: 600; margin-bottom: 5px; color: #444; }
            .form-group input, .form-group textarea {
                width: 100%;
                padding: 11px 13px;
                border: 1.5px solid #ddd;
                border-radius: 10px;
                font-family: var(--font-primary);
                font-size: 13px;
                transition: border-color 0.2s;
            }
            .form-group input:focus, .form-group textarea:focus {
                outline: none;
                border-color: var(--color-moss-green);
            }
            .form-group textarea { resize: vertical; min-height: 80px; }
            .order-summary-box {
                background: #fdfaf5;
                border: 1px solid #ede6d8;
                border-radius: 12px;
                padding: 14px;
                margin-bottom: 20px;
            }
            .order-summary-box h4 { font-size: 13px; font-weight: 600; margin: 0 0 10px; color: #5d4037; }
            .order-summary-line {
                display: flex;
                justify-content: space-between;
                font-size: 13px;
                color: #555;
                margin-bottom: 4px;
            }
            .order-summary-line.total {
                font-weight: 700;
                font-size: 15px;
                color: var(--color-moss-green);
                border-top: 1px solid #ede6d8;
                padding-top: 8px;
                margin-top: 6px;
            }
            .modal-btns { display: flex; gap: 12px; margin-top: 6px; }
            .btn-cancel-order {
                padding: 12px;
                background: #f5f5f5;
                border: none;
                border-radius: 10px;
                font-family: var(--font-primary);
                font-size: 14px;
                cursor: pointer;
                flex: 1;
            }
            #btn-pub-confirm-order {
                padding: 12px;
                background: linear-gradient(135deg, #5f5a30, #8a8244);
                color: white;
                border: none;
                border-radius: 10px;
                font-family: var(--font-primary);
                font-size: 14px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                flex: 2;
            }
            #btn-pub-confirm-order:hover { filter: brightness(1.1); }

            @media (max-width: 540px) {
                #order-modal {
                    padding: 16px;
                    max-width: 95vw;
                }
                #order-modal h3 {
                    font-size: 17px;
                    margin-bottom: 2px;
                }
                #order-modal p {
                    margin-bottom: 12px;
                    font-size: 11.5px;
                }
                .order-summary-box {
                    padding: 10px;
                    margin-bottom: 12px;
                    border-radius: 8px;
                }
                .form-group {
                    margin-bottom: 10px;
                }
                .form-group label {
                    font-size: 11.5px;
                    margin-bottom: 3px;
                }
                .form-group input, .form-group textarea {
                    padding: 8px 10px;
                    font-size: 12px;
                    border-radius: 8px;
                }
                .form-group textarea {
                    min-height: 50px;
                }
                .modal-btns {
                    margin-top: 10px;
                }
                .btn-cancel-order, #btn-pub-confirm-order {
                    padding: 9px;
                    font-size: 12.5px;
                }
            }
        `;
        document.head.appendChild(styles);
    },

    // Inyecta dinámicamente las capas HTML en el body si no existen
    injectHTML() {
        if (document.getElementById('cart-overlay')) return;

        const cartOverlay = document.createElement('div');
        cartOverlay.id = 'cart-overlay';
        cartOverlay.onclick = () => this.close();
        document.body.appendChild(cartOverlay);

        const cartPanel = document.createElement('div');
        cartPanel.id = 'cart-panel';
        cartPanel.innerHTML = `
            <div class="cart-header">
                <h3><i data-lucide="shopping-bag" style="width:18px;height:18px;display:inline;vertical-align:-3px;margin-right:6px;"></i>Mi Pedido</h3>
                <button id="btn-close-cart" onclick="Carrito.close()"><i data-lucide="x" style="width:20px;height:20px;"></i></button>
            </div>
            <div id="cart-items">
                <div id="cart-empty" style="display:flex;flex-direction:column;align-items:center;gap:10px;">
                    <i data-lucide="package" style="width:40px;height:40px;color:#e0d9ce;"></i>
                    Tu pedido está vacío
                </div>
            </div>
            <div class="cart-footer">
                <div class="cart-total-row">
                    <span>Total Estimado</span>
                    <span class="total-amount" id="pub-cart-total">$0.00</span>
                </div>
                <button id="btn-pedir" onclick="Carrito.openCheckout()" disabled>
                    <i data-lucide="send" style="width:16px;height:16px;"></i>
                    Enviar Pedido
                </button>
            </div>
        `;
        document.body.appendChild(cartPanel);

        const orderOverlay = document.createElement('div');
        orderOverlay.id = 'order-overlay';
        orderOverlay.innerHTML = `
            <div id="order-modal">
                <h3>Confirmar Pedido</h3>
                <p>Completa tus datos de contacto para finalizar el pedido.</p>

                <div class="order-summary-box" id="pub-order-summary-box"></div>

                <div class="form-group">
                    <label>Nombre de Contacto *</label>
                    <input type="text" id="pub-ord-nombre" placeholder="Tu nombre completo" required>
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="pub-ord-email" placeholder="tu@email.com">
                </div>
                <div class="form-group">
                    <label>Teléfono *</label>
                    <input type="tel" id="pub-ord-telefono" placeholder="787-000-0000" required>
                </div>
                <div class="form-group">
                    <label>Notas adicionales</label>
                    <textarea id="pub-ord-notas" placeholder="Fecha de entrega preferida, instrucciones especiales..."></textarea>
                </div>
                <div class="form-group">
                    <label>Método de Pago *</label>
                    <select id="pub-ord-pago" style="width: 100%; padding: 11px 13px; border: 1.5px solid #ddd; border-radius: 10px; font-family: var(--font-primary); font-size: 13px; transition: border-color 0.2s;" onchange="Carrito.onPaymentMethodChange()">
                        <option value="ATH Movil">ATH Móvil (Recomendado)</option>
                        <option value="PayPal">PayPal</option>
                        <option value="Efectivo">Efectivo (Recogido en Taller)</option>
                        <option value="Tarjeta">Tarjeta de Crédito / Stripe (Próximamente)</option>
                    </select>
                </div>
                <div id="payment-instructions" style="font-size: 12.5px; color: #8a8244; background: #fffcf4; border: 1px solid #ede6d8; border-radius: 10px; padding: 12px; margin-bottom: 16px; text-align: left; line-height: 1.4;">
                    📲 <strong>Instrucciones ATH Móvil:</strong> Envía tu pago al <strong>(787) 960-1431</strong> por ATH Móvil y comparte la captura de pantalla por WhatsApp al finalizar.
                </div>

                <div class="modal-btns">
                    <button class="btn-cancel-order" onclick="Carrito.closeCheckout()">Cancelar</button>
                    <button id="btn-pub-confirm-order" onclick="Carrito.submitOrder()">
                        <i data-lucide="check-circle" style="width:15px;height:15px;display:inline;vertical-align:-2px;margin-right:4px;"></i>
                        Confirmar Pedido
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(orderOverlay);
        
        lucide.createIcons({ attrs: { class: 'lucide-icon' } });
    },

    // Configura controladores de eventos iniciales
    setupListeners() {
        // Nada más requerido ya que se definen en el HTML dinámico inyectado
    },

    // Agrega un producto al carrito
    async agregar(productoId, cantidad = 1) {
        const sessionId = this.getSessionId();
        try {
            await EvergreenAPI.addToCart(sessionId, productoId, cantidad);
            
            // Toast de éxito sutil
            const toast = document.createElement('div');
            toast.textContent = '✔ Añadido al carrito';
            toast.style.position = 'fixed';
            toast.style.bottom = '20px';
            toast.style.right = '20px';
            toast.style.background = '#4caf50';
            toast.style.color = '#fff';
            toast.style.padding = '10px 16px';
            toast.style.borderRadius = '4px';
            toast.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
            toast.style.zIndex = 3500;
            document.body.appendChild(toast);
            setTimeout(() => document.body.removeChild(toast), 1800);

            await this.syncBadge();
        } catch (err) {
            console.error('Error al añadir al carrito:', err);
        }
    },

    // Sincroniza la cantidad total del badge de la cabecera
    async syncBadge() {
        const sessionId = this.getSessionId();
        try {
            const res = await EvergreenAPI.getCart(sessionId);
            this.cart = res.data || [];
            const count = this.cart.reduce((s, c) => s + c.cantidad, 0);
            
            const badge = document.getElementById('cart-badge');
            if (badge) {
                badge.textContent = count;
                badge.style.display = count > 0 ? 'inline-flex' : 'none';
            }
        } catch (e) {
            console.error('Error al sincronizar badge:', e);
        }
    },

    // Abre el panel lateral del carrito
    async open() {
        document.getElementById('cart-overlay').style.display = 'block';
        document.getElementById('cart-panel').classList.add('open');
        await this.renderItems();
    },

    // Cierra el panel lateral del carrito
    close() {
        document.getElementById('cart-overlay').style.display = 'none';
        document.getElementById('cart-panel').classList.remove('open');
    },

    // Renderiza los productos en el drawer lateral
    async renderItems() {
        const container = document.getElementById('cart-items');
        const sessionId = this.getSessionId();

        try {
            const res = await EvergreenAPI.getCart(sessionId);
            this.cart = res.data || [];
            
            if (this.cart.length === 0) {
                container.innerHTML = `
                    <div id="cart-empty" style="display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;color:#c8bba8;padding:60px 20px;font-style:italic;">
                        <i data-lucide="package" style="width:40px;height:40px;color:#e0d9ce;"></i>
                        Tu pedido está vacío
                    </div>
                `;
                document.getElementById('pub-cart-total').textContent = '$0.00';
                document.getElementById('btn-pedir').disabled = true;
                lucide.createIcons();
                return;
            }

            container.innerHTML = this.cart.map(item => `
                <div class="cart-item">
                    ${item.foto_ruta
                        ? `<img src="${item.foto_ruta}" alt="${item.nombre}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                           <div class="cart-item-placeholder" style="display:none;"><i data-lucide="package" style="width:20px;height:20px;color:#c8bba8;"></i></div>`
                        : `<div class="cart-item-placeholder"><i data-lucide="package" style="width:20px;height:20px;color:#c8bba8;"></i></div>`}
                    <div class="cart-item-info">
                        <div class="cart-item-name">${item.nombre}</div>
                        <div class="cart-item-sub">Cant: ${item.cantidad} × $${item.precio_final.toFixed(2)}</div>
                    </div>
                    <div class="cart-item-price">$${(item.precio_final * item.cantidad).toFixed(2)}</div>
                    <button class="btn-remove-item" onclick="Carrito.removeItem(${item.producto_id})">
                        <i data-lucide="x" style="width:16px;height:16px;"></i>
                    </button>
                </div>
            `).join('');

            const total = this.cart.reduce((s, c) => s + c.precio_final * c.cantidad, 0);
            document.getElementById('pub-cart-total').textContent = `$${total.toFixed(2)}`;
            document.getElementById('btn-pedir').disabled = false;
            
            lucide.createIcons();
        } catch (err) {
            console.error('Error renderItems:', err);
            container.innerHTML = `<p style="color:var(--color-danger); text-align:center; padding:20px;">Error al cargar items.</p>`;
        }
    },

    // Elimina un producto específico del carrito
    async removeItem(productoId) {
        const sessionId = this.getSessionId();
        try {
            await EvergreenAPI.removeFromCart(sessionId, productoId);
            await this.renderItems();
            await this.syncBadge();
        } catch (e) {
            console.error('Error al remover item:', e);
        }
    },

    // Abre el modal de confirmación y calcula los desgloses de impuestos
    openCheckout() {
        if (this.cart.length === 0) return;
        this.isSummaryExpanded = false;
        this.renderOrderSummary();
        this.close();
        document.getElementById('order-overlay').classList.add('open');
    },

    // Cierra el modal de confirmación
    closeCheckout() {
        document.getElementById('order-overlay').classList.remove('open');
    },

    // Renderiza el desglose de precios en el modal de confirmación
    renderOrderSummary() {
        const subtotal = this.cart.reduce((s, c) => s + c.precio_final * c.cantidad, 0);
        const stateTax = subtotal * 0.105;
        const municipalTax = subtotal * 0.01;
        const total = subtotal + stateTax + municipalTax;
        
        const container = document.getElementById('pub-order-summary-box');
        const itemCount = this.cart.reduce((s, c) => s + c.cantidad, 0);

        container.innerHTML = `
            <div id="pub-summary-toggle" style="display: flex; align-items: center; justify-content: space-between; cursor: pointer; padding: 6px 0; user-select: none; border-bottom: 1px solid #ede6d8; margin-bottom: 10px;" onclick="Carrito.toggleSummaryList()">
                <h4 style="font-size: 14px; font-weight: 700; color: var(--color-moss-green); margin: 0; display: flex; align-items: center; gap: 8px;">
                    <i data-lucide="shopping-cart" style="width: 16px; height: 16px;"></i> 
                    Artículos en Pedido (${itemCount})
                </h4>
                <div style="display: flex; align-items: center; gap: 6px; color: #8c8244; font-size: 12.5px; font-weight: 600;">
                    <span>${this.isSummaryExpanded ? 'Ocultar' : 'Ver detalle'}</span>
                    <i data-lucide="${this.isSummaryExpanded ? 'chevron-up' : 'chevron-down'}" style="width: 16px; height: 16px;"></i>
                </div>
            </div>

            <!-- Lista de Artículos (colapsable) -->
            <div id="pub-summary-items-list" style="display: ${this.isSummaryExpanded ? 'flex' : 'none'}; flex-direction: column; gap: 6px; margin-bottom: 8px; max-height: 120px; overflow-y: auto; padding-right: 4px; border-bottom: 1px solid rgba(0, 0, 0, 0.03); padding-bottom: 8px;">
                ${this.cart.map(item => {
                    const imgHtml = item.foto_ruta
                        ? `<img src="${item.foto_ruta}" alt="${item.nombre}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 8px; border: 1px solid #ede6d8; flex-shrink: 0;" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                           <div style="width: 40px; height: 40px; border-radius: 8px; background: #fdfaf5; border: 1px dashed #c8bba8; display: none; align-items: center; justify-content: center; flex-shrink: 0;">
                               <i data-lucide="package" style="width:16px; height:16px; color:#c8bba8;"></i>
                           </div>`
                        : `<div style="width: 40px; height: 40px; border-radius: 8px; background: #fdfaf5; border: 1px dashed #c8bba8; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                               <i data-lucide="package" style="width:16px; height:16px; color:#c8bba8;"></i>
                           </div>`;
                    
                    return `
                        <div style="display: flex; align-items: center; gap: 12px; padding: 4px 0;">
                            ${imgHtml}
                            <div style="flex: 1; min-width: 0; text-align: left;">
                                <div style="font-weight: 600; font-size: 13px; color: #2d2d2d; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.nombre}</div>
                                <div style="font-size: 11px; color: #8c8270;">Cant: ${item.cantidad} × $${item.precio_final.toFixed(2)}</div>
                            </div>
                            <div style="font-weight: 700; font-size: 13.5px; color: var(--color-moss-green); flex-shrink: 0;">
                                $${(item.precio_final * item.cantidad).toFixed(2)}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- Desglose de precios e impuestos -->
            <div style="padding-top: 4px; display: flex; flex-direction: column; gap: 3px; font-size: 12.5px; color: #555; text-align: left; border-top: 1px dashed #ede6d8; margin-top: 6px; padding-top: 6px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>Subtotal:</span>
                    <span style="font-weight: 600; color: #2d2d2d;">$${subtotal.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>IVU Estatal (10.5%):</span>
                    <span>$${stateTax.toFixed(2)}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span>IVU Municipal (1.0%):</span>
                    <span>$${municipalTax.toFixed(2)}</span>
                </div>
            </div>

            <div class="order-summary-line total" style="margin-top: 8px; border-top: 2px solid var(--color-moss-green); padding-top: 8px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 700; font-size: 14px; color: #2d2d2d;">Total a Pagar:</span>
                <span style="font-size: 18px; font-weight: 700; color: var(--color-moss-green);">$${total.toFixed(2)}</span>
            </div>
        `;

        lucide.createIcons();
    },

    // Contrae/Expande la lista de artículos en el checkout
    toggleSummaryList() {
        this.isSummaryExpanded = !this.isSummaryExpanded;
        this.renderOrderSummary();
    },

    // Envía el pedido a la base de datos de producción
    async submitOrder() {
        const nombre = document.getElementById('pub-ord-nombre').value.trim();
        const telefono = document.getElementById('pub-ord-telefono').value.trim();
        
        if (!nombre) {
            document.getElementById('pub-ord-nombre').focus();
            document.getElementById('pub-ord-nombre').style.borderColor = '#e74c3c';
            return;
        }
        document.getElementById('pub-ord-nombre').style.borderColor = '#ddd';

        if (!telefono) {
            document.getElementById('pub-ord-telefono').focus();
            document.getElementById('pub-ord-telefono').style.borderColor = '#e74c3c';
            return;
        }
        document.getElementById('pub-ord-telefono').style.borderColor = '#ddd';

        const btn = document.getElementById('btn-pub-confirm-order');
        btn.textContent = 'Enviando...';
        btn.disabled = true;

        const sessionId = this.getSessionId();

        try {
            if (this.cart.length === 0) {
                alert('Tu carrito está vacío.');
                return;
            }

            const email = document.getElementById('pub-ord-email').value.trim() || null;
            const notasAdicionales = document.getElementById('pub-ord-notas').value.trim() || null;
            const metodoPago = document.getElementById('pub-ord-pago').value;

            // Formatear payload agrupado para enviar al nuevo endpoint
            const payload = {
                nombre_contacto: nombre,
                email_contacto: email,
                telefono_contacto: telefono,
                notas: notasAdicionales,
                session_id: sessionId,
                metodo_pago: metodoPago,
                items: this.cart.map(item => ({
                    producto_id: item.producto_id,
                    cantidad: item.cantidad,
                    precio_unitario: item.precio_final,
                    nombre_producto: item.nombre
                }))
            };

            const res = await fetch('/api/carrito/pedido', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.detail || 'Error al guardar el pedido y generar factura');
            }

            const resData = await res.json();
            const numFactura = resData.numero_factura;
            const totalVal = resData.total;

            // Preparar mensaje de WhatsApp antes de limpiar el carrito
            const itemsListText = this.cart.map(i => `  • ${i.nombre} (x${i.cantidad})`).join('\n');
            const paymentMethodText = metodoPago === 'ATH Movil' ? '📲 ATH Móvil' : (metodoPago === 'PayPal' ? '💳 PayPal' : '💵 Efectivo');
            const messageText = `🌿 *Evergreen Love - Confirmación de Pedido* 🌿\n\n¡Hola! He realizado un nuevo pedido desde el catálogo público.\n\n👤 *Cliente:* ${nombre}\n📞 *Teléfono:* ${telefono}\n🧾 *Factura:* ${numFactura || 'N/A'}\n💳 *Método de Pago:* ${paymentMethodText}\n💵 *Total con IVU:* $${totalVal.toFixed(2)}\n\n📦 *Artículos del Pedido:*\n${itemsListText}\n\n¡Muchas gracias!`;

            // Limpiar carrito local
            this.cart = [];
            this.updateBadge(0);

            // Cerrar modal
            this.closeCheckout();

            // Renderizar la pantalla de éxito en la vista del catálogo
            const container = document.getElementById('catalogo-view');
            if (container) {
                let successMessageHtml = '';
                if (metodoPago === 'ATH Movil') {
                    successMessageHtml = `
                        <div style="background: #fffcf4; border: 1px solid #ede6d8; border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: left; font-size: 13.5px; line-height: 1.5; color: #8a8244;">
                            <strong>📲 Instrucciones de ATH Móvil:</strong><br>
                            1. Abre ATH Móvil y envía <strong>$${totalVal.toFixed(2)}</strong> al <strong>(787) 960-1431</strong>.<br>
                            2. Toma una captura de pantalla del comprobante.<br>
                            3. Presiona el botón verde de abajo para enviarnos tu pedido y la captura de pantalla por WhatsApp.
                        </div>
                    `;
                } else if (metodoPago === 'PayPal') {
                    successMessageHtml = `
                        <div style="background: #f4f7fa; border: 1px solid #d1e3eb; border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: left; font-size: 13.5px; line-height: 1.5; color: #1a5276;">
                            <strong>💳 Instrucciones de PayPal:</strong><br>
                            1. Envía tu pago de <strong>$${totalVal.toFixed(2)}</strong> a nuestra cuenta de PayPal: <strong>evergreenlov@gmail.com</strong>.<br>
                            2. Toma una captura de pantalla de la confirmación.<br>
                            3. Presiona el botón verde de abajo para enviarnos tu pedido y la captura por WhatsApp.
                        </div>
                    `;
                } else if (metodoPago === 'Efectivo') {
                    successMessageHtml = `
                        <div style="background: #f4faf6; border: 1px solid #d1ebd8; border-radius: 12px; padding: 16px; margin-bottom: 24px; text-align: left; font-size: 13.5px; line-height: 1.5; color: #2e7d32;">
                            <strong>💵 Pago en Efectivo:</strong><br>
                            Tu pedido será preparado en nuestro taller. Podrás pagarlo al recoger tus piezas directamente. Por favor presiona el botón de abajo para coordinar la recogida por WhatsApp.
                        </div>
                    `;
                }

                container.innerHTML = `
                    <div id="pub-success-screen" class="card animate-fade-in" style="max-width: 480px; margin: 40px auto; text-align: center; background: white; border-radius: 20px; padding: 40px 30px; box-shadow: 0 10px 40px rgba(0,0,0,0.06); border: 1px solid rgba(237, 230, 216, 0.8);">
                        <div class="success-icon" style="width: 76px; height: 76px; background: linear-gradient(135deg, var(--color-moss-green), #6d883b); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; color: white; box-shadow: 0 8px 20px rgba(95, 120, 48, 0.2);">
                            <i data-lucide="check" style="width:38px; height:38px;"></i>
                        </div>
                        <h2 style="font-family: var(--font-secondary); color: var(--color-moss-green); margin-bottom: 8px; font-weight: 700; font-size: 26px;">¡Pedido Recibido!</h2>
                        <p style="font-size: 14px; color: #8c8270; line-height: 1.5; margin-bottom: 20px;">
                            Tu orden ha sido registrada en nuestro taller y la factura fue generada automáticamente.
                        </p>
                        
                        ${successMessageHtml}

                        <div style="background: #fcfbf8; border: 1px dashed #ede6d8; border-radius: 12px; padding: 18px; margin-bottom: 28px; text-align: left;">
                            <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px; border-bottom: 1px dashed rgba(237, 230, 216, 0.5); padding-bottom: 8px;">
                                <span style="color: #8c8270;">Número de Factura:</span>
                                <strong style="color: var(--color-moss-green); font-family: monospace; font-size: 14.5px;">${numFactura}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px; border-bottom: 1px dashed rgba(237, 230, 216, 0.5); padding-bottom: 8px;">
                                <span style="color: #8c8270;">Cliente:</span>
                                <strong style="color: var(--color-soft-black);">${nombre}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 8px; border-bottom: 1px dashed rgba(237, 230, 216, 0.5); padding-bottom: 8px;">
                                <span style="color: #8c8270;">Método de Pago:</span>
                                <strong style="color: var(--color-soft-black);">${paymentMethodText}</strong>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 14px; padding-top: 4px;">
                                <span style="color: #8c8270; font-weight: 600;">Total a Pagar (con IVU):</span>
                                <strong style="color: var(--color-moss-green); font-size: 16px; font-weight: 700;">$${totalVal.toFixed(2)}</strong>
                            </div>
                        </div>

                        <div style="display:flex; flex-direction:column; gap:12px; max-width: 340px; margin-left: auto; margin-right: auto;">
                            <button id="btn-send-whatsapp-pub" style="padding:14px 28px; background:#25d366; color:white; border:none; border-radius:12px; font-family:var(--font-primary); font-size:15px; font-weight:700; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:8px; transition:all 0.3s cubic-bezier(0.16, 1, 0.3, 1); box-shadow: 0 4px 12px rgba(37, 211, 102, 0.25);">
                                <i data-lucide="message-square" style="width:18px; height:18px;"></i> Enviar por WhatsApp
                            </button>
                            <button onclick="Carrito.resetCatalog()" style="padding:13px 28px; background:white; color:var(--color-moss-green); border:1.5px solid var(--color-moss-green); border-radius:12px; font-family:var(--font-primary); font-size:14.5px; font-weight:600; cursor:pointer; transition: all 0.2s;">
                                Volver al Catálogo
                            </button>
                        </div>
                    </div>
                `;
                lucide.createIcons();

                const btnWhatsapp = document.getElementById('btn-send-whatsapp-pub');
                if (btnWhatsapp) {
                    btnWhatsapp.onclick = () => {
                        window.open(`https://wa.me/17879601431?text=${encodeURIComponent(messageText)}`, '_blank');
                    };
                }
            }

        } catch (err) {
            console.error('Error al procesar pedido público:', err);
            alert('Error al enviar el pedido: ' + err.message);
        } finally {
            btn.textContent = 'Confirmar Pedido';
            btn.disabled = false;
        }
    },

    // Manejador del cambio de método de pago en el modal
    onPaymentMethodChange() {
        const select = document.getElementById('pub-ord-pago');
        const inst = document.getElementById('payment-instructions');
        if (!select || !inst) return;
        
        if (select.value === 'ATH Movil') {
            inst.innerHTML = `📲 <strong>Instrucciones ATH Móvil:</strong> Envía tu pago al <strong>(787) 960-1431</strong> por ATH Móvil y comparte la captura de pantalla por WhatsApp al finalizar.`;
            inst.style.display = 'block';
        } else if (select.value === 'PayPal') {
            inst.innerHTML = `💳 <strong>Instrucciones PayPal:</strong> Envía tu pago a nuestra cuenta: <strong>evergreenlov@gmail.com</strong> y comparte la captura de pantalla por WhatsApp al finalizar.`;
            inst.style.display = 'block';
        } else if (select.value === 'Efectivo') {
            inst.innerHTML = `💵 <strong>Instrucciones:</strong> Puedes pagar en efectivo al recoger tu pedido directamente en nuestro taller.`;
            inst.style.display = 'block';
        } else {
            inst.innerHTML = `💳 <strong>Instrucciones:</strong> El pago automático con tarjeta estará disponible próximamente. Por favor, selecciona ATH Móvil, PayPal o Efectivo.`;
            inst.style.display = 'block';
        }
    },

    // Actualiza el badge de cantidad del carrito
    updateBadge(count) {
        const badge = document.getElementById('cart-badge');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'inline-flex' : 'none';
        }
    },

    // Restablece la vista del catálogo sin recargar toda la página (para el admin SPA)
    resetCatalog() {
        if (window.location.pathname.includes('catalogo_publico.html')) {
            location.reload();
        } else {
            if (typeof CatalogoComponent !== 'undefined') {
                CatalogoComponent.render('catalogo-view');
            } else {
                location.reload();
            }
        }
    }
};
