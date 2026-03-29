'use client';

import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import {
  ArrowRightIcon,
  CheckIcon,
  CopyIcon,
  RocketIcon,
  StethoscopeIcon,
  SparklesIcon,
  FlaskConicalIcon,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

const steps = [
  {
    num: '01',
    name: 'init',
    icon: RocketIcon,
    verb: 'Detect your stack, generate everything',
    detail: 'Reads your repo. Produces CLAUDE.md, settings.json, hooks, permissions, .claudeignore — tailored to your framework.',
    href: '/docs/init',
  },
  {
    num: '02',
    name: 'doctor --fix',
    icon: StethoscopeIcon,
    verb: 'Find what\'s broken, fix it automatically',
    detail: '15 checks across security, hooks, permissions, and config quality. Auto-repairs what it can. Shows your score.',
    href: '/docs/doctor',
  },
  {
    num: '03',
    name: 'enhance',
    icon: SparklesIcon,
    verb: 'Let Claude rewrite your own instructions',
    detail: 'Spawns Claude to analyze your codebase and restructure CLAUDE.md with real architecture, conventions, and guardrails.',
    href: '/docs/enhance',
  },
  {
    num: '04',
    name: 'eval',
    icon: FlaskConicalIcon,
    verb: 'Prove Claude actually follows your rules',
    detail: '15 scenarios test your config against real tasks. Security, conventions, workflow. You get a score, not a feeling.',
    href: '/docs/eval',
  },
] as const;

const trustPills = ['Open source', 'MIT licensed'] as const;

const heroStats = [
  { value: '4', label: 'commands: init, doctor, enhance, eval' },
  { value: '15', label: 'eval scenarios across security + workflow' },
  { value: '13', label: 'languages auto-detected from your stack' },
] as const;

const improvements = [
  { icon: RocketIcon, label: 'init — scaffolds CLAUDE.md, hooks, permissions, sandbox, sprint tracking from your stack' },
  { icon: StethoscopeIcon, label: 'doctor --fix — 15 checks, auto-repairs security gaps, credentials, missing config' },
  { icon: SparklesIcon, label: 'enhance — Claude reads your codebase, restructures CLAUDE.md with real content' },
  { icon: FlaskConicalIcon, label: 'eval — 15 scenarios prove Claude follows your rules across security and workflow' },
] as const;

const beforeItems = [
  'No hooks configured',
  'Credentials exposed (~/.ssh, ~/.aws)',
  'No .claudeignore',
  'Bypass mode unprotected',
  'Sandbox disabled',
  'No Off-Limits section',
  'No memory instructions',
] as const;

const afterItems = [
  'Hooks: .env protection, format, force-push',
  'Credentials blocked (SSH, AWS, npm)',
  '.claudeignore configured',
  'Bypass mode disabled',
  'Sandbox enabled',
  'Off-Limits + Memory sections',
  'SessionStart + PostCompact hooks',
] as const;

const shellClassName = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8';

function PageSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={cn(shellClassName, 'py-12 sm:py-16 md:py-20', className)}>{children}</section>;
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
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-emerald-400/70">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-fd-foreground sm:text-3xl">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-fd-muted-foreground sm:text-base">{description}</p>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setCopied(false);
        }
      }}
      className="h-8 w-8 rounded-full"
      aria-label="Copy to clipboard"
    >
      {copied ? <CheckIcon className="h-3.5 w-3.5 text-emerald-400" /> : <CopyIcon className="h-3.5 w-3.5" />}
    </Button>
  );
}

