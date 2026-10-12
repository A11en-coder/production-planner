Production Planner

Product Requirements Document

Build a public web application that recommends daily production quantities for three juice blends. Users enter recipes, profitability, available resources, and order limits; the app returns an optimal feasible plan and lets them compare saved scenarios.

| **Document property**    | **Value**                                          |
| ------------------------ | -------------------------------------------------- |
| Version                  | 1.0                                                |
| Created and last updated | 11 October 2026                                    |
| Product owner            | Allen                                              |
| Status                   | First draft for review                             |
| Product phase            | MVP planning                                       |
| Development budget       | 12 weeks at 15 hours per week, totalling 180 hours |

# 1 Overview and background

A small juice producer supplies cafes with fixed-recipe blends made from orange, apple, and pineapple juice. The blends compete for ingredients and processing time. Choosing the highest-profit product alone can overlook how efficiently each product uses a limited resource.

Production Planner evaluates the products together. It maximizes daily profit contribution while satisfying ingredient availability, processing capacity, minimum order quantities, and maximum demand. Profit contribution means selling price minus variable production cost; unchanged fixed costs are outside this calculation.

The primary project objective is to apply linear optimization in a finished software portfolio project. The juice producer is the demonstration business context. Commercial adoption, customer demand, and realised business savings are not release success measures.

## Stakeholders

Allen owns and develops the project. The business owner or production manager is the intended domain user. A portfolio reviewer is the primary demonstration visitor and should be able to try the core workflow immediately.

## Change history

Version 1.0, 11 October 2026: initial PRD defining the confirmed MVP, acceptance targets, model assumptions, and decisions reserved for technical planning.

# 2 Goals and success metrics

Complete an end-to-end public demonstration within the 12-week development budget. Success is assessed through working behaviour, mathematical correctness, and reviewable engineering evidence.

| **Goal**           | **Target**                               | **Verification**                                                                                               |
| ------------------ | ---------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Calculation speed  | Results within 5 seconds                 | Measure from Optimize click until complete results render on the deployed app under normal network conditions. |
| Reviewer usability | Core demonstration within 2 minutes      | Time a first-time walkthrough: calculate sample, edit a resource, save both scenarios, and compare.            |
| Model correctness  | Pass known-solution and constraint tests | Check objective values and resource/order constraints using the numerical policy defined in the TRD.           |
| Complete workflow  | All P0 requirements pass                 | Verify editing, calculation, saving, reopening, management, comparison, and exception handling.                |
| Public delivery    | Working app and public repository        | Check deployed frontend/backend and repository setup, model explanation, limitations, and test instructions.   |
| Development budget | 12 weeks and 180 planned hours           | Track work against the budget; confirm a calendar start date before scheduling.                                |

The TRD will define the performance test environment, treatment of cold starts, numerical tolerances, and usability evaluation procedure. The 5-second and 2-minute targets remain the agreed product targets.

# 3 Target audience

## Business owner or production manager

Needs to decide daily quantities across several products using shared ingredients and equipment. Wants a feasible plan, a clear explanation of resource usage, and a way to explore whether changing available resources improves the result.

## Portfolio reviewer

Needs to understand the problem and try the solution without registration or setup. Wants meaningful sample data, visible outputs, clear limitations, and a repository that explains how the application works.

## Developer learning objectives

Apply mathematical modelling, build and validate a Python optimization API, connect it to a responsive frontend, handle failures, test the complete workflow, and deploy an application that others can use.

# 4 User stories and use cases

| **ID** | **User story**                                                                                     |
| ------ | -------------------------------------------------------------------------------------------------- |
| US01   | As a reviewer, I can open a sample scenario and calculate a plan without signing in.               |
| US02   | As a planner, I can change recipes, profitability, resources, and order limits before calculating. |
| US03   | As a planner, I can see recommended quantities, profit contribution, and resource use.             |
| US04   | As a planner, I can save named scenarios and reopen or manage them in the same browser.            |
| US05   | As a planner, I can compare two saved scenarios to understand input and result differences.        |
| US06   | As a planner, I can identify shortages when minimum orders cannot be fulfilled.                    |

## Primary demonstration flow

1. Open the public dashboard. Sample inputs and a brief introduction are available immediately.
2. Select Optimize. Review the recommended litres, profit contribution, and resource usage.
3. Save the baseline scenario under a name.
4. Change one resource limit. The previous result becomes outdated until recalculation.
5. Recalculate and save the modified scenario under a second name.
6. Select both saved scenarios and compare their inputs and current results.

## Returning visitor flow

Open saved scenarios from the same browser, select a named scenario, and view its stored inputs and calculated result. Edit and recalculate as needed, then explicitly update the saved scenario. Renaming and deleting are also available.

## Alternative and exception flows

