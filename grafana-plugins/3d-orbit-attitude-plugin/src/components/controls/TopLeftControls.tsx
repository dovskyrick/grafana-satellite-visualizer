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
  onFixedViewClick,
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
            setIsAxesDropdownOpen(false);
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
      
      {/* Camera direction - hidden in Celestial Map and Ground Station POV */}
      {selectedMode !== 'celestial' && selectedMode !== 'groundstation' && (
      <div style={{ position: 'relative' }}>
        <button
          className={styles.dropdownButton}
          disabled={selectedMode === 'earth' || selectedMode === 'groundstation'}
          onClick={() => {
            if (selectedMode === 'earth' || selectedMode === 'groundstation') { return; }
            setIsCameraDropdownOpen(!isCameraDropdownOpen);
            setIsModeDropdownOpen(false);
            setIsAxesDropdownOpen(false);
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
                  className={styles.dropdownItem}
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
                  className={styles.dropdownItem}
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
                  className={styles.dropdownItem}
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
                  className={styles.dropdownItem}
                  onClick={() => {
                    setSatelliteCameraView('fixed');
                    setIsCameraDropdownOpen(false);
                    if (trackedSatelliteId && onFixedViewClick) { onFixedViewClick(); }
                  }}
                >
                  <span className={styles.dropdownItemLabel}>🧭 Fixed Inertial</span>
                  <span className={styles.dropdownItemDescription}>Inertial reference frame</span>
                </div>
              </>
            )}
            
            {/* Celestial Map Mode - Zoom level */}
            {selectedMode === 'celestial' && (
              <>
                <div
                  className={`${styles.dropdownItem} ${celestialCameraView === 'zoomed-in' ? 'active' : ''}`}
                  onClick={() => {
                    setCelestialCameraView('zoomed-in');
                    setIsCameraDropdownOpen(false);
                  }}
                >
                  <span className={styles.dropdownItemLabel}>🔍 90° View</span>
                  <span className={styles.dropdownItemDescription}>Close-up celestial view</span>
                </div>
                <div
                  className={`${styles.dropdownItem} ${celestialCameraView === 'total-map' ? 'active' : ''}`}
                  onClick={() => {
                    setCelestialCameraView('total-map');
                    setIsCameraDropdownOpen(false);
                  }}
                >
                  <span className={styles.dropdownItemLabel}>🌐 360° View</span>
                  <span className={styles.dropdownItemDescription}>Full celestial sphere view</span>
                </div>
              </>
            )}
            {/* Earth Focus: no options — camera direction dropdown is disabled; camera is free (moving nadir) */}
          </div>
        )}
      </div>
      )}

      {/* Reference Axes Visibility Toggle - hidden in Celestial Map and Ground Station POV */}
      {selectedMode !== 'celestial' && selectedMode !== 'groundstation' && (
      <div style={{ position: 'relative' }}>
        <button
          className={styles.dropdownButton}
          disabled={selectedMode === 'groundstation'}
          onClick={() => {
            if (selectedMode === 'groundstation') { return; }
            setIsAxesDropdownOpen(!isAxesDropdownOpen);
            setIsModeDropdownOpen(false);
            setIsCameraDropdownOpen(false);
          }}
          title={
            selectedMode === 'groundstation'
              ? 'Reference axes — not applicable in Ground Station POV'
              : 'Select visible reference axes'
          }
        >
          <Move3d size={16} />
          <ChevronDown size={16} />
        </button>
        
        {isAxesDropdownOpen && selectedMode !== 'groundstation' && (
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
      )}
    </div>
  );
};

