'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import {
  ArrowRightIcon,
  BrainIcon,
  CheckIcon,
  CopyIcon,
  FlaskConicalIcon,
  LaptopIcon,
  LockIcon,
  MonitorIcon,
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
    icon: RocketIcon,
    prefix: '#',
    command: 'Build your project',
    detail: 'Write code, add dependencies, shape the architecture.',
    href: '/docs/init',
  },
  {
    icon: SparklesIcon,
    prefix: '>',
    command: '/lp-enhance',
    detail: 'Claude reads your code and completes CLAUDE.md with real conventions and guardrails.',
    href: '/docs/enhance',
  },
  {
    icon: FlaskConicalIcon,
    prefix: '$',
    command: 'claude-launchpad eval',
    detail: 'Run scenarios to verify Claude actually follows your rules.',
    href: '/docs/eval',
  },
] as const;

const existingProjectSteps = [
  {
    icon: StethoscopeIcon,
    prefix: '$',
    command: 'claude-launchpad',
    detail: 'Runs doctor automatically when config already exists.',
    href: '/docs/doctor',
  },
  {
    icon: StethoscopeIcon,
    prefix: '$',
    command: 'claude-launchpad doctor --fix',
    detail: 'Auto-repair hooks, permissions, and missing sections.',
    href: '/docs/doctor',
  },
  {
    icon: SparklesIcon,
    prefix: '>',
    command: '/lp-enhance',
    detail: 'Claude reads your code and completes CLAUDE.md with real conventions and guardrails.',
    href: '/docs/enhance',
  },
  {
    icon: FlaskConicalIcon,
    prefix: '$',
    command: 'claude-launchpad eval',
    detail: 'Run scenarios to verify Claude actually follows your rules.',
    href: '/docs/eval',
  },
] as const;

const beforeIssues = [
  'Claude forgets context between sessions',
  'Credentials (SSH, AWS) readable',
  'No .claudeignore, reads noise files',
  'Rules followed ~80% of the time',
  'Loses track mid-session after compaction',
  'No guardrails or conventions enforced',
] as const;

const afterOutcomes = [
  'TASKS.md auto-injected every session',
  'Credentials blocked system-wide',
  '.claudeignore filters noise',
  'Hooks enforce rules at 100%',
  'PostCompact re-injects context',
  'CLAUDE.md + rules guide every action',
] as const;

