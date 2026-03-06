/**
 * SidebarControls.tsx
 * 
 * Right sidebar with satellite and ground station lists, tabs, and visibility controls.
 * 
 * Created: January 14, 2026 (Phase 2 Refactoring)
 * Extracted from SatelliteVisualizer.tsx (~150 lines)
 */

import React from 'react';
import { cx } from '@emotion/css';
import { Eye, EyeOff, Settings, ChevronRight, Menu } from 'lucide-react';
import { SidebarControlsProps } from './types';

export const SidebarControls: React.FC<SidebarControlsProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
  activeTab,
  setActiveTab,
  satellites,
  groundStations,
  trackedSatelliteId,
  setTrackedSatelliteId,
  trackedGroundStationId,
  setTrackedGroundStationId,
  hiddenSatellites,
  setHiddenSatellites,
  hiddenGroundStations,
  setHiddenGroundStations,
  setSettingsModalSatelliteId,
  setSettingsModalGroundStationId,
  styles,
}) => {
  // Helper functions
  const toggleSatelliteVisibility = (satelliteId: string) => {
    const newHidden = new Set(hiddenSatellites);
    if (newHidden.has(satelliteId)) {
      newHidden.delete(satelliteId);
      console.log(`👁️ Showing satellite: ${satelliteId}`);
    } else {
      newHidden.add(satelliteId);
      console.log(`🙈 Hiding satellite: ${satelliteId}`);
    }
    setHiddenSatellites(newHidden);
  };

  const isSatelliteVisible = (satelliteId: string) => {
    return !hiddenSatellites.has(satelliteId);
  };

  const handleSatelliteClick = (satelliteId: string) => {
    setTrackedSatelliteId(satelliteId);
    console.log(`🎯 Tracking satellite: ${satelliteId}`);
  };

  return (
    <>
      {/* Sidebar Toggle Button - moves with sidebar */}
      <button
        className={styles.sidebarToggle}
        style={{ 
          right: isSidebarOpen ? '330px' : '10px',
          transition: 'right 0.3s cubic-bezier(0.4, 0.0, 0.2, 1)'
        }}
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        title={isSidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {isSidebarOpen ? <ChevronRight size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar - Satellite & Ground Station Lists */}
      <div 
        className={styles.sidebar} 
        style={{ width: isSidebarOpen ? '320px' : '0' }}
      >
        <div className={styles.sidebarContent}>
          {/* Tab Navigation */}
          <div className={styles.tabContainer}>
            <button
              className={cx(styles.tab, activeTab === 'satellites' && 'active')}
              onClick={() => setActiveTab('satellites')}
            >
              Satellites
            </button>
            <button
              className={cx(styles.tab, activeTab === 'groundstations' && 'active')}
              onClick={() => setActiveTab('groundstations')}
            >
              Ground Stations
            </button>
          </div>

          {/* Satellites Tab Content */}
          {activeTab === 'satellites' && (
            <>
              {satellites.length === 0 ? (
                <div className={styles.emptyState}>No satellites available</div>
              ) : (
                <div className={styles.satelliteList}>
                  {satellites.map((satellite) => (
                    <div 
                      key={satellite.id} 
                      className={cx(
                        styles.satelliteItem,
                        trackedSatelliteId === satellite.id && 'tracked'
                      )}
                      onClick={() => handleSatelliteClick(satellite.id)}
                    >
                      <button
                        className={styles.visibilityToggle}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSatelliteVisibility(satellite.id);
                        }}
                        title={isSatelliteVisible(satellite.id) ? 'Hide satellite' : 'Show satellite'}
                      >
                        {isSatelliteVisible(satellite.id) ? <Eye size={16} /> : <EyeOff size={16} />}
                      </button>
                      
                      <div className={styles.satelliteInfo}>
                        <div className={styles.satelliteName} title={satellite.name}>
                          {satellite.name}
                        </div>
                        <div className={styles.satelliteId} title={satellite.id}>
                          {satellite.id}
                        </div>
                      </div>
                      
                      <button
                        className={styles.settingsButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSettingsModalSatelliteId(satellite.id);
                        }}
                        title="Satellite settings"
                      >
                        <Settings size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Ground Stations Tab Content */}
          {activeTab === 'groundstations' && (
            <>
              {groundStations.length === 0 ? (
                <div className={styles.emptyState}>No ground stations available</div>
              ) : (
                <div className={styles.satelliteList}>
                  {groundStations.map((gs) => {
                    const isHidden = hiddenGroundStations.has(gs.id);
                    
                    return (
                      <div 
                        key={gs.id} 
                        className={cx(styles.satelliteItem, trackedGroundStationId === gs.id && 'tracked')}
                        onClick={() => setTrackedGroundStationId(gs.id)}
                      >
                        <button
                          className={styles.visibilityToggle}
                          onClick={(e) => {
                            e.stopPropagation();
                            const newHidden = new Set(hiddenGroundStations);
                            if (isHidden) {
                              newHidden.delete(gs.id);
                            } else {
                              newHidden.add(gs.id);
                            }
                            setHiddenGroundStations(newHidden);
                          }}
                          title={isHidden ? 'Show ground station' : 'Hide ground station'}
                        >
                          {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                        
                        <div className={styles.satelliteInfo}>
                          <div className={styles.satelliteName} title={gs.name}>
                            {gs.name}
                          </div>
                          <div className={styles.satelliteId} title={gs.id}>
                            {gs.id}
                          </div>
                        </div>
                        
                        <button
                          className={styles.povButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            // TODO: Implement POV functionality
                            console.log(`POV clicked for ground station: ${gs.name}`);
                          }}
                          title="Switch to ground station POV"
                        >
                          POV
                        </button>
                        
                        <button
                          className={styles.settingsButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSettingsModalGroundStationId(gs.id);
                          }}
                          title="Ground station settings"
                        >
                          <Settings size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};

