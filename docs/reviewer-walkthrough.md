# Production Planner — short reviewer walkthrough

Use the [Production planner](https://production-planner-web-tan.vercel.app). The sample is fictional. No account is required. This walkthrough demonstrates a calculation, an edit, explicit saving, and a comparison; it should take under two minutes for a first-time visitor.

## Calculate and save the sample

1. The dashboard opens with the sample inputs already filled in. Select **Optimize**.
2. Review the production quantities, contribution, ingredient use, processing use, and the assumptions. The recorded baseline contribution is about **AUD 219.33**.
3. Save the current scenario with a name such as **Baseline**.

## Change one input and compare

4. Change orange availability from **40 L** to **35 L**, then select **Optimize** again. The recorded contribution is about **AUD 217.04**.
5. Save this result as **Less orange**.
6. In the comparison controls, choose **Baseline** as A and **Less orange** as B. Read the displayed B-minus-A differences. The recorded changes include **−5 L** orange availability and about **−AUD 2.29** contribution.
7. Reload the page and reopen the saved scenarios to see that the collection and comparison remain available in this browser.

## What the result means

The optimizer returns the best contribution for the entered recipes, capacities, minimum orders, maximum demand, and stated model assumptions. Contribution is not a forecast of guaranteed business profit. The sample data are fictional; do not enter confidential production data.

Saved scenarios are stored in this browser's local storage for this website origin. They do not sync to another browser or device and are not backed up on a server. The Production endpoint currently has no custom Vercel rate-limit rule under the Hobby plan; this is an owner-accepted limitation documented in the [acceptance matrix](phase71-acceptance.md).

For test coverage, deployment identities, security limits, and the full list of verified limitations, see the [acceptance matrix](phase71-acceptance.md), [Phase 5.3 evidence](phase53-evidence.md), and [Phase 6.2 evidence](phase62-evidence.md).
