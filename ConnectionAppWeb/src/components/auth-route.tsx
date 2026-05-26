import { useEffect, useRef } from "react"
import { Navigate, useLocation } from "react-router"
import { useAuthStore } from "@/stores/useAuthStore"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { accessToken, user, fetchMe } = useAuthStore()
  const hasFetched = useRef(false)
  const location = useLocation()

  useEffect(() => {
    if (!accessToken) return
    if (user) return
    if (hasFetched.current) return

    hasFetched.current = true
    fetchMe()
  }, [accessToken, user, fetchMe])

  if (!accessToken) {
    return <Navigate to="/signin" state={{ from: location }} replace />
  }

  if (!user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (user.role === "ADMIN" && location.pathname === "/") {
    return <Navigate to="/admin" replace />
  }

  return <>{children}</>
}

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuthStore()

  if (accessToken) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { accessToken, user, fetchMe } = useAuthStore()
  const hasFetched = useRef(false)
  const location = useLocation()

  useEffect(() => {
    if (!accessToken) return
    if (user) return
    if (hasFetched.current) return

    hasFetched.current = true
    fetchMe()
  }, [accessToken, user, fetchMe])

  if (!accessToken) {
    return <Navigate to="/signin" state={{ from: location }} replace />
  }

  if (!user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (user.role !== "ADMIN") {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
