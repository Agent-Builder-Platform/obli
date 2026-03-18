import { Link } from 'react-router-dom'
import { ArrowRight, Zap, Users, Layers, Plug, FlaskConical } from 'lucide-react'


function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-base-200">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-black rounded flex items-center justify-center">
            <span className="text-white font-black text-sm tracking-tighter">O</span>
          </div>
          <span className="font-semibold text-xl tracking-tight">obli</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className="btn btn-ghost btn-sm font-medium text-base-content/70 hover:text-base-content"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="btn btn-primary btn-sm gap-1.5 font-medium"
          >
            Get started
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </nav>
  )
}

function Hero() {
  return (
    <section className="pt-40 pb-28 px-6">
      <div className="max-w-4xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-base-200 text-base-content/60 text-xs font-medium uppercase tracking-widest px-4 py-2 rounded-full mb-10">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
          Now in development
        </div>

        <h1 className="text-6xl md:text-7xl font-light leading-[1.05] tracking-tight text-base-content mb-6">
          Your team's AI agents,<br />
          <span className="font-bold">all in one place.</span>
        </h1>

        <p className="text-xl text-base-content/50 font-light max-w-2xl mx-auto leading-relaxed mb-12">
          Obli is the internal platform for building, deploying, testing and sharing AI agents across your organisation —
          without the chaos of everyone using different tools and fears of data misuse.
          <br></br>
          <br></br>
          Connect what you need and not what you don't
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/signup"
            className="btn btn-primary btn-lg gap-2 font-medium px-8"
          >
            Start building
            <ArrowRight size={18} />
          </Link>
          <Link
            to="/login"
            className="btn btn-ghost btn-lg font-medium text-base-content/60"
          >
            Sign in to workspace
          </Link>
        </div>
      </div>
    </section>
  )
}

function Problem() {
  const problems = [
    {
      label: 'Before Obli',
      items: [
        'Half the team is on ChatGPT, the other half is on something else.',
        'Nobody knows what prompts work, no one knows were and how to add commonly used documents — everyone starts from scratch.',
        "Your best AI workflows live in someone's browser history, or siloed to a team."
      ],
      tone: 'text-base-content/40',
    },
    {
      label: 'After Obli',
      items: [
        'One platform. Every agent, every model, all your team.',
        'Shared prompt libraries, tool server, templates and reference document so good work gets reused, not forgotten.',
        'Agents that remember context and acutally know who you are and what your company does',
      ],
      tone: 'text-base-content',
    },
  ]

  return (
    <section className="py-24 px-6 border-t border-base-200">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">
            Better out than in.
          </h2>
          <p className="text-base-content/50 text-lg max-w-xl mx-auto leading-relaxed">
            Scattered AI tools are like onions: they have layers, and they make everyone cry.
            Obli brings it all together.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {problems.map((col) => (
            <div
              key={col.label}
              className={`rounded-2xl border border-base-200 p-8 ${
                col.label === 'After Obli' ? 'bg-black' : 'bg-base-100'
              }`}
            >
              <p
                className={`text-xs font-semibold uppercase tracking-widest mb-6 ${
                  col.label === 'After Obli' ? 'text-white/40' : 'text-base-content/30'
                }`}
              >
                {col.label}
              </p>
              <ul className="space-y-5">
                {col.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className={`mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        col.label === 'After Obli' ? 'bg-white/60' : 'bg-base-content/20'
                      }`}
                    />
                    <p
                      className={`text-base leading-relaxed ${
                        col.label === 'After Obli' ? 'text-white/80' : 'text-base-content/40'
                      }`}
                    >
                      {item}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Features() {
  const features = [
    {
      icon: <Zap size={20} />,
      title: 'Multi-model agents',
      description:
        'Connect to GPT, Claude, Gemini and more. Switch models per agent without rebuilding anything, and with data privacy integrated from day 1',
    },
    {
      icon: <Layers size={20} />,
      title: 'Shared prompt library',
      description:
        'Your best system prompts in one place. Write once, use everywhere, improve over time.',
    },
    {
      icon: <Plug size={20} />,
      title: 'Shared MCP tools',
      description:
        'With support for both out of the box MCP tools, and custom company MCP server, you can easily add tools to your agent, unlock the true preformance of AI',
    },
    {
      icon: <Users size={20} />,
      title: 'Built for teams',
      description:
        'Agents and prompts your whole organisation can discover, use, and build on — not just one power user.',
    },
    {
      icon: <FlaskConical size={20} />,
      title: 'Pre-built testing and evalution for every agent',
      description:
        'Deploy AI agents with confidence with thorough testing and evaluations from the first day the agent is created.',
    },

  ]

  return (
    <section className="py-24 px-6 border-t border-base-200">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">Bring the control of AI agent building to your team</h2>
          <p className="text-base-content/50 text-lg max-w-xl mx-auto leading-relaxed">
            designed to allow team to solve thier own problems
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-base-200 p-8 bg-base-100 hover:border-base-300 transition-colors"
            >
              <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white mb-5">
                {f.icon}
              </div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-base-content/50 text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    { number: '01', title: 'Create an agent', body: 'Pick a model, give it a name, add a system prompt, connect to company knowledge and test.'},
    { number: '02', title: 'Share with your team', body: 'Everyone in your team, company can find and use the agents you build.' },
    { number: '03', title: 'Iterate together', body: 'Improve prompts, swap models, and watch your agents get better over time through test driven development.' },       
  ]

  return (
    <section className="py-24 px-6 border-t border-base-200 bg-base-200/40">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold mb-4">How it works</h2>
          <p className="text-base-content/50 text-lg">
            This is the part of the swamp tour where we explain the swamp.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, i) => (
            <div key={step.number} className="relative">
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-5 left-full w-full h-px bg-base-300 -translate-x-4 z-0" />
              )}
              <div className="relative z-10">
                <p className="text-5xl font-black text-base-content/10 mb-4">{step.number}</p>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-base-content/50 text-sm leading-relaxed">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Contact() {
  return (
    <section className="py-24 px-6 border-t border-base-200">
      <div className="max-w-2xl mx-auto text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-base-content/30 mb-4">
          Enterprise &amp; Teams
        </p>
        <h2 className="text-4xl font-bold mb-4">Get in touch</h2>
        <p className="text-base-content/50 text-lg leading-relaxed mb-10">
          Want to roll out Obli across your organisation? We'd love to talk about
          your use case, data requirements, and how we can help.
        </p>
        <a
          href="mailto:hello@obli.ai"
          className="btn btn-primary btn-lg gap-2 font-medium px-10"
        >
          infoatobli@gmail.com
          <ArrowRight size={18} />
        </a>
      </div>
    </section>
  )
}

function CTA() {
  return (
    <section className="py-28 px-6 bg-black">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-5xl font-heavy text-white leading-tight mb-6">
          Obli gives your team one place to build with AI — properly.
        </h2>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-base-200 py-10 px-6">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-black rounded flex items-center justify-center">
            <span className="text-white font-black text-xs tracking-tighter">O</span>
          </div>
          <span className="font-semibold tracking-tight">obli</span>
        </div>
        <p className="text-base-content/30 text-sm">
          © {new Date().getFullYear()} Obli. All rights reserved.
        </p>
      </div>
    </footer>
  )
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-base-100 font-sans">
      <Navbar />
      <main>
        <Hero />
        <Problem />
        <Features />
        <HowItWorks />
        <Contact />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
