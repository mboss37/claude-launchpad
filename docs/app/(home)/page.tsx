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
    detail: 'Reads your repo. Produces CLAUDE.md, settings.json, hooks, permissions, .claudeignore, all tailored to your framework.',
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
  {
    icon: RocketIcon,
    name: 'init',
    label: 'Scaffolds CLAUDE.md, hooks, permissions, sandbox, and sprint tracking from your stack.',
  },
  {
    icon: StethoscopeIcon,
    name: 'doctor --fix',
    label: 'Runs 15 checks and auto-repairs security gaps, credentials, and missing config.',
  },
  {
    icon: SparklesIcon,
    name: 'enhance',
    label: 'Reads your codebase and rewrites CLAUDE.md with architecture, conventions, and guardrails.',
  },
  {
    icon: FlaskConicalIcon,
    name: 'eval',
    label: 'Proves Claude follows your rules with 15 scenarios across security and workflow.',
  },
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
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-black dark:text-(--accent)/70">{eyebrow}</p>
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
      {copied ? <CheckIcon className="h-3.5 w-3.5 text-black dark:text-(--accent)" /> : <CopyIcon className="h-3.5 w-3.5" />}
    </Button>
  );
}

function InstallBlock({ command, className = '' }: { command: string; className?: string }) {
  return (
    <div
      className={cn(
        'inline-flex w-full items-center justify-between gap-3 rounded-2xl border border-black/15 dark:border-(--accent-border) bg-white px-4 py-3 font-mono text-sm text-fd-foreground shadow-[0_10px_30px_rgba(15,23,42,0.06)] dark:bg-black/40 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:w-auto',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
        <span className="select-none text-black dark:text-(--accent)">$</span>
        <span className="truncate">{command}</span>
      </div>
      <CopyButton text={command} />
    </div>
  );
}

function HeroPanel() {
  return (
    <Card className="overflow-hidden border-black/15 dark:border-(--accent-border) bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(255,255,255,0.94)_30%,rgba(255,255,255,1)_100%)] shadow-[0_24px_64px_rgba(16,24,40,0.08)] dark:bg-[linear-gradient(180deg,rgba(16,185,129,0.08),rgba(0,0,0,0))] dark:shadow-none">
      <CardHeader className="gap-5 border-b border-fd-border/80 pb-5">
        <div className="flex items-center justify-between gap-4">
          <Badge variant="default" className="w-fit">
            The full pipeline
          </Badge>
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-fd-muted-foreground">31 {'->'} 91</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-red-500/20 bg-white p-4 shadow-sm dark:bg-black/30 dark:shadow-none">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-red-700/80 dark:text-red-300/80">Typical setup</div>
            <div className="mt-3 text-4xl font-semibold tracking-tight text-red-700 dark:text-red-300">31/100</div>
            <p className="mt-2 text-sm leading-6 text-fd-foreground/72 dark:text-fd-muted-foreground">
              Vague instructions, exposed paths, missing hooks.
            </p>
          </div>
          <div className="rounded-2xl border border-black/15 dark:border-(--accent-border) bg-white p-4 shadow-sm dark:bg-black/30 dark:shadow-none">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-black/80 dark:text-(--accent)/80">Launchpad</div>
            <div className="mt-3 text-5xl font-semibold tracking-tight text-black dark:text-(--accent)">91/100</div>
            <p className="mt-2 text-sm leading-6 text-fd-foreground/72 dark:text-fd-muted-foreground">
              Security rails, workflow hooks, and docs that match the repo.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-6">
        {improvements.map(({ icon: Icon, label, name }) => (
          <div
            key={name}
            className="grid gap-3 rounded-2xl border border-fd-border bg-white p-3 shadow-sm dark:bg-black/20 dark:shadow-none sm:grid-cols-[36px_minmax(0,1fr)]"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-(--accent-border) bg-black/5 dark:bg-(--accent-bg)">
              <Icon className="h-4 w-4 text-black dark:text-(--accent)" />
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-black/65 dark:text-(--accent)/70">{name}</div>
              <p className="mt-1 text-sm leading-6 text-fd-foreground/72 dark:text-fd-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function CommandStageCard({
  detail,
  href,
  icon: Icon,
  name,
  num,
  verb,
  className,
  featured = false,
}: {
  detail: string;
  href: string;
  icon: LucideIcon;
  name: string;
  num: string;
  verb: string;
  className?: string;
  featured?: boolean;
}) {
  return (
    <Card
      className={cn(
        'group h-full border-fd-border/80 bg-white transition-all hover:-translate-y-0.5 hover:border-(--accent-border) hover:shadow-[0_16px_40px_rgba(16,24,40,0.08)] dark:bg-fd-card/50 dark:hover:bg-fd-card dark:hover:shadow-none',
        className,
      )}
    >
      <CardHeader className={cn('gap-5', featured ? 'pb-4' : '')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="font-mono tracking-[0.2em]">
              {num}
            </Badge>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-fd-border bg-fd-background/70 transition-colors group-hover:border-(--accent-border) group-hover:bg-(--accent-bg) dark:bg-black/20">
              <Icon className="h-4 w-4 text-fd-muted-foreground transition-colors group-hover:text-black dark:group-hover:text-(--accent)" />
            </div>
          </div>
          {featured ? <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-fd-muted-foreground">Core</span> : null}
        </div>
        <div className={cn(featured ? 'max-w-sm' : '')}>
          <CardTitle className={cn('font-mono', featured ? 'text-xl sm:text-2xl' : 'text-base')}>{name}</CardTitle>
          <CardDescription className={cn('mt-2', featured ? 'text-base leading-7' : '')}>{verb}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className={cn(featured ? 'pb-8' : '')}>
        <p className={cn('text-sm leading-6 text-fd-muted-foreground', featured ? 'max-w-md text-[15px] leading-7' : '')}>{detail}</p>
      </CardContent>
      <CardFooter>
        <Link
          href={href}
          className={buttonVariants({
            variant: 'ghost',
            className: 'h-auto px-0 py-0 text-sm text-fd-foreground hover:bg-transparent hover:text-black dark:hover:text-(--accent)',
          })}
        >
          Read docs
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
      </CardFooter>
    </Card>
  );
}

function ProofBoard() {
  return (
    <div className="grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
      <Card className="rounded-2xl bg-white font-mono text-xs shadow-[0_12px_36px_rgba(15,23,42,0.06)] dark:bg-black/30 dark:shadow-none">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <Badge variant="outline">Before</Badge>
            <span className="text-2xl font-semibold tracking-tight text-red-700 dark:text-red-300">31/100</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {beforeItems.map((item) => (
            <div key={item} className="flex items-start gap-3 text-fd-muted-foreground">
              <span className="mt-0.5 text-sm text-red-600 dark:text-red-400">✗</span>
              <span className="leading-5">{item}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-(--accent-border) bg-white font-mono text-xs shadow-[0_16px_40px_rgba(16,24,40,0.08)] dark:bg-black/30 dark:shadow-none">
        <CardHeader className="border-b border-fd-border/80 pb-5">
          <div className="flex items-center justify-between gap-4">
            <Badge variant="default">After --fix</Badge>
            <span className="text-3xl font-semibold tracking-tight text-black dark:text-(--accent)">91/100</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-fd-muted-foreground">Hooks</div>
              <div className="mt-1 text-sm text-fd-foreground">enabled</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-fd-muted-foreground">Credentials</div>
              <div className="mt-1 text-sm text-fd-foreground">blocked</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-[0.22em] text-fd-muted-foreground">Workflow</div>
              <div className="mt-1 text-sm text-fd-foreground">enforced</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
          {afterItems.map((item) => (
            <div key={item} className="flex items-start gap-3 rounded-xl border border-fd-border bg-fd-background/70 p-3 dark:bg-black/20">
              <span className="mt-0.5 text-sm text-black dark:text-(--accent)">✓</span>
              <span className="leading-5 text-fd-muted-foreground">{item}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="relative isolate overflow-hidden">
      <section className="relative">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.05)_0%,rgba(255,255,255,0)_60%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(8,12,14,0.82)_0%,rgba(6,10,12,0.58)_36%,rgba(10,28,22,0.18)_62%,rgba(0,0,0,0)_100%)]" />

        <PageSection className="pt-12 sm:pt-16 md:pt-24">
          <div className="grid gap-8 sm:gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,430px)] lg:items-start">
            <div className="max-w-3xl">
              <Badge variant="outline" className="border-(--accent-border) bg-white/80 text-black dark:bg-transparent dark:text-(--accent)">
                CLI toolkit for Claude Code
              </Badge>
              <h1 className="mt-5 text-5xl font-bold tracking-tight text-fd-foreground sm:mt-6 sm:text-6xl md:text-7xl">
                Your Claude config
                <span className="mt-2 block text-fd-foreground/55 dark:text-fd-muted-foreground">deserves better.</span>
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-fd-foreground/72 dark:text-fd-muted-foreground sm:mt-6 sm:text-lg">
                From stale and insecure to codebase-aware, hardened, and verified. Four commands.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:items-center sm:gap-4">
                <InstallBlock command="npm i -g claude-launchpad" />
                <Link href="/docs" className={buttonVariants({ size: 'default', className: 'w-full rounded-2xl sm:h-[50px] sm:w-auto sm:px-6' })}>
                  Read the docs
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-8 grid gap-3 sm:mt-10 sm:gap-4 sm:grid-cols-3">
                {heroStats.map((stat) => (
                  <Card key={stat.label} className="rounded-xl border-fd-border bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)] dark:bg-fd-card/40 dark:shadow-none">
                    <CardContent className="p-4 sm:p-5">
                      <div className="text-xl font-semibold tracking-tight text-fd-foreground sm:text-2xl">{stat.value}</div>
                      <p className="mt-2 text-xs leading-5 text-fd-foreground/70 dark:text-fd-muted-foreground sm:text-sm sm:leading-6">{stat.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="mt-5 flex flex-wrap gap-2 sm:mt-6">
                {trustPills.map((pill) => (
                  <Badge key={pill} variant="secondary" className="border border-fd-border bg-white text-fd-foreground/70 shadow-sm dark:bg-fd-card/40 dark:text-fd-muted-foreground dark:shadow-none">
                    {pill}
                  </Badge>
                ))}
              </div>
            </div>

            <HeroPanel />
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

          <div className="mt-10 grid gap-5 md:grid-cols-12">
            <CommandStageCard {...steps[0]} featured className="md:col-span-5" />
            <CommandStageCard {...steps[1]} featured className="md:col-span-7" />
            <CommandStageCard {...steps[2]} className="md:col-span-6" />
            <CommandStageCard {...steps[3]} className="md:col-span-6" />
          </div>
        </PageSection>
      </div>

      <PageSection>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
          <SectionHeading
            eyebrow="Proof, not vibes"
            title="See what actually changes"
            description="Doctor scores your config and --fix repairs the gaps. Then enhance rewrites CLAUDE.md with real content. Then eval proves compliance."
          />

          <ProofBoard />
        </div>
      </PageSection>

      <PageSection className="pt-0">
        <Card className="border-(--accent-border) bg-[linear-gradient(135deg,rgba(16,185,129,0.08),rgba(255,255,255,0.96)_38%,rgba(241,245,249,0.98)_100%)] dark:bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(17,24,39,0.7)_55%,rgba(0,0,0,0.75))]">
          <CardHeader className="items-center text-center">
            <Badge variant="default">Ready to run</Badge>
            <CardTitle className="text-2xl sm:text-3xl">Open source. Ready to use.</CardTitle>
            <CardDescription className="max-w-2xl">
              Scaffold, diagnose, perfect, and prove. The full pipeline for Claude Code configs.
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
