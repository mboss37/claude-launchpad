'use client';

import Link from 'next/link';
import { type ReactNode, useState } from 'react';
import {
  ArrowRightIcon,
  CheckIcon,
  CopyIcon,
  PackageIcon,
  RocketIcon,
  StethoscopeIcon,
  SparklesIcon,
  FlaskConicalIcon,
  BrainIcon,
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
    tag: 'CLI',
  },
  {
    num: '02',
    name: 'doctor',
    icon: StethoscopeIcon,
    verb: 'Find what\'s broken, fix it automatically',
    detail: '15 checks across security, hooks, permissions, and config quality. Auto-repairs what it can. Shows your score.',
    href: '/docs/doctor',
    tag: 'CLI',
  },
  {
    num: '03',
    name: '/lp-enhance',
    icon: SparklesIcon,
    verb: 'Let Claude rewrite your own instructions',
    detail: 'Runs inside Claude Code. Analyzes your codebase and restructures CLAUDE.md with real architecture, conventions, and guardrails.',
    href: '/docs/enhance',
    tag: 'Skill',
  },
  {
    num: '04',
    name: 'eval',
    icon: FlaskConicalIcon,
    verb: 'Prove Claude actually follows your rules',
    detail: '15 scenarios test your config against real tasks. Security, conventions, workflow. You get a score, not a feeling.',
    href: '/docs/eval',
    tag: 'CLI',
  },
  {
    num: '05',
    name: 'memory',
    icon: BrainIcon,
    verb: 'Persistent intelligent memory across sessions',
    detail: 'Decay-based memory system with SQLite, FTS5 search, and 7 MCP tools. Memories fade naturally. Context is auto-injected.',
    href: '/docs/memory',
    tag: 'CLI',
  },
] as const;

const trustPills = ['Open source', 'MIT licensed'] as const;

