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
      className="relative glass p-8 md:p-10 rounded-[28px] overflow-hidden"
    >
      <div className="absolute top-4 right-4 w-20 h-20 bg-white/10 rounded-full blur-xl" />
      <div className="absolute bottom-6 left-6 w-16 h-16 bg-white/5 rounded-full blur-lg" />

      <div className="relative space-y-6">
        <div className="text-center space-y-2">
          <p className="text-sm uppercase tracking-[0.4em] text-white/60">יתרת הטיול</p>
          <p
            dir="ltr"
            className="grad-text numeric-display text-[clamp(2.75rem,9vw,4.75rem)] font-extrabold tracking-tight leading-none text-center"
          >
            {totalFormatted}
          </p>
          <p className="text-base text-white/70">סכום מצטבר של כל ההוצאות ששויכו לטיול הזה</p>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-8">
          <div className="text-center glass-sm p-4" dir="ltr">
            <Receipt className="mx-auto h-5 w-5 text-white/70" />
            <p className="mt-2 text-xs text-white/60">סה״כ הוצאות</p>
            <p className="mt-1 text-lg font-semibold text-white numeric-display">{totalExpenses}</p>
          </div>
          <div className="text-center glass-sm p-4" dir="ltr">
            <Users className="mx-auto h-5 w-5 text-white/70" />
            <p className="mt-2 text-xs text-white/60">משתתפים</p>
            <p className="mt-1 text-lg font-semibold text-white numeric-display">{participantCount}</p>
          </div>
          <div className="text-center glass-sm p-4" dir="ltr">
            <TrendingUp className="mx-auto h-5 w-5 text-white/70" />
            <p className="mt-2 text-xs text-white/60">ממוצע הוצאה</p>
            <p className="mt-1 text-lg font-semibold text-white numeric-display">{averageFormatted}</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
