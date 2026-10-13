# Design Direction

**Status:** Interview complete. Use the confirmed direction and starting tokens below as the redesign brief. Do not reopen settled choices unless a contrast or usability issue requires a specific adjustment.

**Agreed direction:** modern, calm, and precise; dark theme; a neutral, operational palette with hunter green as the primary accent; one continuous page with strong section hierarchy. Use [Stripe](https://stripe.com) as a reference for clear information hierarchy, spacious layout, polished typography, subtle interaction detail, and color treatment. The reference is inspiration, not a request to reproduce Stripe's brand or landing page.

**Design Read:** production-planning workspace for production managers, with a calm, precise visual language; ENERGY 1 / RHYTHM 2 / MOTION 2. Rhythm stays consistent through the planning flow, with stronger emphasis on results and scenario comparison. Motion is limited to short interaction feedback and the user-requested movement to Results after calculation.

## Product and audience

Production Planner helps a business owner or production manager plan one day of juice production across three blends. A user edits recipes, ingredient supply, processing capacity, profit contribution, and order limits; calculates a feasible plan; reviews recommended quantities and resource use; saves named scenarios in the current browser; and can compare two saved scenarios. A first-time visitor should be able to try a clearly identified sample without signing in.

Design for the production manager's planning task first. Keep the sample flow quick for portfolio reviewers without making the working planner feel like a marketing page.

## Design goals

1. Make the next useful action apparent from the layout and visual treatment, without relying on explanatory copy alone.
2. Make the relationship between inputs, a calculated recommendation, and its resource constraints easy to understand at a glance.
3. Make navigation and scenario state clear: what area the user is in, which scenario is open, and whether the result still matches its inputs.
4. Give the product a deliberate, modern visual identity that feels authored for production planning rather than assembled from generic dashboard patterns.

## Information architecture and task flow

### Confirmed product tasks

- Start with an editable sample scenario.
- Set available ingredients and shared processing time.
- Edit blend recipes, contribution, minimum order, and maximum demand.
- Calculate the plan and review output quantities, contribution, and resource usage.
- Save, open, update, rename, or delete named scenarios stored in this browser.
- Compare two saved scenarios whose results are current.
- Recover from invalid inputs, infeasible minimum orders, calculation failures, and unavailable browser storage while preserving current inputs.

### Navigation direction

Navigation must expose the user's real work and provide clear active, hover, focus, and disabled states. Group related tasks so users can tell where to edit, calculate, review, and compare. Every navigation item must lead to a real destination or a clearly identified unavailable feature.

**Confirmed:** Keep the planning experience in one guided workspace with clear sections. Do not turn the core workflow into separate pages.

**Confirmed:** Use one continuous page with clearly differentiated sections rather than separate views.

**Confirmed section sequence:** Production inputs (resources, then blends) → calculate → recommendation and resource use → save/manage scenarios → compare scenarios. Keep saved-scenario management and comparison in a clear context within the workspace.

### In-page navigation

Use a compact, sticky anchor row near the top with three destinations: **Plan**, **Results**, and **Scenarios**. Highlight the destination currently in view and let each item jump to its section. This preserves the continuous page while making location and available destinations visible without imposing a locked stepper.

**Confirmed:** Plan / Results / Scenarios anchor navigation, with the active section highlighted and the compact row sticky on desktop.

**Confirmed responsive behavior:** Keep the anchor row sticky and very compact on phones. Preserve readable labels and comfortable tap targets.

**Confirmed calculation behavior:** After a successful calculation, move the user to **Results** and show the updated active section in the anchor row. Respect reduced-motion preferences.

## Interaction and affordance rules

- Use containers and spacing to show which controls and values belong together.
- Show selected and active states clearly. Provide hover and keyboard-focus feedback for interactive controls.
- Define button default, hover, pressed, keyboard-focus, disabled, and loading states. Disabled controls should appear unavailable and explain why when the reason is not otherwise clear.
- Use tooltips only to clarify a non-obvious control; do not make essential instructions hover-only.
- Inputs need clear default, focus, error, and warning states. Associate validation feedback with the affected field or group.
- Every action needs immediate feedback appropriate to its outcome: progress while calculating, confirmation after a successful save, and a useful recovery action after a failure.
- Keep current inputs usable after calculation or storage failures. Distinguish an outdated result from a current result wherever it appears.
- Distinguish an empty first-use collection, a filter with no matches, unavailable storage, and a failed operation. State the cause and the next useful action.
- Confirm destructive or replacing actions before they happen; describe what will be replaced or removed.

## Visual hierarchy and layout

- Put the main task and its most important decision near the top of each view.
- Use size, placement, weight, contrast, and purposeful color to rank primary actions, results, and supporting detail.
- Give results clear precedence over secondary explanation once a calculation completes. Make units and resource limits easy to scan beside their values.
- Use whitespace to separate groups and avoid crowding. Keep alignment consistent across related forms, blend inputs, resource values, and result tables.
- Base spacing on a 4-point scale and use values that divide cleanly in half where finer adjustments are needed.
- Use 4 px increments for spacing and component padding; use 2 px only for fine optical alignment or focus treatment.
- Use responsive layouts that preserve the relationships between labels, values, actions, and comparison columns on narrow screens.

**Confirmed top-of-page treatment:** Replace the oversized promotional slogan and decorative fruit illustration with a compact product title and the working inputs. Clearly identify the sample data in the planning area.

## Typography

- Use one sans-serif font family throughout the product.
- Use no more than six font sizes across the website. Keep dashboard type at or below 24 px, including headings.
- Use a restrained scale with clear roles for page title, section heading, body, label, helper text, and compact metadata.
- For large headings, use approximately -2% to -3% letter spacing and 110% to 120% line height.
- Preserve legibility for dense numeric inputs, units, tabular results, and validation messages.

**Confirmed:** Use Inter as the single family throughout. It is already the dominant family in the app stylesheet and is legible for dense labels, numeric values, and tables. Remove the isolated Manrope use rather than introducing a second family. Use Stripe's polished typography as a quality reference without copying its brand typography by default.

## Color and theme

- Build around one primary brand color with lighter values for subtle surfaces and darker values where text contrast is needed.
- Use semantic color consistently: blue for trust, red for danger or urgency, yellow for warning, and green for success. Pair color with text, shape, or icon cues so meaning is not color-only.
- Keep the active palette focused: a neutral foundation, the chosen primary, and only the accents required for semantic states.
- Avoid gradients as decoration. If text overlays imagery, use a directional gradient or progressive blur that keeps the image visible while making the text readable.

**Confirmed:** Use dark mode.

**Confirmed:** Hunter green is the primary brand accent. Keep ingredient colors out of the primary interface palette; the interface should read as neutral and operational.

### Starting palette

The user approved these values as the starting palette. Keep the primary hunter green darker and grounded; use its lighter counterpart for readable emphasis and the success role. Adjust only if implementation contrast checks show a need, preserving the agreed color character.

| Role | Starting value | Intended use |
| --- | --- | --- |
| Warm charcoal canvas | `#191815` | Main page background |
| Warm charcoal surface | `#22211D` | Input groups and panels |
| Raised surface | `#2D2B25` | Menus, selected rows, and overlays |
| Border | `#48453C` | Quiet separation; increase contrast on focus |
| Primary text | `#F2F0E8` | Headings and essential values |
| Secondary text | `#B8B4A8` | Labels and supporting content |
| Hunter green | `#426348` | Main brand action and selected navigation |
| Clear green | `#A9C99D` | Success, positive result, and accessible green emphasis |
| Trust blue | `#8CB6D2` | Informational or trust-related state |
| Warning amber | `#E0BD76` | Warnings and constraints needing attention |
| Danger red | `#E58D82` | Errors, urgency, and destructive actions |

**Confirmed:** The warm-charcoal and hunter-green values are approved as a starting direction.

## Surfaces, depth, and shape

- Keep most content grounded on clear page surfaces. Use elevation only when it helps distinguish a floating menu, dialog, or other layer.
- In dark mode, create depth with slightly lighter card surfaces and subdued borders; avoid overly bright saturation.
- Establish a small, consistent radius scale. Use shape to distinguish controls, cards, and overlays rather than rounding every element identically.
- Do not use blur, glow, or shadow as a page-wide treatment.

## Controls and iconography

- Size icons to align with adjacent text line height; a 24 px icon is a useful reference beside 24 px text.
- Use recognizable, task-relevant icons. Do not add an icon when it would repeat a clear label or introduce ambiguity.
- Give standalone buttons balanced padding; use the user's proportional guideline of width around twice the control height as a starting reference, then check actual label fit and touch usability.
- Keep primary actions visually distinct from secondary and destructive actions. Destructive actions use the danger semantic and a confirmation step where loss is possible.

## Data display and decision support

- State the decision a result or comparison helps the user make; avoid charts or summary metrics that do not answer a practical question.
- Keep quantities paired with units. Make available, required, used, and remaining resources visually distinguishable.
- Label calculated recommendations as based on the entered data and assumptions. Do not imply guaranteed business profit; the model reports profit contribution.
- Show real calculations and real saved-scenario data only. Identify sample values as fictional. Do not fabricate activity, metrics, dates, or customer details.
- Infeasibility should show the limiting resource, amount required, amount available, and shortfall. Do not show an optimal plan for an infeasible scenario.
- Comparison must clearly identify Scenario A and Scenario B and label the direction of each difference.

## Motion and feedback

- Use short transitions to reinforce a user-triggered change, such as opening a menu, updating a result, or showing confirmation.
- Motion must communicate state or guide attention; avoid decorative loops, perpetual pulses, and motion on every element.
- Respect reduced-motion preferences.

## Accessibility and responsive behavior

- Preserve visible keyboard focus and logical keyboard navigation across the entire planning flow.
- Do not rely on color alone to communicate status, validity, or selection.
- Keep labels, units, errors, and descriptions programmatically associated with their controls.
- Ensure charts and comparisons have readable textual equivalents and remain usable at narrow widths.
- Maintain readable contrast and touch targets across themes and states.

## Explicitly avoid

- Generic dashboard filler such as decorative metrics, charts without a decision question, or activity feeds without real events.
- Decorative gradients, glows, background grids, floating dots, badges, or iconography with no product meaning.
- Repeating identical cards or sections where that repetition hides meaningful differences in task priority.
- Navigation links without a real destination, and controls without real behavior.
- Placeholder empty, loading, error, or infeasible states that omit what happened and what the user can do next.
- An oversized promotional slogan or decorative fruit illustration above the working planner; begin with a compact product title and the actual inputs.

## Implementation note

The interview decisions are settled. The hex values are approved starting tokens and may be tuned only to preserve contrast and legibility while keeping the agreed warm-charcoal and hunter-green character.