- Invalid inputs: identify the affected fields and request correction before calculation.
- Impossible minimum orders: show the resources required, resources available, and shortages.
- Outdated results: label them and require recalculation before comparison.
- API or solver failure: preserve inputs, explain that calculation failed, and allow retry.
- Saving failure: keep current work usable during the visit, state that it was not saved, and allow retry.

# 5 Functional requirements

P0 means required for the MVP release. All requirements below are P0 unless explicitly identified otherwise. The first version plans one day for three blends: orange-apple uses orange and apple juice, apple-pineapple uses apple and pineapple juice, and tropical uses all three ingredients.

## Production inputs and model rules

| **Input**                         | **Unit**          | **Rule**                                                                                                      |
| --------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Recipe proportions for each blend | Percentage        | Editable proportions of the blend ingredients listed above; nonnegative shares totalling 100% for each blend. |
| Profit contribution per blend     | AUD per litre     | Entered directly; positive, zero, and negative values are allowed.                                            |
| Processing requirement per blend  | Minutes per litre | Nonnegative processing time per litre.                                                                        |
| Available juice ingredients       | Litres            | Separate nonnegative limits for orange, apple, and pineapple juice.                                           |
| Available processing time         | Hours             | Nonnegative shared capacity, converted to minutes for calculation.                                            |
| Minimum quantity per blend        | Litres            | Nonnegative; defaults to zero.                                                                                |
| Maximum demand per blend          | Litres            | Finite, nonnegative upper limit; must be at least the minimum quantity.                                       |

## FR01 Open the public sample planner

Open directly into a dark-themed dashboard with sample inputs already loaded, a short explanation, and an Optimize action. No account or separate landing page is required.

**Acceptance:** A new visitor can calculate immediately. Sample values are clearly labelled fictional and produce a feasible plan. Opening the sample does not delete saved scenarios.

## FR02 Edit a production scenario

Allow users to edit the input fields above for the orange-apple, apple-pineapple, and tropical blends. Recipes remain fixed during each calculation and can change between calculations.

**Acceptance:** Edited inputs are used in the next calculation. Existing results are visibly outdated after a model input changes. Recipe values are converted consistently from percentages to ingredient litres per output litre.

Model assumptions: one litre of input ingredients produces one litre of finished juice; there is no production waste. Quantities are continuous and may be fractional. Profit contribution and processing requirements remain constant per litre. Production up to the entered maximum demand is assumed saleable.

# 5 Functional requirements continued

## FR03 Validate production inputs

Validate numeric completeness, finite values, nonnegative resource/time/quantity values, recipe totals, and minimum-versus-maximum consistency. Profit contribution is the exception to the nonnegative rule.

**Acceptance:** Invalid inputs identify the affected fields and cannot produce a successful plan. The backend independently validates the submitted model. Recipe-total tolerances and numeric limits are defined in the TRD.

## FR04 Calculate an optimal feasible plan

Send the validated scenario to the Python backend. Choose litres of each blend to maximize the sum of profit contribution per litre multiplied by production quantity. Keep ingredient use within available litres, total processing time within available minutes, and each quantity within its minimum and maximum.

**Acceptance:** Known-solution tests pass and returned plans satisfy all constraints within the TRD numerical tolerance. Only a successful optimal result is presented as optimal. A feasible zero-production plan is a valid result. Where multiple optimal plans exist, any valid optimum is acceptable.

## FR05 Present the production recommendation

Show litres per blend, total profit contribution in AUD, ingredient use and remaining litres, and processing time used and remaining. Include exact-value tables and simple charts for production quantities and resource utilization.

**Acceptance:** Tables and charts agree with the same calculation. Units remain visible. Fully used resources and reached demand limits are identified; the app does not claim that increasing a fully used resource must improve profit.

## FR06 Explain result meaning and limitations

Explain that the plan is optimal under the entered data and assumptions. Negative profit contributions remain allowed, and minimum orders may force production with a negative total contribution.

**Acceptance:** Zero or negative contribution is displayed without treating it as a calculation failure. Assumptions are accessible from the dashboard. Results are labelled profit contribution rather than guaranteed business profit.

## Numerical presentation

Calculation precision and display precision are separate. Display rounding must not conceal a resource or order violation. The TRD will define solver tolerances, recipe-total tolerance, rounding rules, and near-zero handling; these values are not prescribed in this PRD.

# 5 Functional requirements continued

## FR07 Save and reopen named scenarios

Users explicitly save a named scenario in browser storage. Save its inputs and calculated result when available. Reopening a saved successful scenario shows the stored result immediately.

**Acceptance:** A saved scenario can be reopened after refreshing or revisiting in the same browser while its stored data remains available. The app confirms success only after the save succeeds. Saving the current work must not imply an automatic update of another saved scenario.

