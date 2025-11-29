'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Menu, X, Instagram } from 'lucide-react'
import { DiscordIcon } from '@/components/icons/DiscordIcon'
import { useState } from 'react'

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'FAQ', href: '#faq' },
]

export function NavBar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const scrollToSection = (href: string) => {
    if (href.startsWith('#')) {
      const element = document.querySelector(href)
      element?.scrollIntoView({ behavior: 'smooth' })
      setMobileMenuOpen(false)
    }
  }

  return (
    <nav className="sticky top-0 z-50 bg-bg/90 backdrop-blur-md border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/logo.png"
              alt="Archvd - UK Reseller Analytics & Collection Tracker"
              width={280}
              height={84}
              className="h-16 w-auto"
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  if (link.href.startsWith('#')) {
                    e.preventDefault()
                    scrollToSection(link.href)
                  }
                }}
                className="relative text-sm text-muted hover:text-fg transition-colors group"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-accent group-hover:w-full transition-all duration-300 shadow-[0_0_8px_rgba(var(--archvd-accent-rgb),0.6)]" />
              </Link>
            ))}
          </div>

          {/* Desktop Auth & Social Buttons */}
          <div className="hidden md:flex items-center gap-3">
            {/* Social Icons */}
            <a
              href="https://discord.gg/6S7N92EYMa"
              target="_blank"
              rel="noopener noreferrer"
              className="relative group"
            >
              <Button variant="outline" className="gap-2 border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-500/10">
                <DiscordIcon className="h-4 w-4 text-purple-400" />
                <span className="text-purple-400">Community</span>
                {/* Pulse effect */}
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                </span>
              </Button>
            </a>
            <a
              href="https://www.instagram.com/archvd.io"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-md hover:bg-elev-1 transition-colors"
            >
              <Instagram className="h-5 w-5 text-muted hover:text-pink-400 transition-colors" />
            </a>

            {/* Auth Buttons */}
            <Link href="/auth/sign-in">
              <Button variant="ghost">
                Log in
              </Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button className="!bg-accent !text-white">
                Create account
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-md hover:bg-elev-1 transition-colors"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6 text-fg" />
            ) : (
              <Menu className="h-6 w-6 text-fg" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border/50 bg-bg">
          <div className="px-4 py-4 space-y-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={(e) => {
                  if (link.href.startsWith('#')) {
                    e.preventDefault()
                    scrollToSection(link.href)
                  } else {
                    setMobileMenuOpen(false)
                  }
                }}
                className="relative block py-2 text-sm text-muted hover:text-fg transition-colors group"
              >
                {link.label}
                <span className="absolute bottom-1 left-0 w-0 h-0.5 bg-accent group-hover:w-full transition-all duration-300 shadow-[0_0_8px_rgba(var(--archvd-accent-rgb),0.6)]" />
              </Link>
            ))}
            <div className="pt-3 border-t border-border/30 space-y-2">
              {/* Social Links */}
              <a
                href="https://discord.gg/6S7N92EYMa"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button variant="outline" className="w-full gap-2 border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-500/10">
                  <DiscordIcon className="h-4 w-4 text-purple-400" />
                  <span className="text-purple-400">Join Discord Community</span>
                </Button>
              </a>
              <a
                href="https://www.instagram.com/archvd.io"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Button variant="outline" className="w-full gap-2">
                  <Instagram className="h-4 w-4 text-pink-400" />
                  <span>Follow on Instagram</span>
                </Button>
              </a>

              {/* Auth Buttons */}
              <Link href="/auth/sign-in" className="block" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="ghost" className="w-full">
                  Log in
                </Button>
              </Link>
              <Link href="/auth/sign-up" className="block" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full !bg-accent !text-white">
                  Create account
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
