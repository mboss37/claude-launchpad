import Link from 'next/link';
import { RocketIcon, StethoscopeIcon, SparklesIcon, FlaskConicalIcon } from 'lucide-react';

const pipeline = [
  {
    step: 1,
    name: 'init',
    icon: <RocketIcon className="h-4 w-4" />,
    description: 'Detect your stack. Generate secure config, hooks, permissions, sprint tracking, memory management.',
    href: '/docs/init',
  },
  {
    step: 2,
    name: 'doctor',
    icon: <StethoscopeIcon className="h-4 w-4" />,
    description: 'Score 0-100. 15 checks across 7 analyzers. Auto-fix with one flag. CI gate. Live watch.',
    href: '/docs/doctor',
  },
  {
    step: 3,
    name: 'enhance',
    icon: <SparklesIcon className="h-4 w-4" />,
    description: 'Claude reads your codebase and fills in architecture, conventions, and guardrails.',
    href: '/docs/enhance',
  },
  {
    step: 4,
    name: 'eval',
    icon: <FlaskConicalIcon className="h-4 w-4" />,
    description: '15 scenarios test if Claude actually follows your rules. Security, conventions, workflow.',
    href: '/docs/eval',
  },
] as const;

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-64px)]">
      <main className="container max-w-[1100px] mx-auto flex-1 flex flex-col justify-center px-4 py-8">
        {/* Hero */}
        <div className="flex flex-col items-center text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl mb-3">
            Your Claude Code setup is broken.
            <br />
            <span className="text-fd-muted-foreground">You just don&apos;t know it yet.</span>
          </h1>
          <p className="text-fd-muted-foreground text-base mb-6 max-w-lg">
            Scaffold a secure config. Let Claude perfect it. Prove it actually works.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 items-center">
            <code className="rounded-full border border-fd-border bg-fd-card px-5 py-2 text-sm font-mono cursor-pointer hover:bg-fd-accent transition-colors">
              npm i -g claude-launchpad
            </code>
            <Link
              href="/docs"
              className="rounded-full bg-fd-foreground text-fd-background px-5 py-2 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Read the docs
            </Link>
          </div>
        </div>

        {/* Pipeline */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto w-full">
          {pipeline.map((step) => (
            <Link
              key={step.name}
              href={step.href}
              className="group flex flex-col rounded-xl border border-fd-border bg-fd-card p-4 transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-fd-secondary text-fd-secondary-foreground">
                  {step.icon}
                </span>
                <span className="font-mono text-sm font-bold">{step.name}</span>
              </div>
              <p className="text-xs text-fd-muted-foreground group-hover:text-fd-accent-foreground/70 leading-relaxed flex-1">
                {step.description}
              </p>
            </Link>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="container max-w-[1100px] mx-auto border-t border-fd-border py-4 px-4 text-center text-xs text-fd-muted-foreground flex items-center justify-center gap-4">
        <span>MIT License</span>
        <span className="text-fd-border">|</span>
        <a href="https://github.com/mboss37/claude-launchpad" className="hover:text-fd-foreground transition-colors">GitHub</a>
        <span className="text-fd-border">|</span>
        <a href="https://www.npmjs.com/package/claude-launchpad" className="hover:text-fd-foreground transition-colors">npm</a>
      </footer>
    </div>
  );
}
