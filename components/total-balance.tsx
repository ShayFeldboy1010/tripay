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
  const formatted = formatILS(amount).replace("₪", "").trim()
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
          <p className="grad-text text-6xl md:text-7xl font-extrabold tracking-tight leading-none text-center">
            {formatted}₪
          </p>
          <p className="text-base text-white/70">סכום מצטבר של כל ההוצאות ששויכו לטיול הזה</p>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-2">
          <div className="glass-sm rounded-2xl px-3 py-3 text-center">
            <Receipt className="mx-auto h-4 w-4 text-white/70" />
            <p className="mt-2 text-[11px] text-white/70 truncate-1 leading-4">סה״כ הוצאות</p>
            <p className="mt-1 text-base font-semibold leading-tight grad-text md:text-lg">{totalExpenses}</p>
          </div>
          <div className="glass-sm rounded-2xl px-3 py-3 text-center">
            <Users className="mx-auto h-4 w-4 text-white/70" />
            <p className="mt-2 text-[11px] text-white/70 truncate-1 leading-4">משתתפים</p>
            <p className="mt-1 text-base font-semibold leading-tight grad-text md:text-lg">{participantCount}</p>
          </div>
          <div className="glass-sm rounded-2xl px-3 py-3 text-center">
            <TrendingUp className="mx-auto h-4 w-4 text-white/70" />
            <p className="mt-2 text-[11px] text-white/70 truncate-1 leading-4">ממוצע הוצאה</p>
            <p className="mt-1 text-base font-semibold leading-tight grad-text md:text-lg">{averageFormatted}</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
