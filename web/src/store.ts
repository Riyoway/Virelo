import { create } from 'zustand';

interface UIState {
  search: string;
  setSearch: (value:string)=>void;
  mobileSearchOpen: boolean;
  setMobileSearchOpen: (value:boolean)=>void;
}

export const useUIStore = create<UIState>((set) => ({
  search: '',
  setSearch: (search) => set({ search }),
  mobileSearchOpen: false,
  setMobileSearchOpen: (mobileSearchOpen) => set({ mobileSearchOpen })
}));