## FR08 Manage saved scenarios

Provide rename, update, and delete actions for saved scenarios. Updating records the current scenario state; users can save a separate named scenario for comparison.

**Acceptance:** Changes are reflected in the saved list and survive reopening. Editing a scenario does not silently update its stored entry. The TRD will resolve naming rules, capacity limits, and treatment of scenarios saved before a successful calculation.

## FR09 Track whether results match inputs

Mark a result outdated whenever its model inputs change. Keep that distinction visible on the dashboard and in saved scenarios. Recalculation with the current inputs is required to restore a current result.

**Acceptance:** An old result is never presented as the result of changed inputs. Renaming alone does not invalidate a result. Failed recalculation does not make an old result current.

## FR10 Compare any two saved scenarios

Let users select two distinct saved scenarios and view their input values, recommended quantities, total profit contribution, and resource use side by side, with differences.

**Acceptance:** Both scenarios must have successful results matching their current inputs. Missing or outdated results require calculation first. Differences have a clear direction and units. Tables and charts remain readable on mobile.

## FR11 Continue when saving is unavailable

If browser storage is unavailable or saving fails, keep the current planning workflow usable during the visit. Explain that the work has not been saved and provide a retry action.

**Acceptance:** Users can continue editing and calculating without a successful persistent save. The app does not promise that unsaved work will survive refresh, closing the page, or a browser crash.

Browser saving applies to the same browser and website origin. Account-based saving, cross-device access, and cloud backup are outside the MVP. Clearing browser data can remove saved scenarios.

# 5 Functional requirements continued

## FR12 Explain infeasible minimum orders

When valid minimum quantities exceed resource capacity, show which ingredients or processing time are short, the amount required by the minimum orders, the amount available, and the shortfall.

**Acceptance:** Every violated resource is identified with consistent units. No optimal plan or profit figure is shown for the infeasible current scenario. Users can edit inputs and calculate again; requirements are not silently relaxed.

Because all ingredient and time coefficients are nonnegative, minimum quantities provide a direct shortage check in this model. A minimum greater than its maximum is an input validation error. A valid scenario whose minimum resource use exceeds capacity is an infeasibility result.

## FR13 Handle calculation failures

Show calculation progress and distinguish an infeasible model from an unavailable backend, solver failure, or unsuccessful calculation. Preserve entered values so the user can retry.

**Acceptance:** No failed or non-optimal calculation is labelled optimal. Existing saved scenarios remain intact. Technical errors are translated into a useful user message rather than a raw traceback.

## FR14 Support responsive interaction

Support the complete editing, calculation, saving, management, and comparison workflow on desktop and mobile. Use a dark appearance and a single dashboard for inputs and results.

**Acceptance:** Core controls and values are usable at the target viewports agreed in the TRD. Comparisons may reflow or use an accessible scrollable layout; no essential value or action is hidden.

## Priority and scope boundaries

All FR01 through FR14 are P0 because they implement the agreed demonstration. No additional P1 or P2 feature is committed for this release. Enhancements must be evaluated against the 180-hour budget before being added.

The MVP covers three blends, three ingredients, one processing resource, and one day. Adding arbitrary products/resources, multiple planning days, integer bottle counts, production losses, inventory carryover, recipe selection by the optimizer, and uncertainty modelling is outside that model.

Accounts, team collaboration, enterprise integrations, purchasing workflows, and cloud scenario storage are outside the agreed product scope. Additional exports or reporting features require a separate scope decision.

# 6 Non functional requirements

## Performance and usability

NFR01: On the deployed application, a valid calculation must display complete results within 5 seconds under normal network conditions. The interval runs from the user selecting Optimize to the tables and charts being rendered. Show visible progress while calculation is pending.

NFR02: A first-time reviewer must be able to complete the sample calculation, modify a resource, save the two scenarios, and compare them within 2 minutes. Provide clear labels, sensible sample inputs, and concise instructions. Record the validation method and outcomes before release.

## Mathematical correctness and reliability

NFR03: Preserve units throughout the calculation, including hours-to-minutes conversion and percentages-to-ingredient-use conversion. Verify objective values, minimum/maximum quantities, and resource totals using the TRD numerical policy. Do not interpret display rounding as calculation precision.

NFR04: A failed calculation or save must preserve usable current inputs. A response must correspond to the inputs that produced it; if inputs change while a calculation is pending, its eventual result must not be presented as current for the edited scenario.

## Security and data handling

NFR05: Validate API inputs independently of the frontend. Use secure transport for the public deployment, keep operational secrets out of browser code and the public repository, and avoid exposing internal error traces. Public-endpoint protection and request limits are TRD decisions.

NFR06: Keep saved scenarios in the browser, with no requirement for backend scenario persistence. Explain the local scope of saving. The calculation API necessarily receives the submitted inputs; request logging, retention, and hosting-provider behaviour must be addressed in technical planning.

