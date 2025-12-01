import * as React from "react"
import { ChevronUp, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getDaysInMonth, setDate, setMonth, setYear, getYear, getMonth, getDate, format } from "date-fns"

interface DateScrollPickerProps {
    date: Date | undefined
    setDate: (date: Date | undefined) => void
}

export function DateScrollPicker({ date, setDate: onDateChange }: DateScrollPickerProps) {
    // Default to today if no date is selected
    const currentDate = date || new Date()

    const handleDayChange = (increment: number) => {
        const daysInMonth = getDaysInMonth(currentDate)
        let newDay = getDate(currentDate) + increment
        if (newDay > daysInMonth) newDay = 1
        if (newDay < 1) newDay = daysInMonth
        onDateChange(setDate(currentDate, newDay))
    }

    const handleMonthChange = (increment: number) => {
        let newMonth = getMonth(currentDate) + increment
        if (newMonth > 11) newMonth = 0
        if (newMonth < 0) newMonth = 11
        onDateChange(setMonth(currentDate, newMonth))
    }

    const handleYearChange = (increment: number) => {
        const newYear = getYear(currentDate) + increment
        onDateChange(setYear(currentDate, newYear))
    }

    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ]

    return (
        <div className="flex items-center gap-2 p-4 bg-background border rounded-md shadow-sm w-fit">
            {/* Day Column */}
            <div className="flex flex-col items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDayChange(1)}>
                    <ChevronUp className="h-4 w-4" />
                </Button>
                <div className="text-lg font-bold w-12 text-center select-none">
                    {format(currentDate, "dd")}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDayChange(-1)}>
                    <ChevronDown className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground uppercase">Day</span>
            </div>

            <div className="h-12 w-px bg-border mx-1" />

            {/* Month Column */}
            <div className="flex flex-col items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMonthChange(1)}>
                    <ChevronUp className="h-4 w-4" />
                </Button>
                <div className="text-lg font-bold w-16 text-center select-none">
                    {months[getMonth(currentDate)]}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMonthChange(-1)}>
                    <ChevronDown className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground uppercase">Month</span>
            </div>

            <div className="h-12 w-px bg-border mx-1" />

            {/* Year Column */}
            <div className="flex flex-col items-center gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleYearChange(1)}>
                    <ChevronUp className="h-4 w-4" />
                </Button>
                <div className="text-lg font-bold w-16 text-center select-none">
                    {format(currentDate, "yyyy")}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleYearChange(-1)}>
                    <ChevronDown className="h-4 w-4" />
                </Button>
                <span className="text-xs text-muted-foreground uppercase">Year</span>
            </div>
        </div>
    )
}
