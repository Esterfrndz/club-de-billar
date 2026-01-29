import { useState, useEffect } from 'react'
import { TableList } from './components/TableList'
import { ReservationWizard } from './components/ReservationWizard'
import { LoginModal } from './components/LoginModal'
import { AdminCalendarView } from './components/AdminCalendarView'
import { useReservations } from './hooks/useReservations'
import { useAuth } from './hooks/useAuth'
import './AppLayout.css'

function App() {
    const { reservations, addReservation, deleteReservation, checkAvailability } = useReservations();
    const { user, login, logout } = useAuth();
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [isLoginOpen, setIsLoginOpen] = useState(false);
    const [selectedTable, setSelectedTable] = useState(null);
    const [activeTab, setActiveTab] = useState('servicios'); // 'servicios', 'nosotros', 'calendario'

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
            // Success alert
            alert(`Reserva confirmada con éxito para la Mesa ${data.tableId} a las ${data.time}`);

            // Construct WhatsApp Message
            const table = tablesData.find(t => t.id === data.tableId);
            const tableName = table ? table.name : `Mesa ${data.tableId}`;
            const reservationId = result.data[0].id;

            // Cancellation Link
            const cancelUrl = `${window.location.origin}${window.location.pathname}?cancel=${reservationId}`;

            const message = `*Confirmación de Reserva*\n\nHola ${data.name},\n\nTe confirmamos tu reserva en *Club de billar Paterna*:\n\n📍 Mesa: ${tableName}\n📅 Fecha: ${data.date}\n⏰ Hora: ${data.time}h\n\nSi necesitas cancelar tu reserva, puedes hacerlo pulsando aquí:\n${cancelUrl}\n\n¡Te esperamos! 🎱`;

            // Format phone (remove spaces and ensure it starts with +34 if no country code)
            let phone = data.mobile.replace(/\s+/g, '');
            if (!phone.startsWith('+')) {
                phone = '+34' + phone; // Default to Spain if not provided
            }
            phone = phone.startsWith('+') ? phone.slice(1) : phone; // wa.me prefers without '+'

            const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

            // Open WhatsApp
            window.open(whatsappUrl, '_blank');

            handleCloseWizard(); // Close wizard on success
        } else {
            alert(`Error: ${result.error}`);
        }
    };

    return (
        <div className="app-container">
            {/* Top Navigation */}
            <nav className="top-nav">
                <div className="brand-name">Club de billar Paterna</div>
                <div className="user-profile">
                    {user ? (
                        <div className="admin-menu">
                            <div className="user-avatar">👤</div>
                            <span>Admin</span>
                            <button className="logout-btn" onClick={logout} title="Cerrar sesión">SALIR</button>
                        </div>
                    ) : (
                        <button className="login-trigger-btn" onClick={() => setIsLoginOpen(true)}>
                            Iniciar sesión
                        </button>
                    )}
                </div>
            </nav>

            {/* Hero Section */}
            <div className="hero-section">
                <div className="hero-content">
                    <div className="hero-icon">🏢</div>
                    <div className="hero-details">
                        <h1>Club de billar Paterna</h1>
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
                    <button
                        className={`tab-link-calendario ${activeTab === 'calendario' ? 'active' : ''}`}
                        onClick={() => setActiveTab('calendario')}
                    >
                        CALENDARIO
                    </button>
                )}
            </div>

            <main>
                {activeTab === 'servicios' && (
                    <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px', marginBottom: '16px' }}>
                            <h2 className="section-title" style={{ padding: 0, margin: 0 }}>Servicios</h2>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#999' }}>🔍</span>
                                <input
                                    type="text"
                                    placeholder="Buscar..."
                                    style={{
                                        padding: '8px 12px 8px 32px',
                                        borderRadius: '4px',
                                        border: '1px solid #E0E0E0',
                                        fontSize: '0.9rem',
                                        width: '200px'
                                    }}
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
            </main>

            <ReservationWizard
                isOpen={isWizardOpen}
                onClose={handleCloseWizard}
                onSubmit={handleConfirmReservation}
                tableData={selectedTable}
                checkAvailability={checkAvailability}
            />

            <LoginModal
                isOpen={isLoginOpen}
                onClose={() => setIsLoginOpen(false)}
                onLogin={login}
            />
        </div>
    );
}

export default App;
