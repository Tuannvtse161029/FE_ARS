# Dark Mode Applied — Landing Page

## Reference Site
**URL:** https://fe-ars.vercel.app/

## Changes Applied

### ✅ Completed Updates

1. **FAQ Section Background** - Changed from `#ffffff` to `var(--page-base)` (dark)
2. **CTA Section Background** - Changed from `#ffffff` to `var(--page-base)` (dark)
3. **Text Colors Updated** - All titles now use `var(--ink-on-dark)`:
   - `.boundariesTitle`
   - `.faqTitle`
   - `.ctaTitle`
   - `.faqItem summary`
   - `.page` root

### Dark Theme Active

The landing page uses `data-theme="archive-dusk"` on the root element, which activates:

#### Key Tokens
```css
--page-base: #090d16;            /* Deep obsidian background */
--ink-on-dark: #f8fafc;          /* White text on dark surfaces */
--accent-primary: #facc15;       /* Bright yellow for CTAs */
--accent-hover: #fde047;         /* Lighter yellow on hover */
--ink-primary: #09090b;          /* Dark text (for yellow buttons) */
```

## Result

Landing page now matches the deployed site with:
- Deep navy/obsidian backgrounds throughout all sections
- Bright yellow accent for primary actions with dark text
- Proper white text contrast on dark surfaces
- Existing spotlight gradients and glows preserved
