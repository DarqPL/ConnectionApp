import { useEffect, useState } from "react"
import { Navigate, useLocation } from "react-router"
import { useAuthStore } from "@/stores/useAuthStore"

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const accessToken = localStorage.getItem("accessToken")
  const { fetchMe, user } = useAuthStore()
  const [checking, setChecking] = useState(true)
  const location = useLocation()

  useEffect(() => {
    if (!accessToken) {
      setChecking(false)
      return
    }

    let cancelled = false
    fetchMe().finally(() => {
      if (!cancelled) setChecking(false)
    })

    return () => {
      cancelled = true
    }
  }, [accessToken, fetchMe])

  if (!accessToken) {
    return <Navigate to="/signin" state={{ from: location }} replace />
  }

  if (checking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/signin" state={{ from: location }} replace />
  }

  if (user.role === "ADMIN" && location.pathname === "/") {
    return <Navigate to="/admin" replace />
  }

  return <>{children}</>
}

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const accessToken = localStorage.getItem("accessToken")

  if (accessToken) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const accessToken = localStorage.getItem("accessToken")
  const { fetchMe, user } = useAuthStore()
  const [checking, setChecking] = useState(true)
  const location = useLocation()

  useEffect(() => {
    if (!accessToken) {
      setChecking(false)
      return
    }

    let cancelled = false
    fetchMe().finally(() => {
      if (!cancelled) setChecking(false)
    })

    return () => {
      cancelled = true
    }
  }, [accessToken, fetchMe])

  if (!accessToken) {
    return <Navigate to="/signin" state={{ from: location }} replace />
  }

  if (checking) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/signin" state={{ from: location }} replace />
  }

  if (user.role !== "ADMIN") {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
