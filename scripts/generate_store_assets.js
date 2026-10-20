import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const CHROMIUM_PATH = process.env.CHROMIUM_BIN || process.env.CHROME_BIN || (
  fs.existsSync('/snap/bin/chromium') ? '/snap/bin/chromium' : '/usr/bin/chromium'
);

function getBase64(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  return `data:image/png;base64,${fs.readFileSync(filePath).toString('base64')}`;
}

const originalScreenshotsDir = path.resolve('dist/screenshots/original-audit11');
const lightUI = getBase64(path.join(originalScreenshotsDir, 'tab-vault-light-1280x800.png'));
const darkUI = getBase64(path.join(originalScreenshotsDir, 'tab-vault-dark-1280x800.png'));
const settingsUI = getBase64(path.join(originalScreenshotsDir, 'tab-vault-settings-1280x800.png'));
const snapshotsUI = getBase64(path.join(originalScreenshotsDir, 'tab-vault-snapshots-1280x800.png'));
const logoIcon = getBase64(path.resolve('dist/brand-assets/tab-vault-icon-512.png'));

const commonStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1280px;
    height: 800px;
    background: #070B14;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Helvetica, Arial, sans-serif;
    color: #F8FAFC;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding-top: 52px;
  }
  
  /* Luminous Background Grid and Accents */
  .bg-grid {
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background-image: 
      linear-gradient(rgba(56, 189, 248, 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(56, 189, 248, 0.04) 1px, transparent 1px);
    background-size: 40px 40px;
    z-index: 0;
  }
  
  .bg-glow-top {
    position: absolute;
    top: -150px;
    left: 50%;
    transform: translateX(-50%);
    width: 900px;
    height: 400px;
    background: radial-gradient(ellipse, rgba(37, 99, 235, 0.28) 0%, rgba(56, 189, 248, 0.12) 45%, transparent 70%);
    z-index: 0;
    pointer-events: none;
  }

  .header-block {
    position: relative;
    z-index: 2;
    text-align: center;
    max-width: 960px;
    margin-bottom: 34px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border-radius: 999px;
    background: rgba(30, 41, 59, 0.8);
    border: 1px solid rgba(56, 189, 248, 0.35);
    color: #38BDF8;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 14px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  }

  .badge-icon {
    width: 14px;
    height: 14px;
  }

  h1 {
    font-size: 38px;
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.025em;
    color: #FFFFFF;
    margin-bottom: 10px;
  }

  h1 span.gradient-text {
    background: linear-gradient(135deg, #38BDF8 0%, #60A5FA 50%, #A78BFA 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  p.subtitle {
    font-size: 17px;
    font-weight: 400;
    line-height: 1.45;
    color: #94A3B8;
    max-width: 760px;
  }

  /* Mockup Frame */
  .mockup-container {
    position: relative;
    z-index: 2;
    width: 1080px;
    height: 570px;
    border-radius: 14px;
    background: #0F172A;
    border: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 
      0 30px 80px -15px rgba(0, 0, 0, 0.8),
      0 0 0 1px rgba(56, 189, 248, 0.15),
      0 0 60px rgba(37, 99, 235, 0.15);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .browser-chrome {
    height: 42px;
    background: #1E293B;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 14px;
  }

  .window-controls {
    display: flex;
    gap: 7px;
  }

  .dot {
    width: 11px;
    height: 11px;
    border-radius: 50%;
  }
  .dot-red { background: #EF4444; }
  .dot-yellow { background: #F59E0B; }
  .dot-green { background: #10B981; }

  .browser-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    background: #0F172A;
    padding: 5px 16px;
    border-radius: 8px 8px 0 0;
    font-size: 12px;
    font-weight: 600;
    color: #F8FAFC;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-bottom: none;
  }

  .tab-icon {
    width: 14px;
    height: 14px;
    border-radius: 3px;
  }

  .browser-url-bar {
    flex: 1;
    max-width: 520px;
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    height: 26px;
    display: flex;
    align-items: center;
    padding: 0 12px;
    font-size: 12px;
    color: #94A3B8;
    gap: 6px;
  }

  .browser-url-bar span.accent {
    color: #38BDF8;
    font-weight: 600;
  }

  .mockup-viewport {
    flex: 1;
    position: relative;
    background: #FFFFFF;
    overflow: hidden;
  }

  .mockup-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
    display: block;
  }

  /* Floating Floating Pills and Stat Badges */
  .floating-stat {
    position: absolute;
    background: rgba(15, 23, 42, 0.92);
    backdrop-filter: blur(14px);
    border: 1px solid rgba(56, 189, 248, 0.4);
    border-radius: 12px;
    padding: 14px 20px;
    color: #FFFFFF;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    gap: 14px;
    z-index: 10;
  }

  .stat-icon-wrap {
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background: linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(37, 99, 235, 0.3));
    border: 1px solid rgba(56, 189, 248, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
  }

  .stat-text h4 {
    font-size: 17px;
    font-weight: 800;
    color: #F8FAFC;
    line-height: 1.2;
  }

  .stat-text p {
    font-size: 12px;
    font-weight: 500;
    color: #38BDF8;
  }
`;

const templates = [
  // ----------------------------------------------------
  // SLIDE 1: Hero - One-Click Stash & 95% Memory Reduction
  // ----------------------------------------------------
  {
    name: 'store-screenshot-1-hero-collapse.png',
    alias: 'tab-vault-light-1280x800.png',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          ${commonStyles}
          .floating-stat-1 {
            bottom: 30px;
            left: 20px;
          }
          .floating-stat-2 {
            top: 60px;
            right: 20px;
          }
        </style>
      </head>
      <body>
        <div class="bg-grid"></div>
        <div class="bg-glow-top"></div>

        <div class="header-block">
          <div class="badge">
            <span>⚡ One-Click Performance</span>
          </div>
          <h1>Declutter 50+ Tabs in One Click. <span class="gradient-text">Save 95% Memory.</span></h1>
          <p class="subtitle">Instantly consolidate chaotic browser windows into organized, timestamped research sessions that free up CPU and RAM.</p>
        </div>

        <div class="mockup-container">
          <div class="browser-chrome">
            <div class="window-controls">
              <div class="dot dot-red"></div>
              <div class="dot dot-yellow"></div>
              <div class="dot dot-green"></div>
            </div>
            <div class="browser-tab">
              <img class="tab-icon" src="${logoIcon}" alt="Icon">
              <span>Tab Vault — Active Sessions</span>
            </div>
            <div class="browser-url-bar">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <span>chrome-extension://<span class="accent">tab-vault</span>/tab-vault.html</span>
            </div>
          </div>
          <div class="mockup-viewport">
            <img class="mockup-img" src="${lightUI}" alt="Tab Vault Light UI">
            
            <div class="floating-stat floating-stat-1">
              <div class="stat-icon-wrap">⚡</div>
              <div class="stat-text">
                <h4>95% Memory Freed</h4>
                <p>Instant RAM reclamation</p>
              </div>
            </div>

            <div class="floating-stat floating-stat-2">
              <div class="stat-icon-wrap">🛡️</div>
              <div class="stat-text">
                <h4>1-Click Safe Stash</h4>
                <p>Zero lost URLs or history</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  },

  // ----------------------------------------------------
  // SLIDE 2: Disaster Recovery & Rolling Snapshots
  // ----------------------------------------------------
  {
    name: 'store-screenshot-2-disaster-recovery.png',
    alias: 'tab-vault-snapshots-1280x800.png',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          ${commonStyles}
          .floating-stat-recovery {
            bottom: 30px;
            right: 25px;
          }
          .floating-stat-snapshots {
            top: 55px;
            left: 25px;
          }
        </style>
      </head>
      <body>
        <div class="bg-grid"></div>
        <div class="bg-glow-top"></div>

        <div class="header-block">
          <div class="badge">
            <span>🛡️ Defense-in-Depth Disaster Recovery</span>
          </div>
          <h1>Never Lose Your Tabs to a Crash. <span class="gradient-text">Bulletproof Safety.</span></h1>
          <p class="subtitle">Automatic rolling JSON backups to Downloads and 5-state in-extension snapshots guarantee 1-click state rollback at any time.</p>
        </div>

        <div class="mockup-container">
          <div class="browser-chrome">
            <div class="window-controls">
              <div class="dot dot-red"></div>
              <div class="dot dot-yellow"></div>
              <div class="dot dot-green"></div>
            </div>
            <div class="browser-tab">
              <img class="tab-icon" src="${logoIcon}" alt="Icon">
              <span>Rolling Snapshots & Disaster Recovery</span>
            </div>
            <div class="browser-url-bar">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <span>chrome-extension://tab-vault/<span class="accent">snapshots</span></span>
            </div>
          </div>
          <div class="mockup-viewport">
            <img class="mockup-img" src="${snapshotsUI}" alt="Snapshots Drawer">

            <div class="floating-stat floating-stat-snapshots">
              <div class="stat-icon-wrap">🔄</div>
              <div class="stat-text">
                <h4>5-State Rolling Ring Buffer</h4>
                <p>1-Click instant state rollback</p>
              </div>
            </div>

            <div class="floating-stat floating-stat-recovery">
              <div class="stat-icon-wrap">💾</div>
              <div class="stat-text">
                <h4>Automated Downloads Backup</h4>
                <p>Zero cloud risk · 100% offline recovery</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  },

  // ----------------------------------------------------
  // SLIDE 3: Instant Search & Omnibox Keyword
  // ----------------------------------------------------
  {
    name: 'store-screenshot-3-instant-search.png',
    alias: null,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          ${commonStyles}
          .floating-omnibox-card {
            position: absolute;
            top: 25px;
            left: 50%;
            transform: translateX(-50%);
            width: 580px;
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(56, 189, 248, 0.5);
            border-radius: 12px;
            box-shadow: 0 25px 60px rgba(0, 0, 0, 0.8), 0 0 20px rgba(56, 189, 248, 0.2);
            padding: 16px 20px;
            z-index: 20;
          }
          .omnibox-input {
            display: flex;
            align-items: center;
            gap: 10px;
            background: #090D1A;
            border: 1px solid #38BDF8;
            border-radius: 8px;
            padding: 8px 14px;
            font-size: 14px;
            color: #F8FAFC;
          }
          .omnibox-tag {
            background: #2563EB;
            color: #FFFFFF;
            font-size: 11px;
            font-weight: 700;
            padding: 2px 7px;
            border-radius: 4px;
            text-transform: uppercase;
          }
          .omnibox-results {
            margin-top: 10px;
            display: flex;
            flex-direction: column;
            gap: 6px;
          }
          .result-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 12px;
            background: rgba(255, 255, 255, 0.04);
          }
          .result-item.active {
            background: rgba(56, 189, 248, 0.15);
            border: 1px solid rgba(56, 189, 248, 0.4);
          }
          .result-title {
            color: #F8FAFC;
            font-weight: 500;
          }
          .result-url {
            color: #38BDF8;
            font-size: 11px;
          }
        </style>
      </head>
      <body>
        <div class="bg-grid"></div>
        <div class="bg-glow-top"></div>

        <div class="header-block">
          <div class="badge">
            <span>🔍 Sub-Millisecond Retrieval</span>
          </div>
          <h1>Find Any Tab in Milliseconds. <span class="gradient-text">Search from Anywhere.</span></h1>
          <p class="subtitle">Type 'tv' into your Chrome address bar or press '/' for instant multi-token search across thousands of saved research tabs.</p>
        </div>

        <div class="mockup-container">
          <div class="browser-chrome">
            <div class="window-controls">
              <div class="dot dot-red"></div>
              <div class="dot dot-yellow"></div>
              <div class="dot dot-green"></div>
            </div>
            <div class="browser-tab">
              <img class="tab-icon" src="${logoIcon}" alt="Icon">
              <span>Instant Omnibox & In-Vault Search</span>
            </div>
            <div class="browser-url-bar">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <span>tv <span class="accent">deep learning</span></span>
            </div>
          </div>
          <div class="mockup-viewport">
            <img class="mockup-img" src="${lightUI}" alt="Tab Vault Light UI">

            <div class="floating-omnibox-card">
              <div class="omnibox-input">
                <span class="omnibox-tag">Tab Vault</span>
                <span>tv deep learning</span>
                <span style="margin-left: auto; color: #64748B; font-size: 11px;">Press Tab or Enter to search</span>
              </div>
              <div class="omnibox-results">
                <div class="result-item active">
                  <span class="result-title">📄 Attention Is All You Need - arXiv Research</span>
                  <span class="result-url">arxiv.org</span>
                </div>
                <div class="result-item">
                  <span class="result-title">⚙️ Deep Learning & Agentic Systems Research</span>
                  <span class="result-url">4 tabs matched</span>
                </div>
              </div>
            </div>

            <div class="floating-stat" style="bottom: 25px; left: 25px;">
              <div class="stat-icon-wrap">⌨️</div>
              <div class="stat-text">
                <h4>Instant Keyboard Shortcuts</h4>
                <p>Press '/' or 'Ctrl+F' to search · Alt+Shift+V to stash</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  },

  // ----------------------------------------------------
  // SLIDE 4: Power Organization & Batch Control
  // ----------------------------------------------------
  {
    name: 'store-screenshot-4-batch-organize.png',
    alias: null,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          ${commonStyles}
          .floating-batch-bar {
            position: absolute;
            bottom: 40px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(16px);
            border: 1px solid rgba(56, 189, 248, 0.5);
            border-radius: 999px;
            padding: 10px 24px;
            display: flex;
            align-items: center;
            gap: 16px;
            box-shadow: 0 20px 45px rgba(0, 0, 0, 0.7);
            z-index: 25;
          }
          .batch-count {
            font-size: 13px;
            font-weight: 700;
            color: #F8FAFC;
          }
          .batch-btn {
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            border: none;
          }
          .btn-primary { background: #2563EB; color: #FFFFFF; }
          .btn-ghost { background: rgba(255, 255, 255, 0.08); color: #E2E8F0; }
          .btn-danger { background: rgba(239, 68, 68, 0.2); color: #FCA5A5; border: 1px solid rgba(239, 68, 68, 0.4); }
        </style>
      </head>
      <body>
        <div class="bg-grid"></div>
        <div class="bg-glow-top"></div>

        <div class="header-block">
          <div class="badge">
            <span>✨ Power Organization</span>
          </div>
          <h1>Organize Your Mind. <span class="gradient-text">Drag, Drop & Batch Actions.</span></h1>
          <p class="subtitle">Multi-select checkboxes for batch restore, intuitive drag-and-drop between collections, starred Quick Lists, and 30-day soft trash.</p>
        </div>

        <div class="mockup-container">
          <div class="browser-chrome">
            <div class="window-controls">
              <div class="dot dot-red"></div>
              <div class="dot dot-yellow"></div>
              <div class="dot dot-green"></div>
            </div>
            <div class="browser-tab">
              <img class="tab-icon" src="${logoIcon}" alt="Icon">
              <span>Drag-and-Drop & Batch Organization</span>
            </div>
            <div class="browser-url-bar">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <span>chrome-extension://tab-vault/<span class="accent">batch-actions</span></span>
            </div>
          </div>
          <div class="mockup-viewport">
            <img class="mockup-img" src="${lightUI}" alt="Tab Vault Light UI">

            <div class="floating-batch-bar">
              <span class="batch-count">☑️ 3 Tabs Selected</span>
              <button class="batch-btn btn-primary">Restore Selected</button>
              <button class="batch-btn btn-ghost">Move to New Group</button>
              <button class="batch-btn btn-danger">Delete</button>
            </div>

            <div class="floating-stat" style="top: 30px; right: 25px;">
              <div class="stat-icon-wrap">★</div>
              <div class="stat-text">
                <h4>Quick List / Starred Links</h4>
                <p>1-Click instant access to priority tabs</p>
              </div>
            </div>

            <div class="floating-stat" style="top: 30px; left: 25px;">
              <div class="stat-icon-wrap">🔒</div>
              <div class="stat-text">
                <h4>Locked Project Groups</h4>
                <p>Protected from deletion on restore</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  },

  // ----------------------------------------------------
  // SLIDE 5: 100% Local Privacy & Dual Themes
  // ----------------------------------------------------
  {
    name: 'store-screenshot-5-privacy-themes.png',
    alias: 'tab-vault-dark-1280x800.png',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          ${commonStyles}
          .split-viewport {
            display: flex;
            width: 100%;
            height: 100%;
          }
          .split-half {
            flex: 1;
            height: 100%;
            position: relative;
            overflow: hidden;
          }
          .split-divider {
            width: 3px;
            height: 100%;
            background: linear-gradient(180deg, #38BDF8, #2563EB, transparent);
            z-index: 15;
            box-shadow: 0 0 12px #38BDF8;
          }
          .theme-pill-left {
            position: absolute;
            top: 16px;
            left: 16px;
            background: rgba(15, 23, 42, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.15);
            color: #FFFFFF;
            font-size: 11px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 999px;
            z-index: 10;
          }
          .theme-pill-right {
            position: absolute;
            top: 16px;
            right: 16px;
            background: rgba(255, 255, 255, 0.9);
            border: 1px solid rgba(0, 0, 0, 0.1);
            color: #0F172A;
            font-size: 11px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 999px;
            z-index: 10;
          }
        </style>
      </head>
      <body>
        <div class="bg-grid"></div>
        <div class="bg-glow-top"></div>

        <div class="header-block">
          <div class="badge">
            <span>🔒 100% Local-First & Accessible</span>
          </div>
          <h1>Private by Design. <span class="gradient-text">Beautiful in Light & Dark.</span></h1>
          <p class="subtitle">Zero telemetry or cloud tracking. Fully customizable preferences and certified 100% WCAG AA contrast compliance.</p>
        </div>

        <div class="mockup-container">
          <div class="browser-chrome">
            <div class="window-controls">
              <div class="dot dot-red"></div>
              <div class="dot dot-yellow"></div>
              <div class="dot dot-green"></div>
            </div>
            <div class="browser-tab">
              <img class="tab-icon" src="${logoIcon}" alt="Icon">
              <span>Dual Themes & Local-First Preferences</span>
            </div>
            <div class="browser-url-bar">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <span>chrome-extension://tab-vault/<span class="accent">settings</span></span>
            </div>
          </div>
          <div class="mockup-viewport">
            <div class="split-viewport">
              <div class="split-half">
                <span class="theme-pill-left">🌙 Dark Mode</span>
                <img class="mockup-img" src="${darkUI}" alt="Dark Mode UI">
              </div>
              <div class="split-divider"></div>
              <div class="split-half">
                <span class="theme-pill-right">☀️ Light Mode</span>
                <img class="mockup-img" src="${settingsUI}" alt="Settings Drawer UI">
              </div>
            </div>

            <div class="floating-stat" style="bottom: 25px; left: 25px;">
              <div class="stat-icon-wrap">🔒</div>
              <div class="stat-text">
                <h4>100% Offline & Private</h4>
                <p>Zero external servers · No trackers</p>
              </div>
            </div>

            <div class="floating-stat" style="bottom: 25px; right: 25px;">
              <div class="stat-icon-wrap">♿</div>
              <div class="stat-text">
                <h4>WCAG AA Certified</h4>
                <p>20/20 verified contrast pairs</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  },

  // ----------------------------------------------------
  // SLIDE 6: Power Settings, Preferences & Self-Healing
  // ----------------------------------------------------
  {
    name: 'store-screenshot-6-power-settings.png',
    alias: 'tab-vault-settings-1280x800.png',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          ${commonStyles}
          .floating-settings-stat1 {
            top: 50px;
            left: 30px;
          }
          .floating-settings-stat2 {
            bottom: 30px;
            right: 30px;
          }
        </style>
      </head>
      <body>
        <div class="bg-grid"></div>
        <div class="bg-glow-top"></div>

        <div class="header-block">
          <div class="badge">
            <span>⚙️ Precision Customization</span>
          </div>
          <h1>Customized to Your Workflow. <span class="gradient-text">Complete Control.</span></h1>
          <p class="subtitle">Configurable window targets, deduplication, lazy tab restoration, and built-in storage self-healing diagnostics.</p>
        </div>

        <div class="mockup-container">
          <div class="browser-chrome">
            <div class="window-controls">
              <div class="dot dot-red"></div>
              <div class="dot dot-yellow"></div>
              <div class="dot dot-green"></div>
            </div>
            <div class="browser-tab">
              <img class="tab-icon" src="${logoIcon}" alt="Icon">
              <span>Tab Vault Options & Preferences</span>
            </div>
            <div class="browser-url-bar">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <span>chrome-extension://tab-vault/<span class="accent">preferences</span></span>
            </div>
          </div>
          <div class="mockup-viewport">
            <img class="mockup-img" src="${settingsUI}" alt="Settings Drawer UI">

            <div class="floating-stat floating-settings-stat1">
              <div class="stat-icon-wrap">⚡</div>
              <div class="stat-text">
                <h4>Lazy Tab Restore</h4>
                <p>Zero CPU freezing on 50+ tab batch restores</p>
              </div>
            </div>

            <div class="floating-stat floating-settings-stat2">
              <div class="stat-icon-wrap">🔧</div>
              <div class="stat-text">
                <h4>1-Click Storage Repair</h4>
                <p>Automatic orphan key cleanup & baseline sync</p>
              </div>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
  }
];

// Promotional Tiles Templates
const promoTiles = [
  // ----------------------------------------------------
  // PROMO TILE: Small (440 x 280 px)
  // ----------------------------------------------------
  {
    name: 'tab-vault-small-promo-440x280.png',
    width: 440,
    height: 280,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            width: 440px;
            height: 280px;
            background: #070B14;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
            color: #F8FAFC;
            overflow: hidden;
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 24px;
            text-align: center;
          }
          .bg-glow {
            position: absolute;
            top: -50px;
            left: 50%;
            transform: translateX(-50%);
            width: 320px;
            height: 200px;
            background: radial-gradient(ellipse, rgba(37, 99, 235, 0.4) 0%, rgba(56, 189, 248, 0.15) 50%, transparent 70%);
            z-index: 0;
          }
          .content {
            position: relative;
            z-index: 2;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .app-icon {
            width: 72px;
            height: 72px;
            border-radius: 18px;
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5), 0 0 20px rgba(56, 189, 248, 0.35);
            margin-bottom: 14px;
          }
          h2 {
            font-size: 26px;
            font-weight: 800;
            letter-spacing: -0.02em;
            color: #FFFFFF;
            line-height: 1.15;
            margin-bottom: 6px;
          }
          p.tagline {
            font-size: 13px;
            color: #94A3B8;
            margin-bottom: 14px;
            max-width: 320px;
            line-height: 1.35;
          }
          .badges-row {
            display: flex;
            gap: 8px;
          }
          .pill {
            background: rgba(30, 41, 59, 0.8);
            border: 1px solid rgba(56, 189, 248, 0.3);
            color: #38BDF8;
            font-size: 10px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 999px;
            letter-spacing: 0.04em;
          }
        </style>
      </head>
      <body>
        <div class="bg-glow"></div>
        <div class="content">
          <img class="app-icon" src="${logoIcon}" alt="Tab Vault">
          <h2>Tab Vault</h2>
          <p class="tagline">Declutter 50+ tabs in 1 click · Save 95% memory · Disaster-proof recovery</p>
          <div class="badges-row">
            <span class="pill">⚡ 95% RAM SAVER</span>
            <span class="pill">🛡️ CRASH-PROOF</span>
            <span class="pill">🔒 100% LOCAL</span>
          </div>
        </div>
      </body>
      </html>
    `
  },

  // ----------------------------------------------------
  // PROMO BANNER: Marquee (1400 x 560 px)
  // ----------------------------------------------------
  {
    name: 'tab-vault-marquee-promo-1400x560.png',
    width: 1400,
    height: 560,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            width: 1400px;
            height: 560px;
            background: #070B14;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
            color: #F8FAFC;
            overflow: hidden;
            position: relative;
            display: flex;
            align-items: center;
            padding: 0 80px;
          }
          .bg-grid {
            position: absolute;
            top: 0; left: 0; right: 0; bottom: 0;
            background-image: 
              linear-gradient(rgba(56, 189, 248, 0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(56, 189, 248, 0.04) 1px, transparent 1px);
            background-size: 40px 40px;
            z-index: 0;
          }
          .bg-glow-left {
            position: absolute;
            top: 20%;
            left: 5%;
            width: 600px;
            height: 400px;
            background: radial-gradient(ellipse, rgba(37, 99, 235, 0.3) 0%, rgba(56, 189, 248, 0.1) 50%, transparent 70%);
            z-index: 0;
          }
          .bg-glow-right {
            position: absolute;
            top: 10%;
            right: 0%;
            width: 700px;
            height: 500px;
            background: radial-gradient(ellipse, rgba(14, 165, 233, 0.25) 0%, rgba(99, 102, 241, 0.12) 50%, transparent 70%);
            z-index: 0;
          }
          .left-column {
            position: relative;
            z-index: 2;
            width: 580px;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
          }
          .brand-badge {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 6px 14px;
            border-radius: 999px;
            background: rgba(30, 41, 59, 0.8);
            border: 1px solid rgba(56, 189, 248, 0.35);
            margin-bottom: 20px;
          }
          .brand-badge img {
            width: 18px;
            height: 18px;
            border-radius: 4px;
          }
          .brand-badge span {
            color: #38BDF8;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }
          h1 {
            font-size: 48px;
            font-weight: 800;
            letter-spacing: -0.025em;
            color: #FFFFFF;
            line-height: 1.1;
            margin-bottom: 16px;
          }
          h1 span.gradient {
            background: linear-gradient(135deg, #38BDF8 0%, #60A5FA 50%, #A78BFA 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }
          p.lead {
            font-size: 18px;
            color: #94A3B8;
            line-height: 1.45;
            margin-bottom: 28px;
          }
          .features-grid {
            display: flex;
            gap: 16px;
          }
          .feat-pill {
            background: rgba(15, 23, 42, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 10px;
            padding: 10px 16px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .feat-pill h5 {
            font-size: 14px;
            font-weight: 700;
            color: #F8FAFC;
          }
          .feat-pill p {
            font-size: 11px;
            color: #38BDF8;
          }
          .right-column {
            position: absolute;
            right: -60px;
            top: 50%;
            transform: translateY(-50%) perspective(1200px) rotateY(-14deg) rotateX(4deg);
            z-index: 2;
            width: 780px;
            height: 480px;
            border-radius: 16px;
            background: #0F172A;
            border: 1px solid rgba(56, 189, 248, 0.3);
            box-shadow: 
              0 30px 80px rgba(0, 0, 0, 0.8),
              0 0 50px rgba(37, 99, 235, 0.25);
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .mockup-img-wrap {
            flex: 1;
            overflow: hidden;
          }
          .mockup-img-wrap img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            object-position: top center;
          }
        </style>
      </head>
      <body>
        <div class="bg-grid"></div>
        <div class="bg-glow-left"></div>
        <div class="bg-glow-right"></div>

        <div class="left-column">
          <div class="brand-badge">
            <img src="${logoIcon}" alt="Logo">
            <span>Tab Vault for Chrome</span>
          </div>
          <h1>Fast, Private Tabs. <br><span class="gradient">Bulletproof Recovery.</span></h1>
          <p class="lead">Save up to 95% memory. Instantly collapse cluttered windows with 1-click disaster recovery and 5-state rolling snapshots.</p>
          
          <div class="features-grid">
            <div class="feat-pill">
              <span style="font-size: 20px;">⚡</span>
              <div>
                <h5>-95% RAM Usage</h5>
                <p>Instant tab collapse</p>
              </div>
            </div>
            <div class="feat-pill">
              <span style="font-size: 20px;">🛡️</span>
              <div>
                <h5>Zero Tab Loss</h5>
                <p>Automated backup & restore</p>
              </div>
            </div>
            <div class="feat-pill">
              <span style="font-size: 20px;">🔒</span>
              <div>
                <h5>100% Local-First</h5>
                <p>Zero telemetry or cloud</p>
              </div>
            </div>
          </div>
        </div>

        <div class="right-column">
          <div style="height: 34px; background: #1E293B; display: flex; align-items: center; padding: 0 14px; gap: 8px;">
            <div style="width: 9px; height: 9px; border-radius: 50%; background: #EF4444;"></div>
            <div style="width: 9px; height: 9px; border-radius: 50%; background: #F59E0B;"></div>
            <div style="width: 9px; height: 9px; border-radius: 50%; background: #10B981;"></div>
            <span style="margin-left: 12px; font-size: 11px; color: #94A3B8;">Tab Vault — Intelligent Session Manager</span>
          </div>
          <div class="mockup-img-wrap">
            <img src="${lightUI}" alt="Tab Vault Dashboard">
          </div>
        </div>
      </body>
      </html>
    `
  }
];

async function generateAll() {
  console.log('Launching headless Chromium with Puppeteer...');
  const browser = await puppeteer.launch({
    executablePath: CHROMIUM_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu']
  });

  const screenshotsDir = path.resolve('dist/screenshots');
  const promoDir = path.resolve('dist/promo');
  fs.mkdirSync(screenshotsDir, { recursive: true });
  fs.mkdirSync(promoDir, { recursive: true });

  // 1. Render Screenshots (1280x800)
  for (const tpl of templates) {
    console.log(`Rendering ${tpl.name}...`);
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
    await page.setContent(tpl.html, { waitUntil: 'networkidle0' });
    const outPath = path.join(screenshotsDir, tpl.name);
    await page.screenshot({ path: outPath, type: 'png' });
    console.log(`Saved: ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);

    // If an alias is requested (e.g. tab-vault-light-1280x800.png)
    if (tpl.alias) {
      const aliasPath = path.join(screenshotsDir, tpl.alias);
      fs.copyFileSync(outPath, aliasPath);
      console.log(`Copied alias: ${aliasPath}`);
    }
    await page.close();
  }

  // 2. Render Promo Tiles
  for (const tile of promoTiles) {
    console.log(`Rendering ${tile.name}...`);
    const page = await browser.newPage();
    await page.setViewport({ width: tile.width, height: tile.height, deviceScaleFactor: 1 });
    await page.setContent(tile.html, { waitUntil: 'networkidle0' });
    const outPath = path.join(promoDir, tile.name);
    await page.screenshot({ path: outPath, type: 'png' });
    console.log(`Saved: ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB)`);
    await page.close();
  }

  await browser.close();
  console.log('All store assets generated successfully!');
}

generateAll().catch(err => {
  console.error('Asset generation failed:', err);
  process.exit(1);
});
