"use client";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Menu, MenuContent, MenuItem, MenuTrigger } from "@/components/ui/menu";

type EntryActionsMenuProps = {
  onEdit: () => void;
  onDelete: () => void;
};

/**
 * The "⋯" menu on a Journal Archive entry: Edit and Delete. Kept presentational
 * — the parent article owns the edit / delete flows and their confirmation.
 */
export const EntryActionsMenu = ({
  onEdit,
  onDelete,
}: EntryActionsMenuProps) => (
  <Menu>
    <MenuTrigger
      aria-label="Entry actions"
      onClick={(event) => event.stopPropagation()}
      className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <MoreHorizontal className="size-4" />
    </MenuTrigger>
    <MenuContent>
      <MenuItem onClick={onEdit}>
        <Pencil className="size-3.5" />
        Edit
      </MenuItem>
      <MenuItem variant="destructive" onClick={onDelete}>
        <Trash2 className="size-3.5" />
        Delete
      </MenuItem>
    </MenuContent>
  </Menu>
);
