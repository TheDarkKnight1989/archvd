'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { User, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface UserProfileMenuProps {
  className?: string
}

export function UserProfileMenu({ className }: UserProfileMenuProps) {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUser() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        setUser(user)
      } catch (error) {
        console.error('Error fetching user:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/auth/sign-in')
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  const userInitial = user?.email?.[0]?.toUpperCase() || 'U'
  const userEmail = user?.email || 'user@example.com'
  const userName = user?.user_metadata?.display_name || userEmail.split('@')[0]

  if (loading) {
    return (
      <div className={cn("h-9 w-9 rounded-full bg-elev-2 animate-pulse", className)} />
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="User menu"
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full",
            "bg-gradient-to-br from-accent/30 to-accent/10 border border-accent/20",
            "hover:border-accent/40 hover:from-accent/40 hover:to-accent/20",
            "transition-all duration-200",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            "active:scale-95",
            className
          )}
        >
          <span className="text-sm font-bold text-accent-foreground">{userInitial}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium text-fg">{userName}</p>
            <p className="text-xs text-muted">{userEmail}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push('/profile')}
          className="cursor-pointer hover:bg-elev-3 focus:bg-elev-3"
        >
          <User className="mr-2 h-4 w-4" />
          <span>My Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push('/settings')}
          className="cursor-pointer hover:bg-elev-3 focus:bg-elev-3"
        >
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="cursor-pointer hover:bg-red-500/10 focus:bg-red-500/10 text-red-400 focus:text-red-400"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
