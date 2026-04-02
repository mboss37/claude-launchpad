'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import {
  ArrowRightIcon,
  BrainIcon,
  CheckIcon,
  CopyIcon,
  FlaskConicalIcon,
  RocketIcon,
  SparklesIcon,
  StethoscopeIcon,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const shellClassName = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8';
const terminalClass = 'border border-fd-border bg-fd-card/95 shadow-[0_14px_36px_rgba(2,6,23,0.24)]';

const newProjectSteps = [
  {
    icon: RocketIcon,
    prefix: '$',
    command: 'claude-launchpad init',
    detail: 'Generate the baseline Claude setup for a new repo.',
    href: '/docs/init',
  },
  {
    icon: SparklesIcon,
    prefix: '>',
    command: '/lp-enhance',
    detail: 'Rewrite CLAUDE.md from the actual codebase context.',
    href: '/docs/enhance',
  },
  {
    icon: FlaskConicalIcon,
    prefix: '$',
    command: 'claude-launchpad eval',
    detail: 'Verify behavior before you trust the configuration.',
    href: '/docs/eval',
  },
] as const;

const existingProjectSteps = [
  {
    icon: StethoscopeIcon,
    prefix: '$',
    command: 'claude-launchpad',
    detail: 'Open with doctor automatically when config already exists.',
    href: '/docs/doctor',
  },
  {
    icon: StethoscopeIcon,
    prefix: '$',
    command: 'claude-launchpad doctor --fix',
    detail: 'Apply deterministic fixes for hooks, permissions, and gaps.',
    href: '/docs/doctor',
  },
  {
    icon: SparklesIcon,
    prefix: '>',
    command: '/lp-enhance',
    detail: 'Refine CLAUDE.md with repo-specific architecture and rules.',
    href: '/docs/enhance',
  },
  {
    icon: FlaskConicalIcon,
    prefix: '$',
    command: 'claude-launchpad eval',
    detail: 'Run scenarios to confirm the config actually behaves.',
    href: '/docs/eval',
  },
] as const;

const beforeIssues = [
  'No hooks configured',
  'Credential paths exposed',
  'No .claudeignore',
  'Bypass mode unprotected',
  'Sandbox disabled',
  'No Off-Limits guidance',
] as const;

const afterOutcomes = [
  'Hooks enabled',
  'Credentials blocked',
  '.claudeignore added',
  'Bypass mode disabled',
  'Sandbox enabled',
  'CLAUDE.md hardened',
] as const;

const proofStats = [
  { value: '4', label: 'core commands' },
  { value: '1', label: 'in-session skill' },
  { value: '15', label: 'eval scenarios' },
] as const;

function PageSection({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn(shellClassName, 'py-10 sm:py-12 md:py-14', className)}>{children}</section>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 rounded-full"
      aria-label="Copy install command"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
    </Button>
  );
}

function InstallBlock({ command, className }: { command: string; className?: string }) {
  return (
    <div className={cn('inline-flex h-11 items-center justify-between gap-2 rounded-xl border border-fd-border bg-fd-background/55 px-3 font-mono text-[13px] shadow-sm sm:px-4 sm:text-sm', className)}>
      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
        <span className="text-fd-muted-foreground">$</span>
        <span className="truncate">{command}</span>
      </div>
      <CopyButton text={command} />
    </div>
  );
}

function TerminalPanel({
  title,
  aside,
  children,
  className,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn(terminalClass, className)}>
      <CardContent className="p-0">
        <div className="flex items-center justify-between border-b border-fd-border px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-fd-border" />
              <span className="h-2.5 w-2.5 rounded-full bg-fd-border" />
              <span className="h-2.5 w-2.5 rounded-full bg-fd-border" />
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-fd-muted-foreground">{title}</span>
          </div>
          {aside}
        </div>
        <div className="p-4">{children}</div>
      </CardContent>
    </Card>
  );
}

