import { Link } from '@tanstack/react-router';
import { House, SquaresFour, Gear, MonitorPlay } from '@phosphor-icons/react';

export function MobileNav() {
  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <Link to="/" activeProps={{className:'active'}}><House weight="fill"/><span>Home</span></Link>
      <Link to="/shorts" activeProps={{className:'active'}}><MonitorPlay weight="fill"/><span>Shorts</span></Link>
      <Link to="/library" activeProps={{className:'active'}}><SquaresFour weight="fill"/><span>Library</span></Link>
      <Link to="/settings" activeProps={{className:'active'}}><Gear weight="fill"/><span>Settings</span></Link>
    </nav>
  );
}
