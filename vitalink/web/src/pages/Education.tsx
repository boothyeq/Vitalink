import { Card } from "@/components/ui/card"
import { Heart, AlertCircle, Activity, Users, BookOpen } from "lucide-react"
import * as React from "react"

const modules = [
  {
    id: "A",
    title: "Understanding Heart Failure",
    description: "Learn the basics about heart failure, how it affects your body, and what it means for your daily life.",
    icon: Heart,
    color: "bg-primary/10 text-primary",
    url: "https://www.heartfailurematters.org/understanding-heart-failure/",
  },
  {
    id: "B",
    title: "Causes & Related Conditions",
    description: "Explore the common causes of heart failure and other medical conditions that may be related.",
    icon: Activity,
    color: "bg-secondary/10 text-secondary",
    url: "https://www.heartfailurematters.org/heart-failure-causes-and-other-common-medical-conditions/",
  },
  {
    id: "C",
    title: "What You Can Do",
    description: "Practical steps and lifestyle changes you can make to manage your heart failure effectively.",
    icon: BookOpen,
    color: "bg-chart-3/10 text-warning",
    url: "https://www.heartfailurematters.org/what-you-can-do/",
  },
  {
    id: "D",
    title: "Living with Heart Failure",
    description: "Tips and strategies for maintaining quality of life while managing heart failure.",
    icon: Activity,
    color: "bg-chart-2/10 text-secondary",
    url: "https://www.heartfailurematters.org/living-with-heart-failure/",
  },
  {
    id: "E",
    title: "For Caregivers",
    description: "Essential information and support resources for family members and caregivers.",
    icon: Users,
    color: "bg-chart-5/10 text-chart-5",
    url: "https://www.heartfailurematters.org/for-caregivers/",
  },
  {
    id: "H",
    title: "Warning Signs",
    description: "Learn to recognize important warning signs and when to seek immediate medical attention.",
    icon: AlertCircle,
    color: "bg-accent/10 text-accent",
    url: "https://www.heartfailurematters.org/warning-signs/",
  },
]

export default function Education() {
  const [query, setQuery] = React.useState("")
  const filtered = modules.filter((m) => {
    const q = query.trim().toLowerCase()
    if (!q) return true
    return (
      m.id.toLowerCase().includes(q) ||
      m.title.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q)
    )
  })
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Educational Resources</h1>
          <p className="text-muted-foreground">Learn about heart failure management through our comprehensive modules</p>
        </div>
        <div className="mb-6">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search modules"
            aria-label="Search educational modules"
            className="w-full md:w-96 px-4 py-2 rounded-md border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((module) => {
            const Icon = module.icon
            return (
              <a
                key={module.id}
                href={module.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
                aria-label={`Open ${module.title} (Module ${module.id}) in new tab`}
              >
                <Card className="p-6 hover:shadow-lg transition-all cursor-pointer h-full">
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`p-3 rounded-lg ${module.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div className="flex-1">
                      <div className="text-xs font-semibold text-muted-foreground mb-1">Module {module.id}</div>
                      <h3 className="font-bold text-lg text-foreground mb-2">{module.title}</h3>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-3">{module.description}</p>
                </Card>
              </a>
            )
          })}
        </div>

        <Card className="mt-8 p-6 bg-primary/5 border-primary/20">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <BookOpen className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg text-foreground mb-2">Educational Content Features</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Written guides and articles
                </li>
                <li className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Interactive learning modules
                </li>
              </ul>
              <p className="text-xs text-muted-foreground mt-4">Content adapted from Heart Failure Matters</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}