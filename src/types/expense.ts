export interface ExpenseSourceMeta {
  provider?: string
  fileName?: string
  rowIndex: number
  originalAmount?: number
  originalCurrency?: string
  exchangeRate?: number
  transactionType?: string
  billingDate?: string
  raw: Record<string, unknown>
}

export interface ExpenseDTO {
  date: string
  merchant: string
  amount: number
  currency: string
  category?: string
  notes?: string
  tags?: string[]
  method?: string
  source?: ExpenseSourceMeta
  cardLast4?: string
  importHash: string
}
