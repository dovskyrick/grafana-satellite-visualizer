/**
 * TopLeftControls.tsx
 * 
 * Top-left control panel with Mode, Camera, and Reference Axes dropdowns.
 * 
 * Created: January 14, 2026 (Phase 2 Refactoring)
 * Extracted from SatelliteVisualizer.tsx (~300 lines)
 */

import React from 'react';
import { Video, ChevronDown, Move3d, Eye, EyeOff } from 'lucide-react';
import { TopLeftControlsProps } from './types';

export const TopLeftControls: React.FC<TopLeftControlsProps> = ({
  isModeDropdownOpen,
  setIsModeDropdownOpen,
  isCameraDropdownOpen,
  setIsCameraDropdownOpen,
  isAxesDropdownOpen,
  setIsAxesDropdownOpen,
  selectedMode,
  setSelectedMode,
  satelliteCameraView,
  setSatelliteCameraView,
  celestialCameraView,
  setCelestialCameraView,
  earthCameraView,
  setEarthCameraView,
  showLVLHAxes,
  setShowLVLHAxes,
  showBodyAxes,
  setShowBodyAxes,
  showITRFAxes,
  setShowITRFAxes,
  showICRFAxes,
  setShowICRFAxes,
  onNadirViewClick,
  onCrossTrackViewClick,
  onAlongTrackViewClick,
  trackedSatelliteId,
  styles,
}) => {
  return (
    <div className={styles.topLeftControlsContainer}>
      {/* Mode Dropdown */}
      <div style={{ position: 'relative' }}>
        <button
          className={styles.dropdownButton}
          onClick={() => {
            setIsModeDropdownOpen(!isModeDropdownOpen);
            setIsCameraDropdownOpen(false);
          }}
          title="View Mode"
        >
          Mode
          <ChevronDown size={16} />
        </button>
        
        {isModeDropdownOpen && (
          <div className={styles.dropdownMenu}>
            <div
              className={`${styles.dropdownItem} ${selectedMode === 'satellite' ? 'active' : ''}`}
              onClick={() => {
                setSelectedMode('satellite');
                setIsModeDropdownOpen(false);
                // TODO: Implement satellite-centered view logic
              }}
            >
              <span className={styles.dropdownItemLabel}>🛰️ Satellite Focus</span>
              <span className={styles.dropdownItemDescription}>Center on tracked satellite</span>
            </div>
            <div
              className={`${styles.dropdownItem} ${selectedMode === 'earth' ? 'active' : ''}`}
              onClick={() => {
                setSelectedMode('earth');
                setIsModeDropdownOpen(false);
                // TODO: Implement earth-centered view logic
              }}
            >
              <span className={styles.dropdownItemLabel}>🌍 Earth Focus</span>
              <span className={styles.dropdownItemDescription}>Center on Earth</span>
            </div>
            <div
              className={`${styles.dropdownItem} ${selectedMode === 'celestial' ? 'active' : ''}`}
              onClick={() => {
                setSelectedMode('celestial');
                setIsModeDropdownOpen(false);
                // TODO: Implement celestial map view logic
              }}
            >
              <span className={styles.dropdownItemLabel}>⭐ Celestial Map</span>
              <span className={styles.dropdownItemDescription}>RA/Dec reference frame</span>
            </div>
            <div
              className={`${styles.dropdownItem} ${selectedMode === 'groundstation' ? 'active' : ''}`}
              onClick={() => {
                setSelectedMode('groundstation');
                setIsModeDropdownOpen(false);
                // TODO: Implement ground station POV logic
              }}
            >
              <span className={styles.dropdownItemLabel}>📡 Ground Station POV</span>
              <span className={styles.dropdownItemDescription}>Sky view from selected ground station</span>
            </div>
          </div>
        )}
      </div>
      
      {/* Camera direction - Options change by view mode; disabled in Earth Focus (camera is free) */}
      <div style={{ position: 'relative' }}>
        <button
          className={styles.dropdownButton}
          disabled={selectedMode === 'earth' || selectedMode === 'groundstation'}
          onClick={() => {
            if (selectedMode === 'earth' || selectedMode === 'groundstation') { return; }
            setIsCameraDropdownOpen(!isCameraDropdownOpen);
            setIsModeDropdownOpen(false);
          }}
          title={
            selectedMode === 'earth' ? 'Camera direction — free camera in Earth Focus mode' :
            selectedMode === 'groundstation' ? 'Camera direction — free look in Ground Station POV' :
            'Camera direction'
          }
        >
          <Video size={16} />
          <ChevronDown size={16} />
        </button>
        
        {isCameraDropdownOpen && selectedMode !== 'earth' && selectedMode !== 'groundstation' && (
          <div className={styles.dropdownMenu}>
            {/* Satellite Focus Mode - Satellite-centric camera views */}
            {selectedMode === 'satellite' && (
              <>
                <div
                  className={`${styles.dropdownItem} ${satelliteCameraView === 'nadir' ? 'active' : ''}`}
                  onClick={() => {
                    setSatelliteCameraView('nadir');
                    setIsCameraDropdownOpen(false);
                    // Use existing nadir view function
                    if (trackedSatelliteId && onNadirViewClick) {
                      onNadirViewClick();
                    }
                  }}
                >
                  <span className={styles.dropdownItemLabel}>🔭 Nadir View</span>
                  <span className={styles.dropdownItemDescription}>View from directly above</span>
                </div>
                <div
                  className={`${styles.dropdownItem} ${satelliteCameraView === 'cross-track' ? 'active' : ''}`}
                  onClick={() => {
                    setSatelliteCameraView('cross-track');
                    setIsCameraDropdownOpen(false);
                    if (trackedSatelliteId && onCrossTrackViewClick) { onCrossTrackViewClick(); }
                  }}
                >
                  <span className={styles.dropdownItemLabel}>↔️ Cross-Track View</span>
                  <span className={styles.dropdownItemDescription}>Camera along orbit normal</span>
                </div>
                <div
                  className={`${styles.dropdownItem} ${satelliteCameraView === 'along-track' ? 'active' : ''}`}
                  onClick={() => {
                    setSatelliteCameraView('along-track');
                    setIsCameraDropdownOpen(false);
                    if (trackedSatelliteId && onAlongTrackViewClick) { onAlongTrackViewClick(); }
                  }}
                >
                  <span className={styles.dropdownItemLabel}>➡️ Along-Track View</span>
                  <span className={styles.dropdownItemDescription}>From behind satellite, motion forward</span>
                </div>
                <div
                  className={`${styles.dropdownItem} ${satelliteCameraView === 'fixed' ? 'active' : ''}`}
                  onClick={() => {
                    setSatelliteCameraView('fixed');
                    setIsCameraDropdownOpen(false);
                    // TODO: Implement fixed inertial view
                  }}
                >
                  <span className={styles.dropdownItemLabel}>🧭 Fixed Inertial</span>
                  <span className={styles.dropdownItemDescription}>Inertial reference frame</span>
                </div>
              </>
            )}
            
            {/* Celestial Map Mode - Celestial reference pointing */}
            {selectedMode === 'celestial' && (
              <>
                <div
                  className={`${styles.dropdownItem} ${celestialCameraView === 'sun' ? 'active' : ''}`}
                  onClick={() => {
                    setCelestialCameraView('sun');
                    setIsCameraDropdownOpen(false);
                    // TODO: Implement sun pointing
                  }}
                >
                  <span className={styles.dropdownItemLabel}>☀️ Sun Pointing</span>
                  <span className={styles.dropdownItemDescription}>Camera points toward sun</span>
                </div>
                <div
                  className={`${styles.dropdownItem} ${celestialCameraView === 'lvlh-orbit' ? 'active' : ''}`}
                  onClick={() => {
                    setCelestialCameraView('lvlh-orbit');
                    setIsCameraDropdownOpen(false);
                    // TODO: Implement LVLH orbit direction pointing
                  }}
                >
                  <span className={styles.dropdownItemLabel}>🛰️ LVLH Orbit Direction</span>
                  <span className={styles.dropdownItemDescription}>Aligned with orbit velocity</span>
                </div>
                <div
                  className={`${styles.dropdownItem} ${celestialCameraView === 'star' ? 'active' : ''}`}
                  onClick={() => {
                    setCelestialCameraView('star');
                    setIsCameraDropdownOpen(false);
                    // TODO: Implement star pointing
                  }}
                >
                  <span className={styles.dropdownItemLabel}>⭐ Star Pointing</span>
                  <span className={styles.dropdownItemDescription}>Fixed stellar reference</span>
                </div>
                <div
                  className={`${styles.dropdownItem} ${celestialCameraView === 'groundstation' ? 'active' : ''}`}
                  onClick={() => {
                    setCelestialCameraView('groundstation');
                    setIsCameraDropdownOpen(false);
                    // TODO: Implement ground station pointing
                  }}
                >
                  <span className={styles.dropdownItemLabel}>📡 Ground Station Pointing</span>
                  <span className={styles.dropdownItemDescription}>Camera toward selected station</span>
                </div>
              </>
            )}
            {/* Earth Focus: no options — camera direction dropdown is disabled; camera is free (moving nadir) */}
          </div>
        )}
      </div>
      
      {/* Reference Axes Visibility Toggle - Common to All Modes */}
      <div style={{ position: 'relative' }}>
        <button
          className={styles.dropdownButton}
          onClick={() => {
            setIsAxesDropdownOpen(!isAxesDropdownOpen);
            setIsModeDropdownOpen(false);
            setIsCameraDropdownOpen(false);
          }}
          title="Select visible reference axes"
        >
          <Move3d size={16} />
          <ChevronDown size={16} />
        </button>
        
        {isAxesDropdownOpen && (
          <div className={styles.dropdownMenu}>
            {/* LVLH Reference Frame Toggle */}
            <div 
              className={styles.toggleItem}
              onClick={() => setShowLVLHAxes(!showLVLHAxes)}
              style={{ cursor: 'pointer' }}
            >
              <span className={styles.toggleLabel}>
                LVLH Reference Frame
              </span>
              {showLVLHAxes ? <Eye size={18} /> : <EyeOff size={18} />}
            </div>
            
            {/* Body Axes Reference Frame Toggle */}
            <div 
              className={styles.toggleItem}
              onClick={() => setShowBodyAxes(!showBodyAxes)}
              style={{ cursor: 'pointer' }}
            >
              <span className={styles.toggleLabel}>
                Body Axes Reference Frame
              </span>
              {showBodyAxes ? <Eye size={18} /> : <EyeOff size={18} />}
            </div>
            
            {/* ITRF Reference Frame Toggle */}
            <div 
              className={styles.toggleItem}
              onClick={() => setShowITRFAxes(!showITRFAxes)}
              style={{ cursor: 'pointer' }}
            >
              <span className={styles.toggleLabel}>
                ITRF Reference Frame
              </span>
              {showITRFAxes ? <Eye size={18} /> : <EyeOff size={18} />}
            </div>
            
            {/* ICRF Reference Frame Toggle */}
            <div 
              className={styles.toggleItem}
              onClick={() => setShowICRFAxes(!showICRFAxes)}
              style={{ cursor: 'pointer' }}
            >
              <span className={styles.toggleLabel}>
                ICRF Reference Frame
              </span>
              {showICRFAxes ? <Eye size={18} /> : <EyeOff size={18} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

