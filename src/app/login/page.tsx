'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/ThemeToggle'

const loginSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

type LoginForm = z.infer<typeof loginSchema>

function dashboardForRole(role: string | undefined): string {
  return role === 'admin' ? '/admin/dashboard' : '/supervisor/dashboard'
}

function BrandLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Image
      src="/AnuranjanLogo.png"
      alt="Anuranjan Infratech Resources Pvt. Ltd."
      width={255}
      height={56}
      priority
      unoptimized
      className={compact ? 'h-8 w-auto object-contain' : 'h-10 w-auto object-contain'}
    />
  )
}

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [showPassword, setShowPassword] = useState(false)

  // If a valid session already exists, skip the form and route by role.
  useEffect(() => {
    let active = true
    authClient
      .getSession()
      .then((session) => {
        if (!active) return
        const role = session.data?.user?.role as string | undefined
        if (role) {
          router.replace(dashboardForRole(role))
        } else {
          setCheckingSession(false)
        }
      })
      .catch(() => {
        // Never hang on the splash if the session check fails — show the form.
        if (active) setCheckingSession(false)
      })
    return () => {
      active = false
    }
  }, [router])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  async function onSubmit(data: LoginForm) {
    setError(null)
    const result = await authClient.signIn.email({
      email: data.email,
      password: data.password,
    })

    if (result.error) {
      setError(result.error.message ?? 'Invalid email or password')
      return
    }

    const session = await authClient.getSession()
    const role = session.data?.user?.role as string | undefined
    router.push(dashboardForRole(role))
  }

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
          <span className="size-2 animate-pulse rounded-full bg-[#d71920]" />
          Checking workspace access...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <div className="fixed right-4 top-4 z-30">
        <ThemeToggle />
      </div>

      <main className="grid min-h-screen lg:grid-cols-[minmax(0,1.08fr)_minmax(460px,0.92fr)]">
        <section className="relative hidden overflow-hidden bg-[#17213d] text-white lg:block">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.05)_1px,transparent_1px)] bg-[size:72px_72px]" />
          <div className="absolute inset-x-0 top-0 h-1.5 bg-[#d71920]" />

          <div className="relative flex min-h-screen flex-col justify-between px-12 py-10 xl:px-16">
            <BrandLogo />

            <div className="max-w-2xl space-y-6">
              <h1 className="max-w-xl text-5xl font-semibold leading-[1.05] xl:text-6xl">
                Sign in to your workspace.
              </h1>
              <p className="max-w-lg text-lg leading-8 text-white/72">
                Access attendance, workers, and site operations from one place.
              </p>
            </div>

            <div className="h-10" />
          </div>
        </section>

        <section className="relative flex min-h-screen items-center justify-center px-4 py-14 sm:px-6 lg:px-10">
          <div className="relative w-full max-w-[28rem]">
            <div className="mb-8 flex items-center justify-between gap-4 lg:hidden">
              <BrandLogo compact />
            </div>

            <div className="rounded-lg border bg-card p-6 shadow-sm sm:p-7">
              <div className="mb-7 space-y-2">
                <h2 className="text-2xl font-semibold tracking-normal text-card-foreground">
                  Sign in
                </h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Enter your email and password to continue.
                </p>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      {...register('email')}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        className="pr-10"
                        {...register('password')}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 size-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowPassword((visible) => !visible)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        title={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </Button>
                    </div>
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password.message}</p>
                    )}
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button
                    type="submit"
                    size="lg"
                    className="h-11 w-full bg-[#d71920] text-base text-white hover:bg-[#b9151c]"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      'Signing in...'
                    ) : (
                      <>
                        Sign in
                        <ArrowRight className="size-4" />
                      </>
                    )}
                  </Button>
              </form>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
