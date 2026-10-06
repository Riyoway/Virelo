import { useEffect, useRef } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { Button, Input } from '@heroui/react';
import { MagnifyingGlass, Gear } from '@phosphor-icons/react';
import { useUIStore } from '../store';

export function Header() {
  const navigate = useNavigate();
  const search = useUIStore((s)=>s.search);
  const setSearch = useUIStore((s)=>s.setSearch);
  const searchOpen = useUIStore((s)=>s.mobileSearchOpen);
  const setMobileSearchOpen = useUIStore((s)=>s.setMobileSearchOpen);
  const searchInputRef = useRef<HTMLInputElement>(null);

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
          <Link to="/" activeOptions={{exact:true}} activeProps={{className:'active'}}>Home</Link>
          <Link to="/library" activeProps={{className:'active'}}>Library</Link>
          <Link to="/shorts" search={{}} activeProps={{className:'active'}}>Shorts</Link>
        </nav>
        <div className="topbar-actions">
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