function CommandRow({
  icon: Icon,
  prefix,
  command,
  detail,
  href,
}: {
  icon: LucideIcon;
  prefix: string;
  command: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-xl border border-fd-border bg-fd-background/34 px-3 py-3 transition-colors hover:border-fd-foreground/30 hover:bg-fd-background/48"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-fd-border bg-fd-card">
        <Icon className="h-4 w-4 text-fd-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 font-mono text-[12px]">
          <span className="text-fd-muted-foreground">{prefix}</span>
          <span className="truncate">{command}</span>
        </div>
        <p className="mt-1.5 text-sm leading-6 text-fd-muted-foreground">{detail}</p>
      </div>
      <ArrowRightIcon className="mt-1 h-4 w-4 shrink-0 text-fd-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-fd-muted-foreground">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-fd-muted-foreground sm:text-base">{description}</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="relative isolate overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(59,130,246,0.08)_0%,rgba(2,6,23,0)_58%)]" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(rgba(148,163,184,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.05)_1px,transparent_1px)] bg-size-[36px_36px] mask-[linear-gradient(to_bottom,rgba(0,0,0,0.55),transparent)]" />

      <PageSection className="pt-12 sm:pt-16">
        <div className="max-w-3xl">
          <Badge variant="outline" className="border-fd-border bg-fd-background/45">Claude Launchpad</Badge>
          <h1 className="mt-5 text-[2.35rem] font-bold leading-[1.02] tracking-tight sm:text-6xl">
            Make Claude Code
            <span className="mt-2 block text-fd-muted-foreground">actually hold the line.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-fd-muted-foreground sm:text-lg">
            Terminal-grade workflow for Claude configuration: scaffold it, diagnose it, refine CLAUDE.md from real context, then verify behavior in a sandbox.
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <InstallBlock command="npm i -g claude-launchpad" className="w-full sm:w-auto" />
            <div className="grid grid-cols-2 gap-2 sm:contents">
              <Link href="/docs" className={buttonVariants({ className: 'h-11 shrink-0 whitespace-nowrap rounded-xl px-4' })}>
                Open quickstart
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <a href="https://www.npmjs.com/package/claude-launchpad" className={buttonVariants({ variant: 'outline', className: 'h-11 shrink-0 whitespace-nowrap rounded-xl px-4' })}>
                View npm package
              </a>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <TerminalPanel title="new project" aside={<Badge variant="outline">init first</Badge>}>
            <div className="space-y-2.5">
              {newProjectSteps.map((step) => (
                <CommandRow key={step.command} {...step} />
              ))}
            </div>
          </TerminalPanel>

          <TerminalPanel title="existing setup" aside={<Badge variant="outline">doctor first</Badge>}>
            <div className="space-y-2.5">
              {existingProjectSteps.map((step) => (
                <CommandRow key={step.command} {...step} />
              ))}
            </div>
          </TerminalPanel>
        </div>
      </PageSection>

      <div className="border-y border-fd-border/80 bg-fd-card/22">
        <PageSection>
          <SectionHeading
            eyebrow="Measured improvement"
            title="What changes after doctor --fix"
            description="The goal is not prettier docs. The goal is a configuration that enforces behavior, blocks obvious mistakes, and can be validated."
          />

          <div className="mt-8 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <TerminalPanel
              title="before vs after"
              aside={<span className="font-mono text-[11px] uppercase tracking-[0.2em] text-fd-muted-foreground">31 {'->'} 91</span>}
            >
              <div className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
                <div className="rounded-xl border border-fd-border bg-fd-background/34 p-3">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">Before</Badge>
                    <span className="text-2xl font-semibold text-fd-muted-foreground">31/100</span>
                  </div>
                  <div className="mt-3 space-y-2.5">
                    {beforeIssues.map((item) => (
                      <div key={item} className="flex items-start gap-2 text-sm text-fd-muted-foreground">
                        <span className="mt-0.5">✗</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-fd-border bg-fd-background/34 p-3">
                  <div className="flex items-center justify-between">
                    <Badge>After --fix</Badge>
                    <span className="text-2xl font-semibold">91/100</span>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {afterOutcomes.map((item) => (
                      <div key={item} className="rounded-lg border border-fd-border bg-fd-card px-3 py-2.5 text-sm text-fd-muted-foreground">
                        ✓ {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TerminalPanel>

            <TerminalPanel title="core model" aside={<Badge variant="secondary">memory optional</Badge>}>
              <div className="grid grid-cols-3 gap-2">
                {proofStats.map((stat) => (
                  <div key={stat.label} className="rounded-lg border border-fd-border bg-fd-background/34 px-3 py-3">
                    <div className="text-[2rem] font-semibold leading-none tracking-tight">{stat.value}</div>
                    <p className="mt-1.5 text-[10px] leading-4 text-fd-muted-foreground">{stat.label}</p>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded-xl border border-dashed border-fd-border bg-fd-background/26 px-3 py-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-fd-border bg-fd-card">
                    <BrainIcon className="h-4 w-4 text-fd-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">claude-launchpad memory</span>
                      <Badge variant="outline" className="text-[10px]">optional</Badge>
                    </div>
                    <p className="mt-1.5 text-sm leading-6 text-fd-muted-foreground">
                      Add later if you want SQLite-backed cross-session memory, hooks, MCP integration, and `/lp-migrate-memory`.
                    </p>
                  </div>
                </div>
              </div>
            </TerminalPanel>
          </div>
        </PageSection>
      </div>

      <PageSection>
        <TerminalPanel title="get started" aside={<Badge variant="secondary">docs-first</Badge>}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h3 className="text-2xl font-semibold tracking-tight">Install, then follow the runbook.</h3>
              <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">
                The landing page stays focused on the main workflow. The docs cover flags, edge cases, and command details.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:items-end">
              <InstallBlock command="npm i -g claude-launchpad" className="w-full sm:w-auto" />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Link href="/docs" className={buttonVariants({ className: 'h-11 whitespace-nowrap rounded-xl px-4' })}>
                  Open docs
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <a href="https://www.npmjs.com/package/claude-launchpad" className={buttonVariants({ variant: 'outline', className: 'h-11 whitespace-nowrap rounded-xl px-4' })}>
                  npm package
                </a>
              </div>
            </div>
          </div>
        </TerminalPanel>
      </PageSection>

      <footer className={cn(shellClassName, 'flex flex-col gap-3 border-t border-fd-border py-6 text-xs text-fd-muted-foreground sm:flex-row sm:items-center sm:justify-between')}>
        <span>MIT License</span>
        <div className="flex items-center gap-4">
          <a href="https://github.com/mboss37/claude-launchpad" className="transition-colors hover:text-fd-foreground">GitHub</a>
          <Link href="/docs" className="transition-colors hover:text-fd-foreground">Docs</Link>
          <a href="https://www.npmjs.com/package/claude-launchpad" className="transition-colors hover:text-fd-foreground">npm</a>
        </div>
      </footer>
    </div>
  );
}
