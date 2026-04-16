import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, addDays, startOfWeek, addWeeks, addMonths, startOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { DayView } from "./calendar/DayView";
import { WeekView } from "./calendar/WeekView";
import { MonthView } from "./calendar/MonthView";

type ViewType = "day" | "week" | "month";

export function CalendarSchedule() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>("week");

  const handlePrevious = () => {
    if (view === "day") {
      setCurrentDate((prev) => addDays(prev, -1));
    } else if (view === "week") {
      setCurrentDate((prev) => addWeeks(prev, -1));
    } else {
      setCurrentDate((prev) => addMonths(prev, -1));
    }
  };

  const handleNext = () => {
    if (view === "day") {
      setCurrentDate((prev) => addDays(prev, 1));
    } else if (view === "week") {
      setCurrentDate((prev) => addWeeks(prev, 1));
    } else {
      setCurrentDate((prev) => addMonths(prev, 1));
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getDateRangeText = () => {
    if (view === "day") {
      return format(currentDate, "d MMMM yyyy, EEEE", { locale: ru });
    } else if (view === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = addDays(start, 6);
      return `${format(start, "d MMM", { locale: ru })} - ${format(end, "d MMM yyyy", { locale: ru })}`;
    } else {
      return format(currentDate, "LLLL yyyy", { locale: ru });
    }
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700">
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevious}
              className="border-slate-600 hover:bg-slate-700"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-[200px] text-center">
              <h2 className="text-xl font-semibold text-white capitalize">
                {getDateRangeText()}
              </h2>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNext}
              className="border-slate-600 hover:bg-slate-700"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              onClick={handleToday}
              className="border-slate-600 hover:bg-slate-700"
            >
              <CalendarIcon className="w-4 h-4 mr-2" />
              Сегодня
            </Button>
          </div>

          <Tabs value={view} onValueChange={(v) => setView(v as ViewType)}>
            <TabsList className="bg-slate-700">
              <TabsTrigger value="day">День</TabsTrigger>
              <TabsTrigger value="week">Неделя</TabsTrigger>
              <TabsTrigger value="month">Месяц</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {view === "day" && <DayView selectedDate={currentDate} onDateChange={setCurrentDate} />}
        {view === "week" && <WeekView selectedDate={currentDate} onDateChange={setCurrentDate} />}
        {view === "month" && <MonthView selectedDate={currentDate} onDateChange={setCurrentDate} />}
      </CardContent>
    </Card>
  );
}
