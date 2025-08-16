"use client";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase, type Expense } from "@/lib/supabase/client";
import { X } from "lucide-react";

// ⬇️ רכיבי Select של shadcn (אם עדיין לא מיובא אצלך)
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface EditExpenseFormProps {
  expense: Expense;
  onExpenseUpdated: (expense: Expense) => void;
  onCancel: () => void;
}

// שמור את אותן האופציות כמו בטופס ההוספה
const CATEGORY_OPTIONS = ["Food", "Transportation", "Accommodation", "Sleep", "Other"] as const;
// אם יש לך רשימה סגורה ל"מי שילם" (Settings.payers), תחליף למקור הנתונים אצלך:
const PAYER_OPTIONS = ["Me", "Partner"] as const;

export function EditExpenseForm({ expense, onExpenseUpdated, onCancel }: EditExpenseFormProps) {
  // סדר שדות: Title/Description → Category → Amount → PaidBy → Date (אופציונלי) → Note
  const [description, setDescription] = useState(expense.description ?? "");
  const [category, setCategory] = useState<string>(expense.category ?? CATEGORY_OPTIONS[0]);
  const [amount, setAmount] = useState(String(expense.amount ?? ""));
  const [paidBy, setPaidBy] = useState<string>(expense.paid_by ?? PAYER_OPTIONS[0]);
  const [date, setDate] = useState<string>(expense.date ?? ""); // אם אין שדה כזה בטבלה – מחק/התאם
  const [note, setNote] = useState<string>(expense.note ?? ""); // אם אין – מחק/התאם
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !amount.trim() || !category || !paidBy) {
      alert("Please fill in all required fields");
      return;
    }
    const amountNum = Number.parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("Please enter a valid amount");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("expenses")
        .update({
          description: description.trim(),
          category: category,
          amount: amountNum,
          paid_by: paidBy,
          // הוסף/הסר לפי הסכימה האמיתית שלך:
          date: date || null,
          note: note?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", expense.id)
        .select()
        .single();

      if (error) throw error;
      onExpenseUpdated(data);
    } catch (err) {
      console.error("Error updating expense:", err);
      alert("Failed to update expense. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="mb-6 ring-2 ring-blue-500">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg">Edit Expense</CardTitle>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1) Title/Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
            <Input
              placeholder="Dinner at restaurant"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          {/* 2) Category (dropdown סגור) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 3) Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount *</label>
            <Input
              type="number"
              step="0.01"
              inputMode="decimal"
              placeholder="25.50"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          {/* 4) Who Paid (dropdown סגור) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Paid by *</label>
            <Select value={paidBy} onValueChange={setPaidBy}>
              <SelectTrigger>
                <SelectValue placeholder="Select payer" />
              </SelectTrigger>
              <SelectContent>
                {PAYER_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 5) Optional: Date + Note, שמור עקביות עם ההוספה */}
          {/* אם אין שדה date/note בטבלה שלך – הסר את שני הבלוקים הבאים */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <Input
              type="date"
              value={date || ""}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <Input
              placeholder="Optional note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={isSubmitting} className="flex-1 bg-blue-600 hover:bg-blue-700">
              {isSubmitting ? "Updating..." : "Update Expense"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
