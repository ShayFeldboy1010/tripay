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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="glass relative overflow-hidden p-6 md:p-8"
    >
      <div className="space-y-6">
        <div className="space-y-1.5 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-white/40">יתרת הטיול</p>
          <p
            dir="ltr"
            className="grad-text numeric-display text-[clamp(2rem,7vw,3.5rem)] font-bold leading-none tracking-tight"
          >
            {totalFormatted}
          </p>
          <p className="text-sm text-white/40">סכום מצטבר של כל ההוצאות ששויכו לטיול הזה</p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3" dir="ltr">
          {[
            { icon: Receipt, label: "סה״כ הוצאות", value: totalExpenses.toLocaleString() },
            { icon: Users, label: "משתתפים", value: participantCount.toLocaleString() },
            { icon: TrendingUp, label: "ממוצע הוצאה", value: averageFormatted },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="flex items-center justify-between rounded-xl bg-white/4 px-3 py-2.5 sm:flex-col sm:items-center sm:gap-2 sm:text-center"
            >
              <div className="flex items-center gap-2.5 sm:flex-col sm:gap-1.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/6">
                  <Icon className="h-3.5 w-3.5 text-white/50" />
                </span>
                <div className="space-y-0.5">
                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/35">{label}</p>
                  <p className="numeric-display text-base font-semibold text-white" dir="ltr">
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
