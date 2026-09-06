/**
 * ScrollCraft Demo Page
 *
 * Demonstrates the scrollcraft integration with ARS design tokens.
 * This component shows various scroll-driven interaction patterns.
 */

import { ScrollPage, WorldFlight } from './ScrollPage';
import {
  ScrollAct,
  ScrollStage,
  ScrollCopy,
  ScrollScrim,
  ScrollMedia,
  ScrollCue,
  ScrollReveal,
  ScrollParallax,
  ScrollCounter,
  ScrollDisplay,
  ScrollLedea,
  ScrollBody,
  ScrollLabel,
  ScrollWrap,
  ScrollSection,
  ScrollTilt,
  ScrollSpotlight,
  ScrollMagnet,
} from './components';
import { arsScrollThemes } from './ars-tokens';
import { ArrowRight, BookOpen, Search, Users } from 'lucide-react';

/**
 * Demo sections showing different scrollcraft patterns
 */

function HeroSection() {
  return (
    <ScrollAct act="scrub" span={2.5} dwell={0.3}>
      <ScrollStage>
        {/* Background video/image */}
        <ScrollMedia
          type="video"
          src="/assets/demo-hero.mp4"
          poster="/assets/demo-hero-poster.jpg"
          className="sc-stage__media"
        />
        
        {/* Gradient overlay for text legibility */}
        <ScrollScrim variant="band" />
        
        {/* Hero copy */}
        <ScrollCopy position="lead">
          <ScrollLabel data-sc-cue="0.1 0.3">Academic Research System</ScrollLabel>
          <ScrollDisplay 
            size="xl" 
            data-sc-cue="0.15 0.4" 
            data-sc-kinetic="words"
            style={{ marginTop: '1rem' }}
          >
            Where Vietnamese researchers share, review, and advance science together.
          </ScrollDisplay>
          <ScrollLedea 
            data-sc-cue="0.3 0.6" 
            style={{ marginTop: '1.5rem', maxWidth: '46ch' }}
          >
            Discover research, join structured peer review, organize academic seminars, 
            and collaborate by role — all in one secure platform.
          </ScrollLedea>
          <div 
            className="sc-actions" 
            data-sc-cue="0.4 0.7"
            style={{ marginTop: '2rem', display: 'flex', gap: '1rem' }}
          >
            <a 
              href="/login" 
              className="sc-button sc-button--primary"
              style={{
                background: 'var(--sc-accent)',
                color: 'var(--sc-accent-ink)',
                padding: '0.75rem 1.5rem',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              Get started free <ArrowRight size={18} />
            </a>
            <a 
              href="#features" 
              className="sc-button sc-button--ghost"
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '6px',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              View features
            </a>
          </div>
        </ScrollCopy>
      </ScrollStage>
    </ScrollAct>
  );
}

function ParallaxHero() {
  return (
    <section data-sc-act="pin" data-sc-span="1.8" style={{ position: 'relative' }}>
      <div className="sc-stage" style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden' }}>
        {/* Background with parallax */}
        <ScrollParallax 
          rate={-0.3} 
          style={{ 
            position: 'absolute', 
            inset: '-20%', 
            zIndex: 0 
          }}
        >
          <img 
            src="/assets/demo-bg.jpg" 
            alt="" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </ScrollParallax>
        
        {/* Foreground content */}
        <div className="sc-copy sc-copy--center" style={{ zIndex: 1 }}>
          <ScrollCue cue="0.1 0.5" kinetic="chars">
            <ScrollDisplay size="lg" style={{ textAlign: 'center' }}>
              Structured Discovery
            </ScrollDisplay>
          </ScrollCue>
          <ScrollCue cue="0.2 0.6" style={{ marginTop: '1rem' }}>
            <ScrollBody style={{ textAlign: 'center', maxWidth: '40ch', margin: '0 auto' }}>
              Browse papers by field, author group, and trends. 
              Save to your watchlist to never miss an update.
            </ScrollBody>
          </ScrollCue>
        </div>
        
        <ScrollScrim variant="vignette" />
      </div>
    </section>
  );
}

function FeatureSection() {
  const features = [
    {
      icon: Search,
      title: 'Structured Discovery',
      description: 'Browse papers by field, author group, and trends. Save to your watchlist to never miss an update.',
    },
    {
      icon: BookOpen,
      title: 'Trusted Peer Review',
      description: 'Structured evaluation workflows enable clear feedback, transparent version history, and auditable publication decisions.',
    },
    {
      icon: Users,
      title: 'Role-based Collaboration',
      description: 'Dedicated workspaces for Lecturers, Researchers, Reviewers, and Admins with clear permissions.',
    },
  ];

  return (
    <ScrollSection>
      <ScrollWrap>
        <div 
          className="sc-section-header"
          data-sc-in
          style={{ marginBottom: '4rem', textAlign: 'center' }}
        >
          <ScrollLabel>Platform Features</ScrollLabel>
          <ScrollDisplay size="lg" style={{ marginTop: '0.5rem' }}>
            Everything your research team needs
          </ScrollDisplay>
        </div>
        
        <div 
          className="sc-features-grid"
          data-sc-in
          data-sc-stagger="80"
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '2rem' 
          }}
        >
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <article 
                key={index}
                className="sc-feature-card"
                style={{
                  background: 'var(--sc-surface)',
                  borderRadius: '12px',
                  padding: '2rem',
                  border: '1px solid var(--sc-hairline)',
                }}
              >
                <div 
                  className="sc-feature-icon"
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '8px',
                    background: 'var(--sc-accent)',
                    color: 'var(--sc-accent-ink)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '1.5rem',
                  }}
                >
                  <Icon size={24} />
                </div>
                <ScrollDisplay size="md" style={{ marginBottom: '0.75rem' }}>
                  {feature.title}
                </ScrollDisplay>
                <ScrollBody>
                  {feature.description}
                </ScrollBody>
              </article>
            );
          })}
        </div>
      </ScrollWrap>
    </ScrollSection>
  );
}

