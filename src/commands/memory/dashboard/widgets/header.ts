import blessed from "blessed";

export interface HeaderWidget {
  readonly widget: blessed.Widgets.BoxElement;
  setLabel(text: string): void;
}

export function createHeader(screen: blessed.Widgets.Screen): HeaderWidget {
  const box = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: "100%",
    height: 1,
    tags: true,
    style: { fg: "black", bg: "green", bold: true },
    content:
      "{bold} agentic-memory cockpit {/bold}  {|} [/]=search [p]=project picker [[/]]=prev/next [1-5]=type [l]=life [s]=sort [tab]=focus [?]=help [q]=quit",
  });

  return {
    widget: box,
    setLabel(text: string) {
      box.setContent(
        `{bold} ${text} {/bold}  {|} [/]=search [p]=project picker [[/]]=prev/next [1-5]=type [l]=life [s]=sort [tab]=focus [?]=help [q]=quit`,
      );
    },
  };
}
