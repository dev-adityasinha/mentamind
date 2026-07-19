"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Search,
  Menu,
  X,
  ChevronRight,
  Home,
  Star,
  MessageCircle,
  FileText,
  Users,
  ShieldCheck,
} from "lucide-react";

const BACKGROUND_VIDEO_URL =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260508_064122_c4750c0e-7476-4b44-94a2-a85a65c63bf2.mp4";

const gradientStyle: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(to right, #091020 0%, #0B2551 12.5%, #A4F4FD 32.5%, #00d2ff 50%, #0B2551 67.5%, #091020 87.5%, #091020 100%)",
  backgroundSize: "200% auto",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
  WebkitTextFillColor: "transparent",
  filter: "url(#c3-noise)",
};

function LogoMark({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <Image
      src="/logo/mentamind.webp"
      alt="Mentamind"
      width={32}
      height={32}
      className={`${className} object-contain`}
    />
  );
}

function PrimaryButton({ label = "Get started" }: { label?: string }) {
  return (
    <Link
      href="/register"
      className="group inline-flex items-center justify-center gap-2 rounded-full bg-white text-black font-medium text-sm px-5 py-3 transition-all hover:bg-white/90 active:scale-[0.98]"
    >
      <LogoMark className="w-4 h-4" />
      {label}
      <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-[1px]" />
    </Link>
  );
}

function SectionEyebrow({ label, tag }: { label: string; tag?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-1.5 h-1.5 rounded-full bg-white" />
      <span className="text-xs font-medium uppercase tracking-widest text-white/70">
        {label}
      </span>
      {tag && (
        <span className="px-2 py-0.5 rounded-full border border-white/10 text-white/50 text-[10px] uppercase tracking-wide">
          {tag}
        </span>
      )}
    </div>
  );
}

const NAV_LINKS = ["Features", "How it works"];

type TabKey = "home" | "checkin" | "coach" | "journal" | "forum" | "insights";

const TABS: { key: TabKey; label: string; icon: typeof Home; count?: number }[] = [
  { key: "home", label: "Home", icon: Home },
  { key: "checkin", label: "Check-in", icon: Star, count: 4 },
  { key: "coach", label: "Coach", icon: MessageCircle },
  { key: "journal", label: "Journal", icon: FileText, count: 2 },
  { key: "forum", label: "Forum", icon: Users },
  { key: "insights", label: "Insights", icon: ShieldCheck },
];

const TAB_CONTENT: Record<
  TabKey,
  {
    list: { title: string; time: string; unread?: boolean }[];
    readerTitle: string;
    readerBody: React.ReactNode;
  }
