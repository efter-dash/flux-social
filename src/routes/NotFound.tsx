import { useNavigate } from 'react-router-dom'
import { Button, EmptyState } from '@/components/ui/primitives'

export function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="py-16">
      <EmptyState
        icon="search"
        title="Nothing here"
        blurb="That page does not exist in this workspace."
        action={
          <Button icon="arrow-left" onClick={() => navigate('/')}>
            Back to dashboard
          </Button>
        }
      />
    </div>
  )
}
