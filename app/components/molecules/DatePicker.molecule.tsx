"use client";
import * as React from "react";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatDateInput, parseDateInput } from "@/lib/time/parse-date";

type DatePickerProps = {
  value: Date | undefined;
  onChange: (date: Date | undefined) => void;
  label?: string;
  /** Dates after this are rejected (typed and in the calendar). */
  disableAfter?: Date;
};

/** Oldest year the calendar's year dropdown offers (covers paper backfill). */
const YEAR_FLOOR = new Date(new Date().getFullYear() - 80, 0, 1);
const isAfter = (a: Date, b: Date) =>
  new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime() >
  new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();

/**
 * Reusable date field: type a date directly ("1/5/2022") or pick one from a
 * calendar with fast month/year dropdowns. The value is always a real `Date`,
 * never a string. Parsing/validation live in `lib/time/parse-date`.
 */
export const DatePicker = ({
  value,
  onChange,
  label = "Date of entry",
  disableAfter,
}: DatePickerProps) => {
  const inputId = React.useId();
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(value ? formatDateInput(value) : "");
  const [error, setError] = React.useState<string | null>(null);

  // Re-sync the field when the selected date changes from outside (compared by
  // calendar day, since the caller may pass a fresh Date object each render).
  const valueTime = value ? value.getTime() : null;
  const [prevTime, setPrevTime] = React.useState(valueTime);
  if (valueTime !== prevTime) {
    setPrevTime(valueTime);
    setText(value ? formatDateInput(value) : "");
    setError(null);
  }

  const commit = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError(null);
      onChange(undefined);
      return;
    }
    const parsed = parseDateInput(trimmed);
    if (!parsed) {
      setError("Enter a date like 1/5/2022.");
      return;
    }
    if (disableAfter && isAfter(parsed, disableAfter)) {
      setError("That date is in the future.");
      return;
    }
    setError(null);
    setText(formatDateInput(parsed));
    onChange(parsed);
  };

  const pick = (date: Date | undefined) => {
    setError(null);
    setText(date ? formatDateInput(date) : "");
    onChange(date);
    setOpen(false);
  };

  return (
    <Field className="w-64" data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={inputId}
          className="cursor-text"
          inputMode="numeric"
          placeholder="M/D/YYYY"
          aria-invalid={error ? true : undefined}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
        />
        <InputGroupAddon align="inline-end">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="cursor-pointer"
                  aria-label="Open calendar"
                >
                  <CalendarIcon className="opacity-60" />
                </Button>
              }
            />
            <PopoverContent className="w-auto overflow-hidden p-0" align="end">
              <Calendar
                mode="single"
                captionLayout="dropdown"
                startMonth={YEAR_FLOOR}
                endMonth={disableAfter}
                defaultMonth={value ?? disableAfter ?? new Date()}
                selected={value}
                disabled={disableAfter ? { after: disableAfter } : undefined}
                onSelect={pick}
              />
            </PopoverContent>
          </Popover>
        </InputGroupAddon>
      </InputGroup>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  );
};