function InstallBlock({ command, className = '' }: { command: string; className?: string }) {
  return (
    <div
      className={cn(
        'inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-black/40 px-4 py-3 font-mono text-sm text-fd-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:w-auto',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
        <span className="select-none text-emerald-400">$</span>
        <span className="truncate">{command}</span>
      </div>
      <CopyButton text={command} />
    </div>
  );
}

function CommandCard({
  detail,
  href,
  icon: Icon,
  name,
  num,
  verb,
}: {
  detail: string;
  href: string;
  icon: LucideIcon;
  name: string;
  num: string;
  verb: string;
}) {
  return (
    <Card className="group h-full border-fd-border/80 bg-fd-card/50 transition-colors hover:border-emerald-500/30 hover:bg-fd-card">
      <CardHeader className="gap-4">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="font-mono tracking-[0.2em]">
            {num}
          </Badge>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-fd-border bg-black/20 transition-colors group-hover:border-emerald-500/30 group-hover:bg-emerald-500/10">
            <Icon className="h-4 w-4 text-fd-muted-foreground transition-colors group-hover:text-emerald-300" />
          </div>
        </div>
        <div>
          <CardTitle className="font-mono text-base">{name}</CardTitle>
          <CardDescription className="mt-2">{verb}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-6 text-fd-muted-foreground">{detail}</p>
      </CardContent>
      <CardFooter>
        <Link
          href={href}
          className={buttonVariants({
            variant: 'ghost',
            className: 'h-auto px-0 py-0 text-sm text-fd-foreground hover:bg-transparent hover:text-emerald-300',
          })}
        >
          Read docs
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </CardFooter>
    </Card>
  );
}

function ScoreCard({
  items,
  score,
  tone,
}: {
  items: readonly string[];
  score: string;
  tone: 'after' | 'before';
}) {
  const isAfter = tone === 'after';

  return (
    <Card
      className={cn(
        'h-full rounded-2xl bg-black/30 font-mono text-xs',
        isAfter ? 'border-emerald-500/20' : 'border-fd-border',
      )}
    >
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <Badge variant={isAfter ? 'default' : 'outline'}>{isAfter ? 'After --fix' : 'Before'}</Badge>
          <span className={cn('text-2xl font-semibold tracking-tight', isAfter ? 'text-emerald-300' : 'text-red-300')}>
            {score}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-3 text-fd-muted-foreground">
            <span className={cn('mt-0.5 text-sm', isAfter ? 'text-emerald-400' : 'text-red-400')}>{isAfter ? '✓' : '✗'}</span>
            <span className="leading-5">{item}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  return (
    <div className="relative isolate overflow-hidden">
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(8,12,14,0.82)_0%,rgba(6,10,12,0.58)_36%,rgba(10,28,22,0.18)_62%,rgba(0,0,0,0)_100%)]" />

        <PageSection className="pt-12 sm:pt-16 md:pt-24">
          <div className="grid gap-8 sm:gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(340px,420px)] lg:items-start">
            <div className="max-w-3xl">
              <Badge variant="outline" className="border-emerald-500/20 text-emerald-300">
                CLI toolkit for Claude Code
              </Badge>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight text-fd-foreground sm:mt-6 sm:text-5xl md:text-6xl">
                Claude reads your codebase.
                <span className="mt-2 block text-fd-muted-foreground">Does it actually know the rules?</span>
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-fd-muted-foreground sm:mt-6 sm:text-lg">
                Most Claude Code setups have no hooks, no security boundaries, and no way to verify compliance.
                Launchpad scaffolds a secure config, lets Claude perfect it with real codebase context, and proves it works with 15 test scenarios.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center sm:gap-4">
                <InstallBlock command="npm i -g claude-launchpad" />
                <Link href="/docs" className={buttonVariants({ size: 'default', className: 'w-full sm:h-11 sm:w-auto sm:px-6' })}>
                  Read the docs
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:mt-10 sm:gap-4 sm:grid-cols-3">
                {heroStats.map((stat) => (
                  <Card key={stat.label} className="rounded-xl border-fd-border/70 bg-fd-card/40">
                    <CardContent className="p-4 sm:p-5">
                      <div className="text-xl font-semibold tracking-tight text-fd-foreground sm:text-2xl">{stat.value}</div>
                      <p className="mt-2 text-xs leading-5 text-fd-muted-foreground sm:text-sm sm:leading-6">{stat.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2 sm:mt-6">
                {trustPills.map((pill) => (
                  <Badge key={pill} variant="secondary" className="border border-fd-border/80 bg-fd-card/40">
                    {pill}
                  </Badge>
                ))}
              </div>
            </div>

            <Card className="overflow-hidden border-emerald-500/20 bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(0,0,0,0))]">
              <CardHeader className="border-b border-fd-border/80 pb-5">
                <Badge variant="default" className="w-fit">
                  The full pipeline
                </Badge>
                <CardTitle className="text-xl">From unchecked config to verified compliance</CardTitle>
                <CardDescription>
                  Not just a score — a complete workflow from scaffolding to proof.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-red-500/15 bg-black/30 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-red-300/80">Typical setup</div>
                    <div className="mt-3 text-3xl font-semibold tracking-tight text-red-300">31/100</div>
                    <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">Vague instructions, exposed paths, missing hooks.</p>
                  </div>
                  <div className="rounded-xl border border-emerald-500/20 bg-black/30 p-4">
                    <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-300/80">Launchpad</div>
                    <div className="mt-3 text-3xl font-semibold tracking-tight text-emerald-300">91/100</div>
                    <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">Security rails, workflow hooks, and docs that match the repo.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {improvements.map(({ icon: Icon, label }) => (
                    <div key={label} className="flex items-start gap-3 rounded-xl border border-fd-border/70 bg-black/20 p-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10">
                        <Icon className="h-4 w-4 text-emerald-300" />
                      </div>
                      <p className="text-sm leading-6 text-fd-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </PageSection>
      </section>

      <div className="border-y border-fd-border/80 bg-fd-card/20">
        <PageSection>
          <SectionHeading
            eyebrow="Recommended flow"
            title="Four commands. One configuration you can trust."
            description="Start with a clean baseline, diagnose what's weak, improve the instructions, then verify the behavior with real scenarios."
          />

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {steps.map((step) => (
              <CommandCard key={step.name} {...step} />
            ))}
          </div>
        </PageSection>
      </div>

      <PageSection>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <SectionHeading
            eyebrow="Proof, not vibes"
            title="See what actually changes"
            description="Doctor scores your config and --fix repairs the gaps. Then enhance rewrites CLAUDE.md with real content. Then eval proves compliance."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <ScoreCard tone="before" score="31/100" items={beforeItems} />
            <ScoreCard tone="after" score="91/100" items={afterItems} />
          </div>
        </div>
      </PageSection>

      <PageSection className="pt-0">
        <Card className="border-emerald-500/20 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(17,24,39,0.7)_55%,rgba(0,0,0,0.75))]">
          <CardHeader className="items-center text-center">
            <CardTitle className="text-2xl sm:text-3xl">Open source. Ready to use.</CardTitle>
            <CardDescription className="max-w-2xl">
              Scaffold, diagnose, perfect, and prove — the full pipeline for Claude Code configs.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <InstallBlock command="npm i -g claude-launchpad" className="w-full max-w-xl" />
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/docs" className={buttonVariants({ size: 'lg' })}>
                Browse docs
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
              <a
                href="https://www.npmjs.com/package/claude-launchpad"
                className={buttonVariants({ variant: 'outline', size: 'lg' })}
              >
                npm package
              </a>
            </div>
          </CardContent>
        </Card>
      </PageSection>

      <footer className={cn(shellClassName, 'flex flex-col gap-3 border-t border-fd-border py-6 text-xs text-fd-muted-foreground sm:flex-row sm:items-center sm:justify-between')}>
        <span>MIT License</span>
        <div className="flex items-center gap-4">
          <a href="https://github.com/mboss37/claude-launchpad" className="transition-colors hover:text-fd-foreground">
            GitHub
          </a>
          <Link href="/docs" className="transition-colors hover:text-fd-foreground">
            Docs
          </Link>
          <a href="https://www.npmjs.com/package/claude-launchpad" className="transition-colors hover:text-fd-foreground">
            npm
          </a>
        </div>
      </footer>
    </div>
  );
}
