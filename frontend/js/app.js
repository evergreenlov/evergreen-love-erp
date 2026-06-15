/**
 * Enrutador interactivo SPA (Single Page Application)
 */

// =============================================================
// MÓDULO DE AUTENTICACIÓN DE ADMINISTRADOR
// =============================================================
const AdminAuth = (() => {
    const TOKEN_KEY   = 'ev_token';
    const ROLE_KEY    = 'ev_role';
    const NOMBRE_KEY  = 'ev_user_nombre';
    const EMAIL_KEY   = 'ev_user_email';

    function getToken()  { return localStorage.getItem(TOKEN_KEY); }
    function getRole()   { return localStorage.getItem(ROLE_KEY); }
    function getNombre() { return localStorage.getItem(NOMBRE_KEY); }

    function saveSession(data) {
        localStorage.setItem(TOKEN_KEY,  data.access_token);
        localStorage.setItem(ROLE_KEY,   data.role);
        localStorage.setItem(NOMBRE_KEY, data.nombre || '');
        localStorage.setItem(EMAIL_KEY,  data.email  || '');
    }

    function clearSession() {
        [TOKEN_KEY, ROLE_KEY, NOMBRE_KEY, EMAIL_KEY].forEach(k => localStorage.removeItem(k));
    }

    function showApp() {
        document.getElementById('login-screen').style.display  = 'none';
        document.getElementById('app-container').style.display = '';
        const el = document.getElementById('session-user');
        if (el) el.textContent = getNombre() || getRole();
        lucide.createIcons();
    }

    function showLogin(msg) {
        clearSession();
        document.getElementById('app-container').style.display  = 'none';
        document.getElementById('login-screen').style.display   = 'flex';
        if (msg) showError(msg);
    }

    function showError(msg) {
        const el = document.getElementById('login-error');
        if (!el) return;
        el.textContent = msg;
        el.style.display = 'block';
    }

    function hideError() {
        const el = document.getElementById('login-error');
        if (el) el.style.display = 'none';
    }

    async function verifyToken() {
        const token = getToken();
        if (!token) return false;
        try {
            const res = await fetch(`${API_BASE_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    async function init() {
        const valid = await verifyToken();
        if (valid && ['admin','superadmin'].includes(getRole())) {
            showApp();
        } else {
            showLogin();
        }
    }

    async function login(email, password) {
        hideError();
        const btn = document.getElementById('login-btn');
        btn.disabled    = true;
        btn.textContent = 'Verificando...';
        try {
            const res = await fetch(`${API_BASE_URL}/auth/admin/login`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email, password }),
            });
            const data = await res.json();
            if (!res.ok) {
                showError(data.detail || 'Credenciales incorrectas.');
                return;
            }
            if (!['admin','superadmin'].includes(data.role)) {
                showError('Tu cuenta no tiene permisos de administrador.');
                return;
            }
            saveSession(data);
            showApp();
        } catch {
            showError('No se pudo conectar con el servidor. Verifica tu conexión.');
        } finally {
            btn.disabled    = false;
            btn.textContent = 'Iniciar sesión';
        }
    }

    function logout() {
        if (!confirm('¿Cerrar sesión?')) return;
        clearSession();
        showLogin();
    }

    function openChangePassword() {
        const modal = document.getElementById('change-password-modal');
        if (modal) {
            document.getElementById('cp-current').value = '';
            document.getElementById('cp-new').value = '';
            document.getElementById('cp-confirm').value = '';
            document.getElementById('cp-error').style.display = 'none';
            modal.style.display = 'flex';
        }
    }

    function closeChangePassword() {
        const modal = document.getElementById('change-password-modal');
        if (modal) modal.style.display = 'none';
    }

    async function submitChangePassword() {
        const currentPwd = document.getElementById('cp-current').value;
        const newPwd     = document.getElementById('cp-new').value;
        const confirmPwd = document.getElementById('cp-confirm').value;
        const errorEl    = document.getElementById('cp-error');
        const saveBtn    = document.getElementById('cp-save-btn');

        errorEl.style.display = 'none';

        if (newPwd !== confirmPwd) {
            errorEl.textContent = 'Las contraseñas nuevas no coinciden.';
            errorEl.style.display = 'block';
            return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Guardando...';
        try {
            const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
                body: JSON.stringify({
                    current_password: currentPwd,
                    new_password:     newPwd,
                    confirm_password: confirmPwd,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                errorEl.textContent = data.detail || 'Error al cambiar la contraseña.';
                errorEl.style.display = 'block';
                return;
            }
            closeChangePassword();
            showLogin('Contraseña actualizada. Inicia sesión nuevamente.');
        } catch {
            errorEl.textContent = 'No se pudo conectar con el servidor.';
            errorEl.style.display = 'block';
        } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Guardar';
        }
    }

    return { init, login, logout, getToken, getRole, getNombre, showLogin, openChangePassword, closeChangePassword, submitChangePassword };
})();

// Hacer el token disponible globalmente para que api.js lo incluya en los headers
function getAdminAuthHeaders() {
    const token = AdminAuth.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

// =============================================================

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar iconos de Lucide
    lucide.createIcons();

    // --- Inicializar autenticación antes de mostrar el dashboard ---
    AdminAuth.init();

    // Manejar envío del formulario de login
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const email    = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            AdminAuth.login(email, password);
        });
    }

    // Inicializar Carrito para inyectar su DOM y listeners
    if (typeof Carrito !== 'undefined') {
        Carrito.init();
    }
    
    // Configurar menú móvil (hamburguesa)
    const mobileToggle = document.getElementById('mobile-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    // Manejar enrutamiento
    const navItems = document.querySelectorAll('.nav-item');
    const tabViews = document.querySelectorAll('.tab-view');
    const pageTitle = document.getElementById('page-title');

    function navigateToTab(tabId) {
        // Cerrar menú móvil si está abierto
        if (sidebar) sidebar.classList.remove('open');

        // Desactivar todas las pestañas y vistas
        navItems.forEach(item => item.classList.remove('active'));
        tabViews.forEach(view => view.classList.remove('active'));

        // Activar la seleccionada
        const activeNavItem = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
        const activeView = document.getElementById(`view-${tabId}`);

        if (activeNavItem && activeView) {
            activeNavItem.classList.add('active');
            activeView.classList.add('active');
            
            // Actualizar título superior de la página
            const tabName = activeNavItem.querySelector('span').innerText;
            if (pageTitle) pageTitle.innerText = tabName;

            // Mostrar/ocultar el botón del carrito según la pestaña
            const cartBtn = document.getElementById('btn-carrito-admin');
            if (cartBtn) {
                if (tabId === 'catalogo') {
                    cartBtn.style.display = 'flex';
                    if (typeof Carrito !== 'undefined' && typeof Carrito.syncBadge === 'function') {
                        Carrito.syncBadge();
                    }
                } else {
                    cartBtn.style.display = 'none';
                }
            }

            // Renderizar el componente JS dinámico según la sección activa
            switch (tabId) {
                case 'dashboard':
                    DashboardComponent.render('dashboard-container');
                    break;
                case 'inventario':
                    InventarioComponent.render('inventario-container');
                    break;
                case 'disenos':
                    DisenosComponent.render('disenos-container');
                    break;
                case 'costos':
                    CostosComponent.render('costos-container');
                    break;
                case 'produccion':
                    ProduccionComponent.render('produccion-container');
                    break;
                case 'catalogo':
                    CatalogoComponent.render('catalogo-view');
                    break;
                case 'personalizados':
                    window.location.hash = '#costos';
                    return;
                    break;
                case 'clientes':
                    ClientesComponent.render('clientes-container');
                    break;
                case 'cotizaciones':
                    CotizacionesComponent.render('cotizaciones-container');
                    break;
                case 'facturas':
                    FacturasComponent.render('facturas-container');
                    break;
                default:
                    console.warn(`No se encontró componente para la pestaña: ${tabId}`);

            }
        }
    }

    // Configurar escuchas de clics en navegación
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            window.location.hash = tabId;
        });
    });

    // Escuchar cambios de Hash en la URL
    window.addEventListener('hashchange', () => {
        const hash = window.location.hash.substring(1) || 'dashboard';
        navigateToTab(hash);
    });

    // Cargar pestaña inicial basada en el Hash actual
    const initialHash = window.location.hash.substring(1) || 'dashboard';
    navigateToTab(initialHash);

    // --- SERVICIO DE ALERTAS DE PEDIDOS EN TIEMPO REAL ---

    // Inyectar animaciones CSS para los toasts emergentes
    const toastStyles = document.createElement('style');
    toastStyles.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(120%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(120%); opacity: 0; }
        }
    `;
    document.head.appendChild(toastStyles);

    // Generar un timbre/chime sutil usando Web Audio API (evita descargas de recursos externos)
    function playNotificationSound() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            
            // Primer tono (agudo)
            const osc1 = audioCtx.createOscillator();
            const gain1 = audioCtx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5 (Do)
            gain1.gain.setValueAtTime(0.08, audioCtx.currentTime);
            gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
            osc1.connect(gain1);
            gain1.connect(audioCtx.destination);
            osc1.start();
            osc1.stop(audioCtx.currentTime + 0.3);

            // Segundo tono en armonía (más agudo, desfasado 100ms)
            setTimeout(() => {
                const osc2 = audioCtx.createOscillator();
                const gain2 = audioCtx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(659.25, audioCtx.currentTime); // E5 (Mi)
                gain2.gain.setValueAtTime(0.08, audioCtx.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
                osc2.connect(gain2);
                gain2.connect(audioCtx.destination);
                osc2.start();
                osc2.stop(audioCtx.currentTime + 0.4);
            }, 100);
        } catch (e) {
            console.error("No se pudo reproducir el sonido de notificación:", e);
        }
    }

    // Mostrar modal emergente en la esquina inferior derecha
    function showNotificationPopup(factura) {
        let container = document.getElementById('admin-notif-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'admin-notif-container';
            container.style.position = 'fixed';
            container.style.bottom = '24px';
            container.style.right = '24px';
            container.style.zIndex = '9999';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '12px';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.style.background = '#FFFFFF';
        toast.style.borderLeft = '6px solid var(--color-moss-green)';
        toast.style.borderRadius = '8px';
        toast.style.boxShadow = '0 10px 25px rgba(62,62,62,0.18)';
        toast.style.padding = '16px 20px';
        toast.style.width = '320px';
        toast.style.display = 'flex';
        toast.style.flexDirection = 'column';
        toast.style.gap = '8px';
        toast.style.animation = 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards';
        toast.style.fontFamily = 'var(--font-primary)';
        
        toast.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <strong style="color:var(--color-moss-green); font-size:14px; display:flex; align-items:center; gap:6px;">
                    <i data-lucide="bell" style="width:16px; height:16px; display:inline;"></i> ¡Nuevo Pedido Recibido!
                </strong>
                <button class="toast-close-btn" style="background:none; border:none; color:#bbb; cursor:pointer; font-size:18px; padding:0; line-height:1; outline:none;">&times;</button>
            </div>
            <p style="margin:0; font-size:13.5px; color:#2d2d2d; line-height:1.4; text-align: left;">
                El cliente <strong>${factura.cliente_nombre}</strong> ha realizado un pedido.
            </p>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:12.5px; color:#8c8270; margin-top:4px;">
                <span>Factura: <strong>${factura.numero_factura}</strong></span>
                <span style="font-weight:700; color:var(--color-moss-green); font-size:14px;">$${factura.total.toFixed(2)}</span>
            </div>
            <div style="display:flex; gap:8px; margin-top:6px; justify-content:flex-end;">
                <button class="toast-view-btn" style="padding:6px 12px; background:var(--color-moss-green); color:white; border:none; border-radius:4px; font-size:11px; font-weight:600; cursor:pointer; outline:none;">Ver Detalles</button>
            </div>
        `;

        container.appendChild(toast);
        lucide.createIcons();

        // Controladores de cierre y navegación
        const closeBtn = toast.querySelector('.toast-close-btn');
        closeBtn.onclick = () => {
            toast.style.animation = 'slideOutRight 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        };

        const viewBtn = toast.querySelector('.toast-view-btn');
        viewBtn.onclick = () => {
            window.location.hash = 'facturas';
            toast.remove();
        };

        // Autodestruir después de 10 segundos
        setTimeout(() => {
            if (toast.parentElement) {
                toast.style.animation = 'slideOutRight 0.3s ease forwards';
                setTimeout(() => toast.remove(), 300);
            }
        }, 10000);
    }

    // Loop de verificación
    let isCheckingOrders = false;
    async function checkNewOrders() {
        if (isCheckingOrders) return;
        isCheckingOrders = true;
        try {
            if (typeof EvergreenAPI !== 'undefined' && typeof EvergreenAPI.getNuevasFacturas === 'function') {
                const res = await EvergreenAPI.getNuevasFacturas();
                const nuevas = res.data || [];
                if (nuevas.length > 0) {
                    playNotificationSound();
                    nuevas.forEach(f => showNotificationPopup(f));
                    
                    // Marcar como leídas/alertadas en lote
                    const ids = nuevas.map(f => f.id);
                    await EvergreenAPI.marcarFacturasLeidas(ids);
                }
            }
        } catch (err) {
            console.error("Error al buscar nuevos pedidos:", err);
        } finally {
            isCheckingOrders = false;
        }
    }

    // Iniciar el polling (cada 30 segundos)
    setInterval(checkNewOrders, 30000);
    // Ejecutar chequeo inicial a los 4 segundos
    setTimeout(checkNewOrders, 4000);
});
