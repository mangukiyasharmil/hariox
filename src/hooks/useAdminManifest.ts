import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Hook to switch PWA manifest based on route
 * Admin routes use admin-manifest.json for proper PWA installation
 * This updates both the manifest link and iOS-specific meta tags
 */
export const useAdminManifest = () => {
  const location = useLocation();

  useEffect(() => {
    const isAdminRoute = location.pathname.startsWith("/admin");
    
    // Update manifest link - remove old and add new to force browser refresh
    const existingManifest = document.querySelector('link[rel="manifest"]');
    const newManifestHref = isAdminRoute ? '/admin-manifest.json' : '/manifest.json';
    
    if (existingManifest) {
      const currentHref = existingManifest.getAttribute('href')?.split('?')[0]; // Remove any query params
      if (currentHref !== newManifestHref) {
        existingManifest.remove();
        const newManifestLink = document.createElement('link');
        newManifestLink.rel = 'manifest';
        newManifestLink.href = newManifestHref;
        document.head.appendChild(newManifestLink);
      }
    }

    // Update PWA meta tags for admin (critical for iOS Safari)
    const appNameMeta = document.querySelector('meta[name="application-name"]');
    const appleTitleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    
    if (isAdminRoute) {
      if (appNameMeta) appNameMeta.setAttribute("content", "Hariox Admin");
      if (appleTitleMeta) appleTitleMeta.setAttribute("content", "FC Admin");
      if (themeColorMeta) themeColorMeta.setAttribute("content", "#0f172a");
      
      // Update document title for better iOS home screen name
      document.title = "Hariox Admin";
    } else {
      if (appNameMeta) appNameMeta.setAttribute("content", "Credit Hariox");
      if (appleTitleMeta) appleTitleMeta.setAttribute("content", "Credit Hariox");
      if (themeColorMeta) themeColorMeta.setAttribute("content", "#1e3a5f");
    }
  }, [location.pathname]);
};
