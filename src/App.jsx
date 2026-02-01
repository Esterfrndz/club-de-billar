import { useState, useEffect } from 'react'
import { TableList } from './components/TableList.jsx'
import { ReservationWizard } from './components/ReservationWizard.jsx'
import { AccessPortal } from './components/AccessPortal.jsx'
import { AdminCalendarView } from './components/AdminCalendarView.jsx'
import { MemberManager } from './components/MemberManager.jsx'
import { useReservations } from './hooks/useReservations.js'
import { useMembers } from './hooks/useMembers.js'
import './AppLayout.css'

function App() {
    const { reservations, addReservation, deleteReservation, checkAvailability } = useReservations();
    const { members, addMember, deleteMember, updateMember, loading: membersLoading } = useMembers();
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [selectedTable, setSelectedTable] = useState(null);
    const [activeTab, setActiveTab] = useState('servicios'); // 'servicios', 'nosotros', 'mis-reservas', 'todas-reservas', 'socios'
    const [isPortalLocked, setIsPortalLocked] = useState(() => {
        const saved = sessionStorage.getItem('accessGranted');
        return saved !== 'true';
    });
    const [memberName, setMemberName] = useState(() => {
        return sessionStorage.getItem('memberName') || '';
    });
    const [memberCode, setMemberCode] = useState(() => {
        return sessionStorage.getItem('memberCode') || '';
    });
    const [memberPhoto, setMemberPhoto] = useState(() => {
        return sessionStorage.getItem('memberPhoto') || '';
    });
    const [isAdmin, setIsAdmin] = useState(() => {
        const saved = sessionStorage.getItem('isAdmin');
        return saved === 'true';
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
            memberName,
            memberCode,
            '' // No mobile needed now
        );

        if (result.success) {
            alert("¡Reserva confirmada con éxito! 🎉");
            handleCloseWizard();
        } else {
            alert(`Error: ${result.error}`);
        }
    };

    const handleAccessGranted = (name, code, adminStatus, photoUrl) => {
        sessionStorage.setItem('accessGranted', 'true');
        sessionStorage.setItem('memberName', name);
        sessionStorage.setItem('memberCode', code);
        sessionStorage.setItem('isAdmin', adminStatus ? 'true' : 'false');
        sessionStorage.setItem('memberPhoto', photoUrl || '');
        setMemberName(name);
        setMemberCode(code);
        setIsAdmin(adminStatus || false);
        setMemberPhoto(photoUrl || '');
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
                            className={`theme-toggle ${darkMode ? 'dark' : 'light'}`}
                            onClick={() => setDarkMode(!darkMode)}
                            title={darkMode ? 'Modo claro' : 'Modo oscuro'}
                        >
                            {darkMode ? '☀️' : '🌙'}
                        </button>
                        {memberName && (
                            <div className="admin-menu">
                                {memberPhoto ? (
                                    <img src={memberPhoto} alt={memberName} className="user-avatar-img" />
                                ) : (
                                    <div className="user-avatar">👤</div>
                                )}
                                <span className="admin-name">{memberName}</span>
                                <button className="logout-btn" onClick={() => {
                                    sessionStorage.clear();
                                    setIsPortalLocked(true);
                                    setMemberName('');
                                    setMemberCode('');
                                    setIsAdmin(false);
                                    setActiveTab('servicios'); // Reset tab on logout
                                }} title="Cerrar sesión">SALIR</button>
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
                                {isOpen ? 'Local Abierto' : 'Local Cerrado'}
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
                        SOBRE MI
                    </button>
                    {(isAdmin || memberName) && (
                        <button
                            className={`tab-link ${activeTab === 'mis-reservas' ? 'active' : ''}`}
                            onClick={() => setActiveTab('mis-reservas')}
                        >
                            MIS RESERVAS
                        </button>
                    )}
                    {isAdmin && (
                        <button
                            className={`tab-link ${activeTab === 'todas-reservas' ? 'active' : ''}`}
                            onClick={() => setActiveTab('todas-reservas')}
                        >
                            TODAS LAS RESERVAS
                        </button>
                    )}
                    {isAdmin && (
                        <button
                            className={`tab-link ${activeTab === 'socios' ? 'active' : ''}`}
                            onClick={() => setActiveTab('socios')}
                        >
                            SOCIOS
                        </button>
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
                            <h2>Sobre Mi</h2>
                            <p>Bienvenidos al Club de billar Paterna. Un espacio dedicado al deporte y la convivencia.</p>
                        </div>
                    )}

                    {activeTab === 'mis-reservas' && (isAdmin || memberName) && (
                        <AdminCalendarView
                            reservations={reservations.filter(r => r.member_id === memberCode)}
                            onDelete={deleteReservation}
                            isAdmin={false}
                        />
                    )}

                    {activeTab === 'todas-reservas' && isAdmin && (
                        <AdminCalendarView
                            reservations={reservations}
                            onDelete={deleteReservation}
                            isAdmin={true}
                        />
                    )}

                    {activeTab === 'socios' && isAdmin && (
                        <MemberManager
                            members={members}
                            onAddMember={addMember}
                            onDeleteMember={deleteMember}
                            onUpdateMember={updateMember}
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
                    memberName={memberName}
                    memberCode={memberCode}
                />
            </div>
        </>
    );
}

export default App;
