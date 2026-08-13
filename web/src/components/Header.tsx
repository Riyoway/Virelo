import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Button, Input } from '@heroui/react';
import { DownloadSimple, MagnifyingGlass, Gear } from '@phosphor-icons/react';
import { useUIStore } from '../store';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function isStandalonePwa() {
  const iosStandalone = Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || iosStandalone;
}

export function Header() {
  const navigate = useNavigate();
  const search = useUIStore((s)=>s.search);
  const setSearch = useUIStore((s)=>s.setSearch);
  const searchOpen = useUIStore((s)=>s.mobileSearchOpen);
  const setMobileSearchOpen = useUIStore((s)=>s.setMobileSearchOpen);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const syncInstalledState = () => setIsInstalled(isStandalonePwa());
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      syncInstalledState();
    };
    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    syncInstalledState();
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    displayMode.addEventListener('change', syncInstalledState);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
      displayMode.removeEventListener('change', syncInstalledState);
    };
  }, []);

  const installApp = async () => {
    if (!installPrompt || installing) return;
    setInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === 'accepted') setIsInstalled(true);
    } finally {
      setInstalling(false);
    }
  };

  useEffect(() => {
    if (!searchOpen) return;
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [searchOpen]);
  const toggleSearch = () => {
    const nextOpen = !searchOpen;
    setMobileSearchOpen(nextOpen);
    if (nextOpen) void navigate({to:'/library'});
  };
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand" aria-label="Virelo home">
          <span className="brand-mark"><img src="/virelo-icon.png" alt="" /></span>
          <span className="brand-name">Virelo</span>
        </Link>
        <nav className="desktop-nav" aria-label="Main navigation">
          <Link to="/" activeProps={{className:'active'}}>Home</Link>
          <Link to="/library" activeProps={{className:'active'}}>Library</Link>
          <Link to="/shorts" activeProps={{className:'active'}}>Shorts</Link>
        </nav>
        <div className="topbar-actions">
          {!isInstalled && installPrompt && (
            <Button className="pwa-install-button" variant="secondary" isDisabled={installing} onPress={() => void installApp()} aria-label="Install Virelo">
              <DownloadSimple size={18} />
              <span className="pwa-install-label">Install</span>
            </Button>
          )}
          <div className={`header-search-shell ${searchOpen ? 'open' : ''}`}>
            <div className="header-search-motion">
              <Button
                className="header-search-toggle"
                isIconOnly
                variant="ghost"
                aria-label={searchOpen ? 'Close search' : 'Search'}
                aria-expanded={searchOpen}
                onPress={toggleSearch}
              >
                <MagnifyingGlass size={20}/>
              </Button>
              <Input
                className="header-search-input"
                aria-label="Search library"
                placeholder="Search"
                value={search}
                ref={searchInputRef}
                tabIndex={searchOpen ? 0 : -1}
                onChange={(e)=>setSearch(e.target.value)}
                onKeyDown={(e)=>{
                  if (e.key === 'Enter') void navigate({to:'/library'});
                  if (e.key === 'Escape') setMobileSearchOpen(false);
                }}
              />
            </div>
          </div>
          <Button className="desktop-only icon-button settings-button" isIconOnly variant="ghost" aria-label="Settings" onPress={()=>void navigate({to:'/settings'})}>
            <Gear size={28}/>
          </Button>
        </div>
      </div>
    </header>
  );
}
