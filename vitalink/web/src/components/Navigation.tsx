import { useEffect, useState } from "react"
import { NavLink } from "@/components/NavLink"
import { Heart, LayoutDashboard, Activity, BookOpen, MessageCircle, Menu, ClipboardList, CalendarDays } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { supabase } from "@/lib/supabase"

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/vitals", label: "Vitals Tracker", icon: Activity },
  { to: "/self-check", label: "Self Check", icon: ClipboardList },
  { to: "/schedule", label: "Schedule", icon: CalendarDays },
  { to: "/education", label: "Education", icon: BookOpen },
  { to: "/contact", label: "Get in Touch", icon: MessageCircle },
]

export default function Navigation() {
  const [pid, setPid] = useState<string | undefined>(
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("patientId") || undefined : undefined
  )
  useEffect(() => {
    let mounted = true
    async function init() {
      if (pid) return
      const { data } = await supabase.auth.getSession()
      const id = data?.session?.user?.id || undefined
      if (mounted) setPid(id)
    }
    init()
    return () => { mounted = false }
  }, [pid])
  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Heart className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xl font-bold text-foreground">MyHFGuard</span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to === "/schedule" && pid ? `${item.to}?patientId=${encodeURIComponent(pid)}` : item.to}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                  activeClassName="text-primary bg-primary/10 font-medium"
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              )
            })}
          </div>
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon">
                  <Menu className="w-6 h-6" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <div className="flex flex-col gap-4 mt-8">
                  {navItems.map((item) => {
                    const Icon = item.icon
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to === "/schedule" && pid ? `${item.to}?patientId=${encodeURIComponent(pid)}` : item.to}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                        activeClassName="text-primary bg-primary/10 font-medium"
                      >
                        <Icon className="w-5 h-5" />
                        {item.label}
                      </NavLink>
                    )
                  })}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  )
}
