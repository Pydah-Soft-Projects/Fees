import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Swal from 'sweetalert2';
import {
    BadgeCheck,
    Bell,
    CalendarDays,
    ChartNoAxesColumn,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    CircleDollarSign,
    CreditCard,
    FileText,
    GraduationCap,
    LayoutDashboard,
    LogOut,
    Settings,
    ShieldCheck,
    Tag,
    TriangleAlert,
    Upload,
    UserRound,
    UsersRound,
    Wallet,
    X
} from 'lucide-react';
import { getStoredUser, clearAuthSession } from '../lib/auth';
import api from '../lib/api';

const Sidebar = ({ isOpenMobile = false, onCloseMobile = () => {} }) => {
    const location = useLocation();
    const [isCollapsed, setIsCollapsed] = useState(() => {
        return localStorage.getItem('sidebar-collapsed') === 'true';
    });

    const toggleCollapsed = () => {
        setIsCollapsed(prev => {
            const next = !prev;
            localStorage.setItem('sidebar-collapsed', String(next));
            return next;
        });
    };

    const expandSidebar = () => {
        setIsCollapsed(false);
        localStorage.setItem('sidebar-collapsed', 'false');
    };

    const navRef = React.useRef();

    React.useEffect(() => {
        const storedScroll = sessionStorage.getItem('sidebar-scroll');
        if (storedScroll && navRef.current) {
            navRef.current.scrollTop = Number(storedScroll);
        }
    }, []);

    const handleScroll = (e) => {
        sessionStorage.setItem('sidebar-scroll', e.target.scrollTop);
    };

    const icons = {
        Dashboard: <LayoutDashboard className="w-5 h-5 icon-dashboard transition-transform duration-200" />,
        Config: <Settings className="w-5 h-5 icon-config transition-transform duration-200" />,
        Students: <GraduationCap className="w-5 h-5 icon-students transition-transform duration-200" />,
        Collection: <Wallet className="w-5 h-5 icon-collection transition-transform duration-200" />,
        Reports: <ChartNoAxesColumn className="w-5 h-5 icon-reports transition-transform duration-200" />,
        DueReports: <TriangleAlert className="w-5 h-5 icon-duereports transition-transform duration-200" />,
        Users: <UsersRound className="w-5 h-5 icon-users transition-transform duration-200" />,
        PaymentConfig: <CreditCard className="w-5 h-5 icon-paymentconfig transition-transform duration-200" />,
        Reminders: <Bell className="w-5 h-5 icon-reminders transition-transform duration-200" />,
        BulkUpload: <Upload className="w-5 h-5 icon-bulkupload transition-transform duration-200" />,
        Concession: <Tag className="w-5 h-5 icon-concession transition-transform duration-200" />,
        ConcessionApproval: <BadgeCheck className="w-5 h-5 icon-concessionapproval transition-transform duration-200" />,
        Calendar: <CalendarDays className="w-5 h-5 icon-calendar transition-transform duration-200" />
    };

    const user = getStoredUser() || {};
    const role = user.role;
    const permissions = Array.isArray(user.permissions) ? user.permissions : [];

    // Settings sub-items (hash-based navigation within /settings)
    const SETTINGS_SUB_ITEMS = [
        { name: 'Receipt Appearance',      hash: 'appearance' },
        { name: 'Fee Collection Features', hash: 'features' },
        { name: 'User Payment Access',     hash: 'user-access' },
        { name: 'Receipt Sequence',        hash: 'sequence' },
        { name: 'Mask Fee Heads',          hash: 'masking' },
        { name: 'Email Reports',           hash: 'email-reports' },
        { name: 'Excess Fee Settings',     hash: 'excess-fee' },
    ];

    // Fee Configuration sub-items (hash-based navigation within /fee-config)
    const FEE_CONFIG_SUB_ITEMS = [
        { name: 'Fee Heads',     hash: 'heads' },
        { name: 'Fee Groups',    hash: 'groups' },
        { name: 'Fee Structures',hash: 'definitions' },
        { name: 'Late Fees',     hash: 'latefees' },
    ];

    // Proceedings sub-items (hash-based; filtered by permission)
    const PROCEEDINGS_SUB_ITEMS = [
        { name: 'All Proceedings', hash: 'list',   perm: 'list' },
        { name: 'Pending Queue',   hash: 'pending', perm: 'pending' },
        { name: 'Create Proceeding', hash: 'create', perm: 'create' },
        { name: 'Analytics',         hash: 'analytics', perm: 'view' },
        { name: 'Guide',           hash: 'guide',  perm: 'guide' },
    ];

    // Reminder Configuration sub-items (hash-based navigation within /reminders)
    const REMINDER_CONFIG_SUB_ITEMS = [
        { name: 'Templates',      hash: 'templates' },
        { name: 'Send Reminders',  hash: 'send' },
        { name: 'Reminder Rules',  hash: 'rules' },
        { name: 'Reminder Reports', hash: 'reports' },
        { name: 'Setup Guide',     hash: 'guide' },
    ];

    const isSettingsActive = location.pathname === '/settings';
    const [settingsExpanded, setSettingsExpanded] = React.useState(isSettingsActive);

    const isFeeConfigActive = location.pathname === '/fee-config';
    const [feeConfigExpanded, setFeeConfigExpanded] = React.useState(isFeeConfigActive);

    const isProceedingsActive = location.pathname === '/proceedings' || location.pathname === '/proceedings-analytics';
    const [proceedingsExpanded, setProceedingsExpanded] = React.useState(isProceedingsActive);
    const [hasPendingProceedingTxns, setHasPendingProceedingTxns] = React.useState(false);

    const isReminderConfigActive = location.pathname === '/reminders';
    const [reminderConfigExpanded, setReminderConfigExpanded] = React.useState(isReminderConfigActive);

    const canViewProceedings = role === 'superadmin' || role === 'admin'
        || permissions.includes('/proceedings')
        || permissions.includes('proceedings_view')
        || permissions.includes('proceedings_edit')
        || permissions.includes('proceedings_verify')
        || permissions.includes('proceedings_approve');
    const canCreateProceedings = role === 'superadmin' || role === 'admin'
        || permissions.includes('proceedings_view')
        || permissions.includes('proceedings_edit')
        || permissions.includes('/proceedings');
    const canListProceedings = role === 'superadmin' || role === 'admin'
        || permissions.includes('proceedings_edit')
        || permissions.includes('proceedings_verify')
        || permissions.includes('proceedings_approve');

    // Auto-expand groups when navigating to their respective routes
    React.useEffect(() => {
        if (isSettingsActive) setSettingsExpanded(true);
    }, [isSettingsActive]);

    React.useEffect(() => {
        if (isFeeConfigActive) setFeeConfigExpanded(true);
    }, [isFeeConfigActive]);

    React.useEffect(() => {
        if (isProceedingsActive) setProceedingsExpanded(true);
    }, [isProceedingsActive]);

    React.useEffect(() => {
        if (!canViewProceedings) {
            setHasPendingProceedingTxns(false);
            return undefined;
        }
        let cancelled = false;
        const fetchAlert = async () => {
            try {
                const res = await api.get('/proceedings/pending-auto-txn-alert');
                if (!cancelled) setHasPendingProceedingTxns(Boolean(res.data?.hasPending));
            } catch {
                if (!cancelled) setHasPendingProceedingTxns(false);
            }
        };
        fetchAlert();
        const interval = setInterval(fetchAlert, 60000);
        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    }, [canViewProceedings, isProceedingsActive, location.pathname]);

    React.useEffect(() => {
        if (isReminderConfigActive) setReminderConfigExpanded(true);
    }, [isReminderConfigActive]);

    const canViewOverallConcessions = role === 'superadmin' || role === 'admin'
        || permissions.includes('/overall-concessions')
        || permissions.includes('overall_concession_add')
        || permissions.includes('overall_concession_view')
        || permissions.includes('overall_concession_bulk')
        || permissions.includes('overall_concession_requests_read')
        || permissions.includes('overall_concession_requests_write')
        || permissions.includes('overall_concession_requests');

    const visibleProceedingsSubs = PROCEEDINGS_SUB_ITEMS.filter(sub => {
        if (sub.perm === 'create') return canCreateProceedings;
        if (sub.perm === 'list') return canListProceedings;
        return canViewProceedings;
    });

    const settingsIcon = <Settings className="w-5 h-5 icon-settings transition-transform duration-200" />;

    // Define all available menu items grouped by section
    const allMenuItems = [
        // Overview
        { section: 'Overview', name: 'Dashboard', path: '/dashboard', icon: icons.Dashboard },
        { section: 'Overview', name: 'Students', path: '/students', icon: icons.Students },

        // Fee Operations
        { section: 'Fee Operations', name: 'Fee Collection', path: '/fee-collection', icon: icons.Collection },
        { section: 'Fee Operations', name: 'Transaction Date Changes', path: '/transaction-dates', icon: icons.Calendar },
        { section: 'Fee Operations', name: 'Caution Deposit', path: '/caution-deposit', icon: <CircleDollarSign className="w-5 h-5 icon-collection transition-transform duration-200" /> },
        { section: 'Fee Operations', name: 'Concessions (Declaration)', path: '/overall-concessions', icon: icons.Concession },
        { section: 'Fee Operations', name: 'Concessions (Application)', path: '/concessions', icon: icons.ConcessionApproval },
        { section: 'Fee Operations', name: 'Bulk Fee Upload', path: '/bulk-fee-upload', icon: icons.BulkUpload },
        { section: 'Fee Operations', name: '__PROCEEDINGS__', path: '/proceedings', icon: <FileText className="w-5 h-5 icon-proceedings transition-transform duration-200" /> },

        // Reports
        { section: 'Reports', name: 'Reports & Analytics', path: '/reports', icon: icons.Reports },
        { section: 'Reports', name: 'Due Reports', path: '/due-reports', icon: icons.DueReports },

        // Configuration
        { section: 'Configuration', name: '__FEE_CONFIG__', path: '/fee-config', icon: icons.Config },
        { section: 'Configuration', name: 'Payment Config', path: '/payment-config', icon: icons.PaymentConfig },
        { section: 'Configuration', name: '__SETTINGS__', path: '/settings', icon: settingsIcon },
        { section: 'Configuration', name: '__REMINDER_CONFIG__', path: '/reminders', icon: icons.Reminders },
        { section: 'Configuration', name: 'Academic Calendar', path: '/academic-calendar', icon: icons.Calendar },

        // Administration
        { section: 'Administration', name: 'User Management', path: '/user-management', icon: icons.Users },
        { section: 'Administration', name: 'Permissions', path: '/permissions', icon: <ShieldCheck className="w-5 h-5 icon-permissions transition-transform duration-200" /> },
        { section: 'Administration', name: 'User Profile', path: '/user-profile', icon: <UserRound className="w-5 h-5 icon-userprofile transition-transform duration-200" /> },
    ];

    // Filter Logic
    const visibleMenuItems = role === 'superadmin' || role === 'admin'
        ? allMenuItems
        : allMenuItems.filter(item =>
            permissions.includes(item.path) ||
            item.path === '/user-profile' ||
            (item.path === '/proceedings' && (
                permissions.includes('proceedings_view') ||
                permissions.includes('proceedings_edit') ||
                permissions.includes('proceedings_verify') ||
                permissions.includes('proceedings_approve')
            )) ||
            (item.path === '/overall-concessions' && canViewOverallConcessions) ||
            (item.path === '/transaction-dates' && (
                permissions.includes('/transaction-dates') ||
                permissions.includes('transaction_date_change')
            ))
        );

    // Group items by section
    const groupedItems = visibleMenuItems.reduce((acc, item) => {
        const section = item?.section || 'Other';
        if (!Array.isArray(acc[section])) acc[section] = [];
        acc[section].push(item);
        return acc;
    }, {});

    const handleLogout = () => {
        const isSSO = localStorage.getItem('isSSO') === 'true';
        const crmUrl = localStorage.getItem('crmReturnUrl') || import.meta.env.VITE_CRM_FRONTEND_URL || 'http://localhost:5173';

        Swal.fire({
            title: 'Are you sure?',
            text: isSSO
                ? 'Are you sure you want to log out? You will be redirected to the CRM portal.'
                : 'Are you sure you want to log out? You will be returned to the login screen.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: 'var(--primary)',
            cancelButtonColor: 'var(--sidebar-muted)',
            confirmButtonText: 'Yes, logout!',
            cancelButtonText: 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                clearAuthSession();

                if (isSSO) {
                    window.location.href = crmUrl;
                } else {
                    window.location.href = '/login';
                }
            }
        });
    };

    return (
        <>
            {/* Mobile Backdrop Overlay */}
            {isOpenMobile && (
                <div 
                    className="fixed inset-0 backdrop-blur-xs z-40 md:hidden transition-opacity duration-300"
                    style={{ backgroundColor: 'color-mix(in srgb, var(--sidebar) 70%, transparent)' }}
                    onClick={onCloseMobile}
                />
            )}
            <div
                aria-hidden="true"
                className={`hidden md:block shrink-0 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-64'}`}
            />
            <aside className={`h-screen flex flex-col border-r transition-all duration-300 overflow-visible shrink-0
                fixed top-0 left-0 bottom-0 z-50 md:z-40
                ${isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                ${isCollapsed ? 'w-64 md:w-20' : 'w-64'}
            `} style={{
                backgroundColor: 'var(--sidebar)',
                color: 'var(--sidebar-text)',
                borderColor: 'var(--border)',
                fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
            }}>
            <div
                className="shrink-0 relative flex flex-col items-center justify-center text-center pt-6 pb-4 border-b"
                style={{ borderColor: 'var(--border)' }}
            >
                <div
                    className={`flex items-center justify-center w-full ${isCollapsed ? 'cursor-pointer' : ''}`}
                    onClick={() => isCollapsed && expandSidebar()}
                    title={isCollapsed ? 'Click to Expand' : ''}
                >
                    <div className="flex flex-col items-center justify-center select-none">
                        <img
                            src="/campo-logos/campo_logo_transparent_hq.png"
                            alt="Campo"
                            className={`h-7 object-contain ${isCollapsed ? 'w-14' : 'w-auto max-w-[120px]'}`}
                        />
                        {!isCollapsed && (
                            <span className="text-[10px] mt-1.5 font-medium tracking-wider whitespace-nowrap" style={{ color: 'var(--sidebar-muted)' }}>
                                Fee Management
                            </span>
                        )}
                    </div>
                </div>

                <button
                    onClick={toggleCollapsed}
                    className="hidden md:flex absolute -right-3 top-[106px] z-50 w-6 h-6 items-center justify-center rounded-full shadow-md border sidebar-collapse-button sidebar-utility-button"
                    style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--sidebar-muted)' }}
                    title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                    aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                    {isCollapsed
                        ? <ChevronRight size={14} strokeWidth={2.5} />
                        : <ChevronLeft size={14} strokeWidth={2.5} />}
                </button>
                {/* Mobile Close Button */}
                <button
                    onClick={onCloseMobile}
                    className="md:hidden absolute top-4 right-4 p-1.5 rounded-lg sidebar-utility-button"
                    style={{ color: 'var(--sidebar-text)' }}
                    title="Close Menu"
                    aria-label="Close menu"
                >
                    <X size={20} strokeWidth={2.5} />
                </button>
            </div>
            
            {/* Main Nav Container: Theme sidebar background */}
            <nav 
                ref={navRef} 
                onScroll={handleScroll} 
                className="sidebar-nav-scroll flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-3 relative z-10"
                style={{ backgroundColor: 'transparent', color: 'var(--sidebar-text)' }}
            >
                {Object.entries(groupedItems).map(([section, items], sGroupIdx) => (
                    <div key={section} className="space-y-1">
                        {!isCollapsed && (
                            <div className="mb-1.5 mt-2 flex items-center px-2">
                                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--sidebar-muted)' }}>
                                    {section === 'Overview' ? 'Main' : section}
                                </div>
                            </div>
                        )}
                        {isCollapsed && sGroupIdx > 0 && (
                            <div className="h-px my-2 mx-2" style={{ backgroundColor: 'var(--border)' }}></div>
                        )}
                        <div className="space-y-0.5">
                            {(Array.isArray(items) ? items : []).map((item, index) => {
                                // ── Special: Fee Configuration expandable group ──
                                if (item.name === '__FEE_CONFIG__') {
                                    const isActive = isFeeConfigActive;
                                    return (
                                        <div key={index}>
                                            <button
                                                onClick={() => {
                                                    if (isCollapsed) {
                                                        expandSidebar();
                                                    }
                                                    setFeeConfigExpanded(prev => !prev);
                                                }}
                                                className={`sidebar-link w-full flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                                                    isActive
                                                        ? 'shadow-md'
                                                        : ''
                                                } ${isCollapsed ? 'justify-center' : ''}`}
                                                style={isActive
                                                    ? { backgroundColor: 'var(--primary)', color: 'var(--sidebar-text)' }
                                                    : { color: 'var(--sidebar-text)' }
                                                }
                                                title={isCollapsed ? 'Fee Configuration' : ''}
                                            >
                                                <span className="text-xl shrink-0" style={{ color: isActive ? 'var(--sidebar-text)' : 'var(--sidebar-muted)' }}>{item.icon}</span>
                                                {!isCollapsed && (
                                                    <>
                                                        <span className="ml-3.5 whitespace-nowrap flex-1 text-left">Fee Configuration</span>
                                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${feeConfigExpanded ? 'rotate-180' : ''}`} strokeWidth={2.5} />
                                                    </>
                                                )}
                                            </button>
                                            {/* Sub-items */}
                                            {!isCollapsed && feeConfigExpanded && (
                                                <div className="ml-3 mt-0.5 pl-3 border-l space-y-0.5" style={{ borderColor: 'var(--border)' }}>
                                                    {FEE_CONFIG_SUB_ITEMS.map(sub => {
                                                        const subActive = isFeeConfigActive && (location.hash === `#${sub.hash}` || (!location.hash && sub.hash === 'heads'));
                                                        return (
                                                            <Link
                                                                key={sub.hash}
                                                                to={`/fee-config#${sub.hash}`}
                                                                className={`sidebar-sub-link flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                                    subActive
                                                                        ? 'font-bold'
                                                                        : ''
                                                                }`}
                                                                style={subActive 
                                                                    ? { backgroundColor: 'color-mix(in srgb, var(--sidebar-text) 15%, transparent)', color: 'var(--sidebar-text)' }
                                                                    : { color: 'var(--sidebar-muted)' }
                                                                }
                                                            >
                                                                <span className="w-1.5 h-1.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: subActive ? 'var(--primary-light)' : 'var(--sidebar-muted)' }}></span>
                                                                {sub.name}
                                                            </Link>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                // ── Special: Proceedings expandable group ──
                                if (item.name === '__PROCEEDINGS__') {
                                    const isActive = isProceedingsActive;
                                    const defaultHash = visibleProceedingsSubs[0]?.hash || 'list';
                                    return (
                                        <div key={index}>
                                            <button
                                                onClick={() => {
                                                    if (isCollapsed) {
                                                        expandSidebar();
                                                    }
                                                    setProceedingsExpanded(prev => !prev);
                                                }}
                                                className={`sidebar-link w-full flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                                                    isActive
                                                        ? 'shadow-md'
                                                        : ''
                                                } ${isCollapsed ? 'justify-center' : ''}`}
                                                style={isActive 
                                                    ? { backgroundColor: 'var(--primary)', color: 'var(--sidebar-text)' }
                                                    : { color: 'var(--sidebar-text)' }
                                                }
                                                title={isCollapsed ? 'Proceedings' : ''}
                                            >
                                                <span className="relative text-xl shrink-0" style={{ color: isActive ? 'var(--sidebar-text)' : 'var(--sidebar-muted)' }}>
                                                    {item.icon}
                                                    {hasPendingProceedingTxns && isCollapsed && (
                                                        <span
                                                            className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full ring-2"
                                                            style={{ backgroundColor: 'var(--primary-light)', '--tw-ring-color': isActive ? 'var(--primary)' : 'var(--sidebar)' }}
                                                            title="Pending proceeding transactions"
                                                        />
                                                    )}
                                                </span>
                                                {!isCollapsed && (
                                                    <>
                                                        <span className="ml-3.5 whitespace-nowrap flex-1 text-left flex items-center gap-2">
                                                            Proceedings
                                                            {hasPendingProceedingTxns && (
                                                                <span
                                                                    className="w-2 h-2 rounded-full shrink-0"
                                                                    style={{ backgroundColor: 'var(--primary-light)' }}
                                                                    title="Pending proceeding transactions"
                                                                />
                                                            )}
                                                        </span>
                                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${proceedingsExpanded ? 'rotate-180' : ''}`} strokeWidth={2.5} />
                                                    </>
                                                )}
                                            </button>
                                            {!isCollapsed && proceedingsExpanded && (
                                                <div className="ml-3 mt-0.5 pl-3 border-l space-y-0.5" style={{ borderColor: 'var(--border)' }}>
                                                    {visibleProceedingsSubs.map(sub => {
                                                        const isAnalyticsSub = sub.hash === 'analytics';
                                                        const targetTo = isAnalyticsSub ? '/proceedings-analytics' : `/proceedings#${sub.hash}`;
                                                        const subActive = isAnalyticsSub
                                                            ? location.pathname === '/proceedings-analytics'
                                                            : (location.pathname === '/proceedings' && (location.hash === `#${sub.hash}` || (!location.hash && sub.hash === defaultHash)));
                                                        return (
                                                            <Link
                                                                key={sub.hash}
                                                                to={targetTo}
                                                                className={`sidebar-sub-link flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                                    subActive
                                                                        ? 'font-bold'
                                                                        : ''
                                                                }`}
                                                                style={subActive 
                                                                    ? { backgroundColor: 'color-mix(in srgb, var(--sidebar-text) 15%, transparent)', color: 'var(--sidebar-text)' }
                                                                    : { color: 'var(--sidebar-muted)' }
                                                                }
                                                            >
                                                                <span className="w-1.5 h-1.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: subActive ? 'var(--primary-light)' : 'var(--sidebar-muted)' }}></span>
                                                                {sub.name}
                                                            </Link>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                // ── Special: Reminder Configuration expandable group ──
                                if (item.name === '__REMINDER_CONFIG__') {
                                    const isActive = isReminderConfigActive;
                                    return (
                                        <div key={index}>
                                            <button
                                                onClick={() => {
                                                    if (isCollapsed) {
                                                        expandSidebar();
                                                    }
                                                    setReminderConfigExpanded(prev => !prev);
                                                }}
                                                className={`sidebar-link w-full flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                                                    isActive
                                                        ? 'shadow-md'
                                                        : ''
                                                } ${isCollapsed ? 'justify-center' : ''}`}
                                                style={isActive 
                                                    ? { backgroundColor: 'var(--primary)', color: 'var(--sidebar-text)' }
                                                    : { color: 'var(--sidebar-text)' }
                                                }
                                                title={isCollapsed ? 'Reminder Config' : ''}
                                            >
                                                <span className="text-xl shrink-0" style={{ color: isActive ? 'var(--sidebar-text)' : 'var(--sidebar-muted)' }}>{item.icon}</span>
                                                {!isCollapsed && (
                                                    <>
                                                        <span className="ml-3.5 whitespace-nowrap flex-1 text-left">Reminder Config</span>
                                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${reminderConfigExpanded ? 'rotate-180' : ''}`} strokeWidth={2.5} />
                                                    </>
                                                )}
                                            </button>
                                            {/* Sub-items */}
                                            {!isCollapsed && reminderConfigExpanded && (
                                                <div className="ml-3 mt-0.5 pl-3 border-l space-y-0.5" style={{ borderColor: 'var(--border)' }}>
                                                    {REMINDER_CONFIG_SUB_ITEMS.map(sub => {
                                                        const subActive = isReminderConfigActive && (location.hash === `#${sub.hash}` || (!location.hash && sub.hash === 'templates'));
                                                        return (
                                                            <Link
                                                                key={sub.hash}
                                                                to={`/reminders#${sub.hash}`}
                                                                className={`sidebar-sub-link flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                                    subActive
                                                                        ? 'font-bold'
                                                                        : ''
                                                                }`}
                                                                style={subActive 
                                                                    ? { backgroundColor: 'color-mix(in srgb, var(--sidebar-text) 15%, transparent)', color: 'var(--sidebar-text)' }
                                                                    : { color: 'var(--sidebar-muted)' }
                                                                }
                                                            >
                                                                <span className="w-1.5 h-1.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: subActive ? 'var(--primary-light)' : 'var(--sidebar-muted)' }}></span>
                                                                {sub.name}
                                                            </Link>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                // ── Special: Settings expandable group ──────
                                if (item.name === '__SETTINGS__') {
                                    const isActive = isSettingsActive;
                                    return (
                                        <div key={index}>
                                            <button
                                                onClick={() => {
                                                    if (isCollapsed) {
                                                        expandSidebar();
                                                    }
                                                    setSettingsExpanded(prev => !prev);
                                                }}
                                                className={`sidebar-link w-full flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                                                    isActive
                                                        ? 'shadow-md'
                                                        : ''
                                                } ${isCollapsed ? 'justify-center' : ''}`}
                                                style={isActive 
                                                    ? { backgroundColor: 'var(--primary)', color: 'var(--sidebar-text)' }
                                                    : { color: 'var(--sidebar-text)' }
                                                }
                                                title={isCollapsed ? 'Settings' : ''}
                                            >
                                                <span className="text-xl shrink-0" style={{ color: isActive ? 'var(--sidebar-text)' : 'var(--sidebar-muted)' }}>{item.icon}</span>
                                                {!isCollapsed && (
                                                    <>
                                                        <span className="ml-3.5 whitespace-nowrap flex-1 text-left">Settings</span>
                                                        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${settingsExpanded ? 'rotate-180' : ''}`} strokeWidth={2.5} />
                                                    </>
                                                )}
                                            </button>
                                            {/* Sub-items */}
                                            {!isCollapsed && settingsExpanded && (
                                                <div className="ml-3 mt-0.5 pl-3 border-l space-y-0.5" style={{ borderColor: 'var(--border)' }}>
                                                    {SETTINGS_SUB_ITEMS.map(sub => {
                                                        const subActive = isSettingsActive && (location.hash === `#${sub.hash}` || (!location.hash && sub.hash === 'appearance'));
                                                        return (
                                                            <Link
                                                                key={sub.hash}
                                                                to={`/settings#${sub.hash}`}
                                                                className={`sidebar-sub-link flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                                                    subActive
                                                                        ? 'font-bold'
                                                                        : ''
                                                                }`}
                                                                style={subActive 
                                                                    ? { backgroundColor: 'color-mix(in srgb, var(--sidebar-text) 15%, transparent)', color: 'var(--sidebar-text)' }
                                                                    : { color: 'var(--sidebar-muted)' }
                                                                }
                                                            >
                                                                <span className="w-1.5 h-1.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: subActive ? 'var(--primary-light)' : 'var(--sidebar-muted)' }}></span>
                                                                {sub.name}
                                                            </Link>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                // ── Normal item ──────────────────────────────
                                const isActive = location.pathname === item.path;
                                return (
                                    <Link
                                        key={index}
                                        to={item.path}
                                        onClick={onCloseMobile}
                                        className={`sidebar-link flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                                            isActive
                                                ? 'shadow-md'
                                                : ''
                                        } ${isCollapsed ? 'justify-center' : ''}`}
                                        style={isActive
                                            ? { backgroundColor: 'var(--primary)', color: 'var(--sidebar-text)' }
                                            : { color: 'var(--sidebar-text)' }
                                        }
                                        title={isCollapsed ? item.name : ''}
                                    >
                                        <span className="text-xl shrink-0 transition-colors duration-200" style={{
                                            color: isActive ? 'var(--sidebar-text)' : 'var(--sidebar-muted)'
                                        }}>{item.icon}</span>
                                        {!isCollapsed && <span className="ml-3.5 whitespace-nowrap">{item.name}</span>}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>


            {/* Bottom Section: Profile Card matching Image 2 */}
            <div className="p-3 border-t shrink-0" style={{ backgroundColor: 'transparent', borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                {isCollapsed ? (
                    <div 
                        className="flex flex-col items-center gap-2.5 p-2 rounded-2xl transition-all duration-200"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
                    >
                        <Link 
                            to="/user-profile"
                            className="w-9 h-9 rounded-full bg-white flex items-center justify-center font-bold text-sm shadow-sm transition-transform duration-200 hover:scale-105 shrink-0"
                            style={{ color: 'var(--primary)' }}
                            title={user.name || 'User Profile'}
                        >
                            {user.name ? user.name.trim().charAt(0).toUpperCase() : 'S'}
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="p-1.5 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5 text-white" />
                        </button>
                    </div>
                ) : (
                    <div 
                        className="flex items-center justify-between p-2.5 rounded-2xl transition-all duration-200"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)' }}
                    >
                        <Link 
                            to="/user-profile"
                            className="flex items-center gap-3 flex-1 min-w-0 mr-1.5 group"
                            title="View Profile"
                        >
                            {/* White Circle Avatar with Primary Letter */}
                            <div 
                                className="w-9 h-9 rounded-full bg-white flex items-center justify-center font-bold text-sm shadow-sm shrink-0 transition-transform duration-200 group-hover:scale-105"
                                style={{ color: 'var(--primary)' }}
                            >
                                {user.name ? user.name.trim().charAt(0).toUpperCase() : 'S'}
                            </div>

                            {/* User Name & Role */}
                            <div className="flex-1 min-w-0 text-left">
                                <p className="text-sm font-bold text-white leading-tight truncate">
                                    {user.name || 'System Superadmin'}
                                </p>
                                <p className="text-xs text-slate-400 mt-0.5 truncate font-normal">
                                    {role === 'superadmin' 
                                        ? 'Superadmin' 
                                        : (user.campuses && user.campuses.length > 0
                                            ? `Campus scope (${user.campuses.length})`
                                            : (user.colleges && user.colleges.length > 1 
                                                ? `${user.college} (+${user.colleges.length - 1})` 
                                                : (user.college || role || 'User')
                                              )
                                          )
                                    }
                                </p>
                            </div>
                        </Link>

                        {/* Logout Button */}
                        <button
                            onClick={handleLogout}
                            className="p-1.5 rounded-lg text-white/90 hover:text-white hover:bg-white/10 transition-colors shrink-0"
                            title="Logout"
                        >
                            <LogOut className="w-5 h-5 text-white" />
                        </button>
                    </div>
                )}
            </div>

            {/* Sidebar Micro-Animations */}
            <style>{`
                .sidebar-link:hover {
                    background-color: color-mix(in srgb, var(--sidebar-text) 10%, transparent);
                }
                .sidebar-sub-link:hover,
                .sidebar-utility-button:hover {
                    background-color: color-mix(in srgb, var(--sidebar-text) 10%, transparent);
                }
                .sidebar-profile-link:hover {
                    filter: brightness(0.96);
                }
                .sidebar-logout-button:hover {
                    background-color: color-mix(in srgb, var(--primary-light) 25%, transparent);
                    color: var(--sidebar-text);
                }
                .sidebar-link:hover .icon-dashboard {
                    animation: dashboard-pulse 1s infinite alternate ease-in-out;
                }
                .sidebar-link:hover .icon-config,
                .sidebar-link:hover .icon-settings {
                    animation: cog-spin 2.5s infinite linear;
                }
                .sidebar-link:hover .icon-students,
                .sidebar-link:hover .icon-users,
                .sidebar-link:hover .icon-userprofile {
                    transform: scale(1.2);
                }
                .sidebar-link:hover .icon-collection {
                    animation: money-bounce 0.8s infinite alternate ease-in-out;
                }
                .sidebar-link:hover .icon-reports,
                .sidebar-link:hover .icon-duereports {
                    transform: translateY(-3px) scale(1.1);
                }
                .sidebar-link:hover .icon-reminders {
                    animation: bell-ring 0.6s ease-in-out;
                    transform-origin: top center;
                }
                .sidebar-link:hover .icon-bulkupload {
                    animation: upload-bounce 1s infinite ease-in-out;
                }
                .sidebar-link:hover .icon-concession,
                .sidebar-link:hover .icon-concessionapproval {
                    animation: tag-swing 0.8s ease-in-out;
                }
                .sidebar-link:hover .icon-calendar {
                    animation: calendar-pulse 0.8s infinite alternate ease-in-out;
                }
                .sidebar-link:hover .icon-permissions {
                    transform: rotate(15deg) scale(1.15);
                }
                .sidebar-link:hover .icon-proceedings {
                    transform: translateX(2px) scale(1.1);
                }

                /* Hide Scrollbars in Sidebar Navigation */
                .sidebar-nav-scroll {
                    -ms-overflow-style: none;  /* IE and Edge */
                    scrollbar-width: none;  /* Firefox */
                }
                .sidebar-nav-scroll::-webkit-scrollbar {
                    display: none; /* Chrome, Safari and Opera */
                }

                @keyframes cog-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes dashboard-pulse {
                    0% { transform: scale(1); }
                    100% { transform: scale(1.15); }
                }
                @keyframes money-bounce {
                    0% { transform: translateY(0); }
                    100% { transform: translateY(-3px) rotate(5deg); }
                }
                @keyframes bell-ring {
                    0%, 100% { transform: rotate(0deg); }
                    20% { transform: rotate(15deg); }
                    40% { transform: rotate(-15deg); }
                    60% { transform: rotate(10deg); }
                    80% { transform: rotate(-10deg); }
                }
                @keyframes upload-bounce {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-4px); }
                }
                @keyframes tag-swing {
                    0%, 100% { transform: rotate(0deg); }
                    50% { transform: rotate(-15deg); }
                }
                @keyframes calendar-pulse {
                    0% { transform: scale(1) translateY(0); }
                    100% { transform: scale(1.1) translateY(-2px); }
                }
            `}</style>
        </aside>
        </>
    );
};

export default Sidebar;
