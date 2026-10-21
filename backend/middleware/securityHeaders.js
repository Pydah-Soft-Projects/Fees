/**
 * Security Headers Middleware
 * Protects the application against common web vulnerabilities:
 * - Clickjacking (X-Frame-Options, CSP frame-ancestors)
 * - Cross-Site Scripting (CSP)
 * - MIME Confusion Attacks (X-Content-Type-Options)
 * - Server Version Fingerprinting (removes X-Powered-By and Server header versions)
 * - Information Leakage (Referrer-Policy, Permissions-Policy)
 */

const buildContentSecurityPolicy = () => {
  const directives = [
    "default-src 'self'",
    // Allows scripts from self, inline (needed for React/Vite/Tailwind dynamic bundles), Razorpay, CDN, and Pydah CRM Portal Switcher
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://crm.pydah.edu.in https://checkout.razorpay.com https://cdn.jsdelivr.net",
    // Allows styles from self, inline styles, and Google Fonts
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // Allows fonts from self, Google Fonts, and data URIs
    "font-src 'self' https://fonts.gstatic.com data:",
    // Allows images from self, data URIs, blob URIs, AWS S3, Pydah CRM, Wix static, and QR code API
    "img-src 'self' data: blob: https://static.wixstatic.com https://api.qrserver.com https://*.amazonaws.com https://*.s3.amazonaws.com https://crm.pydah.edu.in",
    // Allows API / WebSocket / EventSource connections to self, CRM, Razorpay, S3, and local/prod WebSockets
    "connect-src 'self' https://crm.pydah.edu.in https://api.razorpay.com https://*.amazonaws.com https://*.s3.amazonaws.com ws: wss:",
    // Allows Razorpay modals and internal hidden print iframe
    "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com blob: data:",
    // Allows PDF.js web workers
    "worker-src 'self' blob: https://cdn.jsdelivr.net",
    // Disallow plugins (Flash, Java, etc.)
    "object-src 'none'",
    // Restricts the URLs that can be used in a document's <base> element
    "base-uri 'self'",
    // Prevents Clickjacking by restricting framing to same origin only
    "frame-ancestors 'self'",
  ];

  return directives.join('; ');
};

const cspHeaderValue = buildContentSecurityPolicy();

const securityHeaders = (req, res, next) => {
  // 1. Mitigate Server Fingerprinting
  res.removeHeader('X-Powered-By');

  // 2. Prevent Clickjacking
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // 3. Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // 4. Content Security Policy
  res.setHeader('Content-Security-Policy', cspHeaderValue);

  // 5. Enforce HTTP Strict Transport Security (HSTS - 1 year, includes all subdomains)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // 6. Additional Defense-in-Depth Headers
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  next();
};

module.exports = securityHeaders;
