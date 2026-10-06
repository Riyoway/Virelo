import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';
import { Header } from './components/Header';
import { MobileNav } from './components/MobileNav';
import { NotFoundView } from './views/NotFoundView';
import type { SortKey } from './types';

const HomeView = lazy(async () => ({ default: (await import('./views/HomeView')).HomeView }));
const LibraryView = lazy(async () => ({ default: (await import('./views/LibraryView')).LibraryView }));
const SettingsView = lazy(async () => ({ default: (await import('./views/SettingsView')).SettingsView }));
const WatchView = lazy(async () => ({ default: (await import('./views/WatchView')).WatchView }));
const DetailView = lazy(async () => ({ default: (await import('./views/DetailView')).DetailView }));
const ShortsView = lazy(async () => ({ default: (await import('./views/ShortsView')).ShortsView }));

export interface WatchRouteSearch {
  queue?: boolean;
  folder?: string;
  libraryId?: number;
  sort?: SortKey;
  search?: string;
}

function validateWatchSearch(input: Record<string, unknown>): WatchRouteSearch {
  return {
    queue: input.queue === true || input.queue === '1' || input.queue === 'true',
    folder: typeof input.folder === 'string' && input.folder !== '' ? input.folder.slice(0, 500) : undefined,
    libraryId: typeof input.libraryId === 'string' && /^\d+$/.test(input.libraryId) ? Number(input.libraryId) : undefined,
    sort: (['title', 'newest', 'oldest', 'year', 'duration', 'random'] as string[]).includes(String(input.sort ?? '')) ? input.sort as SortKey : undefined,
    search: typeof input.search === 'string' && input.search !== '' ? input.search.slice(0, 200) : undefined
  };
}

function Shell() {
  return <div className="app-shell"><Header /><main className="page-shell"><Outlet /></main><MobileNav /></div>;
}

function withSuspense(View: LazyExoticComponent<ComponentType>) {
  return function SuspendedView() {
    return <Suspense fallback={<div className="route-loading skeleton" role="status" aria-label="Loading" />}><View /></Suspense>;
  };
}

const HomeRouteView = withSuspense(HomeView);
const LibraryRouteView = withSuspense(LibraryView);
const SettingsRouteView = withSuspense(SettingsView);
const WatchRouteView = withSuspense(WatchView);
const DetailRouteView = withSuspense(DetailView);
const ShortsRouteView = withSuspense(ShortsView);

const rootRoute = createRootRoute({ component: Shell, notFoundComponent: NotFoundView });
const indexRoute = createRoute({ getParentRoute:()=>rootRoute, path:'/', component:HomeRouteView });
const libraryRoute = createRoute({ getParentRoute:()=>rootRoute, path:'/library', component:LibraryRouteView });
const settingsRoute = createRoute({ getParentRoute:()=>rootRoute, path:'/settings', component:SettingsRouteView });
const watchRoute = createRoute({ getParentRoute:()=>rootRoute, path:'/watch/$mediaId', component:WatchRouteView, validateSearch: validateWatchSearch });
const detailRoute = createRoute({ getParentRoute:()=>rootRoute, path:'/title/$mediaId', component:DetailRouteView });
const shortsRoute = createRoute({ getParentRoute:()=>rootRoute, path:'/shorts', component:ShortsRouteView });
const routeTree = rootRoute.addChildren([indexRoute, libraryRoute, settingsRoute, watchRoute, detailRoute, shortsRoute]);
export const router = createRouter({ routeTree, defaultPreload: 'intent', scrollRestoration: true });
declare module '@tanstack/react-router' { interface Register { router: typeof router } }
