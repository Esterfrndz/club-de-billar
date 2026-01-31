import { useState, useEffect } from 'react'
import { TableList } from './components/TableList'
import { ReservationWizard } from './components/ReservationWizard'
import { AccessPortal } from './components/AccessPortal'
import { LoginModal } from './components/LoginModal'
import { AdminCalendarView } from './components/AdminCalendarView'
import { MemberManager } from './components/MemberManager'
import { useReservations } from './hooks/useReservations'
import { useAuth } from './hooks/useAuth'
import { useMembers } from './hooks/useMembers'
import './AppLayout.css'

function App() {
    const { reservations, addReservation, deleteReservation, checkAvailability } = useReservations();
    const { user, login, logout } = useAuth();
    const { members, addMember, deleteMember, loading: membersLoading } = useMembers();
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [selectedTable, setSelectedTable] = useState(null);
    const [activeTab, setActiveTab] = useState('servicios'); // 'servicios', 'nosotros', 'calendario', 'socios'
    const [isPortalLocked, setIsPortalLocked] = useState(() => {
        const saved = localStorage.getItem('accessGranted');
        return saved !== 'true';
    });
    const [memberName, setMemberName] = useState(() => {
        return localStorage.getItem('memberName') || '';
    });
    const [darkMode, setDarkMode] = useState(() => {
        const saved = localStorage.getItem('darkMode');
        return saved ? JSON.parse(saved) : false;
    });

    const [isLargeFont, setIsLargeFont] = useState(() => {
        const saved = localStorage.getItem('isLargeFont');
        return saved ? JSON.parse(saved) : false;
    });

    // Handle Dark Mode
    useEffect(() => {
        if (darkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        localStorage.setItem('darkMode', JSON.stringify(darkMode));
    }, [darkMode]);

    // Handle Font Scale
    useEffect(() => {
        const scale = isLargeFont ? 1.5 : 1;
        document.documentElement.style.setProperty('--font-scale', scale);
        localStorage.setItem('isLargeFont', JSON.stringify(isLargeFont));
    }, [isLargeFont]);

    // Handle cancellation via URL parameter
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const cancelId = params.get('cancel');
        if (cancelId) {
            const confirmCancel = async () => {
                if (window.confirm("¿Seguro que quieres cancelar tu reserva?")) {
                    const res = await deleteReservation(cancelId);
                    if (res.success) {
                        alert("Reserva cancelada con éxito.");
                        // Clean up URL
                        window.history.replaceState({}, document.title, window.location.pathname);
                    } else {
                        alert("Error al cancelar: " + res.error);
                    }
                }
            };
            confirmCancel();
        }
    }, [deleteReservation]);

    const currentHour = new Date().getHours();
    const isOpen = currentHour >= 9 && currentHour < 21;

    // Static list of tables with specific names/colors from reference
    const tablesData = [
        { id: 1, name: 'Mesa 1 - Sagredo', colorClass: 'icon-blue' },
        { id: 2, name: 'Mesa 2 - Liern', colorClass: 'icon-red' },
        { id: 3, name: 'Mesa 3 - Bailen', colorClass: 'icon-green' },
    ];

    const handleOpenReserve = (tableId) => {
        const table = tablesData.find(t => t.id === tableId);
        setSelectedTable(table);
        setIsWizardOpen(true);
    };

    const handleCloseWizard = () => {
        setIsWizardOpen(false);
        setSelectedTable(null);
    };

    const handleConfirmReservation = async (data) => {
        const result = await addReservation(
            data.tableId,
            data.date,
            data.time,
            data.name,
            data.memberId,
            data.mobile
        );

        if (result.success) {
            // Construct WhatsApp Message
            const table = tablesData.find(t => t.id === data.tableId);
            const tableName = table ? table.name : `Mesa ${data.tableId}`;
            const reservationId = result.data?.[0]?.id || 'null';

            // Cancellation Link (only if we have an ID)
            const cancelUrl = reservationId !== 'null'
                ? `${window.location.origin}${window.location.pathname}?cancel=${reservationId}`
                : '';

            const cancelText = cancelUrl
                ? `\n\nSi necesitas cancelar tu reserva, puedes hacerlo pulsando aquí:\n${cancelUrl}`
                : '';

            const message = `*Confirmación de Reserva*\n\nHola ${data.name},\n\nTe confirmamos tu reserva en *Club de billar Paterna*:\n\n📍 Mesa: ${tableName}\n📅 Fecha: ${data.date}\n⏰ Hora: ${data.time}h${cancelText}\n\n¡Te esperamos! 🎱`;

            // Format phone
            let phone = data.mobile.replace(/\s+/g, '');
            if (!phone.startsWith('+')) phone = '+34' + phone;
            phone = phone.replace('+', '');

            const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

            // In production, window.open after await is often blocked.
            // Using window.location.href is more reliable for a "final" action.
            window.location.href = whatsappUrl;

            handleCloseWizard();
        } else {
            alert(`Error: ${result.error}`);
        }
    };

    const handleAccessGranted = (name) => {
        localStorage.setItem('accessGranted', 'true');
        localStorage.setItem('memberName', name);
        setMemberName(name);
        setIsPortalLocked(false);
    };

    return (
        <>
            {isPortalLocked && (
                <AccessPortal onAccessGranted={handleAccessGranted} />
            )}
            <div className="app-container">
                {/* Top Navigation */}
                <nav className="top-nav">
                    <div className="brand-name">Club de billar Paterna</div>
                    <div className="user-profile">
                        <div className="accessibility-controls">
                            <button
                                className={`font-control-btn single-btn ${isLargeFont ? 'active' : ''}`}
                                onClick={() => setIsLargeFont(!isLargeFont)}
                                title={isLargeFont ? "Tamaño de letra normal" : "Aumentar tamaño de letra"}
                            >
                                A
                            </button>
                        </div>
                        <button
                            className="theme-toggle-btn"
                            onClick={() => setDarkMode(!darkMode)}
                            title={darkMode ? "Pasar a modo claro" : "Pasar a modo oscuro"}
                        >
                            {darkMode ? '☀️' : '🌙'}
                        </button>
                        {user ? (
                            <div className="admin-menu">
                                <div className="user-avatar">👤</div>
                                <span className="admin-name">Admin</span>
                                <button className="logout-btn" onClick={logout} title="Cerrar sesión">SALIR</button>
                            </div>
                        ) : (
                            <div className="visitor-info">
                                <button className="login-trigger-btn" onClick={() => setIsLoginOpen(true)}>
                                    Iniciar sesión
                                </button>
                            </div>
                        )}
                    </div>
                </nav>

                {/* Hero Section */}
                <div className="hero-section">
                    <div className="hero-content">
                        <div className="hero-icon">🏢</div>
                        <div className="hero-details">
                            <h1>{memberName ? `Bienvenido ${memberName}` : 'Club de billar Paterna'}</h1>
                            <span className={`status-badge ${isOpen ? 'open' : 'closed'}`}>
                                {isOpen ? 'Abierto' : 'Cerrado'}
                            </span>
                        </div>
                    </div>

                </div>

                {/* Tabs */}
                <div className="tabs-nav">
                    <button
                        className={`tab-link ${activeTab === 'servicios' ? 'active' : ''}`}
                        onClick={() => setActiveTab('servicios')}
                    >
                        SERVICIOS
                    </button>
                    <button
                        className={`tab-link ${activeTab === 'nosotros' ? 'active' : ''}`}
                        onClick={() => setActiveTab('nosotros')}
                    >
                        SOBRE NOSOTROS
                    </button>
                    {user && (
                        <>
                            <button
                                className={`tab-link ${activeTab === 'calendario' ? 'active' : ''}`}
                                onClick={() => setActiveTab('calendario')}
                            >
                                CALENDARIO
                            </button>
                            <button
                                className={`tab-link ${activeTab === 'socios' ? 'active' : ''}`}
                                onClick={() => setActiveTab('socios')}
                            >
                                SOCIOS
                            </button>
                        </>
                    )}
                </div>

                <main>
                    {activeTab === 'servicios' && (
                        <>
                            <div className="section-header">
                                <h2 className="section-title">Servicios</h2>
                                <div className="search-container">
                                    <span className="search-icon">🔍</span>
                                    <input
                                        type="text"
                                        placeholder="Buscar..."
                                        className="search-input"
                                    />
                                </div>
                            </div>

                            <TableList tables={tablesData} onReserve={handleOpenReserve} />
                        </>
                    )}

                    {activeTab === 'nosotros' && (
                        <div style={{ padding: '40px 24px', textAlign: 'center', color: '#666' }}>
                            <h2>Sobre Nosotros</h2>
                            <p>Bienvenidos al Club de billar Paterna. Un espacio dedicado al deporte y la convivencia.</p>
                        </div>
                    )}

                    {activeTab === 'calendario' && user && (
                        <AdminCalendarView
                            reservations={reservations}
                            onDelete={deleteReservation}
                        />
                    )}

                    {activeTab === 'socios' && (
                        <MemberManager
                            members={members}
                            onAddMember={addMember}
                            onDeleteMember={deleteMember}
                            loading={membersLoading}
                        />
                    )}
                </main>

                <ReservationWizard
                    isOpen={isWizardOpen}
                    onClose={handleCloseWizard}
                    onSubmit={handleConfirmReservation}
                    tableData={selectedTable}
                    checkAvailability={checkAvailability}
                    isLargeFont={isLargeFont}
                    setIsLargeFont={setIsLargeFont}
                />

                <LoginModal
                    isOpen={isLoginOpen}
                    onClose={() => setIsLoginOpen(false)}
                    onLogin={login}
                />
            </div>
        </>
    );
}

export default App;
