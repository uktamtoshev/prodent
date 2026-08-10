import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface DoctorDailyIncomeChartProps {
  data: Array<{ date: string; value: number }>;
  doctorId: string;
  doctorType: string;
  revenueLabel: string;
}

interface ClinicIncomeComparisonChartProps {
  data: Array<{ name: string; value: number; fill: string }>;
  incomeLabel: string;
}

export function DoctorDailyIncomeChart({
  data,
  doctorId,
  doctorType,
  revenueLabel,
}: DoctorDailyIncomeChartProps) {
  const color = doctorType === "staff_doctor" ? "#10b981" : "#f59e0b";
  const gradientId = `gradient-${doctorId}`;

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          fill={`url(#${gradientId})`}
          strokeWidth={2}
        />
        <XAxis dataKey="date" fontSize={10} stroke="hsl(var(--muted-foreground))" />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
          formatter={(value: number) => [`${value.toLocaleString()} UZS`, revenueLabel]}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ClinicIncomeComparisonChart({
  data,
  incomeLabel,
}: ClinicIncomeComparisonChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
        <YAxis stroke="hsl(var(--muted-foreground))" />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
          }}
          formatter={(value: number) => [`${value.toLocaleString()} UZS`, incomeLabel]}
        />
        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`${entry.name}-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
