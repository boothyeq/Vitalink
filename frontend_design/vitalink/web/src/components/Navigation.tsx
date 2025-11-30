import { useEffect, useState } from "react"
import { NavLink } from "@/components/NavLink"
import { Heart, LayoutDashboard, Activity, BookOpen, MessageCircle, Menu, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { supabase } from "@/lib/supabase"

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/vitals", label: "Vitals Tracker", icon: Activity },
  { to: "/education", label: "Education", icon: BookOpen },
  { to: "/contact", label: "Get in Touch", icon: MessageCircle },
]

export default function Navigation() {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    function checkAdminStatus() {
      const sessionData = localStorage.getItem("adminSession");
      if (sessionData) {
        try {
          const session = JSON.parse(sessionData);
          const loginTime = new Date(session.loginTime);
          const now = new Date();
          const hoursSinceLogin = (now.getTime() - loginTime.getTime()) / (1000 * 60 * 60);

          // Session expires after 8 hours
          if (hoursSinceLogin <= 8) {
            setIsAdmin(true);
          } else {
            localStorage.removeItem("adminSession");
            setIsAdmin(false);
          }
        } catch {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    }

    checkAdminStatus();
    // Check periodically in case session expires
    const interval = setInterval(checkAdminStatus, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [])

  const items = isAdmin
    ? [...navItems, { to: "/admin/patients", label: "Admin", icon: Users }]
    : navItems

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Heart className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xl font-bold text-foreground">VitaLink</span>
          </div>
          <div className="hidden md:flex items-center gap-1">
            {items.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
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
                  {items.map((item) => {
                    const Icon = item.icon
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
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