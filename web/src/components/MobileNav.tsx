import { Link } from '@tanstack/react-router';
import { useUIStore } from '../store';
import { House, SquaresFour, Gear, MonitorPlay } from '@phosphor-icons/react';

export function MobileNav() {
  const setHomeFilter = useUIStore(s=>s.setHomeFilter);
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <Link to="/" activeOptions={{exact:true}} activeProps={{className:'active'}} onClick={()=>setHomeFilter('all')}><House weight="fill"/><span>Home</span></Link>
      <Link to="/shorts" search={{}} activeProps={{className:'active'}}><MonitorPlay weight="fill"/><span>Shorts</span></Link>
      <Link to="/library" activeProps={{className:'active'}}><SquaresFour weight="fill"/><span>Library</span></Link>
      <Link to="/settings" activeProps={{className:'active'}}><Gear weight="fill"/><span>Settings</span></Link>
    </nav>
  );
}
