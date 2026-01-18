import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import AppSidebar from '@/components/AppSidebar';
import { useAuth } from '@/lib/AuthContext';
import { Menu } from 'lucide-react';

// Pages that should NOT show the sidebar
const PUBLIC_PAGES = ['Home', 'Login', 'Stables', 'StableDetails', 'ContactUs'];

export default function Layout({ children, currentPageName }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const savedLang = localStorage.getItem('language');
    if (!savedLang) {
      localStorage.setItem('language', 'en');
      document.documentElement.lang = 'en';
    } else {
      document.documentElement.lang = savedLang;
    }
  }, []);

  const showSidebar = isAuthenticated && !PUBLIC_PAGES.includes(currentPageName);

  if (!showSidebar) {
    return (
      <>
        <style>{`
          /* Hide Base44 edit banner */
          [class*="base44-edit"],
          [id*="base44-edit"],
          iframe[title*="base44"],
          div[style*="z-index: 999"],
          button[aria-label*="Edit"],
          .base44-banner {
            display: none !important;
          }
        `}</style>
        {children}
      </>
    );
  }

  return (
    <>
      <style>{`
        /* Hide Base44 edit banner */
        [class*="base44-edit"],
        [id*="base44-edit"],
        iframe[title*="base44"],
        div[style*="z-index: 999"],
        button[aria-label*="Edit"],
        .base44-banner {
          display: none !important;
        }
      `}</style>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="overflow-x-hidden">
          <div className="flex items-center gap-2 px-2 py-2 md:hidden border-b border-[#1B4332]/10 sticky top-0 bg-[#FAFAF8] z-10">
            <SidebarTrigger className="text-[#1B4332]">
              <Menu className="w-6 h-6" />
            </SidebarTrigger>
            <span className="font-semibold text-[#1B4332]">RidersOS</span>
          </div>
          <div className="flex-1 overflow-x-hidden w-full max-w-full">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </>
  );
}
