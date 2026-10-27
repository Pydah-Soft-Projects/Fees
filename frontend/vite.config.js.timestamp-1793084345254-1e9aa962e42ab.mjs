// vite.config.js
import { defineConfig } from "file:///B:/PYDAH%20SOFT%20PROJECTS/Fees/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///B:/PYDAH%20SOFT%20PROJECTS/Fees/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///B:/PYDAH%20SOFT%20PROJECTS/Fees/frontend/node_modules/@tailwindcss/vite/dist/index.mjs";
var CSP_POLICY = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://crm.pydah.edu.in https://checkout.razorpay.com https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://static.wixstatic.com https://api.qrserver.com https://*.amazonaws.com https://*.s3.amazonaws.com https://crm.pydah.edu.in; connect-src 'self' http://localhost:* http://127.0.0.1:* https://crm.pydah.edu.in https://api.razorpay.com https://*.amazonaws.com https://*.s3.amazonaws.com ws: wss:; frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com blob: data:; worker-src 'self' blob: https://cdn.jsdelivr.net; object-src 'none'; base-uri 'self'; frame-ancestors 'self'; upgrade-insecure-requests;";
var vite_config_default = defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    headers: {
      "Content-Security-Policy": CSP_POLICY,
      "X-Frame-Options": "SAMEORIGIN",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=2592000; includeSubDomains",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Permissions-Policy": "geolocation=(), camera=(self)"
    }
  },
  preview: {
    headers: {
      "Content-Security-Policy": CSP_POLICY,
      "X-Frame-Options": "SAMEORIGIN",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Strict-Transport-Security": "max-age=2592000; includeSubDomains",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cross-Origin-Resource-Policy": "same-origin",
      "Permissions-Policy": "geolocation=(), camera=(self)"
    }
  },
  css: {
    transformer: "lightningcss",
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
          const name = String(assetInfo.names?.[0] || assetInfo.name || "");
          if (name.includes("pdf.worker") || name.endsWith(".mjs")) {
            return "assets/[name]-[hash].js";
          }
          return "assets/[name]-[hash][extname]";
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJCOlxcXFxQWURBSCBTT0ZUIFBST0pFQ1RTXFxcXEZlZXNcXFxcZnJvbnRlbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIkI6XFxcXFBZREFIIFNPRlQgUFJPSkVDVFNcXFxcRmVlc1xcXFxmcm9udGVuZFxcXFx2aXRlLmNvbmZpZy5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQjovUFlEQUglMjBTT0ZUJTIwUFJPSkVDVFMvRmVlcy9mcm9udGVuZC92aXRlLmNvbmZpZy5qc1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnXHJcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcclxuaW1wb3J0IHRhaWx3aW5kY3NzIGZyb20gJ0B0YWlsd2luZGNzcy92aXRlJ1xyXG5cclxuY29uc3QgQ1NQX1BPTElDWSA9IFwiZGVmYXVsdC1zcmMgJ3NlbGYnOyBzY3JpcHQtc3JjICdzZWxmJyAndW5zYWZlLWlubGluZScgJ3Vuc2FmZS1ldmFsJyBodHRwczovL2NybS5weWRhaC5lZHUuaW4gaHR0cHM6Ly9jaGVja291dC5yYXpvcnBheS5jb20gaHR0cHM6Ly9jZG4uanNkZWxpdnIubmV0OyBzdHlsZS1zcmMgJ3NlbGYnICd1bnNhZmUtaW5saW5lJyBodHRwczovL2ZvbnRzLmdvb2dsZWFwaXMuY29tOyBmb250LXNyYyAnc2VsZicgaHR0cHM6Ly9mb250cy5nc3RhdGljLmNvbSBkYXRhOjsgaW1nLXNyYyAnc2VsZicgZGF0YTogYmxvYjogaHR0cHM6Ly9zdGF0aWMud2l4c3RhdGljLmNvbSBodHRwczovL2FwaS5xcnNlcnZlci5jb20gaHR0cHM6Ly8qLmFtYXpvbmF3cy5jb20gaHR0cHM6Ly8qLnMzLmFtYXpvbmF3cy5jb20gaHR0cHM6Ly9jcm0ucHlkYWguZWR1LmluOyBjb25uZWN0LXNyYyAnc2VsZicgaHR0cDovL2xvY2FsaG9zdDoqIGh0dHA6Ly8xMjcuMC4wLjE6KiBodHRwczovL2NybS5weWRhaC5lZHUuaW4gaHR0cHM6Ly9hcGkucmF6b3JwYXkuY29tIGh0dHBzOi8vKi5hbWF6b25hd3MuY29tIGh0dHBzOi8vKi5zMy5hbWF6b25hd3MuY29tIHdzOiB3c3M6OyBmcmFtZS1zcmMgJ3NlbGYnIGh0dHBzOi8vYXBpLnJhem9ycGF5LmNvbSBodHRwczovL2NoZWNrb3V0LnJhem9ycGF5LmNvbSBibG9iOiBkYXRhOjsgd29ya2VyLXNyYyAnc2VsZicgYmxvYjogaHR0cHM6Ly9jZG4uanNkZWxpdnIubmV0OyBvYmplY3Qtc3JjICdub25lJzsgYmFzZS11cmkgJ3NlbGYnOyBmcmFtZS1hbmNlc3RvcnMgJ3NlbGYnOyB1cGdyYWRlLWluc2VjdXJlLXJlcXVlc3RzO1wiXHJcblxyXG4vLyBodHRwczovL3ZpdGUuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwbHVnaW5zOiBbcmVhY3QoKSwgdGFpbHdpbmRjc3MoKV0sXHJcbiAgc2VydmVyOiB7XHJcbiAgICBoZWFkZXJzOiB7XHJcbiAgICAgICdDb250ZW50LVNlY3VyaXR5LVBvbGljeSc6IENTUF9QT0xJQ1ksXHJcbiAgICAgICdYLUZyYW1lLU9wdGlvbnMnOiAnU0FNRU9SSUdJTicsXHJcbiAgICAgICdYLUNvbnRlbnQtVHlwZS1PcHRpb25zJzogJ25vc25pZmYnLFxyXG4gICAgICAnUmVmZXJyZXItUG9saWN5JzogJ3N0cmljdC1vcmlnaW4td2hlbi1jcm9zcy1vcmlnaW4nLFxyXG4gICAgICAnU3RyaWN0LVRyYW5zcG9ydC1TZWN1cml0eSc6ICdtYXgtYWdlPTI1OTIwMDA7IGluY2x1ZGVTdWJEb21haW5zJyxcclxuICAgICAgJ0Nyb3NzLU9yaWdpbi1PcGVuZXItUG9saWN5JzogJ3NhbWUtb3JpZ2luJyxcclxuICAgICAgJ0Nyb3NzLU9yaWdpbi1FbWJlZGRlci1Qb2xpY3knOiAncmVxdWlyZS1jb3JwJyxcclxuICAgICAgJ0Nyb3NzLU9yaWdpbi1SZXNvdXJjZS1Qb2xpY3knOiAnc2FtZS1vcmlnaW4nLFxyXG4gICAgICAnUGVybWlzc2lvbnMtUG9saWN5JzogJ2dlb2xvY2F0aW9uPSgpLCBjYW1lcmE9KHNlbGYpJyxcclxuICAgIH1cclxuICB9LFxyXG4gIHByZXZpZXc6IHtcclxuICAgIGhlYWRlcnM6IHtcclxuICAgICAgJ0NvbnRlbnQtU2VjdXJpdHktUG9saWN5JzogQ1NQX1BPTElDWSxcclxuICAgICAgJ1gtRnJhbWUtT3B0aW9ucyc6ICdTQU1FT1JJR0lOJyxcclxuICAgICAgJ1gtQ29udGVudC1UeXBlLU9wdGlvbnMnOiAnbm9zbmlmZicsXHJcbiAgICAgICdSZWZlcnJlci1Qb2xpY3knOiAnc3RyaWN0LW9yaWdpbi13aGVuLWNyb3NzLW9yaWdpbicsXHJcbiAgICAgICdTdHJpY3QtVHJhbnNwb3J0LVNlY3VyaXR5JzogJ21heC1hZ2U9MjU5MjAwMDsgaW5jbHVkZVN1YkRvbWFpbnMnLFxyXG4gICAgICAnQ3Jvc3MtT3JpZ2luLU9wZW5lci1Qb2xpY3knOiAnc2FtZS1vcmlnaW4nLFxyXG4gICAgICAnQ3Jvc3MtT3JpZ2luLUVtYmVkZGVyLVBvbGljeSc6ICdyZXF1aXJlLWNvcnAnLFxyXG4gICAgICAnQ3Jvc3MtT3JpZ2luLVJlc291cmNlLVBvbGljeSc6ICdzYW1lLW9yaWdpbicsXHJcbiAgICAgICdQZXJtaXNzaW9ucy1Qb2xpY3knOiAnZ2VvbG9jYXRpb249KCksIGNhbWVyYT0oc2VsZiknLFxyXG4gICAgfVxyXG4gIH0sXHJcbiAgY3NzOiB7XHJcbiAgICB0cmFuc2Zvcm1lcjogJ2xpZ2h0bmluZ2NzcycsXHJcbiAgICBsaWdodG5pbmdjc3M6IHtcclxuICAgICAgdGFyZ2V0czoge1xyXG4gICAgICAgIGNocm9tZTogNTAsXHJcbiAgICAgICAgc2FmYXJpOiAxMlxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSxcclxuICBidWlsZDoge1xyXG4gICAgcm9sbHVwT3B0aW9uczoge1xyXG4gICAgICBvdXRwdXQ6IHtcclxuICAgICAgICAvLyBFbWl0IHBkZi5qcyB3b3JrZXIgYXMgLmpzIHNvIGhvc3RzIHdpdGhvdXQgLm1qcyBNSU1FIHN0aWxsIHNlcnZlIEpTIGNvcnJlY3RseVxyXG4gICAgICAgIGFzc2V0RmlsZU5hbWVzKGFzc2V0SW5mbykge1xyXG4gICAgICAgICAgY29uc3QgbmFtZSA9IFN0cmluZyhhc3NldEluZm8ubmFtZXM/LlswXSB8fCBhc3NldEluZm8ubmFtZSB8fCAnJylcclxuICAgICAgICAgIGlmIChuYW1lLmluY2x1ZGVzKCdwZGYud29ya2VyJykgfHwgbmFtZS5lbmRzV2l0aCgnLm1qcycpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAnYXNzZXRzL1tuYW1lXS1baGFzaF0uanMnXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm4gJ2Fzc2V0cy9bbmFtZV0tW2hhc2hdW2V4dG5hbWVdJ1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxufSlcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUEwUyxTQUFTLG9CQUFvQjtBQUN2VSxPQUFPLFdBQVc7QUFDbEIsT0FBTyxpQkFBaUI7QUFFeEIsSUFBTSxhQUFhO0FBR25CLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLEdBQUcsWUFBWSxDQUFDO0FBQUEsRUFDaEMsUUFBUTtBQUFBLElBQ04sU0FBUztBQUFBLE1BQ1AsMkJBQTJCO0FBQUEsTUFDM0IsbUJBQW1CO0FBQUEsTUFDbkIsMEJBQTBCO0FBQUEsTUFDMUIsbUJBQW1CO0FBQUEsTUFDbkIsNkJBQTZCO0FBQUEsTUFDN0IsOEJBQThCO0FBQUEsTUFDOUIsZ0NBQWdDO0FBQUEsTUFDaEMsZ0NBQWdDO0FBQUEsTUFDaEMsc0JBQXNCO0FBQUEsSUFDeEI7QUFBQSxFQUNGO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxTQUFTO0FBQUEsTUFDUCwyQkFBMkI7QUFBQSxNQUMzQixtQkFBbUI7QUFBQSxNQUNuQiwwQkFBMEI7QUFBQSxNQUMxQixtQkFBbUI7QUFBQSxNQUNuQiw2QkFBNkI7QUFBQSxNQUM3Qiw4QkFBOEI7QUFBQSxNQUM5QixnQ0FBZ0M7QUFBQSxNQUNoQyxnQ0FBZ0M7QUFBQSxNQUNoQyxzQkFBc0I7QUFBQSxJQUN4QjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLEtBQUs7QUFBQSxJQUNILGFBQWE7QUFBQSxJQUNiLGNBQWM7QUFBQSxNQUNaLFNBQVM7QUFBQSxRQUNQLFFBQVE7QUFBQSxRQUNSLFFBQVE7QUFBQSxNQUNWO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQTtBQUFBLFFBRU4sZUFBZSxXQUFXO0FBQ3hCLGdCQUFNLE9BQU8sT0FBTyxVQUFVLFFBQVEsQ0FBQyxLQUFLLFVBQVUsUUFBUSxFQUFFO0FBQ2hFLGNBQUksS0FBSyxTQUFTLFlBQVksS0FBSyxLQUFLLFNBQVMsTUFBTSxHQUFHO0FBQ3hELG1CQUFPO0FBQUEsVUFDVDtBQUNBLGlCQUFPO0FBQUEsUUFDVDtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