> = {
  home: {
    list: [
      { title: "Today's check-in", time: "8:41 AM", unread: true },
      { title: "Coach reflection", time: "8:12 AM" },
      { title: "Weekly signal", time: "Yesterday" },
    ],
    readerTitle: "Welcome back",
    readerBody: (
      <>
        <p>3 day check-in streak.</p>
        <p>Mood trending steady this week.</p>
      </>
    ),
  },
  checkin: {
    list: [
      { title: "Mood check-in", time: "8:41 AM", unread: true },
      { title: "Mood check-in", time: "Yesterday" },
      { title: "Mood check-in", time: "Mon" },
      { title: "Mood check-in", time: "Sun" },
    ],
    readerTitle: "Mood check-in",
    readerBody: (
      <>
        <div className="liquid-glass rounded-lg p-3 flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 mt-0.5" style={{ color: "#A4F4FD" }} />
          <p className="text-white/60">Energy 7/10, stress 4/10. Steady week.</p>
        </div>
        <p>Want to talk it through, or try a short breathing exercise?</p>
      </>
    ),
  },
  coach: {
    list: [
      { title: "Naming what is hard", time: "8:12 AM", unread: true },
      { title: "Deadline pressure", time: "Mon" },
      { title: "Sleep routine", time: "Fri" },
    ],
    readerTitle: "AI Coach",
    readerBody: (
      <>
        <div className="rounded-2xl rounded-br-sm bg-white/10 px-3 py-2 ml-auto max-w-[80%] text-right">
          The deadline is stressing me out.
        </div>
        <div className="rounded-2xl rounded-bl-sm bg-white/5 px-3 py-2 max-w-[80%]">
          That&apos;s real. What would make tomorrow feel lighter?
        </div>
      </>
    ),
  },
  journal: {
    list: [
      { title: "Untitled entry", time: "Today", unread: true },
      { title: "Untitled entry", time: "Sat" },
    ],
    readerTitle: "Private journal",
    readerBody: (
      <>
        <span className="text-[10px] px-2 py-0.5 rounded-full border border-white/10 text-white/50">
          Only visible to you
        </span>
        <p className="mt-3">A quiet space to write, separate from check-ins.</p>
      </>
    ),
  },
  forum: {
    list: [
      { title: "Anyone else finding this week rough?", time: "2h", unread: true },
      { title: "How do you unplug on weekends?", time: "1d" },
    ],
    readerTitle: "Community forum",
    readerBody: (
      <>
        <div className="rounded-2xl rounded-bl-sm bg-white/5 px-3 py-2 max-w-[85%]">
          <span className="text-[10px] text-white/40 block mb-1">Anonymous</span>
          Anyone else finding this week rough?
        </div>
        <div className="rounded-2xl rounded-bl-sm bg-white/5 px-3 py-2 max-w-[85%]">
          <span className="text-[10px] text-white/40 block mb-1">You</span>
          Same. The check-in helped me name it.
        </div>
      </>
    ),
  },
  insights: {
    list: [
      { title: "Team 1", time: "Low" },
      { title: "Team 2", time: "Watch" },
      { title: "Team 3", time: "Low" },
    ],
    readerTitle: "Org signal",
    readerBody: (
      <>
        <p>Individual entries stay private, always.</p>
        <div className="mt-3 space-y-2">
          {[
            { label: "Response rate", value: 82 },
            { label: "Coach engagement", value: 54 },
          ].map((bar) => (
            <div key={bar.label}>
              <div className="flex justify-between text-[11px] text-white/40 mb-1">
                <span>{bar.label}</span>
                <span>{bar.value}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5">
                <div
                  className="h-1.5 rounded-full bg-white/50"
                  style={{ width: `${bar.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </>
    ),
  },
};

const SIGNAL_ROWS = [
  { team: "Team 1", status: "Low", tone: "#10b981" },
  { team: "Team 2", status: "Watch", tone: "#f59e0b" },
  { team: "Team 3", status: "Low", tone: "#10b981" },
];

const TRUST_POINTS = [
  "AES-256 encryption",
  "SSO / SAML",
  "Private by default",
  "Built with clinicians",
];

const TESTIMONIALS = [
  {
    quote: "A real signal, not a once-a-year survey nobody remembers filling out.",
    name: "People Ops Lead",
    role: "Technology company",
  },
  {
    quote: "The AI coach is the part employees actually use.",
    name: "Head of HR",
    role: "Healthcare org",
  },
  {
    quote: "We see risk trending in a team before it shows up as attrition.",
    name: "VP of People",
    role: "Remote team",
  },
];

function ProductMockup() {
  const [active, setActive] = useState<TabKey>("checkin");
  const content = TAB_CONTENT[active];

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#0e1014]/90 backdrop-blur-2xl"
    >
      <div className="h-10 flex items-center justify-center relative border-b border-white/10 bg-black/30">
        <div className="absolute left-4 flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
          <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
          <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-xs text-white/50">Mentamind</span>
      </div>

      <div className="grid grid-cols-12 h-[460px]">
        <div className="col-span-12 sm:col-span-3 border-r border-white/10 bg-black/30 p-4 hidden sm:flex sm:flex-col">
          <Link
            href="/register"
            className="w-full rounded-lg bg-white text-black text-xs font-semibold px-3 py-2 flex items-center justify-center gap-2 mb-4"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Start check-in
          </Link>
          <nav className="flex flex-col gap-1 text-xs">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActive(tab.key)}
                className={`flex items-center justify-between rounded-md px-2 py-1.5 text-left ${active === tab.key
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/5"
                  }`}
              >
                <span className="flex items-center gap-2">
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </span>
                {tab.count && <span className="text-white/40">{tab.count}</span>}
              </button>
            ))}
          </nav>
        </div>

        <div className="col-span-12 sm:col-span-4 border-r border-white/10 hidden md:flex md:flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 text-white/40 text-xs">
            <Search className="w-3.5 h-3.5" />
            Search
          </div>
          <div className="flex-1 overflow-y-auto">
            {content.list.map((item, i) => (
              <div
                key={item.title + i}
                className={`px-4 py-3 border-b border-white/5 ${i === 0 ? "bg-white/[0.04]" : ""
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs ${item.unread ? "text-white font-medium" : "text-white/60"
                      }`}
                  >
                    {item.title}
                  </span>
                  <span className="text-[10px] text-white/30">{item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-12 sm:col-span-5 p-4">
          <h4 className="text-sm font-semibold text-white">{content.readerTitle}</h4>
          <div className="mt-3 space-y-3 text-xs text-white/60 leading-relaxed">
            {content.readerBody}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SignalSection() {
  return (
    <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-20 md:py-28">
      <div className="grid md:grid-cols-2 gap-10 md:gap-16 items-start">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7 }}
        >
          <SectionEyebrow label="Signal" tag="AI-native" />
          <h2 className="mt-5 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.02]">
            See burnout coming.
          </h2>
          <p className="mt-6 text-white/60 text-base leading-[1.6] max-w-md">
            Daily check-ins, read across your org, surfaced early. No
            individual entry ever reaches a manager.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {["Risk scoring", "Weekly digests", "Private by default", "Admin dashboard"].map(
              (chip) => (
                <span
                  key={chip}
                  className="text-xs text-white/70 px-3 py-1.5 rounded-full border border-white/10 bg-white/[0.03]"
                >
                  {chip}
                </span>
              ),
            )}
          </div>
        </motion.div>

        <div className="liquid-glass rounded-2xl p-5">
          <div className="text-xs text-white/40 mb-4">This week</div>
          <div className="grid grid-cols-3 gap-2">
            {SIGNAL_ROWS.map((row) => (
              <div key={row.team} className="liquid-glass rounded-lg p-3 text-center">
                <div className="text-lg font-semibold" style={{ color: row.tone }}>
                  {row.status}
                </div>
                <div className="text-xs text-white/40 mt-1">{row.team}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustStrip() {
  return (
    <section id="for-teams" className="max-w-6xl mx-auto px-6 py-16 md:py-20">
      <div className="text-center text-xs uppercase tracking-widest text-white/40">
        Built for security-conscious teams
      </div>
      <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-6">
        {TRUST_POINTS.map((point, i) => (
          <motion.div
            key={point}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
            className="text-sm font-medium tracking-tight text-white/50 text-center"
          >
            {point}
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-20 md:py-28 border-t border-white/10">
      <div className="grid md:grid-cols-3 gap-6">
        {TESTIMONIALS.map((t) => (
          <figure key={t.name} className="liquid-glass rounded-2xl p-6">
            <blockquote className="text-sm text-white/80 leading-[1.6]">
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <figcaption className="mt-6 pt-5 border-t border-white/10">
              <div className="text-sm font-semibold">{t.name}</div>
              <div className="text-xs text-white/50 mt-0.5">{t.role}</div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="dark relative min-h-screen overflow-x-hidden bg-[#0c0c0c] text-white">
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <filter id="c3-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency={0.9}
              numOctaves={2}
              stitchTiles="stitch"
            />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.35 0"
            />
            <feComposite in2="SourceGraphic" operator="in" result="noise" />
            <feBlend in="SourceGraphic" in2="noise" mode="multiply" />
          </filter>
        </defs>
      </svg>

      <div className="fixed inset-0 z-0 pointer-events-none">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover pointer-events-none opacity-60"
          src={BACKGROUND_VIDEO_URL}
        />
        <div className="absolute inset-0 bg-[#0c0c0c]/50" />
      </div>

      <div className="relative z-10">
        <motion.nav
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between"
        >
          <Link href="/" className="flex items-center">
            <LogoMark />
          </Link>
          <div className="hidden md:flex gap-8">
            {NAV_LINKS.map((link, i) => (
              <motion.a
                key={link}
                href={`#${link.toLowerCase().replace(/\s+/g, "-")}`}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
                className="text-white/70 text-sm font-medium hover:text-white"
              >
                {link}
              </motion.a>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-4">
            <Link href="/login" className="text-white/70 text-sm font-medium hover:text-white">
              Log in
            </Link>
            <PrimaryButton />
          </div>
          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="md:hidden w-10 h-10 rounded-full border border-white/10 bg-white/5 flex items-center justify-center"
          >
            {menuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </motion.nav>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden border-b border-white/10"
            >
              <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col gap-4">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link}
                    href={`#${link.toLowerCase().replace(/\s+/g, "-")}`}
                    onClick={() => setMenuOpen(false)}
                    className="text-white/70 text-sm font-medium hover:text-white"
                  >
                    {link}
                  </a>
                ))}
                <Link
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="text-white/70 text-sm font-medium hover:text-white"
                >
                  Log in
                </Link>
                <PrimaryButton />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <section className="pt-16 md:pt-28 pb-20 text-center flex flex-col items-center px-6">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="text-4xl md:text-7xl font-semibold tracking-tight leading-[0.9]"
          >
            Support your team.
            <br />
            <span className="animate-shiny" style={gradientStyle}>
              Before burnout.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-8 text-white/60 max-w-md text-base leading-[1.5]"
          >
            Daily check-ins, an AI coach, and real support. Plus the org-wide
            signal to act early.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-8 flex flex-col items-center gap-3"
          >
            <PrimaryButton label="Get started free" />
          </motion.div>
        </section>

        <section id="features" className="max-w-6xl mx-auto px-6 py-16 md:py-24">
          <ProductMockup />
        </section>

        <SignalSection />
        <TrustStrip />
        <Testimonials />

        <section className="max-w-6xl mx-auto px-6 py-20 md:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.7 }}
            className="liquid-glass relative overflow-hidden rounded-3xl px-8 py-16 md:py-24 text-center"
          >
            <div
              className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                background:
                  "radial-gradient(600px circle at 50% 0%, rgba(255,255,255,0.15), transparent 70%)",
              }}
            />
            <div className="relative">
              <h2 className="text-4xl md:text-6xl font-semibold tracking-tight leading-[1.02]">
                Support your people.
              </h2>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <PrimaryButton label="Get started free" />
                <a
                  href="mailto:noreply.mentamind@gmail.com"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 text-white text-sm font-medium px-5 py-3 hover:bg-white/5"
                >
                  Talk to us
                  <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </motion.div>
        </section>

        <footer className="border-t border-white/10">
          <div className="max-w-6xl mx-auto flex flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-white/40 sm:flex-row">
            <div className="flex items-center gap-2">
              <LogoMark className="w-[18px] h-[18px]" />© {new Date().getFullYear()} Mentamind
            </div>
            <div className="flex gap-4">
              <Link href="/login" className="hover:text-white/70">
                Log in
              </Link>
              <Link href="/register" className="hover:text-white/70">
                Get started
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
