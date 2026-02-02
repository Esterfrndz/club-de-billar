import { useState, useEffect } from 'react'
import { TableList } from './components/TableList.jsx'
import { ReservationWizard } from './components/ReservationWizard.jsx'
import { AccessPortal } from './components/AccessPortal.jsx'
import { AdminCalendarView } from './components/AdminCalendarView.jsx'
import { MemberManager } from './components/MemberManager.jsx'
import { DailyPartidas } from './components/DailyPartidas.jsx'
import { useReservations } from './hooks/useReservations.js'
import { useMembers } from './hooks/useMembers.js'
import './AppLayout.css'

// Main App Component
function App() {
    const { reservations, addReservation, deleteReservation, checkAvailability } = useReservations();
    const { members, addMember, deleteMember, updateMember, uploadMemberPhoto, loading: membersLoading } = useMembers();
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [selectedTable, setSelectedTable] = useState(null);
    const [activeTab, setActiveTab] = useState('servicios'); // 'servicios', 'partidas', 'nosotros', 'mis-reservas', 'todas-reservas', 'socios'
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
    const [memberId, setMemberId] = useState(() => {
        return sessionStorage.getItem('memberId') || '';
    });
    const [memberPhoto, setMemberPhoto] = useState(() => {
        return sessionStorage.getItem('memberPhoto') || '';
    });

    const handleGlobalUpdate = async (id, updates) => {
        const result = await updateMember(id, updates);
        if (result.success && result.data) {
            // Sincronizar con el estado global si es el usuario actual usando los datos frescos de Supabase
            const isSelf = id === memberId || result.data.access_code === memberCode;

            if (isSelf) {
                if (result.data.name) {
                    setMemberName(result.data.name);
                    sessionStorage.setItem('memberName', result.data.name);
                }
                if (result.data.photo_url !== undefined) {
                    setMemberPhoto(result.data.photo_url || '');
                    sessionStorage.setItem('memberPhoto', result.data.photo_url || '');
                }
                if (!memberId && result.data.id) {
                    setMemberId(result.data.id);
                    sessionStorage.setItem('memberId', result.data.id);
                }
            }
        }
        return result;
    };

    const handleGlobalUpload = async (id, file) => {
        const result = await uploadMemberPhoto(id, file);
        if (result.success && result.data) {
            const isSelf = id === memberId || result.data.access_code === memberCode;

            if (isSelf) {
                const newPhotoUrl = result.data.photo_url;
                setMemberPhoto(newPhotoUrl || '');
                sessionStorage.setItem('memberPhoto', newPhotoUrl || '');

                if (!memberId && result.data.id) {
                    setMemberId(result.data.id);
                    sessionStorage.setItem('memberId', result.data.id);
                }
            }
        }
        return result;
    };

    const [isAdmin, setIsAdmin] = useState(() => {
        const saved = sessionStorage.getItem('isAdmin');
        return saved === 'true';
    });

    const handleLogout = () => {
        setMemberName('');
        setMemberCode('');
        setMemberId('');
        setMemberPhoto('');
        setIsAdmin(false);
        setIsPortalLocked(true);
        sessionStorage.clear();
        setActiveTab('servicios');
    };
    // Sincronizar estado del usuario actual con la lista de socios
    useEffect(() => {
        if (!members.length || (!memberId && !memberCode)) return;

        const me = members.find(m =>
            (memberId && String(m.id) === String(memberId)) ||
            (memberCode && String(m.access_code) === String(memberCode))
        );

        if (me) {
            if (me.name !== memberName) {
                setMemberName(me.name);
                sessionStorage.setItem('memberName', me.name);
            }
            if (me.photo_url !== (memberPhoto || null)) {
                const newPhoto = me.photo_url || '';
                setMemberPhoto(newPhoto);
                sessionStorage.setItem('memberPhoto', newPhoto);
            }
            if ((me.is_admin || false) !== isAdmin) {
                setIsAdmin(me.is_admin || false);
                sessionStorage.setItem('isAdmin', me.is_admin ? 'true' : 'false');
            }
            if (!memberId && me.id) {
                setMemberId(me.id);
                sessionStorage.setItem('memberId', me.id);
            }
        }
    }, [members, memberId, memberCode, memberName, memberPhoto, isAdmin]);
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

    const handleAccessGranted = (name, code, adminStatus, photoUrl, id) => {
        sessionStorage.setItem('accessGranted', 'true');
        sessionStorage.setItem('memberName', name);
        sessionStorage.setItem('memberCode', code);
        sessionStorage.setItem('isAdmin', adminStatus ? 'true' : 'false');
        sessionStorage.setItem('memberId', id || '');
        sessionStorage.setItem('memberPhoto', photoUrl || '');
        setMemberName(name);
        setMemberCode(code);
        setIsAdmin(adminStatus || false);
        setMemberId(id || '');
        setMemberPhoto(photoUrl || '');
        setIsPortalLocked(false);
    };

    const currentUser = members.find(m =>
        (memberId && String(m.id) === String(memberId)) ||
        (memberCode && String(m.access_code) === String(memberCode))
    );
    const memberNumber = currentUser ? members.indexOf(currentUser) + 1 : null;

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
                                <button className="logout-btn" onClick={handleLogout} title="Cerrar sesión" style={{ marginLeft: 0 }}>SALIR</button>
                            </div>
                        )}
                    </div>
                </nav>

                {/* Hero Section */}
                <div className="hero-section">
                    <div className="hero-content">
                        <div className="hero-icon">
                            {memberPhoto ? (
                                <img
                                    src={memberPhoto}
                                    alt={memberName}
                                    className="hero-icon-img"
                                    onError={(e) => {
                                        console.error("Hero image failed to load:", memberPhoto);
                                        setMemberPhoto('');
                                    }}
                                />
                            ) : (
                                '🏢'
                            )}
                        </div>
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
                        RESERVAR
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
                    <button
                        className={`tab-link ${activeTab === 'partidas' ? 'active' : ''}`}
                        onClick={() => setActiveTab('partidas')}
                    >
                        PARTIDAS HOY
                    </button>
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

                    {activeTab === 'partidas' && (
                        <DailyPartidas reservations={reservations} />
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
                            onUpdateMember={handleGlobalUpdate}
                            onUploadPhoto={handleGlobalUpload}
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
                    memberNumber={memberNumber}
                />
            </div >
        </>
    );
}

export default App;
