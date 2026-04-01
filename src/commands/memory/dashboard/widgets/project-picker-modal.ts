import blessed from "blessed";

export interface ProjectPickerModalWidget {
  open(projects: readonly string[], activeProject?: string): void;
  close(): void;
  isOpen(): boolean;
  onSubmit(callback: (project: string | undefined) => void): void;
}

interface ProjectOption {
  readonly label: string;
  readonly project: string | undefined;
}

export function createProjectPickerModal(
  screen: blessed.Widgets.Screen,
): ProjectPickerModalWidget {
  const box = blessed.box({
    parent: screen,
    top: "center",
    left: "center",
    width: 52,
    height: 14,
    border: { type: "line" },
    label: " Project Picker ",
    tags: true,
    hidden: true,
    style: {
      border: { fg: "yellow" },
      bg: "black",
    },
  });

  const hint = blessed.box({
    parent: box,
    top: 0,
    left: 1,
    right: 1,
    height: 1,
    tags: true,
    content: "{gray-fg}Enter=select  Esc=close{/gray-fg}",
  });

  const list = blessed.list({
    parent: box,
    top: 1,
    left: 1,
    right: 1,
    bottom: 1,
    keys: true,
    vi: true,
    mouse: true,
    tags: true,
    style: {
      item: { fg: "white" },
      selected: { fg: "black", bg: "yellow" },
    },
    scrollbar: {
      style: { bg: "yellow" },
    },
  });

  let isOpenState = false;
  let options: readonly ProjectOption[] = [];
  let submitCallback: ((project: string | undefined) => void) | null = null;
  let previousFocus: blessed.Widgets.BlessedElement | null = null;

  function restoreFocus(): void {
    if (previousFocus) {
      previousFocus.focus();
      previousFocus = null;
    }
  }

  function emitSelection(): void {
    const selectedIndex = (list as unknown as { selected: number }).selected;
    const selected = options[selectedIndex];
    if (!selected || !submitCallback) return;
    submitCallback(selected.project);
    box.hide();
    isOpenState = false;
    restoreFocus();
    screen.render();
  }

  list.key(["escape"], () => {
    box.hide();
    isOpenState = false;
    restoreFocus();
    screen.render();
  });

  list.on("select", () => emitSelection());

  return {
    open(projects: readonly string[], activeProject?: string) {
      options = [
        { label: "All projects", project: undefined },
        ...projects.map((project) => ({ label: project, project })),
      ];

      const items = options.map((option) => {
        const active =
          option.project === activeProject ||
          (option.project === undefined && !activeProject);
        return `${active ? "> " : "  "}${option.label}`;
      });

      list.setItems(items);
      const activeIndex = options.findIndex(
        (o) =>
          o.project === activeProject ||
          (o.project === undefined && !activeProject),
      );
      list.select(Math.max(0, activeIndex));
      previousFocus = screen.focused as blessed.Widgets.BlessedElement | null;
      box.show();
      isOpenState = true;
      list.focus();
      hint.setFront();
      screen.render();
    },
    close() {
      box.hide();
      isOpenState = false;
      restoreFocus();
      screen.render();
    },
    isOpen() {
      return isOpenState;
    },
    onSubmit(callback: (project: string | undefined) => void) {
      submitCallback = callback;
    },
  };
}
