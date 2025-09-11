"use client";

import { useEffect, useState } from "react";
import { Plus, Receipt, Users, MapPin } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface AddSplitButtonProps {
  onAddExpense: () => void;
  onAddParticipants: () => void;
  onAddLocation: () => void;
}

export function AddSplitButton({
  onAddExpense,
  onAddParticipants,
  onAddLocation,
}: AddSplitButtonProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "a") {
        setOpen((o) => !o);
      }
      if (e.key.toLowerCase() === "e") onAddExpense();
      if (e.key.toLowerCase() === "p") onAddParticipants();
      if (e.key.toLowerCase() === "l") onAddLocation();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onAddExpense, onAddParticipants, onAddLocation]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button className="hidden lg:inline-flex gap-2" aria-label="Add">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onAddExpense}>
          <Receipt className="h-4 w-4" /> Expense
          <DropdownMenuShortcut>E</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onAddParticipants}>
          <Users className="h-4 w-4" /> Participants
          <DropdownMenuShortcut>P</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onAddLocation}>
          <MapPin className="h-4 w-4" /> Location
          <DropdownMenuShortcut>L</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
