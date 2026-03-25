/**
 * types.ts
 * 
 * Type definitions for UI control components.
 * 
 * Created: January 14, 2026 (Phase 2 Refactoring)
 * Extracted from SatelliteVisualizer.tsx for better maintainability.
 */

import { ParsedSatellite } from '../../types/satelliteTypes';
import { GroundStation } from '../../types/groundStationTypes';

/**
 * View mode types
 */
export type ViewMode = 'satellite' | 'earth' | 'celestial' | 'groundstation';
export type SatelliteCameraView = 'nadir' | 'cross-track' | 'along-track' | 'fixed';
export type CelestialCameraView = 'sun' | 'lvlh-orbit' | 'star' | 'groundstation';
export type EarthCameraView = 'icrf' | 'itrf' | 'gcrf' | 'teme';

/**
 * Props for TopLeftControls component
 */
export interface TopLeftControlsProps {
  // Dropdown open/close states
  isModeDropdownOpen: boolean;
  setIsModeDropdownOpen: (value: boolean) => void;
  isCameraDropdownOpen: boolean;
  setIsCameraDropdownOpen: (value: boolean) => void;
  isAxesDropdownOpen: boolean;
  setIsAxesDropdownOpen: (value: boolean) => void;
  
  // Mode selection
  selectedMode: ViewMode;
  setSelectedMode: (mode: ViewMode) => void;
  
  // Camera views (per mode)
  satelliteCameraView: SatelliteCameraView;
  setSatelliteCameraView: (view: SatelliteCameraView) => void;
  celestialCameraView: CelestialCameraView;
  setCelestialCameraView: (view: CelestialCameraView) => void;
  earthCameraView: EarthCameraView;
  setEarthCameraView: (view: EarthCameraView) => void;
  
  // Reference axes visibility
  showLVLHAxes: boolean;
  setShowLVLHAxes: (value: boolean) => void;
  showBodyAxes: boolean;
  setShowBodyAxes: (value: boolean) => void;
  showITRFAxes: boolean;
  setShowITRFAxes: (value: boolean) => void;
  showICRFAxes: boolean;
  setShowICRFAxes: (value: boolean) => void;
  
  // Callbacks
  onNadirViewClick?: () => void;
  onCrossTrackViewClick?: () => void;
  onAlongTrackViewClick?: () => void;
  onFixedViewClick?: () => void;
  
  // Tracked satellite ID (for nadir view)
  trackedSatelliteId: string | null;
  
  // Styles (from parent)
  styles: any;
}

/**
 * Props for SidebarControls component
 */
export interface SidebarControlsProps {
  // Sidebar state
  isSidebarOpen: boolean;
  setIsSidebarOpen: (value: boolean) => void;
  
  // Tab state
  activeTab: 'satellites' | 'groundstations';
  setActiveTab: (tab: 'satellites' | 'groundstations') => void;
  
  // Data
  satellites: ParsedSatellite[];
  groundStations: GroundStation[];
  
  // Visibility & tracking
  trackedSatelliteId: string | null;
  setTrackedSatelliteId: (id: string | null) => void;
  trackedGroundStationId: string | null;
  setTrackedGroundStationId: (id: string | null) => void;
  hiddenSatellites: Set<string>;
  setHiddenSatellites: (value: Set<string>) => void;
  hiddenGroundStations: Set<string>;
  setHiddenGroundStations: (value: Set<string>) => void;
  
  // Mode control
  setSelectedMode: (mode: 'satellite' | 'earth' | 'celestial' | 'groundstation') => void;

  // Modal controls
  setSettingsModalSatelliteId: (id: string | null) => void;
  setSettingsModalGroundStationId: (id: string | null) => void;
  
  // Styles (from parent)
  styles: any;
}

