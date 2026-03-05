/**
 * SatelliteVisualizerStyles.ts
 * 
 * Extracted styles for the Satellite Visualizer component.
 * All CSS-in-JS styles using @emotion/css.
 * 
 * Refactored: January 14, 2026 (Phase 1 Refactoring)
 * Reduces main component size and improves maintainability.
 */

import { css } from '@emotion/css';

export const getStyles = () => {
  return {
    wrapper: css`
      font-family: Open Sans;
      position: relative;
    `,
    svg: css`
      position: absolute;
      top: 0;
      left: 0;
    `,
    textBox: css`
      position: absolute;
      bottom: 0;
      left: 0;
      padding: 10px;
    `,
    showCesiumCredits: css`
      display: block;
    `,
    hideCesiumCredits: css`
      display: none;
    `,
    panelContainer: css`
      display: flex;
      width: 100%;
      height: 100%;
      overflow: hidden;
      position: relative;
    `,
    mainContent: css`
      flex: 1;
      position: relative;
      min-width: 0;
      transition: flex 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
    `,
    sidebar: css`
      width: 0;
      height: 100%;
      background: rgba(30, 30, 30, 0.95);
      border-left: 1px solid rgba(255, 255, 255, 0.1);
      overflow: hidden;
      transition: width 0.3s cubic-bezier(0.4, 0.0, 0.2, 1);
      z-index: 999;
      
      &.open {
        width: 320px;
      }
    `,
    sidebarToggle: css`
      position: absolute;
      top: 10px;
      right: 10px;
      z-index: 1001;
      padding: 8px 12px;
      background: rgba(50, 50, 50, 0.9);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
      
      &:hover {
        background: rgba(70, 70, 70, 0.9);
      }
    `,
    nadirViewButton: css`
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 1000;
      padding: 8px 10px;
      cursor: pointer;
      border: none;
      border-radius: 4px;
      font-size: 16px;
      line-height: 1;
      background: rgba(50, 50, 50, 0.9);
      color: white;
      
      &:hover {
        background: rgba(70, 70, 70, 0.9);
      }
      
      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
    `,
    topLeftControlsContainer: css`
      position: absolute;
      top: 10px;
      left: 10px;
      z-index: 1000;
      display: flex;
      gap: 8px;
    `,
    dropdownButton: css`
      position: relative;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      background: rgba(50, 50, 50, 0.9);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
      
      &:hover {
        background: rgba(70, 70, 70, 0.9);
        border-color: rgba(255, 255, 255, 0.3);
      }
      
      &:active {
        transform: scale(0.98);
      }
      
      &:disabled {
        opacity: 0.65;
        cursor: not-allowed;
        transform: none;
      }
    `,
    dropdownMenu: css`
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      background: rgba(40, 40, 40, 0.98);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      min-width: 200px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
      overflow: hidden;
      z-index: 1001;
    `,
    dropdownItem: css`
      padding: 10px 16px;
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      cursor: pointer;
      transition: background 0.15s ease;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      
      &:last-child {
        border-bottom: none;
      }
      
      &:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      
      &.active {
        background: rgba(76, 175, 80, 0.2);
        color: #4CAF50;
      }
    `,
    dropdownItemLabel: css`
      display: block;
      font-weight: 500;
      margin-bottom: 2px;
    `,
    dropdownItemDescription: css`
      display: block;
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
    `,
    toggleItem: css`
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      
      &:last-child {
        border-bottom: none;
      }
      
      &:hover {
        background: rgba(255, 255, 255, 0.05);
      }
    `,
    toggleLabel: css`
      color: rgba(255, 255, 255, 0.9);
      font-size: 14px;
      cursor: pointer;
      flex: 1;
    `,
    toggleSwitch: css`
      position: relative;
      width: 44px;
      height: 24px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      cursor: pointer;
      transition: background 0.2s ease;
      
      &.active {
        background: #4CAF50;
      }
      
      &::after {
        content: '';
        position: absolute;
        top: 2px;
        left: 2px;
        width: 20px;
        height: 20px;
        background: white;
        border-radius: 50%;
        transition: transform 0.2s ease;
      }
      
      &.active::after {
        transform: translateX(20px);
      }
    `,
    sidebarContent: css`
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    `,
    tabContainer: css`
      flex-shrink: 0;
      display: flex;
      background: rgba(0, 0, 0, 0.3);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    `,
    tab: css`
      flex: 1;
      padding: 14px 16px;
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.6);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      border-bottom: 2px solid transparent;
      
      &:hover {
        color: rgba(255, 255, 255, 0.8);
        background: rgba(255, 255, 255, 0.03);
      }
      
      &.active {
        color: rgba(255, 255, 255, 0.95);
        border-bottom-color: #FF9800;
        background: rgba(255, 152, 0, 0.08);
      }
    `,
    sidebarTitle: css`
      flex-shrink: 0;
      padding: 16px;
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(0, 0, 0, 0.2);
    `,
    satelliteList: css`
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 8px;
      
      &::-webkit-scrollbar {
        width: 8px;
      }
      
      &::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.2);
      }
      
      &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        
        &:hover {
          background: rgba(255, 255, 255, 0.5);
        }
      }
    `,
    satelliteItem: css`
      display: flex;
      align-items: flex-start;
      padding: 10px 8px;
      border-radius: 4px;
      margin-bottom: 4px;
      background: rgba(255, 255, 255, 0.02);
      transition: background 0.2s ease, border-left 0.2s ease, padding-left 0.2s ease;
      cursor: pointer;
      border-left: 3px solid transparent;
      
      &:hover {
        background: rgba(255, 255, 255, 0.08);
      }
      
      &.tracked {
        background: rgba(255, 152, 0, 0.1);
        border-left: 3px solid #FF9800;
        padding-left: 5px;
      }
    `,
    visibilityToggle: css`
      flex-shrink: 0;
      width: 24px;
      height: 24px;
      margin-right: 10px;
      background: transparent;
      border: none;
      cursor: pointer;
      font-size: 18px;
      line-height: 1;
      color: rgba(255, 255, 255, 0.7);
      padding: 0;
      transition: color 0.2s ease, transform 0.1s ease;
      
      &:hover {
        color: rgba(255, 255, 255, 1);
        transform: scale(1.1);
      }
      
      &:active {
        transform: scale(0.95);
      }
    `,
    satelliteInfo: css`
      flex: 1;
      min-width: 0;
    `,
    satelliteName: css`
      font-size: 14px;
      font-weight: 500;
      color: rgba(255, 255, 255, 0.9);
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `,
    satelliteId: css`
      font-size: 11px;
      color: rgba(255, 255, 255, 0.5);
      font-family: monospace;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `,
    povButton: css`
      flex-shrink: 0;
      height: 28px;
      padding: 0 10px;
      margin-left: 8px;
      background: rgba(33, 150, 243, 0.2);
      border: 1px solid rgba(33, 150, 243, 0.4);
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      line-height: 1;
      color: rgba(33, 150, 243, 1);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
      
      &:hover {
        background: rgba(33, 150, 243, 0.3);
        border-color: rgba(33, 150, 243, 0.6);
        color: rgba(100, 181, 246, 1);
      }
    `,
    settingsButton: css`
      flex-shrink: 0;
      width: 28px;
      height: 28px;
      margin-left: 8px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      line-height: 1;
      color: rgba(255, 255, 255, 0.6);
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      
      &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.9);
        border-color: rgba(255, 255, 255, 0.3);
      }
      
      &:active {
        transform: scale(0.95);
      }
    `,
    modalOverlay: css`
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9999;
      backdrop-filter: blur(4px);
      
      /* Remove focus outline (we handle ESC, don't need visual focus indicator) */
      &:focus {
        outline: none;
      }
    `,
    modal: css`
      background: rgba(30, 30, 30, 0.98);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    `,
    modalHeader: css`
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      background: rgba(255, 255, 255, 0.02);
    `,
    modalTitle: css`
      font-size: 16px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.95);
      margin: 0;
      display: flex;
      align-items: center;
      gap: 10px;
    `,
    modalClose: css`
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.6);
      cursor: pointer;
      font-size: 20px;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      border-radius: 4px;
      
      &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 1);
      }
    `,
    modalContent: css`
      padding: 24px 20px;
      overflow-y: auto;
      flex: 1;
      color: rgba(255, 255, 255, 0.7);
      max-height: calc(80vh - 120px);
    `,
    settingRow: css`
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding: 16px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      
      &:last-child {
        border-bottom: none;
      }
    `,
    settingLabel: css`
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
      cursor: pointer;
      user-select: none;
      
      input[type="checkbox"] {
        width: 18px;
        height: 18px;
        cursor: pointer;
        accent-color: #4CAF50;
      }
      
      span {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.9);
      }
    `,
    settingDescription: css`
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
      margin-left: 30px;
      margin-top: 4px;
      line-height: 1.4;
    `,
    settingsGroup: css`
      margin-bottom: 24px;
      
      &:last-child {
        margin-bottom: 0;
      }
    `,
    settingsGroupTitle: css`
      font-size: 13px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.7);
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `,
    sensorColorRow: css`
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
    `,
    sensorColorRowVertical: css`
      display: flex;
      flex-direction: column;
      gap: 8px;
      width: 100%;
    `,
    sensorNameRow: css`
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
    `,
    colorPickerWrapper: css`
      width: 100%;
    `,
    resetButton: css`
      padding: 4px 10px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 3px;
      color: rgba(255, 255, 255, 0.7);
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s;
      
      &:hover {
        background: rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.9);
      }
    `,
    // DEPRECATED: Old color preview box (commented out for potential future use)
    // colorPreview: css`
    //   width: 32px;
    //   height: 32px;
    //   border-radius: 4px;
    //   border: 2px solid rgba(255, 255, 255, 0.2);
    //   flex-shrink: 0;
    //   cursor: pointer;
    //   transition: border-color 0.2s;
    //   
    //   &:hover {
    //     border-color: rgba(255, 255, 255, 0.5);
    //   }
    // `,
    sensorColorInfo: css`
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
      min-width: 0;
    `,
    sensorName: css`
      font-size: 14px;
      color: rgba(255, 255, 255, 0.9);
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `,
    // DEPRECATED: Old hex value display (commented out)
    // sensorColorValue: css`
    //   font-size: 12px;
    //   color: rgba(255, 255, 255, 0.5);
    //   font-family: 'Courier New', monospace;
    // `,
    // DEPRECATED: Old color picker container with Done/Reset buttons (commented out)
    // colorPickerContainer: css`
    //   margin-top: 12px;
    //   padding: 12px;
    //   background: rgba(0, 0, 0, 0.3);
    //   border-radius: 4px;
    //   border: 1px solid rgba(255, 255, 255, 0.1);
    // `,
    // colorPickerActions: css`
    //   display: flex;
    //   gap: 8px;
    //   margin-top: 12px;
    //   justify-content: flex-end;
    // `,
    // colorPickerButton: css`
    //   padding: 6px 12px;
    //   background: rgba(255, 255, 255, 0.1);
    //   border: 1px solid rgba(255, 255, 255, 0.2);
    //   border-radius: 4px;
    //   color: rgba(255, 255, 255, 0.9);
    //   font-size: 12px;
    //   cursor: pointer;
    //   transition: all 0.2s;
    //   
    //   &:hover {
    //     background: rgba(255, 255, 255, 0.2);
    //     border-color: rgba(255, 255, 255, 0.3);
    //   }
    //   
    //   &:active {
    //     transform: scale(0.98);
    //   }
    // `,
    emptyState: css`
      padding: 32px 16px;
      text-align: center;
      color: rgba(255, 255, 255, 0.5);
      font-size: 14px;
    `,
    hoverTooltip: css`
      position: fixed;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 6px 10px;
      border-radius: 4px;
      font-size: 12px;
      pointer-events: none;
      z-index: 10000;
      white-space: nowrap;
      border: 1px solid rgba(255, 255, 255, 0.3);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
    `,
    cesiumControls: css`
      /* Move Cesium's built-in controls to the left of our custom buttons */
      .cesium-viewer-toolbar {
        right: 120px !important; /* Push to left of our buttons */
        top: 10px !important;
      }
      
      .cesium-baseLayerPickerContainer {
        right: 120px !important; /* Push to left of our buttons */
        top: 10px !important;
      }
      
      .cesium-projectionPickerContainer {
        right: 120px !important; /* Stack to the left */
        top: 10px !important;
      }
    `,
    legendPanel: css`
      position: absolute;
      bottom: 40px;
      right: 10px;
      z-index: 1000;
      background: rgba(30, 30, 30, 0.95);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 4px;
      max-width: 220px;
      min-width: 180px;
      
      /* Default max-height for normal/large windows */
      max-height: 300px;
      
      display: flex;
      flex-direction: column;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
      transition: all 0.3s ease;
      
      /* Responsive sizing for smaller viewports - prevent overlap with top buttons */
      @media (max-height: 600px) {
        max-height: calc(100vh - 110px); /* Leave room for top button + bottom margin */
        max-width: 200px;
        min-width: 160px;
      }
      
      @media (max-height: 400px) {
        max-height: calc(100vh - 90px);
        max-width: 180px;
        min-width: 140px;
      }
      
      /* Narrow width adjustments */
      @media (max-width: 600px) {
        max-width: 180px;
        min-width: 140px;
      }
      
      &.collapsed {
        max-height: 36px;
        min-width: 100px;
        max-width: 120px;
      }
    `,
    legendHeader: css`
      padding: 8px 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 12px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.9);
      background: rgba(255, 255, 255, 0.03);
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      user-select: none;
      
      &:hover {
        background: rgba(255, 255, 255, 0.08);
      }
    `,
    legendToggleButton: css`
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.7);
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
      transition: color 0.2s ease;
      
      &:hover {
        color: rgba(255, 255, 255, 1);
      }
    `,
    legendContent: css`
      padding: 6px;
      overflow-y: auto;
      overflow-x: hidden;
      flex: 1; /* Fill available space in flex container */
      min-height: 0; /* Allow flexbox to shrink below content size */
      
      /* Custom scrollbar */
      &::-webkit-scrollbar {
        width: 6px;
      }
      
      &::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 3px;
      }
      
      &::-webkit-scrollbar-thumb {
        background: rgba(255, 255, 255, 0.3);
        border-radius: 3px;
      }
      
      &::-webkit-scrollbar-thumb:hover {
        background: rgba(255, 255, 255, 0.4);
      }
    `,
    legendSection: css`
      margin-bottom: 8px;
      
      &:last-child {
        margin-bottom: 0;
      }
    `,
    legendSectionTitle: css`
      font-size: 10px;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.6);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      padding: 0 2px;
    `,
    legendItem: css`
      display: flex;
      align-items: center;
      padding: 4px 6px;
      border-radius: 3px;
      transition: background 0.15s ease;
      cursor: pointer;
      
      &:hover {
        background: rgba(255, 255, 255, 0.05);
      }
    `,
    legendColorSwatch: css`
      width: 16px;
      height: 16px;
      border-radius: 3px;
      border: 1px solid rgba(255, 255, 255, 0.3);
      flex-shrink: 0;
      cursor: pointer;
      transition: transform 0.1s ease;
      
      &:hover {
        transform: scale(1.1);
      }
    `,
    legendItemName: css`
      flex: 1;
      margin-left: 8px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.85);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    `,
    legendColorPicker: css`
      margin-top: 4px;
      margin-left: 24px;
      padding: 4px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 3px;
    `,
  };
};