function StatsSection() {
  return (
    <ScrollAct act="pin" span={1.5}>
      <ScrollStage>
        <div 
          style={{
            position: 'absolute',
            inset: 0,
            background: 'var(--sc-canvas)',
            zIndex: 0,
          }}
        />
        <ScrollCopy position="center">
          <div 
            className="sc-stats-grid"
            data-sc-in
            data-sc-stagger="100"
            style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '3rem',
              textAlign: 'center',
            }}
          >
            <div className="sc-stat">
              <ScrollCounter 
                range="0 1200" 
                at="0.1 0.5" 
                className="sc-display sc-display--xl"
              />
              <ScrollLabel style={{ display: 'block', marginTop: '0.5rem' }}>
                Papers published
              </ScrollLabel>
            </div>
            <div className="sc-stat">
              <ScrollCounter 
                range="0 340" 
                at="0.15 0.55" 
                className="sc-display sc-display--xl"
              />
              <ScrollLabel style={{ display: 'block', marginTop: '0.5rem' }}>
                Active researchers
              </ScrollLabel>
            </div>
            <div className="sc-stat">
              <ScrollCounter 
                range="0 85" 
                at="0.2 0.6" 
                className="sc-display sc-display--xl"
              />
              <ScrollLabel style={{ display: 'block', marginTop: '0.5rem' }}>
                Seminars held
              </ScrollLabel>
            </div>
          </div>
        </ScrollCopy>
      </ScrollStage>
    </ScrollAct>
  );
}

function RevealSection() {
  return (
    <ScrollSection>
      <ScrollWrap>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4rem', alignItems: 'center' }}>
          <div>
            <ScrollLabel data-sc-in>Editorial Workflow</ScrollLabel>
            <ScrollReveal direction="up" at="0 0.5">
              <ScrollDisplay size="lg" style={{ marginTop: '0.5rem' }}>
                Five stages. Clear responsibility at each one.
              </ScrollDisplay>
            </ScrollReveal>
            <ScrollReveal direction="up" at="0.1 0.6" style={{ marginTop: '1.5rem' }}>
              <ScrollBody>
                Researchers submit manuscripts, administrators screen for readiness, 
                reviewers provide recommendations, administrators make final decisions, 
                and only approved research reaches the public catalog.
              </ScrollBody>
            </ScrollReveal>
          </div>
          <div data-sc-in>
            <img 
              src="/assets/demo-workflow.svg" 
              alt="Editorial workflow diagram" 
              style={{ width: '100%', height: 'auto' }}
            />
          </div>
        </div>
      </ScrollWrap>
    </ScrollSection>
  );
}

