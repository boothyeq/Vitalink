import { Toaster } from "./components/ui/toaster"
import { Toaster as Sonner } from "./components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { ThemeProvider } from "next-themes"
import Navigation from "./components/Navigation"
import Dashboard from "./pages/Dashboard"
import VitalsTracker from "./pages/VitalsTracker"
import Education from "./pages/Education"
import Contact from "./pages/Contact"
import NotFound from "./pages/NotFound"
import Register from "./pages/Register"
import Login from "./pages/Login"

const queryClient = new QueryClient()

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <Navigation />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/vitals" element={<VitalsTracker />} />
            <Route path="/education" element={<Education />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
)

export default App