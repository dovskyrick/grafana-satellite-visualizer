/**
 * CelestialWelcomeModal.tsx
 *
 * One-time welcome modal shown the first time the user enters Celestial Map mode.
 * Explains the two available views and lets the user pick one before anything renders.
 *
 * Persistence: localStorage key "celestial_map_welcomed".
 */

import React from 'react';
import { css } from '@emotion/css';

interface CelestialWelcomeModalProps {
  onSelect: (view: 'zoomed-in' | 'total-map') => void;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = {
  overlay: css`
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    z-index: 2000;
    display: flex;
    align-items: center;
    justify-content: center;
  `,
  card: css`
    background: rgba(28, 28, 32, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 10px;
    padding: 32px 36px 28px;
    width: 500px;
    max-width: 96vw;
    box-shadow: 0 8px 40px rgba(0, 0, 0, 0.7);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
  `,
  headline: css`
    font-size: 15px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.85);
    text-align: center;
    line-height: 1.5;
    margin: 0;
  `,
  buttonRow: css`
    display: flex;
    gap: 20px;
    width: 100%;
    justify-content: center;
  `,
  viewButton: css`
    flex: 1;
    max-width: 200px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    padding: 20px 16px 18px;
    background: rgba(50, 50, 56, 0.9);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    color: white;

    &:hover {
      background: rgba(70, 70, 80, 0.95);
      border-color: rgba(126, 184, 247, 0.6);
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(86, 207, 225, 0.15);
    }

    &:active {
      transform: translateY(0);
    }
  `,
  svgFrame: css`
    width: 110px;
    height: 110px;
    display: flex;
    align-items: center;
    justify-content: center;
  `,
  viewLabel: css`
    font-size: 15px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.95);
  `,
  viewCaption: css`
    font-size: 12px;
    color: rgba(255, 255, 255, 0.45);
    text-align: center;
    line-height: 1.4;
  `,
};

// ─── Placeholder SVGs (replace inner content with ChatGPT-generated SVGs) ────

const NarrowFovSvg = () => (
  <svg viewBox="0 0 120 120" width="110" height="110" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Starfield background dots */}
    <circle cx="20" cy="18" r="1.2" fill="#ffffff" opacity="0.5" />
    <circle cx="95" cy="25" r="1" fill="#7eb8f7" opacity="0.5" />
    <circle cx="108" cy="70" r="1.2" fill="#ffffff" opacity="0.4" />
    <circle cx="14" cy="85" r="1" fill="#7eb8f7" opacity="0.4" />
    <circle cx="75" cy="105" r="1.2" fill="#ffffff" opacity="0.5" />
    <circle cx="35" cy="100" r="1" fill="#56cfe1" opacity="0.4" />
    <circle cx="100" cy="95" r="1.2" fill="#ffffff" opacity="0.3" />
    <circle cx="50" cy="14" r="1" fill="#56cfe1" opacity="0.5" />

    {/* Outer celestial boundary */}
    <circle cx="60" cy="60" r="52" stroke="rgba(126,184,247,0.2)" strokeWidth="1" strokeDasharray="4 4" />

    {/* 90° FOV cone — two lines from centre spreading ~45° each side */}
    <line x1="60" y1="60" x2="22" y2="8"  stroke="#56cfe1" strokeWidth="1.2" strokeDasharray="5 3" opacity="0.75" />
    <line x1="60" y1="60" x2="98" y2="8"  stroke="#56cfe1" strokeWidth="1.2" strokeDasharray="5 3" opacity="0.75" />
    {/* Arc closing the cone */}
    <path d="M 22 8 A 58 58 0 0 1 98 8" stroke="#56cfe1" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" fill="none" />
    {/* Subtle cone fill */}
    <path d="M 60 60 L 22 8 A 58 58 0 0 1 98 8 Z" fill="rgba(86,207,225,0.06)" />

    {/* A couple of stars inside the cone */}
    <circle cx="60" cy="22" r="1.5" fill="#56cfe1" opacity="0.8" />
    <circle cx="48" cy="30" r="1.2" fill="#ffffff" opacity="0.7" />
    <circle cx="72" cy="28" r="1"   fill="#7eb8f7" opacity="0.7" />