function InteractiveSection() {
  return (
    <ScrollSection style={{ minHeight: '200vh' }}>
      <ScrollWrap>
        <div style={{ textAlign: 'center', padding: '50vh 0' }}>
          <ScrollLabel data-sc-in>Interactive Elements</ScrollLabel>
          <ScrollReveal direction="up" at="0.1 0.5">
            <ScrollDisplay size="lg" style={{ marginTop: '1rem' }}>
              Hover to interact
            </ScrollDisplay>
          </ScrollReveal>
        </div>
        
        {/* Tilt demo */}
        <div 
          data-sc-in
          style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            gap: '3rem', 
            flexWrap: 'wrap',
            padding: '10vh 0',
          }}
        >
          <ScrollTilt degrees={12}>
            <div 
              style={{
                width: '200px',
                height: '200px',
                background: 'var(--sc-surface)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--sc-hairline)',
              }}
            >
              <ScrollLabel>Tilt on hover</ScrollLabel>
            </div>
          </ScrollTilt>
          
          <ScrollMagnet strength={0.25}>
            <div 
              style={{
                width: '200px',
                height: '200px',
                background: 'var(--sc-surface)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--sc-hairline)',
              }}
            >
              <ScrollLabel>Magnet effect</ScrollLabel>
            </div>
          </ScrollMagnet>
          
          <ScrollSpotlight>
            <div 
              style={{
                width: '200px',
                height: '200px',
                background: 'var(--sc-surface)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--sc-hairline)',
              }}
            >
              <ScrollLabel>Spotlight effect</ScrollLabel>
            </div>
          </ScrollSpotlight>
        </div>
      </ScrollWrap>
    </ScrollSection>
  );
}

function WorldFlightDemo() {
  return (
    <WorldFlight
      segments={[
        {
          label: 'Hero',
          weight: 1.5,
          linger: 0.3,
          poster: '/assets/demo-segment1-poster.jpg',
          video: '/assets/demo-segment1.mp4',
        },
        {
          label: 'Features',
          weight: 1.2,
          linger: 0.2,
          poster: '/assets/demo-segment2-poster.jpg',
          video: '/assets/demo-segment2.mp4',
        },
        {
          label: 'Stats',
          weight: 1.0,
          linger: 0.4,
          poster: '/assets/demo-segment3-poster.jpg',
          video: '/assets/demo-segment3.mp4',
        },
      ]}
      copies={[
        {
          content: (
            <>
              <ScrollLabel style={{ color: 'rgba(255,255,255,0.8)' }}>Welcome to ARS</ScrollLabel>
              <ScrollDisplay size="xl" style={{ color: '#fff', marginTop: '0.5rem' }}>
                Where research meets community
              </ScrollDisplay>
            </>
          ),
          window: 'hero',
        },
        {
          content: (
            <>
              <ScrollDisplay size="lg" style={{ color: '#fff' }}>
                Structured peer review with transparent workflows
              </ScrollDisplay>
            </>
          ),
          window: '0.3 0.55',
        },
        {
          content: (
            <>
              <ScrollLedea style={{ color: '#fff' }}>
                Join 340+ active researchers shaping Vietnamese academia
              </ScrollLedea>
            </>
          ),
          window: 'finale',
        },
      ]}
      className="sc-worldflight-demo"
      seam={0.12}
    />
  );
}

/**
 * Main Demo Page Component
 */
export interface ScrollCraftDemoProps {
  /** Theme preset */
  theme?: keyof typeof arsScrollThemes;
  /** Show worldflight demo */
  showWorldFlight?: boolean;
}

export function ScrollCraftDemo({
  theme = 'warmPaper',
  showWorldFlight = false,
}: ScrollCraftDemoProps) {
  return (
    <ScrollPage
      theme={arsScrollThemes[theme]}
      showProgress={true}
      showGrain={true}
      className="scroll-craft-demo"
    >
      <HeroSection />
      <ParallaxHero />
      <FeatureSection />
      <StatsSection />
      <RevealSection />
      <InteractiveSection />
      
      {showWorldFlight && <WorldFlightDemo />}
      
      {/* Footer */}
      <footer 
        style={{ 
          padding: '4rem 0',
          textAlign: 'center',
          borderTop: '1px solid var(--sc-hairline)',
        }}
      >
        <ScrollWrap>
          <ScrollBody style={{ margin: '0 auto' }}>
            &copy; 2026 ARS — Trusted academic platform for research, peer review, and collaboration.
          </ScrollBody>
        </ScrollWrap>
      </footer>
    </ScrollPage>
  );
}

export default ScrollCraftDemo;