const heroStats = [
  { value: '5', label: 'commands: init, doctor, enhance, eval, memory' },
  { value: '15', label: 'eval scenarios across security + workflow' },
  { value: '13', label: 'languages auto-detected from your stack' },
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

const improvements = [
  {
    icon: RocketIcon,
    name: 'init',
    label: 'Scaffolds CLAUDE.md, hooks, permissions, sandbox, and sprint tracking from your stack.',
  },
  {
    icon: StethoscopeIcon,
    name: 'doctor',
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
  {
    icon: BrainIcon,
    name: 'memory',
    label: 'Persistent memory with decay model. Context auto-injected, facts auto-extracted.',
  },
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
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-black dark:text-white/70">{eyebrow}</p>
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
      {copied ? <CheckIcon className="h-3.5 w-3.5 text-black dark:text-white" /> : <CopyIcon className="h-3.5 w-3.5" />}
    </Button>
  );
}

function InstallBlock({ command, className = '' }: { command: string; className?: string }) {
  return (
    <div
      className={cn(
        'inline-flex h-10 w-full items-center justify-between gap-2 rounded-2xl border border-black/15 dark:border-white/10 bg-white px-3 font-mono text-[13px] text-fd-foreground shadow-[0_10px_30px_rgba(15,23,42,0.06)] dark:bg-black/40 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] sm:h-auto sm:w-auto sm:gap-3 sm:px-4 sm:py-3 sm:text-sm',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2 overflow-hidden">
        <span className="select-none text-black dark:text-white">$</span>
        <span className="truncate">{command}</span>
      </div>
      <CopyButton text={command} />
    </div>
  );
}

function GitHubMarkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12.2c0 5.2 3.3 9.6 7.8 11.1.6.1.8-.3.8-.6v-2.1c-3.2.7-3.9-1.4-3.9-1.4-.5-1.4-1.3-1.8-1.3-1.8-1.1-.8.1-.8.1-.8 1.2.1 1.9 1.3 1.9 1.3 1.1 2 2.9 1.4 3.6 1.1.1-.8.4-1.4.8-1.7-2.5-.3-5.2-1.3-5.2-5.8 0-1.3.5-2.3 1.2-3.2-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a10.8 10.8 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.9 1.2 2 1.2 3.2 0 4.5-2.7 5.5-5.3 5.8.4.3.8 1 .8 2.1v3.1c0 .3.2.7.8.6a11.7 11.7 0 0 0 7.8-11.1A11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

function HeroPanel() {
  return (
    <Card className="flex flex-col overflow-hidden border-black/15 dark:border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.04),rgba(255,255,255,0.94)_30%,rgba(255,255,255,1)_100%)] shadow-[0_24px_64px_rgba(16,24,40,0.08)] dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(0,0,0,0))] dark:shadow-none">
      <CardHeader className="gap-5 border-b border-fd-border/80 pb-5">
        <div className="flex items-center justify-between gap-4">
          <Badge variant="default" className="w-fit bg-black text-white dark:bg-white dark:text-black">
            The full pipeline
          </Badge>
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-fd-muted-foreground">31 {'->'} 91</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-2xl border border-fd-border bg-white p-4 shadow-sm dark:bg-black/30 dark:shadow-none">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-fd-muted-foreground">Typical setup</div>
            <div className="mt-3 text-4xl font-semibold tracking-tight text-fd-muted-foreground">31/100</div>
            <p className="mt-2 text-sm leading-6 text-fd-foreground/72 dark:text-fd-muted-foreground">
              Vague instructions, exposed paths, missing hooks.
            </p>
          </div>
          <div className="rounded-2xl border border-black/15 dark:border-white/10 bg-white p-4 shadow-sm dark:bg-black/30 dark:shadow-none">
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-black/80 dark:text-white/80">Launchpad</div>
            <div className="mt-3 text-5xl font-semibold tracking-tight text-black dark:text-white">91/100</div>
            <p className="mt-2 text-sm leading-6 text-fd-foreground/72 dark:text-fd-muted-foreground">
              Security rails, workflow hooks, and docs that match the repo.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 items-center pt-5 pb-5">
        <div className="grid w-full grid-cols-3 gap-2">
          {improvements.map(({ icon: Icon, name }) => (
            <div
              key={name}
              className="flex items-center justify-center gap-2 rounded-xl border border-fd-border bg-white px-3 py-2.5 dark:bg-black/20"
            >
              <Icon className="h-4 w-4 shrink-0 text-black/60 dark:text-white/60" />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-black/60 dark:text-white/60">{name}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function CommandStageCard({
  detail,
  href,
  icon: Icon,
  tag,
  name,
  num,
  verb,
  className,
  featured = false,
}: {
  detail: string;
  href: string;
  icon: LucideIcon;
  tag: string;
  name: string;
  num: string;
  verb: string;
  className?: string;
  featured?: boolean;
}) {
  return (
    <Card
      className={cn(
        'group h-full border-fd-border/80 bg-white transition-all hover:-translate-y-0.5 hover:border-black/20 hover:shadow-[0_16px_40px_rgba(16,24,40,0.08)] dark:bg-fd-card/50 dark:hover:border-white/15 dark:hover:bg-fd-card dark:hover:shadow-none',
        className,
      )}
    >
      <CardHeader className={cn('gap-5', featured ? 'pb-4' : '')}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="font-mono tracking-[0.2em]">
              {num}
            </Badge>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-fd-border bg-fd-background/70 transition-colors group-hover:border-black/20 group-hover:bg-black/5 dark:bg-black/20 dark:group-hover:border-white/15 dark:group-hover:bg-white/5">
              <Icon className="h-4 w-4 text-fd-muted-foreground transition-colors group-hover:text-black dark:group-hover:text-white" />
            </div>
          </div>
          {null}
        </div>
        <div className={cn(featured ? 'max-w-sm' : '')}>
          <CardTitle className={cn('font-mono', featured ? 'text-xl sm:text-2xl' : 'text-base')}>{name}</CardTitle>
          <CardDescription className={cn('mt-2', featured ? 'text-base leading-7' : '')}>{verb}</CardDescription>
        </div>
      </CardHeader>
      <CardContent className={cn(featured ? 'pb-8' : '')}>
        <p className={cn('text-sm leading-6 text-fd-muted-foreground', featured ? 'max-w-md text-[15px] leading-7' : '')}>{detail}</p>
      </CardContent>
      <CardFooter className="justify-between">
        <Link
          href={href}
          className={buttonVariants({
            variant: 'ghost',
            className: 'h-auto px-0 py-0 text-sm text-fd-foreground hover:bg-transparent hover:text-black dark:hover:text-white',
          })}
        >
          Read docs
          <ArrowRightIcon className="h-4 w-4" />
        </Link>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-fd-muted-foreground">
          {tag}
        </span>
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
            <span className="text-2xl font-semibold tracking-tight text-fd-muted-foreground">31/100</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {beforeItems.map((item) => (
            <div key={item} className="flex items-start gap-3 text-fd-muted-foreground">
              <span className="mt-0.5 text-sm text-fd-muted-foreground">✗</span>
              <span className="leading-5">{item}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-black/15 dark:border-white/10 bg-white font-mono text-xs shadow-[0_16px_40px_rgba(16,24,40,0.08)] dark:bg-black/30 dark:shadow-none">
        <CardHeader className="border-b border-fd-border/80 pb-5">
          <div className="flex items-center justify-between gap-4">
            <Badge variant="default" className="bg-black text-white dark:bg-white dark:text-black">After --fix</Badge>
            <span className="text-3xl font-semibold tracking-tight text-black dark:text-white">91/100</span>
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
              <span className="mt-0.5 text-sm text-black dark:text-white">✓</span>
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
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(15,23,42,0.04)_0%,rgba(255,255,255,0)_60%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.05)_0%,rgba(0,0,0,0)_62%)]" />

        <PageSection className="pt-12 sm:pt-16 md:pt-24">
          <div className="grid gap-8 sm:gap-10 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,430px)] lg:items-stretch">
            <div className="max-w-3xl">
              <Badge variant="outline" className="border-black/15 bg-white/80 px-2.5 py-0.5 text-[10px] tracking-[0.18em] text-black dark:border-white/10 dark:bg-transparent dark:text-white sm:px-3 sm:py-1 sm:text-[11px] sm:tracking-[0.22em]">
                CLI toolkit for Claude Code
              </Badge>
              <h1 className="mt-4 text-[2.35rem] font-bold leading-[1.04] tracking-tight text-fd-foreground sm:mt-6 sm:text-6xl md:text-7xl">
                Your Claude config
                <span className="mt-2 block text-fd-foreground/55 dark:text-fd-muted-foreground">deserves better.</span>
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-7 text-fd-foreground/78 dark:text-fd-muted-foreground sm:mt-6 sm:text-lg">
                From stale and insecure to codebase-aware, hardened, and verified. Five commands.
              </p>

              <div className="mt-6 flex items-center gap-2 sm:mt-8 sm:gap-4">
                <div className="flex items-center gap-2 sm:hidden">
                  <a
                    href="https://github.com/mboss37/claude-launchpad"
                    aria-label="Open GitHub repository"
                    className={buttonVariants({ variant: 'outline', size: 'icon', className: 'h-10 w-10 rounded-xl' })}
                  >
                    <GitHubMarkIcon className="h-4 w-4" />
                  </a>
                  <a
                    href="https://www.npmjs.com/package/claude-launchpad"
                    aria-label="Open npm package"
                    className={buttonVariants({ variant: 'outline', size: 'icon', className: 'h-10 w-10 rounded-xl' })}
                  >
                    <PackageIcon className="h-4 w-4" />
                  </a>
                </div>
                <InstallBlock command="npm i -g claude-launchpad" className="hidden min-w-0 flex-1 sm:inline-flex sm:flex-none" />
                <Link href="/docs" className={buttonVariants({ size: 'default', className: 'h-10 shrink-0 gap-1 rounded-xl px-3.5 text-[13px] font-semibold sm:h-[50px] sm:gap-2 sm:rounded-2xl sm:px-6 sm:text-sm sm:font-medium' })}>
                  Docs
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-2.5 sm:mt-10 sm:gap-4 sm:grid-cols-3">
                {heroStats.map((stat, index) => (
                  <Card
                    key={stat.label}
                    className={cn(
                      'rounded-xl border-fd-border bg-white shadow-[0_10px_24px_rgba(15,23,42,0.05)] dark:bg-fd-card/40 dark:shadow-none',
                      index === 2 ? 'col-span-2 sm:col-span-1' : '',
                    )}
                  >
                    <CardContent className="p-4 sm:p-5">
                      <div className="text-xl font-semibold tracking-tight text-fd-foreground sm:text-2xl">{stat.value}</div>
                      <p className="mt-1.5 text-[11px] leading-5 text-fd-foreground/72 dark:text-fd-muted-foreground sm:mt-2 sm:text-sm sm:leading-6">{stat.label}</p>
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
            title="Five commands. One configuration you can trust."
            description="Start with a clean baseline, diagnose what's weak, improve the instructions, verify the behavior, and remember what works."
          />

          <div className="mt-10 grid gap-5 md:grid-cols-12">
            <CommandStageCard {...steps[0]} featured className="md:col-span-5" />
            <CommandStageCard {...steps[1]} featured className="md:col-span-7" />
            <CommandStageCard {...steps[2]} className="md:col-span-4" />
            <CommandStageCard {...steps[3]} className="md:col-span-4" />
            <CommandStageCard {...steps[4]} className="md:col-span-4" />
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
        <Card className="border-black/15 dark:border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.04),rgba(255,255,255,0.96)_38%,rgba(241,245,249,0.98)_100%)] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.04),rgba(17,24,39,0.7)_55%,rgba(0,0,0,0.75))]">
          <CardHeader className="items-center text-center">
            <Badge variant="default" className="bg-black text-white dark:bg-white dark:text-black">Ready to run</Badge>
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
