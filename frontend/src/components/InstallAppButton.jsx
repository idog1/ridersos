import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Share } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useTranslation } from './translations';

export default function InstallAppButton() {
  const t = useTranslation();
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallButton, setShowInstallButton] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
    setIsStandalone(standalone);

    if (standalone) return; // Don't show install button if already installed

    // Detect iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(iOS);

    // Always show the install button - it will either:
    // 1. Trigger native install prompt (if available)
    // 2. Show iOS instructions (on iOS)
    // 3. Show a message that install isn't available (fallback)
    setShowInstallButton(true);

    // Listen for the beforeinstallprompt event (Chrome, Edge, Android)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallButton(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if prompt was already captured before component mounted
    if (window.deferredPrompt) {
      setDeferredPrompt(window.deferredPrompt);
      setShowInstallButton(true);
    }

    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
      setShowInstallButton(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSInstructions(true);
      return;
    }

    if (deferredPrompt) {
      // Show the install prompt
      deferredPrompt.prompt();

      // Wait for the user's response
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        setShowInstallButton(false);
      }

      setDeferredPrompt(null);
    } else {
      // No native prompt available - show instructions dialog
      setShowIOSInstructions(true);
    }
  };

  // Don't render if already installed or no install option available
  if (isStandalone || !showInstallButton) {
    return null;
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleInstallClick}
        className="text-[#1B4332]/60 hover:text-[#1B4332] hover:bg-[#1B4332]/5 gap-2"
        title={t.install?.title || "Install App"}
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">{t.nav?.install || "Install"}</span>
      </Button>

      {/* Install Instructions Dialog */}
      <Dialog open={showIOSInstructions} onOpenChange={setShowIOSInstructions}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1B4332]">{t.install?.title || "Install RidersOS"}</DialogTitle>
            <DialogDescription>
              {t.install?.description || "Add RidersOS to your home screen for quick access"}
            </DialogDescription>
          </DialogHeader>
          {isIOS ? (
            <div className="space-y-4 py-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#1B4332]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">1</span>
                </div>
                <div>
                  <p className="font-medium text-[#1B4332]">{t.install?.step1Title || "Tap the Share button"}</p>
                  <p className="text-sm text-[#1B4332]/60">
                    {t.install?.step1Desc || "Look for the share icon at the bottom of Safari"} <Share className="w-4 h-4 inline mx-1" />
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#1B4332]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">2</span>
                </div>
                <div>
                  <p className="font-medium text-[#1B4332]">{t.install?.step2Title || "Scroll and tap \"Add to Home Screen\""}</p>
                  <p className="text-sm text-[#1B4332]/60">
                    {t.install?.step2Desc || "You may need to scroll down in the share menu"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#1B4332]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">3</span>
                </div>
                <div>
                  <p className="font-medium text-[#1B4332]">{t.install?.step3Title || "Tap \"Add\""}</p>
                  <p className="text-sm text-[#1B4332]/60">
                    {t.install?.step3Desc || "RidersOS will appear on your home screen"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#1B4332]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">1</span>
                </div>
                <div>
                  <p className="font-medium text-[#1B4332]">Open in Chrome</p>
                  <p className="text-sm text-[#1B4332]/60">
                    Use Chrome browser for the best install experience
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#1B4332]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">2</span>
                </div>
                <div>
                  <p className="font-medium text-[#1B4332]">Click the install icon</p>
                  <p className="text-sm text-[#1B4332]/60">
                    Look for <Download className="w-4 h-4 inline mx-1" /> in the address bar, or use the browser menu
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#1B4332]/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">3</span>
                </div>
                <div>
                  <p className="font-medium text-[#1B4332]">Click "Install"</p>
                  <p className="text-sm text-[#1B4332]/60">
                    RidersOS will be added as an app on your device
                  </p>
                </div>
              </div>
              <p className="text-xs text-[#1B4332]/50 mt-2">
                Note: Install option requires HTTPS. Visit ridersos.app for full install support.
              </p>
            </div>
          )}
          <Button
            onClick={() => setShowIOSInstructions(false)}
            className="w-full bg-[#1B4332] hover:bg-[#1B4332]/90"
          >
            {t.install?.gotIt || "Got it"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
