# Pydah Universal Portal Switcher - Integration Guide (CDN)

The **Pydah Universal Portal Switcher** is a floating widget packaged as a lightweight, zero-dependency CDN script. It enables authenticated users in any Pydah portal (HRMS, SDMS, Transport, Hostel, Fee, Academics, EMS, Admissions) to switch between permitted portals without having to log out or manually navigate back to the central landing page.

---

## 🌟 Key Features

- **1-Line Embed**: Import via a single `<script>` tag.
- **Pure Web Component (Shadow DOM)**: 100% style-isolated. It will never conflict with Bootstrap, Tailwind, Material UI, or custom CSS in the host application.
- **Host Portal Token Detection**: Automatically detects existing auth tokens (`accessToken`, `token`, `jwt`) and user objects from the host portal's `localStorage` / `sessionStorage`.
- **Seamless One-Click SSO**: Generates short-lived AES-256 encrypted SSO tokens on the fly and redirects users securely.
- **Draggable Floating Button**: Users can drag the floating button anywhere on their screen to avoid obstructing tables, action buttons, or chatbots. The position is automatically remembered across sessions.
- **Real-Time Search**: Instant filtering across all authorized portals.

---

## 🚀 1. Quick Start (HTML / PHP / Vanilla JS)

Add this script tag right before the closing `</body>` tag of your application:

```html
<script 
  src="https://crm.pydah.edu.in/portal-switcher.js" 
  data-current-portal="hrms" 
  async>
</script>
```

> **Note**: Replace `data-current-portal="hrms"` with the ID of your application (see [Portal IDs Reference](#-portal-ids-reference)).

---

## ⚛️ 2. React / Next.js / Vite / Vue Integration

### Option A: In `index.html` (Recommended for Vite / React SPA)

Simply add the `<script>` tag to your `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Pydah HRMS</title>
  </head>
  <body>
    <div id="root"></div>

    <!-- Pydah Universal Portal Switcher CDN -->
    <script 
      src="https://crm.pydah.edu.in/portal-switcher.js" 
      data-current-portal="hrms" 
      async>
    </script>
  </body>
</html>
```

### Option B: Programmatic Initialization via JavaScript (App.jsx / AuthContext)

If your application loads the user session asynchronously (e.g., from an API or AuthContext), you can pass the host token and user details directly:

```javascript
import { useEffect } from 'react';

function App() {
  const { user, token } = useAuth(); // Your local auth state

  useEffect(() => {
    // Check if CDN script is loaded
    if (window.PydahSwitcher) {
      window.PydahSwitcher.init({
        currentPortal: 'hrms', // Your portal ID
        token: token || localStorage.getItem('accessToken'),
        user: user || JSON.parse(localStorage.getItem('user') || '{}'),
        position: 'bottom-right'
      });
    }
  }, [user, token]);

  return <YourComponents />;
}
```

---

## 📋 Configuration Attributes

You can configure the widget using `data-*` attributes on the `<script>` tag or via `window.PydahSwitcher.init({})`:

| Attribute | Script Tag Attribute | Type | Default | Description |
|---|---|---|---|---|
| `currentPortal` | `data-current-portal` | `string` | `null` | **Required.** The portal ID of the current app (e.g. `'hrms'`). |
| `apiBaseUrl` | `data-api-base-url` | `string` | `https://crm.pydah.edu.in` | Base URL of the CRM Auth Gateway. |
| `landingUrl` | `data-landing-url` | `string` | `https://crm.pydah.edu.in` | URL for the "Central Hub" link. |
| `position` | `data-position` | `string` | `'bottom-right'` | Initial corner (`'bottom-right'`, `'bottom-left'`). |
| `token` | N/A (JS only) | `string` | Auto-detected | The host portal's JWT auth token. |
| `user` | N/A (JS only) | `object` | Auto-detected | The host portal's authenticated user object. |

---

## 🏷️ Portal IDs Reference

Use these exact portal IDs for `data-current-portal`:

| Portal ID | Portal Name | Category | Production URL |
|---|---|---|---|
| `academic-portal` | Academic Portal | Academics & Faculty | `https://acad.pydah.edu.in` |
| `admissions-crm` | Admission Portal | Enrollment Management | `https://admissions.pydah.edu.in` |
| `examination-portal`| Examination Management (EMS) | Exams & Assessment | `https://ems.pydah.edu.in` |
| `fee-management` | Fee Management | Financial Operations | `https://fees.pydah.edu.in` |
| `hostel-automation` | Hostel Automation (HMS) | Facility Management | `https://hms.pydahsoft.in` |
| `hrms` | HRMS & Payroll | Staff Operations | `https://hrms.pydah.edu.in` |
| `student-portal` | Student Portal (SDMS) | Learning & Academics | `https://sdms.pydah.edu.in` |
| `transport-management` | Transport Management | Logistics Hub | `https://transport.pydah.edu.in` |

---

## ⚙️ JavaScript Developer API

The widget exposes a global `window.PydahSwitcher` (and `window.PydahPortalSwitcher`) object:

```javascript
// 1. Initialize or update session
window.PydahSwitcher.init({
  currentPortal: 'transport-management',
  token: 'eyJhbGciOi...',
  user: {
    name: 'Ramesh Babu',
    email: 'ramesh@pydah.edu.in',
    role: 'Transport Admin'
  }
});

// 2. Open popover manually
window.PydahSwitcher.open();

// 3. Close popover
window.PydahSwitcher.close();

// 4. Toggle popover
window.PydahSwitcher.toggle();

// 5. Update session after user login / refresh
window.PydahSwitcher.setSession({
  token: newAccessToken,
  user: updatedUser
});
```

---

## 🔒 How SSO Authentication & Session Replacement Works

When a user clicks any other portal inside the floating switcher:
1. The widget calls `POST https://crm.pydah.edu.in/auth/switch-portal` with the host portal's token and user payload.
2. The CRM Gateway verifies access rights and generates a single-use encrypted SSO token.
3. The widget redirects the browser to the target portal:
   ```
   https://target-portal.pydah.edu.in/login?token=<ENCRYPTED_SSO_TOKEN>
   ```
4. **Crucial Session Reset in Target Portal**:
   To prevent stale sessions from lingering in `localStorage`, ensure your target portal checks for `?token=` on page load and clears old credentials:

```javascript
// Target Portal: Place early in your component lifecycle (App.jsx / AuthProvider)
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const ssoToken = urlParams.get('token');

  if (ssoToken) {
    // Clear old session so the incoming SSO token takes priority
    localStorage.removeItem('accessToken');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    sessionStorage.clear();
  }
}, []);
```

---

## 🛠️ Testing Locally

In development, you can test the switcher against local servers:

```html
<script 
  src="http://localhost:5173/portal-switcher.js" 
  data-api-base-url="http://localhost:3000"
  data-current-portal="hrms">
</script>
```
