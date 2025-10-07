"use client";

import { Plus, Receipt, Users, MapPin } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="hidden lg:inline-flex gap-2" aria-label="Add">
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onAddExpense}>
          <Receipt className="h-4 w-4" /> Expense
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onAddParticipants}>
          <Users className="h-4 w-4" /> Participants
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onAddLocation}>
          <MapPin className="h-4 w-4" /> Location
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
