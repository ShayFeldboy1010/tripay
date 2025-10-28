"use client"

import { motion } from "framer-motion"
import { Receipt, Users, TrendingUp } from "lucide-react"
import { formatILS } from "@/lib/supabase/client"

interface TotalBalanceProps {
  amount: number
  totalExpenses: number
  participantCount: number
  averageExpense: number
}

export function TotalBalance({ amount, totalExpenses, participantCount, averageExpense }: TotalBalanceProps) {
  const totalFormatted = formatILS(amount)
  const averageFormatted = formatILS(averageExpense)

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-8 backdrop-blur md:p-10"
    >
      <div className="pointer-events-none absolute -right-10 top-0 h-32 w-32 rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 left-4 h-28 w-28 rounded-full bg-white/5 blur-2xl" />

      <div className="relative space-y-8">
        <div className="space-y-2 text-center">
          <p className="text-sm uppercase tracking-[0.4em] text-white/60">יתרת הטיול</p>
          <p
            dir="ltr"
            className="grad-text numeric-display text-[clamp(2.5rem,8vw,4.5rem)] font-extrabold leading-none tracking-tight"
          >
            {totalFormatted}
          </p>
          <p className="text-base text-white/70">סכום מצטבר של כל ההוצאות ששויכו לטיול הזה</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3" dir="ltr">
          {[
            {
              icon: Receipt,
              label: "סה״כ הוצאות",
              value: totalExpenses.toLocaleString(),
            },
            {
              icon: Users,
              label: "משתתפים",
              value: participantCount.toLocaleString(),
            },
            {
              icon: TrendingUp,
              label: "ממוצע הוצאה",
              value: averageFormatted,
            },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="glass-sm flex items-center justify-between rounded-2xl px-4 py-3 text-left sm:flex-col sm:items-center sm:gap-3 sm:text-center"
            >
              <div className="flex items-center gap-3 sm:flex-col sm:gap-2">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10">
                  <Icon className="h-4 w-4 text-white/80" />
                </span>
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-[0.3em] text-white/50">{label}</p>
                  <p className="numeric-display text-lg font-semibold text-white" dir="ltr">
                    {value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}
