import { Moon, Sun } from "lucide-react"
import * as React from "react"
import { useTheme } from "next-themes"

const ThemeToggle: React.FC = () => {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const toggleTheme = () => setTheme(isDark ? "light" : "dark")
  return (
    <button
      onClick={toggleTheme}
      className="fixed bottom-6 right-6 inline-flex items-center justify-center rounded-full p-3 bg-muted text-foreground shadow-lg hover:bg-muted/80"
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  )
}

export default ThemeToggle