## Accessibility and responsive presentation

NFR07: Provide labelled inputs, keyboard-operable actions, visible focus, readable dark-theme contrast, and errors that identify their fields. Charts must have equivalent tabular values, and status must not rely on colour alone. Exact accessibility checks and browser/viewport coverage are defined in the TRD.

## Maintainability and deployment

NFR08: Separate interface behaviour from model construction and solver execution. Supply reproducible setup instructions, model tests, and an end-to-end verification procedure. Specific tools remain open.

NFR09: The deployed app and backend must be publicly usable for the demonstration. No concurrent-user, availability percentage, or commercial-scale capacity target has been agreed; hosting selection and practical operating limits belong in the TRD.

# 7 Constraints and dependencies

## Confirmed delivery constraints

- A single-developer portfolio project with a budget of 12 weeks at 15 hours per week.
- A browser-based frontend connected to a Python optimization backend; exact frameworks, solver, storage implementation, and hosting are reserved for the TRD.
- Public access without sign-in. Named scenarios are stored in the same browser.
- A deterministic continuous linear model with editable fixed recipes and no production waste.
- Fictional sample values and AUD display units. Commercial validation is not required for the demonstration.

## External dependencies

The project depends on a suitable optimization solver, frontend/backend hosting, and browser storage. Package selection, licensing checks, API contract, deployment configuration, timeouts, and operational safeguards will be specified in the TRD. Hosting cost limits have not yet been agreed.

## Proposed sequencing within the approved budget

The following sequence is planning guidance, not a separately approved calendar schedule. Confirm it alongside the TRD and project start date.

| **Period**     | **Focus**                                     | **Completion evidence**                                         |
| -------------- | --------------------------------------------- | --------------------------------------------------------------- |
| Weeks 1 to 2   | Technical design and model prototype          | TRD decisions and a tested solver prototype.                    |
| Weeks 3 to 5   | Inputs, API, and calculations                 | Validated end-to-end calculation and infeasibility explanation. |
| Weeks 6 to 8   | Results and saved scenarios                   | Charts, local management, freshness tracking, and comparison.   |
| Weeks 9 to 10  | Deployment and responsive verification        | Public deployment with desktop/mobile and failure-flow checks.  |
| Weeks 11 to 12 | Acceptance checks and portfolio documentation | Performance evidence, tests, README, and final fixes.           |

## Release completion checklist

- All P0 functional requirements and agreed acceptance targets are verified.
- The public app, optimization backend, and public GitHub repository are available.
- The README explains the problem, setup, model, assumptions, limitations, and testing.
- Tests cover known solutions, constraint satisfaction, invalid inputs, and infeasible minimum orders.
- Saving, reopening, management, freshness, comparison, and failure handling work on the deployed app.

# 8 Risks and open decisions

The product scope is ready for technical planning. The decisions below are deliberately open and must not be treated as confirmed implementation requirements.

| **Risk**                                                 | **Response or decision needed**                                                                                                   |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Simplified model is mistaken for a commercial forecast   | Explain fixed recipes, constant contribution/time, deterministic demand caps, and no waste. Label sample data fictional.          |
| Hosting startup or network delay misses the speed target | Choose hosting and benchmark the deployed workflow early. Define normal network conditions and cold-start measurement in the TRD. |
| Saved scenarios are lost or become incompatible          | Define storage schema/version handling and errors. Explain that browser clearing or a different origin/browser can remove access. |
| Old or rounded results appear valid for changed inputs   | Track input/result correspondence and define display precision, tolerance, and response freshness rules.                          |
| Public API is used beyond the demonstration scope        | Choose payload limits and operational protections in the TRD, appropriate to the project budget.                                  |
| Scope expands beyond the 180-hour budget                 | Keep the fixed model and P0 workflow; assess additions explicitly before implementation.                                          |

## Decisions for the TRD

- Frontend/backend frameworks, solver, charting tools, storage mechanism, API contract, and hosting.
- Solver/recipe tolerances, accepted input ranges, decimal display rules, and zero-capacity utilization display.
- Saved-scenario naming rules, storage capacity, invalid/corrupt data handling, and saving inputs without a successful result.
- Sample recipe values and a scenario change that demonstrates a meaningful comparison within the confirmed blend ingredient sets.
- Performance and first-time usability test procedure; target browsers/viewports and accessibility verification.
- API protection, request logging/retention, timeouts, and handling incompatible saved results after model changes.

## Delivery decisions still to confirm

Set the calendar start date, hosting cost budget, and repository details before implementation scheduling. Review and approve this PRD before creating the TRD. The requirements describe the intended product and acceptance criteria; successful tests and portfolio learning evidence will be recorded during implementation.