function PageSection({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn(shellClassName, 'py-8 sm:py-10 md:py-14', className)}>{children}</section>;
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
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-fd-muted-foreground">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-fd-muted-foreground sm:text-base">{description}</p>
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
            Consistent developer experience for
            <span className="mt-2 block text-fd-muted-foreground sm:text-7xl">Claude Code.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-fd-muted-foreground sm:text-lg">
            Your default Claude Code config has no hooks, no guardrails, and no structure. Rules get followed ~80% of the time. Credentials are readable. Sessions start from scratch. Launchpad scores your setup, enforces rules with hooks (100% compliance), adds sprint and backlog management, and gives you cross-device memory that syncs automatically.
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <InstallBlock command="npx claude-launchpad" className="w-full sm:w-auto" />
            <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:contents">
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
            description="One command finds misconfigurations. One flag fixes them. Your score goes from failing to passing in seconds."
          />

          <div className="mt-8">
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
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    {afterOutcomes.map((item) => (
                      <div key={item} className="rounded-lg border border-fd-border bg-fd-card px-3 py-2.5 text-sm text-fd-muted-foreground">
                        ✓ {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </TerminalPanel>
            <div className="mt-4">
              <Link href="/docs/doctor" className={buttonVariants({ variant: 'outline', className: 'rounded-xl px-5' })}>
                See what doctor checks
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </PageSection>
      </div>

      <PageSection>
        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
          <div>
            <SectionHeading
              eyebrow="Verify behavior"
              title="Eval: prove Claude follows your rules"
              description="A doctor score of 95% means your config looks good. An eval FAIL means Claude ignores those rules in practice. Eval closes the gap between configuration and actual behavior."
            />
            <div className="mt-6 space-y-3 text-sm text-fd-muted-foreground">
              <p>15 built-in scenarios across 3 suites: security, conventions, and workflow.</p>
              <p>Each run creates an isolated sandbox with your full .claude/ config copied in. Your code is never touched.</p>
            </div>
            <div className="mt-6">
              <Link href="/docs/eval" className={buttonVariants({ className: 'rounded-xl px-5' })}>
                Write your first scenario
                <ArrowRightIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>
          <TerminalPanel title="eval output" aside={<Badge variant="outline">sandbox</Badge>}>
            <div className="space-y-1 font-mono text-[13px]">
              <div className="text-fd-muted-foreground">$ claude-launchpad eval</div>
              <div className="mt-2"><span className="text-green-400">PASS</span> respects-claudeignore <span className="text-fd-muted-foreground">(12s)</span></div>
              <div><span className="text-green-400">PASS</span> follows-off-limits <span className="text-fd-muted-foreground">(8s)</span></div>
              <div><span className="text-green-400">PASS</span> uses-conventional-commits <span className="text-fd-muted-foreground">(6s)</span></div>
              <div><span className="text-red-400">FAIL</span> blocks-credential-leak <span className="text-fd-muted-foreground">(9s)</span></div>
              <div className="mt-2 text-fd-muted-foreground">Score: 3/4 (75%), 1 scenario needs attention</div>
            </div>
          </TerminalPanel>
        </div>
      </PageSection>

      <div className="border-y border-fd-border/80 bg-fd-card/22">
        <PageSection>
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <SectionHeading
              eyebrow="Optional add-on"
              title="Your decisions follow you everywhere"
              description="Claude's built-in memory resets per machine. Launchpad syncs memories to a private GitHub Gist. Switch laptops, pair on a teammate's machine, or set up a new dev environment. Your architecture decisions, bug patterns, and conventions are already there."
            />
            <div className="flex items-center justify-center">
              <div className="relative flex items-center gap-0">
                {/* Device A */}
                <div className="flex flex-col items-center gap-2 z-10">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-fd-border bg-fd-card/95 sm:h-20 sm:w-20">
                    <LaptopIcon className="h-7 w-7 text-fd-muted-foreground sm:h-8 sm:w-8" />
                  </div>
                  <span className="font-mono text-[11px] font-medium text-fd-muted-foreground">Device A</span>
                  <span className="font-mono text-[10px] text-fd-muted-foreground/40">14 memories</span>
                </div>

                {/* Left connector */}
                <div className="flex flex-col items-center -mx-1 sm:mx-0">
                  <span className="font-mono text-[10px] text-fd-muted-foreground/40 mb-1">push</span>
                  <div className="flex items-center">
                    <div className="h-px w-8 border-t border-dashed border-fd-muted-foreground/25 sm:w-14" />
                    <span className="text-fd-muted-foreground/30 text-xs">›</span>
                  </div>
                </div>

                {/* Gist hub */}
                <div className="flex flex-col items-center gap-2 z-10">
                  <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-fd-border bg-fd-card shadow-[0_0_24px_rgba(59,130,246,0.06)] sm:h-24 sm:w-24">
                    <LockIcon className="h-8 w-8 text-fd-foreground/70 sm:h-9 sm:w-9" />
                  </div>
                  <span className="font-mono text-[11px] font-medium text-fd-foreground/80">Private Gist</span>
                  <span className="font-mono text-[10px] text-fd-muted-foreground/40">auto-syncs each session</span>
                </div>

                {/* Right connector */}
                <div className="flex flex-col items-center -mx-1 sm:mx-0">
                  <span className="font-mono text-[10px] text-fd-muted-foreground/40 mb-1">pull</span>
                  <div className="flex items-center">
                    <span className="text-fd-muted-foreground/30 text-xs">›</span>
                    <div className="h-px w-8 border-t border-dashed border-fd-muted-foreground/25 sm:w-14" />
                  </div>
                </div>

                {/* Device B */}
                <div className="flex flex-col items-center gap-2 z-10">
                  <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-fd-border bg-fd-card/95 sm:h-20 sm:w-20">
                    <MonitorIcon className="h-7 w-7 text-fd-muted-foreground sm:h-8 sm:w-8" />
                  </div>
                  <span className="font-mono text-[11px] font-medium text-fd-muted-foreground">Device B</span>
                  <span className="font-mono text-[10px] text-fd-muted-foreground/40">14 memories</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-[0.35fr_0.65fr] lg:items-stretch">
            <div className="flex flex-col justify-between rounded-xl border border-fd-border bg-fd-card/95 p-5">
              <div>
                <div className="flex items-center gap-2">
                  <BrainIcon className="h-5 w-5 text-fd-muted-foreground" />
                  <span className="font-mono text-sm font-medium">claude-launchpad memory</span>
                </div>
                <p className="mt-3 text-sm text-fd-muted-foreground">One command to set up. Claude does the bookkeeping from there.</p>
                <div className="mt-4 space-y-2 text-sm text-fd-muted-foreground">
                  <div className="flex items-center gap-2"><span className="text-fd-foreground">✓</span> Syncs across devices via private GitHub Gist</div>
                  <div className="flex items-center gap-2"><span className="text-fd-foreground">✓</span> Relevant memories injected automatically at session start</div>
                  <div className="flex items-center gap-2"><span className="text-fd-foreground">✓</span> Stale knowledge fades, important decisions persist</div>
                  <div className="flex items-center gap-2"><span className="text-fd-foreground">✓</span> Each project gets its own scoped memory</div>
                  <div className="flex items-center gap-2"><span className="text-fd-foreground">✓</span> Terminal dashboard to browse and manage</div>
                  <div className="flex items-center gap-2"><span className="text-fd-foreground">✓</span> One command to install, zero config after that</div>
                </div>
              </div>
              <div className="mt-5">
                <Link href="/docs/memory" className={buttonVariants({ variant: 'outline', className: 'w-full rounded-lg' })}>
                  Set up memory
                  <ArrowRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <TerminalPanel title="memory --dashboard" className="hidden sm:block">
              <div className="text-[11px] leading-[1.5] lg:text-[13px] xl:text-[14px]">
                <div className="flex justify-between text-fd-foreground/70">
                  <span>cockpit [project:my-app | sort:importance]</span>
                  <span className="text-fd-muted-foreground/40">[/]=search [p]=projects [1-5]=type</span>
                </div>
                <div className="mt-1 flex gap-4">
                  <div className="flex-1 min-w-0">
                    <pre className="text-cyan-500/25">{`── Memories ────────────────────────────────`}</pre>
                    <pre>{` `}<span className="text-green-400/50">▸</span>{` `}<span className="text-fd-foreground font-bold">Never rush irreversible…</span>{`  `}<span className="text-cyan-400/40">SEMA</span>{` `}<span className="text-green-400/25">90%</span>{` `}<span className="text-blue-400/30">acc:6</span></pre>
                    <pre className="text-fd-muted-foreground">{`   Push back hard on bad…    `}<span className="text-cyan-400/30">SEMA</span>{` `}<span className="text-green-400/30">80%</span>{` `}<span className="text-blue-400/20">acc:2</span></pre>
                    <pre className="text-fd-muted-foreground">{`   CHANGELOG is CLI-only     `}<span className="text-cyan-400/30">SEMA</span>{` `}<span className="text-green-400/30">80%</span>{` `}<span className="text-blue-400/20">acc:4</span></pre>
                    <pre className="text-fd-muted-foreground">{`   Command order - canoni…   `}<span className="text-cyan-400/30">SEMA</span>{` `}<span className="text-green-400/30">80%</span>{` `}<span className="text-blue-400/20">acc:8</span></pre>
                    <pre className="text-fd-muted-foreground">{`   No em dashes in docs      `}<span className="text-cyan-400/30">SEMA</span>{` `}<span className="text-yellow-400/30">70%</span>{` `}<span className="text-blue-400/20">acc:0</span></pre>
                    <pre className="text-fd-muted-foreground">{`   Architecture decisions    `}<span className="text-cyan-400/30">SEMA</span>{` `}<span className="text-yellow-400/25">60%</span>{` `}<span className="text-blue-400/20">acc:2</span></pre>
                    <pre className="text-fd-muted-foreground">{`   Eval engine design        `}<span className="text-cyan-400/30">SEMA</span>{` `}<span className="text-yellow-400/25">60%</span>{` `}<span className="text-blue-400/20">acc:0</span></pre>
                    <pre className="text-fd-muted-foreground">{`   Agent permissions         `}<span className="text-cyan-400/30">SEMA</span>{` `}<span className="text-yellow-400/30">70%</span>{` `}<span className="text-blue-400/20">acc:4</span></pre>
                    <pre className="text-fd-muted-foreground">{`   Read before judging       `}<span className="text-cyan-400/30">SEMA</span>{` `}<span className="text-yellow-400/30">70%</span>{` `}<span className="text-blue-400/20">acc:0</span></pre>
                  </div>
                  <div className="shrink-0">
                    <pre className="text-purple-400/25">{`── Projects ────────────`}</pre>
                    <pre className="text-fd-muted-foreground">{`  All projects    28 mem`}</pre>
                    <pre className="text-yellow-300/50">{`> my-app          14 mem`}</pre>
                    <pre className="text-fd-muted-foreground">{`  api-server       8 mem`}</pre>
                    <pre className="text-fd-muted-foreground">{`  shared-lib       6 mem`}</pre>
                    <pre className="text-blue-400/20">{`── Detail ──────────────`}</pre>
                    <pre className="text-fd-foreground font-bold">{`Never rush irreversible`}</pre>
                    <pre className="text-fd-muted-foreground">{`Type: `}<span className="text-cyan-400/40">semantic</span></pre>
                    <pre className="text-fd-muted-foreground">{`Health:  `}<span className="text-green-400/35">████████</span><span className="text-fd-muted-foreground/30">░░</span>{` 100%`}</pre>
                    <pre className="text-fd-muted-foreground">{`Import:  `}<span className="text-green-400/35">█████████</span><span className="text-fd-muted-foreground/30">░</span>{` 0.90`}</pre>
                  </div>
                </div>
                <div className="mt-1 flex justify-between text-fd-muted-foreground/30">
                  <span>28 memories | 4 relations | 1.7MB</span>
                  <span><span className="text-green-400/25">healthy:24</span> <span className="text-yellow-400/20">fading:3</span> <span className="text-red-400/20">stale:1</span></span>
                </div>
              </div>
            </TerminalPanel>
          </div>
        </PageSection>
      </div>

      <PageSection>
        <SectionHeading
          eyebrow="The full picture"
          title="Each tool has one job"
          description="init scaffolds. doctor maintains. /lp-enhance makes it smart. eval proves it works. memory remembers."
        />

        <div className="mt-8 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-fd-border text-left">
                <th className="py-3 pr-4 font-medium text-fd-muted-foreground">Responsibility</th>
                {['init', 'doctor --fix', '/lp-enhance', 'eval', 'memory'].map((cmd) => (
                  <th key={cmd} className="px-3 py-3 text-center font-mono text-xs font-medium">{cmd}</th>
                ))}
              </tr>
            </thead>
            <tbody className="text-fd-muted-foreground">
              {[
                ['Detect stack and framework', true, false, false, false, false],
                ['Generate CLAUDE.md, TASKS.md, BACKLOG.md', true, false, false, false, false],
                ['Generate settings.json and hooks', true, true, false, false, false],
                ['Generate .claudeignore', true, true, false, false, false],
                ['Score config 0-100', false, true, false, false, false],
                ['Fix missing sections, rules, permissions', false, true, false, false, false],
                ['Add stop-and-swarm rule (When Stuck)', true, true, false, false, false],
                ['Rewrite CLAUDE.md with real project content', false, false, true, false, false],
                ['Suggest hooks, MCP servers, path-scoped rules', false, false, true, false, false],
                ['Overflow conventions to .claude/rules/', false, false, true, false, false],
                ['Prove Claude follows your rules', false, false, false, true, false],
                ['Run sandbox test scenarios', false, false, false, true, false],
                ['Persistent cross-session memory', false, false, false, false, true],
                ['Dashboard, sync, migration', false, false, false, false, true],
              ].map(([label, ...checks]) => (
                <tr key={label as string} className="border-b border-fd-border/50">
                  <td className="py-2.5 pr-4 text-fd-foreground/80">{label as string}</td>
                  {(checks as boolean[]).map((check, i) => (
                    <td key={i} className="px-3 py-2.5 text-center">
                      {check ? <span className="text-fd-foreground">✓</span> : <span className="text-fd-muted-foreground/20">-</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <Link href="/docs" className={buttonVariants({ variant: 'outline', className: 'rounded-xl px-5' })}>
            Read the full docs
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
      </PageSection>

      <div className="border-t border-fd-border/80">
      <PageSection>
        <TerminalPanel title="get started" aside={<Badge variant="secondary">docs-first</Badge>}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h3 className="text-2xl font-semibold tracking-tight">Zero config to start. Five minutes to a scored setup.</h3>
              <p className="mt-2 text-sm leading-6 text-fd-muted-foreground">
                The quickstart walks you through init, doctor, enhance, and eval. Flags, edge cases, and CI integration are in the full docs.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <InstallBlock command="npx claude-launchpad" className="w-full" />
              <div className="grid grid-cols-2 gap-2">
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
      </div>

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
