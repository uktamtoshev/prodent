import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "./alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "./drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "./sheet";
import { Tabs, TabsList, TabsTrigger } from "./tabs";

describe("responsive UI primitives", () => {
  it("keeps dialogs inside the dynamic viewport with a mobile gutter", () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Окно</DialogTitle>
          <DialogDescription>Описание</DialogDescription>
        </DialogContent>
      </Dialog>,
    );

    expect(screen.getByRole("dialog")).toHaveClass(
      "w-[calc(100%-2rem)]",
      "max-h-[calc(100dvh-2rem)]",
      "overflow-y-auto",
    );
  });

  it("keeps alert dialogs inside the dynamic viewport with a mobile gutter", () => {
    render(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Подтверждение</AlertDialogTitle>
          <AlertDialogDescription>Описание</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>,
    );

    expect(screen.getByRole("alertdialog")).toHaveClass(
      "w-[calc(100%-2rem)]",
      "max-h-[calc(100dvh-2rem)]",
      "overflow-y-auto",
    );
  });

  it("allows long side sheets to scroll inside the viewport", () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Панель</SheetTitle>
          <SheetDescription>Длинное содержимое</SheetDescription>
        </SheetContent>
      </Sheet>,
    );

    expect(screen.getByRole("dialog")).toHaveClass("max-h-dvh", "overflow-y-auto");
  });

  it("keeps long mobile drawers within the dynamic viewport", () => {
    render(
      <Drawer open>
        <DrawerContent>
          <DrawerTitle>Панель</DrawerTitle>
          <DrawerDescription>Длинное содержимое</DrawerDescription>
        </DrawerContent>
      </Drawer>,
    );

    expect(screen.getByRole("dialog")).toHaveClass(
      "max-h-[calc(100dvh-1rem)]",
      "overflow-y-auto",
    );
  });

  it("bounds long tab rows and allows horizontal scrolling", () => {
    render(
      <Tabs defaultValue="one">
        <TabsList aria-label="Разделы">
          <TabsTrigger value="one">Первый очень длинный раздел</TabsTrigger>
          <TabsTrigger value="two">Второй очень длинный раздел</TabsTrigger>
          <TabsTrigger value="three">Третий очень длинный раздел</TabsTrigger>
        </TabsList>
      </Tabs>,
    );

    expect(screen.getByRole("tablist", { name: "Разделы" })).toHaveClass(
      "max-w-full",
      "overflow-x-auto",
      "justify-start",
    );
  });
});
