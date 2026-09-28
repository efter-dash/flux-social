import React from 'react'
import { useOnlineStatus } from '@/lib/useOnlineStatus'

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus()

  if (isOnline) return null

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg border border-amber/30 bg-sunken/95 px-3 py-2 text-body-xs font-medium text-amber shadow-ambient backdrop-blur-md">
      <span className="h-2 w-2 rounded-full bg-amber animate-pulse" />
      <span>Offline Mode — All data is preserved locally in IndexedDB</span>
    </div>
  )
}
