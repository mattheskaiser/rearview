"use client";
import * as React from "react";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function formatDate(date: Date | undefined) {
  if (!date) return "Pick a date";
  return date.toLocaleDateString("en-US", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

type DatePickerProps = {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  label?: string;
};

/**
 * Fully controlled date picker. Future dates are disabled; a journal entry can
 * represent today or any past date.
 */
export const DatePicker = ({ value, onChange, label = "Date of entry" }: DatePickerProps) => {
  const [open, setOpen] = React.useState(false);

  return (
    <Field className="w-64">
      <FieldLabel htmlFor="entry-date">{label}</FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button id="entry-date" variant="outline" className="justify-between font-normal">
              {formatDate(value)}
              <CalendarIcon className="size-4 opacity-60" />
            </Button>
          }
        />
        <PopoverContent className="w-auto overflow-hidden p-0" align="start">
          <Calendar
            mode="single"
            selected={value}
            defaultMonth={value ?? new Date()}
            disabled={{ after: new Date() }}
            onSelect={(date) => {
              onChange(date);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </Field>
  );
};
