import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const CSP_POLICY = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://crm.pydah.edu.in https://checkout.razorpay.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://static.wixstatic.com https://api.qrserver.com https://*.amazonaws.com https://*.s3.amazonaws.com https://crm.pydah.edu.in; connect-src 'self' http://localhost:* http://127.0.0.1:* https://crm.pydah.edu.in https://api.razorpay.com https://*.amazonaws.com https://*.s3.amazonaws.com ws: wss:; frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com blob: data:; worker-src 'self' blob: https://cdn.jsdelivr.net; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; upgrade-insecure-requests;"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    headers: {
      'Content-Security-Policy': CSP_POLICY,
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Strict-Transport-Security': 'max-age=2592000; includeSubDomains',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Permissions-Policy': 'geolocation=(), camera=(self)',
    }
  },
  preview: {
    headers: {
      'Content-Security-Policy': CSP_POLICY,
      'X-Frame-Options': 'SAMEORIGIN',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Strict-Transport-Security': 'max-age=2592000; includeSubDomains',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Permissions-Policy': 'geolocation=(), camera=(self)',
    }
  },
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      targets: {
        chrome: 50,
        safari: 12
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        // Emit pdf.js worker as .js so hosts without .mjs MIME still serve JS correctly
        assetFileNames(assetInfo) {
          const name = String(assetInfo.names?.[0] || assetInfo.name || '')
          if (name.includes('pdf.worker') || name.endsWith('.mjs')) {
            return 'assets/[name]-[hash].js'
          }
          return 'assets/[name]-[hash][extname]'
        }
      }
    }
  }
})
