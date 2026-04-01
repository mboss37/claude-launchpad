import blessed from "blessed";

export interface SearchModalWidget {
  readonly widget: blessed.Widgets.BoxElement;
  open(): void;
  close(): void;
  isOpen(): boolean;
  onSubmit(callback: (query: string) => void): void;
  onCancel(callback: () => void): void;
}

export function createSearchModal(
  screen: blessed.Widgets.Screen,
): SearchModalWidget {
  const box = blessed.box({
    top: "center",
    left: "center",
    width: 60,
    height: 5,
    border: { type: "line" },
    label: " Search ",
    tags: true,
    hidden: true,
    style: {
      border: { fg: "yellow" },
      bg: "black",
    },
  });

  const input = blessed.textbox({
    parent: box,
    top: 1,
    left: 1,
    right: 1,
    height: 1,
    inputOnFocus: true,
    style: {
      fg: "white",
      bg: "black",
    },
  });

  screen.append(box);

  let submitCallback: ((query: string) => void) | null = null;
  let cancelCallback: (() => void) | null = null;
  let isOpenState = false;
  let previousFocus: blessed.Widgets.BlessedElement | null = null;

  function restoreFocus(): void {
    if (previousFocus) {
      previousFocus.focus();
      previousFocus = null;
    }
  }

  input.on("submit", (value: string) => {
    isOpenState = false;
    box.hide();
    restoreFocus();
    screen.render();
    if (value.trim()) submitCallback?.(value.trim());
  });

  input.on("cancel", () => {
    isOpenState = false;
    box.hide();
    restoreFocus();
    screen.render();
    cancelCallback?.();
  });

  return {
    widget: box,
    open() {
      previousFocus = screen.focused as blessed.Widgets.BlessedElement | null;
      input.clearValue();
      isOpenState = true;
      box.show();
      input.focus();
      screen.render();
    },
    close() {
      isOpenState = false;
      box.hide();
      restoreFocus();
      screen.render();
    },
    isOpen() {
      return isOpenState;
    },
    onSubmit(callback: (query: string) => void) {
      submitCallback = callback;
    },
    onCancel(callback: () => void) {
      cancelCallback = callback;
    },
  };
}
