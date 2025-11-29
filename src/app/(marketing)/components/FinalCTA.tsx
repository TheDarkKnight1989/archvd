'use client'

import Link from 'next/link'
import { ArrowRight, Instagram } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DiscordIcon } from '@/components/icons/DiscordIcon'

export function FinalCTA() {
  return (
    <section className="relative py-20 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-to-t from-accent/10 via-transparent to-transparent pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl md:text-5xl font-bold text-fg mb-6">
          Ready To Turn Chaos Into <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-blue-400">Clarity?</span>
        </h2>
        <p className="text-lg md:text-xl text-muted mb-8 max-w-2xl mx-auto">
          Join our alpha users and be part of shaping the future of reseller analytics.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link href="/auth/sign-up">
            <Button size="lg" className="px-10 py-6 text-base !bg-accent !text-white">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
          <Link href="/auth/sign-in" className="text-muted hover:text-fg transition-colors">
            Already Have An Account? <span className="text-accent">Sign In</span>
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-border/30">
          <div className="flex flex-col gap-6">
            {/* Social Links */}
            <div className="flex items-center justify-center gap-4">
              <a
                href="https://discord.gg/6S7N92EYMa"
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2 px-4 py-2 rounded-lg border border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all"
              >
                <DiscordIcon className="h-5 w-5 text-purple-400" />
                <span className="text-sm text-purple-400 font-medium">Join Our Community</span>
              </a>
              <a
                href="https://www.instagram.com/archvd.io"
                target="_blank"
                rel="noopener noreferrer"
                className="group p-3 rounded-lg border border-border/30 hover:border-pink-500/50 hover:bg-pink-500/10 transition-all"
              >
                <Instagram className="h-5 w-5 text-muted group-hover:text-pink-400 transition-colors" />
              </a>
            </div>

            {/* Links & Copyright */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted">
              <div className="flex items-center gap-6">
                <Link href="/privacy" className="hover:text-fg transition-colors">
                  Privacy
                </Link>
                <Link href="/terms" className="hover:text-fg transition-colors">
                  Terms
                </Link>
                <a href="mailto:hello@archvd.io" className="hover:text-fg transition-colors">
                  Contact
                </a>
              </div>
              <div>
                © {new Date().getFullYear()} Archvd. Built for collectors and resellers.
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
