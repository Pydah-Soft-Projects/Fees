import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { isSSOUser, getStoredUser } from '../lib/auth';

const SCRIPT_ID = 'pydah-portal-switcher-cdn';
const PORTAL_ID = 'fee-management';
const CDN_URL = 'https://crm.pydah.edu.in/portal-switcher.js';
const API_BASE_URL = 'https://pydah-crm-backend.pydah.edu.in'; // AWS Lightsail Backend
const LANDING_URL = 'https://crm.pydah.edu.in';

export default function PortalSwitcher() {
  const location = useLocation();
  const [ssoActive, setSsoActive] = useState(() => {
    // Active if marked as SSO user OR if a valid auth token is present
    return isSSOUser() || Boolean(localStorage.getItem('token') || localStorage.getItem('accessToken'));
  });

  // Keep SSO state in sync with local storage, route changes, and auth events
  useEffect(() => {
    const checkSSO = () => {
      setSsoActive(
        isSSOUser() || Boolean(localStorage.getItem('token') || localStorage.getItem('accessToken'))
      );
    };

    window.addEventListener('auth-change', checkSSO);
    window.addEventListener('storage', checkSSO);

    checkSSO();

    return () => {
      window.removeEventListener('auth-change', checkSSO);
      window.removeEventListener('storage', checkSSO);
    };
  }, [location.pathname]);

  useEffect(() => {
    const isPublicPage =
      ['/login', '/', '/about', '/docs'].includes(location.pathname) ||
      location.pathname.startsWith('/public/');

    const shouldShow = ssoActive && !isPublicPage;

    // Helper to toggle visibility without destroying DOM/script singletons
    const setSwitcherVisibility = (visible) => {
      const switcher = window.PydahSwitcher || window.PydahPortalSwitcher;
      if (!visible && switcher?.close) {
        try {
          switcher.close();
        } catch (_) {}
      }

      const customElements = document.querySelectorAll(
        'pydah-portal-switcher, portal-switcher, [data-pydah-switcher], #pydah-portal-switcher'
      );
      customElements.forEach((el) => {
        el.style.display = visible ? '' : 'none';
      });
    };

    if (!shouldShow) {
      setSwitcherVisibility(false);
      return;
    }

    // SSO is active and user is on an authorized app page: initialize switcher
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    const user = getStoredUser();

    const initSwitcher = () => {
      const switcher = window.PydahSwitcher || window.PydahPortalSwitcher;
      if (switcher?.init) {
        switcher.init({
          currentPortal: PORTAL_ID,
          apiBaseUrl: API_BASE_URL,
          landingUrl: LANDING_URL,
          token: token,
          user: user || {},
          position: 'bottom-right',
        });
      } else if (switcher?.setSession) {
        switcher.setSession({
          token: token,
          user: user || {},
          currentPortal: PORTAL_ID,
        });
      }

      setSwitcherVisibility(true);
    };

    let script = document.getElementById(SCRIPT_ID);
    if (!script) {
      script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = CDN_URL;
      script.async = true;
      script.setAttribute('data-current-portal', PORTAL_ID);
      script.setAttribute('data-api-base-url', API_BASE_URL); // ✅ Points to backend
      script.setAttribute('data-landing-url', LANDING_URL);
      script.setAttribute('data-position', 'bottom-right');

      script.onload = () => {
        initSwitcher();
      };

      script.onerror = (err) => {
        console.warn('[PortalSwitcher] Failed to load portal-switcher.js CDN script:', err);
      };

      document.body.appendChild(script);
    } else {
      initSwitcher();
    }
  }, [ssoActive, location.pathname]);

  return null;
}
