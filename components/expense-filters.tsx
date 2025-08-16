"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Expense } from "@/lib/supabase/client"
import { X } from "lucide-react"

interface ExpenseFiltersProps {
  expenses: Expense[]
  onFiltersChanged: (filteredExpenses: Expense[]) => void
  className?: string
}

export function ExpenseFilters({ expenses, onFiltersChanged, className }: ExpenseFiltersProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("")
  const [selectedPayer, setSelectedPayer] = useState("")
  const [minAmount, setMinAmount] = useState("")
  const [maxAmount, setMaxAmount] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  // Get unique categories and payers
  const categories = Array.from(new Set(expenses.map((e) => e.category).filter(Boolean))) as string[]
  const payers = Array.from(new Set(expenses.map((e) => e.paid_by)))

  useEffect(() => {
    let filtered = expenses

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter((expense) => expense.description.toLowerCase().includes(searchTerm.toLowerCase()))
    }

    // Filter by category
    if (selectedCategory) {
      filtered = filtered.filter((expense) => expense.category === selectedCategory)
    }

    // Filter by payer
    if (selectedPayer) {
      filtered = filtered.filter((expense) => expense.paid_by === selectedPayer)
    }

    // Filter by amount range
    if (minAmount) {
      const min = Number.parseFloat(minAmount)
      if (!isNaN(min)) {
        filtered = filtered.filter((expense) => expense.amount >= min)
      }
    }

    if (maxAmount) {
      const max = Number.parseFloat(maxAmount)
      if (!isNaN(max)) {
        filtered = filtered.filter((expense) => expense.amount <= max)
      }
    }

    // Filter by date range
    if (startDate) {
      const start = new Date(startDate)
      filtered = filtered.filter((expense) => new Date(expense.created_at) >= start)
    }

    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999) // Include the entire end date
      filtered = filtered.filter((expense) => new Date(expense.created_at) <= end)
    }

    onFiltersChanged(filtered)
  }, [
    searchTerm,
    selectedCategory,
    selectedPayer,
    minAmount,
    maxAmount,
    startDate,
    endDate,
    expenses,
    onFiltersChanged,
  ])

  const clearFilters = () => {
    setSearchTerm("")
    setSelectedCategory("")
    setSelectedPayer("")
    setMinAmount("")
    setMaxAmount("")
    setStartDate("")
    setEndDate("")
  }

  const hasActiveFilters =
    searchTerm || selectedCategory || selectedPayer || minAmount || maxAmount || startDate || endDate

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">Filters</CardTitle>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="flex items-center gap-1">
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search */}
        <div>
          <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
            Search description
          </label>
          <Input
            id="search"
            placeholder="Search expenses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Amount Range */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="minAmount" className="block text-sm font-medium text-gray-700 mb-1">
              Min amount
            </label>
            <Input
              id="minAmount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={minAmount}
              onChange={(e) => setMinAmount(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="maxAmount" className="block text-sm font-medium text-gray-700 mb-1">
              Max amount
            </label>
            <Input
              id="maxAmount"
              type="number"
              step="0.01"
              placeholder="999.99"
              value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value)}
            />
          </div>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
              From date
            </label>
            <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
              To date
            </label>
            <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Categories</label>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <Badge
                  key={category}
                  variant={selectedCategory === category ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setSelectedCategory(selectedCategory === category ? "" : category)}
                >
                  {category}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Payers */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Paid by</label>
          <div className="flex flex-wrap gap-2">
            {payers.map((payer) => (
              <Badge
                key={payer}
                variant={selectedPayer === payer ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setSelectedPayer(selectedPayer === payer ? "" : payer)}
              >
                {payer}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
