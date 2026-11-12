import React, { useState, useEffect, useRef } from 'react';
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

const Sidebar = ({ 
  isOpenMobile = false, 
  onCloseMobile = () => {},
  currentTab,
  setCurrentTab,
  currentRole,
  currentUser,
  roles: propRoles = [],
  isCollapsed: propIsCollapsed,
  setIsCollapsed: propSetIsCollapsed,
  onLogout: propOnLogout,
  onToast
}) => {
  const location = useLocation();

  // Collapsed state: support both external prop control and localStorage persistence
  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  const isCollapsed = propIsCollapsed !== undefined ? propIsCollapsed : internalCollapsed;

  const toggleCollapsed = () => {
    if (propSetIsCollapsed) {
      propSetIsCollapsed(!isCollapsed);
    } else {
      setInternalCollapsed(prev => {
        const next = !prev;
        localStorage.setItem('sidebar-collapsed', String(next));
        return next;
      });
    }
  };

  const expandSidebar = () => {
    if (propSetIsCollapsed) {
      propSetIsCollapsed(false);
    } else {
      setInternalCollapsed(false);
      localStorage.setItem('sidebar-collapsed', 'false');
    }
  };

  // Nav scroll restoration
  const navRef = useRef(null);

  useEffect(() => {
    const storedScroll = sessionStorage.getItem('sidebar-scroll');
    if (storedScroll && navRef.current) {
      navRef.current.scrollTop = Number(storedScroll);
    }
  }, []);

  const handleScroll = (e) => {
    sessionStorage.setItem('sidebar-scroll', e.target.scrollTop);
  };

  // User and permission context
  const user = currentUser || getStoredUser() || {};
  const role = currentRole || user.role || '';
  const permissions = Array.isArray(user.permissions) ? user.permissions : [];
  const isSuperadmin = (role || '').toLowerCase() === 'superadmin' || (role || '').toLowerCase() === 'admin';

  // Sub-items definitions for expandable groups
  const SETTINGS_SUB_ITEMS = [
    { name: 'Receipt Appearance',      hash: 'appearance' },
    { name: 'Fee Collection Features', hash: 'features' },
    { name: 'User Payment Access',     hash: 'user-access' },
    { name: 'Receipt Sequence',        hash: 'sequence' },
    { name: 'Mask Fee Heads',          hash: 'masking' },
    { name: 'Email Reports',           hash: 'email-reports' },
    { name: 'Excess Fee Settings',     hash: 'excess-fee' },
  ];

  const FEE_CONFIG_SUB_ITEMS = [
    { name: 'Fee Heads',      hash: 'heads' },
    { name: 'Fee Groups',     hash: 'groups' },
    { name: 'Fee Structures', hash: 'definitions' },
    { name: 'Late Fees',      hash: 'latefees' },
  ];

  const PROCEEDINGS_SUB_ITEMS = [
    { name: 'All Proceedings',   hash: 'list',      perm: 'list' },
    { name: 'Pending Queue',     hash: 'pending',   perm: 'pending' },
    { name: 'Create Proceeding', hash: 'create',    perm: 'create' },
    { name: 'Analytics',         hash: 'analytics', perm: 'view' },
    { name: 'Guide',             hash: 'guide',     perm: 'guide' },
  ];

  const REMINDER_CONFIG_SUB_ITEMS = [
    { name: 'Templates',       hash: 'templates' },
    { name: 'Send Reminders',  hash: 'send' },
    { name: 'Reminder Rules',  hash: 'rules' },
    { name: 'Reminder Reports', hash: 'reports' },
    { name: 'Setup Guide',     hash: 'guide' },
  ];

  // Active status for expandable sections
  const isSettingsActive = location.pathname === '/settings' || currentTab === 'settings';
  const isFeeConfigActive = location.pathname === '/fee-config' || currentTab === 'fee-config';
  const isProceedingsActive = location.pathname === '/proceedings' || location.pathname === '/proceedings-analytics' || currentTab === 'proceedings';
  const isReminderConfigActive = location.pathname === '/reminders' || currentTab === 'reminders';

  const [settingsExpanded, setSettingsExpanded] = useState(isSettingsActive);
  const [feeConfigExpanded, setFeeConfigExpanded] = useState(isFeeConfigActive);
  const [proceedingsExpanded, setProceedingsExpanded] = useState(isProceedingsActive);
  const [reminderConfigExpanded, setReminderConfigExpanded] = useState(isReminderConfigActive);

  // Auto-expand groups when active
  useEffect(() => {
    if (isSettingsActive) setSettingsExpanded(true);
  }, [isSettingsActive]);

  useEffect(() => {
    if (isFeeConfigActive) setFeeConfigExpanded(true);
  }, [isFeeConfigActive]);

  useEffect(() => {
    if (isProceedingsActive) setProceedingsExpanded(true);
  }, [isProceedingsActive]);

  useEffect(() => {
    if (isReminderConfigActive) setReminderConfigExpanded(true);
  }, [isReminderConfigActive]);

  // Permissions checks
  const canViewProceedings = isSuperadmin
    || permissions.includes('/proceedings')
    || permissions.includes('/proceedings-analytics')
    || permissions.includes('proceedings_view')
    || permissions.includes('proceedings_edit')
    || permissions.includes('proceedings_verify')
    || permissions.includes('proceedings_approve');

  const canCreateProceedings = isSuperadmin
    || permissions.includes('proceedings_view')
    || permissions.includes('proceedings_edit')
    || permissions.includes('/proceedings');

  const canListProceedings = isSuperadmin
    || permissions.includes('proceedings_edit')
    || permissions.includes('proceedings_verify')
    || permissions.includes('proceedings_approve');

  const canViewOverallConcessions = isSuperadmin
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

  // Proceedings pending background auto-transaction alert polling
  const [hasPendingProceedingTxns, setHasPendingProceedingTxns] = useState(false);

  useEffect(() => {
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

  // Standardized Campo sections for Fee Management
  const navSections = [
    {
      category: 'MAIN',
      items: [
        { id: 'dashboard', name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, iconClass: 'icon-dashboard' },
        { id: 'students', name: 'Students', path: '/students', icon: GraduationCap, iconClass: 'icon-students' }
      ]
    },
    {
      category: 'OPERATIONS',
      items: [
        { id: 'fee_collection', name: 'Fee Collection', path: '/fee-collection', icon: Wallet, iconClass: 'icon-collection' },
        { id: 'transaction_dates', name: 'Transaction Date Changes', path: '/transaction-dates', icon: CalendarDays, iconClass: 'icon-calendar' },
        { id: 'caution_deposit', name: 'Caution Deposit', path: '/caution-deposit', icon: CircleDollarSign, iconClass: 'icon-collection' },
        { id: 'overall_concessions', name: 'Concessions (Declaration)', path: '/overall-concessions', icon: Tag, iconClass: 'icon-concession' },
        { id: 'concessions', name: 'Concessions (Application)', path: '/concessions', icon: BadgeCheck, iconClass: 'icon-concessionapproval' },
        { id: 'bulk_upload', name: 'Bulk Fee Upload', path: '/bulk-fee-upload', icon: Upload, iconClass: 'icon-bulkupload' },
        { 
          id: 'proceedings', 
          name: 'Proceedings', 
          path: '/proceedings', 
          icon: FileText,
          iconClass: 'icon-proceedings',
          isExpandable: true,
          isExpanded: proceedingsExpanded,
          setExpanded: setProceedingsExpanded,
          isActive: isProceedingsActive,
          hasAlert: hasPendingProceedingTxns,
          subItems: visibleProceedingsSubs.map(sub => {
            const isAnalytics = sub.hash === 'analytics';
            return {
              name: sub.name,
              to: isAnalytics ? '/proceedings-analytics' : `/proceedings#${sub.hash}`,
              isActive: isAnalytics 
                ? location.pathname === '/proceedings-analytics'
                : (location.pathname === '/proceedings' && (location.hash === `#${sub.hash}` || (!location.hash && sub.hash === 'list')))
            };
          })
        }
      ]
    },
    {
      category: 'REPORTS',
      items: [
        { id: 'reports', name: 'Reports & Analytics', path: '/reports', icon: ChartNoAxesColumn, iconClass: 'icon-reports' },
        { id: 'due_reports', name: 'Due Reports', path: '/due-reports', icon: TriangleAlert, iconClass: 'icon-duereports' }
      ]
    },
    {
      category: 'MANAGEMENT',
      items: [
        {
          id: 'fee_config',
          name: 'Fee Configuration',
          path: '/fee-config',
          icon: Settings,
          iconClass: 'icon-config',
          isExpandable: true,
          isExpanded: feeConfigExpanded,
          setExpanded: setFeeConfigExpanded,
          isActive: isFeeConfigActive,
          subItems: FEE_CONFIG_SUB_ITEMS.map(sub => ({
            name: sub.name,
            to: `/fee-config#${sub.hash}`,
            isActive: isFeeConfigActive && (location.hash === `#${sub.hash}` || (!location.hash && sub.hash === 'heads'))
          }))
        },
        { id: 'payment_config', name: 'Payment Config', path: '/payment-config', icon: CreditCard, iconClass: 'icon-paymentconfig' },
        {
          id: 'settings',
          name: 'Settings',
          path: '/settings',
          icon: Settings,
          iconClass: 'icon-settings',
          isExpandable: true,
          isExpanded: settingsExpanded,
          setExpanded: setSettingsExpanded,
          isActive: isSettingsActive,
          subItems: SETTINGS_SUB_ITEMS.map(sub => ({
            name: sub.name,
            to: `/settings#${sub.hash}`,
            isActive: isSettingsActive && (location.hash === `#${sub.hash}` || (!location.hash && sub.hash === 'appearance'))
          }))
        },
        {
          id: 'reminder_config',
          name: 'Reminder Config',
          path: '/reminders',
          icon: Bell,
          iconClass: 'icon-reminders',
          isExpandable: true,
          isExpanded: reminderConfigExpanded,
          setExpanded: setReminderConfigExpanded,
          isActive: isReminderConfigActive,
          subItems: REMINDER_CONFIG_SUB_ITEMS.map(sub => ({
            name: sub.name,
            to: `/reminders#${sub.hash}`,
            isActive: isReminderConfigActive && (location.hash === `#${sub.hash}` || (!location.hash && sub.hash === 'templates'))
          }))
        },
        { id: 'academic_calendar', name: 'Academic Calendar', path: '/academic-calendar', icon: CalendarDays, iconClass: 'icon-calendar' }
      ]
    },
    {
      category: 'ADMINISTRATION',
      items: [
        { id: 'user_management', name: 'User Management', path: '/user-management', icon: UsersRound, iconClass: 'icon-users' },
        { id: 'permissions', name: 'Permissions', path: '/permissions', icon: ShieldCheck, iconClass: 'icon-permissions' },
        { id: 'user_profile', name: 'User Profile', path: '/user-profile', icon: UserRound, iconClass: 'icon-userprofile' }
      ]
    }
  ];

  // Permission filtering: hide items and sections user cannot access
  const isItemPermitted = (item) => {
    if (isSuperadmin) return true;
    if (item.path === '/user-profile' || item.id === 'user_profile') return true;
    if (item.path === '/dashboard' || item.id === 'dashboard') return true;
    if (item.path === '/proceedings' || item.id === 'proceedings') return canViewProceedings;
    if (item.path === '/overall-concessions' || item.id === 'overall_concessions') return canViewOverallConcessions;
    if (item.path === '/transaction-dates' || item.id === 'transaction_dates') {
      return permissions.includes('/transaction-dates') || permissions.includes('transaction_date_change');
    }
    return permissions.includes(item.path) || permissions.includes(item.id);
  };

  const allowedSections = navSections
    .map(section => ({
      ...section,
      items: section.items.filter(isItemPermitted)
    }))
    .filter(section => section.items.length > 0);

  // Active status helper
  const isItemActive = (item) => {
    if (currentTab && (currentTab === item.id || currentTab === item.path)) return true;
    return location.pathname === item.path;
  };

  // User display info matching Image 2
  const displayName = user.full_name || user.name || 'DAMERLA SAI S...';
  const displayRole = role === 'superadmin' 
    ? 'Superadmin' 
    : (user.campuses && user.campuses.length > 0
        ? `Campus scope (${user.campuses.length})`
        : (user.colleges && user.colleges.length > 1 
            ? `${user.college} (+${user.colleges.length - 1})` 
            : (user.college || role || 'Administrator')
          )
      );
  const initialLetter = displayName.trim().charAt(0).toUpperCase() || 'D';

  // Logout handler
  const handleLogout = () => {
    if (propOnLogout) {
      propOnLogout();
      return;
    }
    const isSSO = localStorage.getItem('isSSO') === 'true';
    const crmUrl = localStorage.getItem('crmReturnUrl') || import.meta.env.VITE_CRM_FRONTEND_URL || 'https://crm.pydah.edu.in';

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

      {/* Main Standardized Fixed Sidebar */}
      <aside 
        className={`fixed top-0 left-0 bottom-0 z-40 border-r transition-all duration-200 ease-in-out flex flex-col justify-between select-none font-['Plus_Jakarta_Sans',system-ui,-apple-system,sans-serif] ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={{
          backgroundColor: 'var(--sidebar)',
          borderColor: 'var(--border)',
          color: 'var(--sidebar-text)',
          boxShadow: '4px 0 24px -2px rgba(10, 20, 35, 0.45)'
        }}
      >
        {/* Floating Circular Collapse/Expand Button Protruding on Right Border */}
        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden md:flex absolute -right-3 top-[106px] z-50 w-6 h-6 rounded-full shadow-md border items-center justify-center cursor-pointer hover:scale-105 transition-all sidebar-collapse-button sidebar-utility-button"
          style={{
            backgroundColor: 'var(--surface)',
            borderColor: 'var(--border)',
            color: 'var(--text-primary, var(--sidebar-text))'
          }}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" style={{ color: 'var(--text-primary, var(--sidebar-text))' }} />
          ) : (
            <ChevronLeft className="w-3.5 h-3.5 stroke-[2.5]" style={{ color: 'var(--text-primary, var(--sidebar-text))' }} />
          )}
        </button>

        {/* Top Header & Scrollable Navigation Area */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Campo Brand Header with Divider Line */}
          <div 
            className={`pt-6 pb-4 border-b flex flex-col items-center justify-center relative ${isCollapsed ? 'px-2' : 'px-6'}`}
            style={{ borderColor: 'var(--border)' }}
          >
            {/* Mobile Close Button */}
            <button
              onClick={onCloseMobile}
              className="md:hidden absolute top-4 right-4 p-1.5 rounded-lg sidebar-utility-button transition-colors hover:bg-white/10 cursor-pointer"
              style={{ color: 'var(--sidebar-text)' }}
              title="Close Menu"
              aria-label="Close menu"
            >
              <X size={20} strokeWidth={2.5} />
            </button>

            {!isCollapsed ? (
              <div className="flex flex-col items-center justify-center text-center w-full">
                <div className="flex items-center justify-center w-full">
                  <img
                    src="/campo-logos/campo_logo_transparent_hq.png"
                    alt="Campo"
                    className="h-7 w-auto object-contain object-center max-w-[120px]"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  {/* Fallback stylized brand text */}
                  <div 
                    className="hidden items-baseline justify-center font-bold text-2xl tracking-tight text-center"
                    style={{ color: 'var(--sidebar-text)' }}
                  >
                    <span style={{ color: 'var(--secondary, #00B4D8)' }}>C</span>ampo
                  </div>
                </div>

                {/* Subtitle */}
                <span 
                  className="text-[12px] font-medium mt-2 tracking-[-0.01em] truncate block leading-tight text-center w-full"
                  style={{ color: 'var(--sidebar-muted)' }}
                >
                  Fee Management
                </span>
              </div>
            ) : (
              /* Collapsed Logo matching Image: 44px white rounded square with Campo Icon */
              <div 
                className="flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
                onClick={expandSidebar}
                title="Click to Expand"
              >
                <img
                  src="/campo-logos/favicon.svg"
                  alt="Campo"
                  title="Campo Fee Management"
                  className="w-11 h-11 object-contain drop-shadow-sm"
                  onError={(e) => {
                    e.target.src = '/campo-logos/favicon.ico';
                  }}
                />
              </div>
            )}
          </div>

          {/* Scrollable Navigation List */}
          <div 
            ref={navRef}
            onScroll={handleScroll}
            className={`sidebar-nav-scroll custom-dark-scrollbar flex-1 overflow-y-auto overflow-x-hidden pt-3 pb-4 ${
              isCollapsed ? 'px-2 space-y-1 flex flex-col items-center' : 'px-3.5 space-y-6'
            }`}
          >
            {allowedSections.map((section, sIdx) => (
              <div key={section.category || sIdx} className={`w-full ${isCollapsed ? 'space-y-1.5' : 'space-y-1'}`}>
                {/* Category Heading or Collapsed Section Divider */}
                {!isCollapsed ? (
                  <div 
                    className="px-3.5 pt-1 pb-2 text-[11px] font-bold uppercase tracking-[0.06em] leading-none"
                    style={{ color: 'var(--sidebar-muted)' }}
                  >
                    {section.category}
                  </div>
                ) : (
                  /* Collapsed horizontal divider line between sections */
                  <div 
                    className="w-9 h-px mx-auto my-2 border-t"
                    style={{ borderColor: 'var(--border)' }}
                  />
                )}

                {/* Section Navigation Items */}
                {section.items.map(item => {
                  const Icon = item.icon;

                  // Expandable Item (e.g. Fee Configuration, Settings, Proceedings, Reminder Config)
                  if (item.isExpandable) {
                    const active = item.isActive;
                    const expanded = item.isExpanded;
                    return (
                      <div key={item.id} className="w-full flex flex-col items-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (isCollapsed) {
                              expandSidebar();
                            }
                            item.setExpanded(prev => !prev);
                          }}
                          title={isCollapsed ? item.name : undefined}
                          className={`sidebar-link group relative flex items-center transition-all duration-150 cursor-pointer ${
                            isCollapsed 
                              ? `w-12 h-12 justify-center rounded-2xl ${active ? 'shadow-sm' : 'rounded-xl hover:bg-white/10'}`
                              : `w-full justify-between px-3.5 py-2.5 rounded-xl text-[13px] ${active ? 'font-semibold shadow-xs' : 'font-medium hover:opacity-80'}`
                          }`}
                          style={
                            active
                              ? { backgroundColor: 'var(--primary)', color: 'var(--sidebar-text)' }
                              : { color: 'var(--sidebar-text)' }
                          }
                        >
                          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3.5 min-w-0'}`}>
                            <span className="relative shrink-0 flex items-center justify-center">
                              <Icon 
                                strokeWidth={2}
                                className={`${item.iconClass || ''} transition-transform duration-200 ${isCollapsed ? 'w-5 h-5' : 'w-[18px] h-[18px]'}`}
                                style={{ color: 'var(--sidebar-text)' }}
                              />
                              {item.hasAlert && isCollapsed && (
                                <span
                                  className="absolute -top-1 -right-1 w-2 h-2 rounded-full ring-2"
                                  style={{ 
                                    backgroundColor: 'var(--primary-light)',
                                    '--tw-ring-color': active ? 'var(--primary)' : 'var(--sidebar)'
                                  }}
                                  title="Pending proceeding transactions"
                                />
                              )}
                            </span>
                            {!isCollapsed && (
                              <span 
                                className="truncate leading-none text-[13px] tracking-normal flex items-center gap-2"
                                style={{ color: 'var(--sidebar-text)' }}
                              >
                                {item.name}
                                {item.hasAlert && (
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: 'var(--primary-light)' }}
                                    title="Pending proceeding transactions"
                                  />
                                )}
                              </span>
                            )}
                          </div>

                          {!isCollapsed && (
                            <ChevronDown 
                              className={`w-3.5 h-3.5 stroke-[2] transition-transform duration-200 shrink-0 ${expanded ? 'rotate-180' : ''}`}
                              style={{ color: 'var(--sidebar-text)' }}
                            />
                          )}

                          {/* Tooltip in Collapsed Mode */}
                          {isCollapsed && (
                            <div 
                              className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl border"
                              style={{
                                backgroundColor: 'var(--sidebar)',
                                borderColor: 'var(--border)',
                                color: 'var(--sidebar-text)'
                              }}
                            >
                              {item.name}
                            </div>
                          )}
                        </button>

                        {/* Sub-items in Expanded Mode */}
                        {!isCollapsed && expanded && item.subItems && item.subItems.length > 0 && (
                          <div className="ml-5 mt-1 pl-3 border-l space-y-0.5 w-full" style={{ borderColor: 'var(--border)' }}>
                            {item.subItems.map(sub => (
                              <Link
                                key={sub.name}
                                to={sub.to}
                                onClick={onCloseMobile}
                                className={`sidebar-sub-link flex items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:bg-white/10 ${
                                  sub.isActive ? 'font-bold' : ''
                                }`}
                                style={
                                  sub.isActive
                                    ? { backgroundColor: 'color-mix(in srgb, var(--sidebar-text) 15%, transparent)', color: 'var(--sidebar-text)' }
                                    : { color: 'var(--sidebar-muted)' }
                                }
                              >
                                <span 
                                  className="w-1.5 h-1.5 rounded-full mr-2 shrink-0" 
                                  style={{ backgroundColor: sub.isActive ? 'var(--primary-light)' : 'var(--sidebar-muted)' }}
                                />
                                {sub.name}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Standard Navigation Item Link
                  const active = isItemActive(item);
                  return (
                    <div key={item.id} className="w-full flex justify-center">
                      <Link
                        to={item.path}
                        onClick={() => {
                          if (setCurrentTab) setCurrentTab(item.id);
                          onCloseMobile();
                        }}
                        title={isCollapsed ? item.name : undefined}
                        className={`sidebar-link group relative flex items-center transition-all duration-150 cursor-pointer ${
                          isCollapsed 
                            ? `w-12 h-12 justify-center rounded-2xl ${active ? 'shadow-sm' : 'rounded-xl hover:bg-white/10'}`
                            : `w-full justify-between px-3.5 py-2.5 rounded-xl text-[13px] ${active ? 'font-semibold shadow-xs' : 'font-medium hover:opacity-80'}`
                        }`}
                        style={
                          active
                            ? { backgroundColor: 'var(--primary)', color: 'var(--sidebar-text)' }
                            : { color: 'var(--sidebar-text)' }
                        }
                      >
                        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3.5 min-w-0'}`}>
                          <Icon 
                            strokeWidth={2}
                            className={`${item.iconClass || ''} shrink-0 transition-opacity ${isCollapsed ? 'w-5 h-5' : 'w-[18px] h-[18px]'}`}
                            style={{ color: 'var(--sidebar-text)' }}
                          />

                          {!isCollapsed && (
                            <span 
                              className="truncate leading-none text-[13px] tracking-normal"
                              style={{ color: 'var(--sidebar-text)' }}
                            >
                              {item.name}
                            </span>
                          )}
                        </div>

                        {/* Tooltip in Collapsed Mode */}
                        {isCollapsed && (
                          <div 
                            className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 shadow-xl border"
                            style={{
                              backgroundColor: 'var(--sidebar)',
                              borderColor: 'var(--border)',
                              color: 'var(--sidebar-text)'
                            }}
                          >
                            {item.name}
                          </div>
                        )}
                      </Link>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Section: Profile Card matching Image 2 */}
        <div className={`border-t shrink-0 ${isCollapsed ? 'p-2.5 flex justify-center' : 'p-3.5'}`} style={{ borderColor: 'var(--border)' }}>
          {isCollapsed ? (
            /* Collapsed Profile Squircle Card matching exact screenshot */
            <div 
              className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)'
              }}
            >
              <Link 
                to="/user-profile"
                onClick={onCloseMobile}
                className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-bold text-base shadow-sm transition-transform duration-200 hover:scale-105 shrink-0"
                style={{ color: 'var(--primary)' }}
                title={`${displayName} (${displayRole})`}
              >
                {initialLetter}
              </Link>
            </div>
          ) : (
            /* Expanded Profile Card */
            <div 
              className="h-16 px-3.5 flex items-center justify-between rounded-2xl transition-all duration-200"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.25)',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)'
              }}
            >
              {/* Avatar & User Details */}
              <Link 
                to="/user-profile"
                onClick={onCloseMobile}
                className="flex items-center gap-3 min-w-0 overflow-hidden flex-1 mr-1.5 group cursor-pointer"
                title="View Profile"
              >
                {/* White Circle Avatar with Primary Letter */}
                <div 
                  className="w-10 h-10 rounded-full bg-white flex items-center justify-center font-extrabold text-[14px] shadow-sm shrink-0 transition-transform duration-200 group-hover:scale-105"
                  style={{ color: 'var(--primary)' }}
                >
                  {initialLetter}
                </div>

                {/* User Name & Role */}
                <div className="overflow-hidden min-w-0 pr-1 leading-tight text-left">
                  <p 
                    className="text-[13px] font-bold tracking-[0.01em] truncate"
                    style={{ color: 'var(--sidebar-text)' }}
                  >
                    {displayName}
                  </p>
                  <p 
                    className="text-[11px] font-normal truncate mt-0.5"
                    style={{ color: 'var(--sidebar-muted)' }}
                  >
                    {displayRole}
                  </p>
                </div>
              </Link>

              {/* Logout Button */}
              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 rounded-lg hover:opacity-80 transition-opacity cursor-pointer shrink-0 ml-1"
                style={{ color: 'var(--sidebar-muted)' }}
                title="Log Out Session"
              >
                <LogOut className="w-4 h-4 stroke-[2]" style={{ color: 'var(--sidebar-text)' }} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* In-flow Spacer so flex parent pages maintain the exact width */}
      <div 
        aria-hidden="true"
        className={`hidden md:block shrink-0 transition-all duration-200 ease-in-out ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      />

      {/* Micro-animations */}
      <style>{`
        .sidebar-link:hover .icon-dashboard {
          transform: scale(1.15);
        }
        .sidebar-link:hover .icon-config,
        .sidebar-link:hover .icon-settings {
          transform: rotate(45deg);
        }
        .sidebar-link:hover .icon-students,
        .sidebar-link:hover .icon-users,
        .sidebar-link:hover .icon-userprofile {
          transform: scale(1.15);
        }
        .sidebar-link:hover .icon-collection {
          transform: translateY(-2px);
        }
        .sidebar-link:hover .icon-reports,
        .sidebar-link:hover .icon-duereports {
          transform: translateY(-2px);
        }
        .sidebar-link:hover .icon-reminders {
          transform: rotate(15deg);
        }
        .sidebar-link:hover .icon-bulkupload {
          transform: translateY(-2px);
        }
        .sidebar-link:hover .icon-concession,
        .sidebar-link:hover .icon-concessionapproval {
          transform: rotate(-10deg);
        }
        .sidebar-link:hover .icon-calendar {
          transform: scale(1.1);
        }
        .sidebar-link:hover .icon-permissions {
          transform: rotate(10deg);
        }
        .sidebar-link:hover .icon-proceedings {
          transform: translateX(2px);
        }
      `}</style>
    </>
  );
};

export default Sidebar;
