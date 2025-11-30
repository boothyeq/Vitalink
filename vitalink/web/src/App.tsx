import { Toaster } from "./components/ui/toaster"
import { Toaster as Sonner } from "./components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import { ThemeProvider } from "next-themes"
import Navigation from "./components/Navigation"
import Dashboard from "./pages/Dashboard"
import Education from "./pages/Education"
import SelfCheck from "./pages/SelfCheck"
import ScheduleReminder from "./pages/ScheduleReminder"
import Medication from "./pages/Medication"
import NotFound from "./pages/NotFound"
import Register from "./pages/Register"
import Login from "./pages/Login"
import RequireAuth from "./components/RequireAuth"

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
            <Route path="/" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
            <Route path="/education" element={<RequireAuth><Education /></RequireAuth>} />
            <Route path="/self-check" element={<RequireAuth><SelfCheck /></RequireAuth>} />
            <Route path="/schedule" element={<RequireAuth><ScheduleReminder /></RequireAuth>} />
            <Route path="/medication" element={<RequireAuth><Medication /></RequireAuth>} />
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
