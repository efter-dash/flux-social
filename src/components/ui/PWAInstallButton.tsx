import React, { useState } from 'react'
import { usePWAInstall } from '@/lib/usePWAInstall'
import { Button } from './primitives'
import { Sheet } from './Overlay'
import { Icon } from './Icon'

interface PWAInstallButtonProps {
  variant?: 'primary' | 'ghost' | 'quiet' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  className?: string
  showIcon?: boolean
  label?: string
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'ghost',
  size = 'sm',
  className = '',
  showIcon = true,
  label = 'Install Desktop App',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall()
  const [guideOpen, setGuideOpen] = useState(false)

  // If already running as an installed standalone app
  if (isInstalled) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 text-label-micro uppercase font-mono text-emerald bg-emerald/10 border border-emerald/20 rounded">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
        <span>Desktop App</span>
      </div>
    )
  }

  const handleInstallClick = async () => {
    if (isInstallable) {
      const outcome = await install()
      if (!outcome) {
        setGuideOpen(true)
      }
    } else {
      setGuideOpen(true)
    }
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        icon={showIcon ? 'download' : undefined}
        onClick={handleInstallClick}
        className={className}
        title="Download and install FLUX as a standalone desktop app"
      >
        {label}
      </Button>

      {guideOpen && (
        <Sheet
          open={guideOpen}
          onClose={() => setGuideOpen(false)}
          title="Install FLUX for Desktop"
          subtitle="Run locally with zero browser tabs, full offline storage, and Ollama integration"
          size="md"
        >
          <div className="space-y-4 text-body-sm text-ink-dim">
            <div className="flex items-center gap-3.5 rounded-lg border border-line/40 bg-sunken/40 p-3">
              <img
                src="/pwa-192x192.png"
                alt="FLUX Desktop App Icon"
                className="h-14 w-14 rounded-2xl shadow-md border border-line/40 shrink-0 bg-void"
              />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink text-body-base">FLUX Desktop</div>
                <div className="text-body-xs text-ink-dim">Standalone Mac application icon configured with the 8-pointed starflare emblem.</div>
              </div>
            </div>

            <div className="rounded-lg border border-line/40 bg-sunken/40 p-3 space-y-2">
              <div className="flex items-center gap-2 text-ink font-semibold text-body-base">
                <Icon name="sparkle" size={18} className="text-primary" />
                <span>Why run as a desktop app on Mac?</span>
              </div>
              <ul className="space-y-1.5 text-body-xs list-disc list-inside text-ink-dim pl-1">
                <li><strong className="text-ink">Offline First:</strong> All your workspace data, content, and tasks persist locally in IndexedDB.</li>
                <li><strong className="text-ink">Local LLM (Ollama) Integration:</strong> Direct connection to your on-device models (<code className="text-primary font-mono">http://localhost:11434</code>) without cloud subscriptions or data leaks.</li>
                <li><strong className="text-ink">Dedicated Window & Dock:</strong> Custom Mac Dock launcher, custom titlebar, and zero distracting browser clutter.</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="text-label-caps text-ink-faint">Installation steps</h4>

              {isInstallable ? (
                <div className="rounded-md border border-primary/30 bg-primary/10 p-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-ink text-body-sm">One-Click Install Ready</div>
                    <div className="text-body-xs text-ink-dim">Your browser supports direct installation.</div>
                  </div>
                  <Button variant="primary" size="sm" icon="download" onClick={install}>
                    Install Now
                  </Button>
                </div>
              ) : isIOS ? (
                <div className="rounded-md border border-line/40 bg-sunken/60 p-3 text-body-xs space-y-1.5">
                  <div className="font-semibold text-ink">Apple Safari / iOS</div>
                  <div>1. Tap the <strong className="text-ink">Share</strong> button in the Safari toolbar.</div>
                  <div>2. Scroll down and tap <strong className="text-ink">Add to Home Screen</strong>.</div>
                  <div>3. Launch FLUX directly from your home screen.</div>
                </div>
              ) : (
                <div className="space-y-2 text-body-xs">
                  <div className="rounded-md border border-line/40 bg-sunken/60 p-3 space-y-1.5">
                    <div className="font-semibold text-ink">Google Chrome / Edge / Brave (Desktop)</div>
                    <div>1. Click the <strong className="text-ink">Install FLUX</strong> icon in the right side of the URL address bar (a computer monitor with down-arrow).</div>
                    <div>2. Or click the browser <strong className="text-ink">Menu (⋮) → "Save and share" → "Install FLUX..."</strong></div>
                    <div>3. The app opens in its own standalone window and adds a desktop shortcut.</div>
                  </div>
                  <div className="rounded-md border border-line/40 bg-sunken/60 p-3 space-y-1.5">
                    <div className="font-semibold text-ink">macOS Safari</div>
                    <div>Click <strong className="text-ink">File → Add to Dock...</strong> to run as a macOS desktop app.</div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <Button variant="ghost" onClick={() => setGuideOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        </Sheet>
      )}
    </>
  )
}