    {/* Satellite body — small hexagon at centre */}
    <polygon points="60,50 66,54 66,62 60,66 54,62 54,54" stroke="#7eb8f7" strokeWidth="1.5" fill="rgba(126,184,247,0.15)" />
    {/* Solar panels */}
    <line x1="44" y1="58" x2="54" y2="58" stroke="#7eb8f7" strokeWidth="1.5" />
    <line x1="66" y1="58" x2="76" y2="58" stroke="#7eb8f7" strokeWidth="1.5" />
    <rect x="38" y="55" width="8" height="6" rx="1" stroke="#7eb8f7" strokeWidth="1" fill="rgba(126,184,247,0.2)" />
    <rect x="74" y="55" width="8" height="6" rx="1" stroke="#7eb8f7" strokeWidth="1" fill="rgba(126,184,247,0.2)" />
  </svg>
);

const FullSkySvg = () => (
  <svg viewBox="0 0 120 120" width="110" height="110" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Stars distributed evenly all around */}
    <circle cx="60" cy="8"   r="1.5" fill="#ffffff" opacity="0.7" />
    <circle cx="88" cy="15"  r="1.2" fill="#7eb8f7" opacity="0.6" />
    <circle cx="108" cy="40" r="1.5" fill="#ffffff" opacity="0.6" />
    <circle cx="112" cy="65" r="1.2" fill="#56cfe1" opacity="0.6" />
    <circle cx="100" cy="92" r="1.5" fill="#ffffff" opacity="0.6" />
    <circle cx="75"  cy="110" r="1.2" fill="#7eb8f7" opacity="0.6" />
    <circle cx="45"  cy="112" r="1.5" fill="#ffffff" opacity="0.6" />
    <circle cx="20"  cy="96"  r="1.2" fill="#56cfe1" opacity="0.6" />
    <circle cx="8"   cy="70"  r="1.5" fill="#ffffff" opacity="0.6" />
    <circle cx="10"  cy="42"  r="1.2" fill="#7eb8f7" opacity="0.6" />
    <circle cx="28"  cy="18"  r="1.5" fill="#ffffff" opacity="0.6" />
    <circle cx="55"  cy="112" r="1"   fill="#56cfe1" opacity="0.5" />

    {/* Outer celestial sphere boundary */}
    <circle cx="60" cy="60" r="52" stroke="rgba(126,184,247,0.35)" strokeWidth="1.2" strokeDasharray="5 3" />

    {/* RA/Dec grid — two orthogonal dashed great-circle arcs */}
    {/* Horizontal equator */}
    <ellipse cx="60" cy="60" rx="52" ry="16" stroke="rgba(86,207,225,0.3)" strokeWidth="1" strokeDasharray="4 4" />
    {/* Vertical meridian */}
    <ellipse cx="60" cy="60" rx="16" ry="52" stroke="rgba(86,207,225,0.3)" strokeWidth="1" strokeDasharray="4 4" />

    {/* Satellite body — slightly larger hexagon at dead centre */}
    <polygon points="60,48 68,53 68,63 60,68 52,63 52,53" stroke="#7eb8f7" strokeWidth="1.5" fill="rgba(126,184,247,0.18)" />
    {/* Solar panels */}
    <line x1="36" y1="58" x2="52" y2="58" stroke="#7eb8f7" strokeWidth="1.5" />
    <line x1="68" y1="58" x2="84" y2="58" stroke="#7eb8f7" strokeWidth="1.5" />
    <rect x="28" y="54" width="10" height="8" rx="1" stroke="#7eb8f7" strokeWidth="1" fill="rgba(126,184,247,0.2)" />
    <rect x="82" y="54" width="10" height="8" rx="1" stroke="#7eb8f7" strokeWidth="1" fill="rgba(126,184,247,0.2)" />
  </svg>
);

// ─── Component ────────────────────────────────────────────────────────────────

export const CelestialWelcomeModal: React.FC<CelestialWelcomeModalProps> = ({ onSelect }) => {
  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <p className={styles.headline}>
          Celestial Map shows the sky as seen from your satellite&rsquo;s position.
        </p>

        <div className={styles.buttonRow}>
          {/* 90° View */}
          <button className={styles.viewButton} onClick={() => onSelect('zoomed-in')}>
            <div className={styles.svgFrame}>
              <NarrowFovSvg />
            </div>
            <span className={styles.viewLabel}>90° View</span>
            <span className={styles.viewCaption}>Pointed field — track a star or sensor target</span>
          </button>

          {/* 360° View */}
          <button className={styles.viewButton} onClick={() => onSelect('total-map')}>
            <div className={styles.svgFrame}>
              <FullSkySvg />
            </div>
            <span className={styles.viewLabel}>360° View</span>
            <span className={styles.viewCaption}>Full sky sphere — see everything around the satellite</span>
          </button>
        </div>
      </div>
    </div>
  );
};
